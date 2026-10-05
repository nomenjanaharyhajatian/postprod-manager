/**
 * db.js — Accès à IndexedDB, moteur de stockage principal de l'application.
 * (Choix validé : IndexedDB plutôt que LocalStorage, pour supporter de gros
 * volumes de scènes/rushs sans la limite de ~5-10 Mo du LocalStorage).
 *
 * Schéma : un store (table) par entité métier + stores techniques.
 * Tous les stores utilisent la propriété 'id' (uuid) comme clé primaire.
 */
(function (App) {
    'use strict';
  
    const DB_NAME = 'postprod-db';
    const DB_VERSION = 4;
  
    /**
     * Définition du schéma de la base de données.
     * Chaque clé est un nom de "table" (Object Store).
     * 'indexes' liste les champs sur lesquels des index de recherche sont créés.
     */
    const STORES = {
      projects: { indexes: [] },
      seasons: { indexes: ['projectId'] },
      episodes: { indexes: ['projectId', 'seasonId'] },
      scenes: { indexes: ['projectId', 'episodeId', 'statut', 'dateTournage'] },
      disks: { indexes: [] },
      rushes: { indexes: ['projectId', 'dateTournage', 'diskSourceId'] },
      settings: { indexes: [] },
      history: { indexes: ['timestamp'] },
      changeLog: { indexes: ['timestamp', 'projectId', 'entityId'] },
      importLog: { indexes: ['timestamp'] },
      users: { indexes: ['role'] },
      roles: { indexes: [] },
      tasks: { indexes: ['userId'] }
    };
  
    // Variable pour stocker la promesse d'ouverture (pattern Singleton)
    let dbPromise = null;
  
    /**
     * Ouvre la base de données IndexedDB ou retourne la promesse existante.
     * Gère la création des tables (stores) si la version a changé.
     * @returns {Promise<IDBDatabase>} La connexion à la base de données.
     */
    function openDB() {
      if (dbPromise) return dbPromise;
  
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
  
        // Se déclenche uniquement si la base n'existe pas ou si DB_VERSION est incrémentée
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          Object.entries(STORES).forEach(([name, cfg]) => {
            // Crée la table si elle n'existe pas déjà
            if (!db.objectStoreNames.contains(name)) {
              const store = db.createObjectStore(name, { keyPath: 'id' });
              // Crée les index secondaires pour accélérer les recherches
              cfg.indexes.forEach((idx) => {
                store.createIndex(idx, idx, { unique: false });
              });
            }
          });
        };
  
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });
  
      return dbPromise;
    }
  
    /**
     * Helper pour obtenir un objet store dans une transaction.
     * @param {string} storeName - Nom de la table.
     * @param {string} mode - 'readonly' ou 'readwrite'.
     * @returns {Promise<IDBObjectStore>} L'objet store prêt à être utilisé.
     */
    function tx(storeName, mode) {
      return openDB().then((db) => {
        return db.transaction(storeName, mode).objectStore(storeName);
      });
    }
  
    const DB = {};
  
    /**
     * Récupère tous les enregistrements d'une table.
     * @param {string} storeName - Nom de la table.
     * @returns {Promise<Array>} Liste des objets.
     */
    DB.getAll = async function (storeName) {
      const store = await tx(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    };
  
    /**
     * Récupère un enregistrement unique par sa clé primaire (id).
     * @param {string} storeName - Nom de la table.
     * @param {string} id - Clé primaire de l'objet.
     * @returns {Promise<Object|null>} L'objet trouvé ou null.
     */
    DB.get = async function (storeName, id) {
      const store = await tx(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    };
  
    /**
     * Insère ou met à jour un objet dans la table (Upsert).
     * @param {string} storeName - Nom de la table.
     * @param {Object} obj - L'objet à sauvegarder (doit contenir une propriété 'id').
     * @returns {Promise<Object>} L'objet sauvegardé.
     */
    DB.put = async function (storeName, obj) {
      const store = await tx(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(obj);
        req.onsuccess = () => resolve(obj);
        req.onerror = () => reject(req.error);
      });
    };
  
    /**
     * Insère ou met à jour plusieurs objets en une seule transaction.
     * CORRECTION : Utilisation d'une boucle for...of avec await pour une 
     * gestion des erreurs plus sûre et plus lisible que le compteur précédent.
     * @param {string} storeName - Nom de la table.
     * @param {Array<Object>} objects - Liste des objets à sauvegarder.
     * @returns {Promise<void>}
     */
    DB.bulkPut = async function (storeName, objects) {
      if (!objects || objects.length === 0) return;
      
      const store = await tx(storeName, 'readwrite');
      
      // Nous retournons une nouvelle Promise pour englober toute la boucle
      return new Promise((resolve, reject) => {
        // Utilisation d'une fonction asynchrone immédiate pour pouvoir utiliser await dans la boucle
        (async () => {
          try {
            for (const obj of objects) {
              // Chaque put est ajouté à la même transaction 'readwrite'
              await new Promise((res, rej) => {
                const req = store.put(obj);
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
              });
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        })();
      });
    };
  
    /**
     * Supprime un enregistrement par sa clé primaire.
     * @param {string} storeName - Nom de la table.
     * @param {string} id - Clé primaire de l'objet à supprimer.
     * @returns {Promise<void>}
     */
    DB.delete = async function (storeName, id) {
      const store = await tx(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    };
  
    /**
     * Vide entièrement une table (supprime tous les enregistrements).
     * @param {string} storeName - Nom de la table.
     * @returns {Promise<void>}
     */
    DB.clearStore = async function (storeName) {
      const store = await tx(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    };
  
    /**
     * Vide TOUTES les tables de l'application.
     * Note : L'await dans la boucle est volontaire ici pour éviter de 
     * surcharger le navigateur avec trop de transactions simultanées.
     * @returns {Promise<void>}
     */
    DB.clearAllData = async function () {
      for (const name of Object.keys(STORES)) {
        // eslint-disable-next-line no-await-in-loop
        await DB.clearStore(name);
      }
    };
  
    // Exporte la liste des noms de tables pour usage externe (ex: pour les boucles de nettoyage)
    DB.storeNames = Object.keys(STORES);
  
    // Exposition de l'objet DB dans l'espace de nom global App
    App.DB = DB;
  
  })(window.App = window.App || {});