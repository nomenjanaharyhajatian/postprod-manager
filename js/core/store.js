/**
 * store.js — État en mémoire de l'application, synchronisé avec IndexedDB.
 * Toute modification passe par Store.save() qui :
 *   1) Horodate et attribue la donnée (createdBy/At, updatedBy/At)
 *   2) Écrit immédiatement en IndexedDB (aucune perte possible)
 *   3) Met à jour le cache mémoire
 *   4) Notifie les abonnés (re-render UI) et marque l'état "modifié"
 *      (utilisé par backup.js pour l'historique périodique).
 */
(function (App) {
    'use strict';
  
    const { DB, Utils } = App;
  
    // État global en mémoire (Single Source of Truth)
    const state = {
      projects: [], seasons: [], episodes: [], scenes: [], disks: [], rushes: [],
      users: [], roles: {}, tasks: [],
      settings: null,
      ready: false
    };
  
    // Ensemble des fonctions de rappel pour mettre à jour l'interface (Pattern Observer)
    const listeners = new Set();
    // Indique si des données ont été modifiées depuis le dernier instantané d'historique
    let dirty = false;
  
    const Store = { state };
  
    /**
     * Abonne une fonction aux changements d'état.
     * @param {Function} fn - Fonction à exécuter lors d'un changement.
     * @returns {Function} Fonction pour se désabonner.
     */
    Store.subscribe = function (fn) { 
      listeners.add(fn); 
      return () => listeners.delete(fn); 
    };
  
    /** Notifie tous les abonnés que l'état a changé. */
    Store.notify = function () { 
      listeners.forEach((fn) => fn(state)); 
    };
  
    Store.isDirty = function () { return dirty; };
    Store.clearDirty = function () { dirty = false; };
  
    /**
     * Initialise l'application en chargeant TOUTES les données depuis IndexedDB.
     * Note : Pour de très gros projets, cela peut consommer de la RAM.
     */
    Store.init = async function () {
      // Promise.all équivaut à asyncio.gather() en Python : exécution parallèle
      const [projects, seasons, episodes, scenes, disks, rushes, settings, users, rolesArr, tasks] = await Promise.all([
        DB.getAll('projects'), DB.getAll('seasons'), DB.getAll('episodes'),
        DB.getAll('scenes'), DB.getAll('disks'), DB.getAll('rushes'), 
        DB.get('settings', 'app'),
        DB.getAll('users'), DB.getAll('roles'), DB.getAll('tasks')
      ]);
  
      Object.assign(state, { projects, seasons, episodes, scenes, disks, rushes, users, tasks });
      state.settings = settings || App.Backup.defaultSettings();
  
      // Initialisation des rôles par défaut si la table est vide
      if (rolesArr.length) {
        state.roles = rolesArr.reduce((acc, r) => { acc[r.id] = r; return acc; }, {});
      } else {
        state.roles = App.Perm.defaultRoles();
        await DB.bulkPut('roles', Object.values(state.roles));
      }
  
      state.ready = true;
      Store.notify();
    };
  
    /**
     * Récupère le nom de l'utilisateur actuellement connecté.
     * @returns {string} Nom de l'utilisateur ou 'Inconnu'.
     */
    function currentUser() {
      const id = state.settings && state.settings.currentUserId;
      const u = state.users.find((x) => x.id === id);
      if (u) return u.name;
      return (state.settings && state.settings.currentUser) || 'Inconnu';
    }
  
    /**
     * Enregistre une entité (création ou mise à jour) dans un store donné.
     * @param {string} storeName - Nom de la table (ex: 'scenes').
     * @param {Object} obj - L'objet à sauvegarder.
     * @returns {Promise<Object>} L'objet sauvegardé avec son ID et ses métadonnées.
     */
    Store.save = async function (storeName, obj) {
      const now = Utils.nowISO();
      const isNew = !obj.id;
      
      if (isNew) {
        obj.id = Utils.uuid();
        obj.createdBy = currentUser();
        obj.createdAt = now;
      }
      obj.updatedBy = currentUser();
      obj.updatedAt = now;
  
      // 1. Sauvegarde en base de données
      await DB.put(storeName, obj);
  
      // 2. Mise à jour du cache mémoire
      const list = state[storeName];
      const idx = list.findIndex((x) => x.id === obj.id);
      
      // CORRECTION CRITIQUE : Utilisation d'une copie profonde (deep copy) 
      // pour figer l'état AVANT modification. Object.assign ne fait qu'une copie 
      // superficielle, ce qui fausserait l'historique des modifications (diff) 
      // si l'objet contient des tableaux ou des objets imbriqués.
      const previous = idx >= 0 ? JSON.parse(JSON.stringify(list[idx])) : null;
      
      if (idx >= 0) {
        list[idx] = obj;
      } else {
        list.push(obj);
      }
  
      // 3. Marquage et notification
      dirty = true;
      Store.notify();
      
      // 4. Journalisation de l'historique (si le module est chargé)
      if (App.History) {
        await App.History.log(storeName, previous, obj);
      }
      
      return obj;
    };
  
    /**
     * Supprime une entité de la base de données et de la mémoire.
     * @param {string} storeName - Nom de la table.
     * @param {string} id - ID de l'entité à supprimer.
     */
    Store.remove = async function (storeName, id) {
      const previous = state[storeName].find((x) => x.id === id) || null;
      
      await DB.delete(storeName, id);
      
      // Filtre le tableau pour retirer l'élément supprimé
      state[storeName] = state[storeName].filter((x) => x.id !== id);
      
      dirty = true;
      Store.notify();
      
      if (App.History && previous) {
        await App.History.log(storeName, previous, null);
      }
    };
  
    /**
     * Met à jour les paramètres globaux de l'application.
     * @param {Object} patch - Objet contenant les nouvelles valeurs.
     */
    Store.saveSettings = async function (patch) {
      state.settings = Object.assign({}, state.settings, patch, { id: 'app' });
      await DB.put('settings', state.settings);
      dirty = true;
      Store.notify();
      return state.settings;
    };
  
    /**
     * Enregistre la définition de droits d'un rôle (admin uniquement).
     * @param {Object} roleDef - Définition du rôle.
     */
    Store.saveRole = async function (roleDef) {
      await DB.put('roles', roleDef);
      state.roles = Object.assign({}, state.roles, { [roleDef.id]: roleDef });
      dirty = true;
      Store.notify();
      return roleDef;
    };
  
    /**
     * Supprime un rôle et réaffecte les utilisateurs de ce rôle à un rôle de secours.
     * @param {string} roleId - ID du rôle à supprimer.
     * @param {string} fallbackRoleId - ID du rôle de remplacement.
     * @returns {Promise<Object>} Statut de la réaffectation.
     */
    Store.removeRole = async function (roleId, fallbackRoleId) {
      const affected = state.users.filter((u) => u.role === roleId);
      
      // L'await dans la boucle est volontaire ici pour garantir que les 
      // mises à jour des utilisateurs sont traitées séquentiellement, 
      // évitant les conditions de course sur le tableau state.users.
      for (const u of affected) {
        // eslint-disable-next-line no-await-in-loop
        await Store.save('users', Object.assign({}, u, { role: fallbackRoleId }));
      }
      
      await DB.delete('roles', roleId);
      
      const next = Object.assign({}, state.roles);
      delete next[roleId];
      state.roles = next;
      
      dirty = true;
      Store.notify();
      
      return { reassignedCount: affected.length };
    };
  
    /* ---- Accesseurs relationnels (équivalent des requêtes JOIN filtrées) ---- */
  
    Store.getProject = (id) => state.projects.find((p) => p.id === id);
    
    Store.seasonsOf = (projectId) => state.seasons
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.numero - b.numero);
      
    Store.episodesOf = (projectId, seasonId) => state.episodes
      .filter((e) => e.projectId === projectId && (seasonId ? e.seasonId === seasonId : true))
      .sort((a, b) => a.numero - b.numero);
      
    Store.scenesOf = (projectId, episodeId) => state.scenes
      .filter((s) => s.projectId === projectId && (episodeId !== undefined ? s.episodeId === episodeId : true))
      .sort((a, b) => (a.numero || 0) - (b.numero || 0));
      
    Store.rushesOf = (projectId) => state.rushes
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => (a.dateTournage || '').localeCompare(b.dateTournage || ''));
  
    Store.currentProject = () => Store.getProject(state.settings && state.settings.currentProjectId);
  
    // Exposition de l'objet Store dans l'espace de nom global App
    App.Store = Store;
  
  })(window.App = window.App || {});