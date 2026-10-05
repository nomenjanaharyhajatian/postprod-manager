/**
 * utils.js — Fonctions utilitaires génériques, sans dépendance.
 * Attachées à window.App.Utils pour rester accessibles depuis tous les
 * modules chargés en <script> classique (pas de bundler / pas de modules ES).
 */
(function (App) {
    'use strict';
  
    const Utils = {};
  
    /**
     * Génère un identifiant unique (UUID v4 simplifié, suffisant en local).
     * @returns {string} Un identifiant unique.
     */
    Utils.uuid = function () {
      if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  
    /** @returns {string} Date et heure actuelles au format ISO. */
    Utils.nowISO = function () { 
      return new Date().toISOString(); 
    };
  
    /**
     * Formate une date ISO en chaîne lisible (fr-FR).
     * @param {string} iso - Date au format ISO.
     * @returns {string} Date formatée ou '—' si vide.
     */
    Utils.formatDateTime = function (iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleString('fr-FR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    };
  
    /**
     * Formate une date (YYYY-MM-DD ou ISO) en chaîne lisible (fr-FR).
     * Gère le décalage horaire pour les dates sans heure.
     * @param {string} iso - Date au format ISO ou YYYY-MM-DD.
     * @returns {string} Date formatée ou la chaîne d'origine si invalide.
     */
    Utils.formatDate = function (iso) {
      if (!iso) return '—';
      const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
  
    /**
     * Convertit des secondes en format timecode "HH:MM:SS".
     * @param {number} totalSeconds - Durée en secondes.
     * @returns {string} Durée formatée.
     */
    Utils.formatDuration = function (totalSeconds) {
      const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(h)}:${pad(m)}:${pad(sec)}`;
    };
  
    /**
     * Parse une chaîne "HH:MM:SS", "MM:SS" ou un nombre de minutes en secondes.
     * @param {string|number} str - La durée à parser.
     * @returns {number} Durée en secondes.
     */
    Utils.parseDuration = function (str) {
      if (str === null || str === undefined || str === '') return 0;
      if (typeof str === 'number') return Math.round(str * 60);
      
      const parts = String(str).trim().split(':').map((p) => parseInt(p, 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 1) return parts[0] * 60;
      return 0;
    };
  
    /**
     * Formate une suite de chiffres bruts en durée H:MM:SS façon chronomètre.
     * @param {string} digitsStr - Chaîne de chiffres.
     * @returns {string} Durée formatée.
     */
    Utils.formatDurationMaskDigits = function (digitsStr) {
      const d = String(digitsStr || '').replace(/\D/g, '').slice(0, 6);
      if (d.length <= 2) return d;
      if (d.length <= 4) return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`;
      return `${d.slice(0, d.length - 4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
    };
  
    /**
     * Branche le masque de saisie "chronomètre" sur un champ texte.
     * CORRECTION : Ajout d'une vérification (_hasDurationMask) pour éviter 
     * d'attacher plusieurs écouteurs d'événements sur le même élément.
     * @param {HTMLInputElement} input - Le champ de saisie.
     */
    Utils.attachDurationMask = function (input) {
      if (!input) return;
      if (input._hasDurationMask) return; // Sécurité contre les doubles bindings
      input._hasDurationMask = true;
  
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('placeholder', input.getAttribute('placeholder') || 'ex: 1234 -> 12:34');
      
      input.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
      });
      
      input.addEventListener('input', () => {
        input.value = Utils.formatDurationMaskDigits(input.value);
      });
    };
  
    /**
     * Formate des Gigaoctets en chaîne lisible (Go ou To).
     * @param {number} go - Valeur en Go.
     * @returns {string} Valeur formatée.
     */
    Utils.formatGo = function (go) {
      const v = Number(go) || 0;
      return v >= 1000 ? (v / 1000).toFixed(2) + ' To' : v.toFixed(1) + ' Go';
    };
  
    /**
     * Formate un nombre d'octets bruts dans l'unité la plus lisible.
     * @param {number} bytes - Valeur en octets.
     * @returns {string} Valeur formatée (o, Ko, Mo, Go).
     */
    Utils.formatBytes = function (bytes) {
      const v = Number(bytes) || 0;
      if (v >= 1e9) return (v / 1e9).toFixed(2) + ' Go';
      if (v >= 1e6) return (v / 1e6).toFixed(1) + ' Mo';
      if (v >= 1e3) return (v / 1e3).toFixed(0) + ' Ko';
      return `${v} o`;
    };
  
    /**
     * Limite l'exécution d'une fonction à une fois par période donnée (anti-rebond).
     * Utile pour les champs de recherche ou le redimensionnement de fenêtre.
     * @param {Function} fn - La fonction à exécuter.
     * @param {number} ms - Délai en millisecondes.
     * @returns {Function} Fonction enveloppée.
     */
    Utils.debounce = function (fn, ms) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    };
  
    /**
     * Limite une valeur numérique entre un minimum et un maximum.
     * @param {number} v - Valeur à limiter.
     * @param {number} min - Valeur minimale.
     * @param {number} max - Valeur maximale.
     * @returns {number} Valeur limitée.
     */
    Utils.clamp = function (v, min, max) { 
      return Math.min(max, Math.max(min, v)); 
    };
  
    /**
     * Échappe les caractères HTML pour prévenir les failles XSS.
     * Équivalent à html.escape() en Python.
     * @param {string} str - Chaîne à échapper.
     * @returns {string} Chaîne sécurisée.
     */
    Utils.escapeHtml = function (str) {
      if (str === null || str === undefined) return '';
      return String(str).replace(/[&<>"']/g, (c) => ({ 
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
      }[c]));
    };
  
    /**
     * Déclenche l'enregistrement d'un fichier. Tente d'abord l'API de partage 
     * native (mobile), puis retombe sur le téléchargement classique.
     * @param {string} filename - Nom du fichier.
     * @param {string} content - Contenu du fichier.
     * @param {string} mime - Type MIME (défaut: application/json).
     */
    Utils.download = async function (filename, content, mime = 'application/json') {
      const blob = new Blob([content], { type: mime });
  
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: mime });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
            return;
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return; // Annulation par l'utilisateur
        }
      }
  
      // Fallback pour les navigateurs ne supportant pas le partage natif
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; 
      a.download = filename;
      document.body.appendChild(a); 
      a.click(); 
      a.remove();
      // Délai de sécurité pour s'assurer que le navigateur a initié le téléchargement
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  
    /**
     * Lit un fichier (File API) et retourne son contenu texte via une Promise.
     * @param {File} file - Objet File issu d'un input type="file".
     * @returns {Promise<string>} Contenu du fichier.
     */
    Utils.readFileAsText = function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    };
  
    /**
     * Génère un hash SHA-256 d'une chaîne de caractères.
     * Utilisé pour ne jamais stocker le code PIN en clair dans IndexedDB.
     * Équivalent à hashlib.sha256(text.encode('utf-8')).hexdigest() en Python.
     * @param {string} text - Texte à hacher.
     * @returns {Promise<string>} Hash hexadécimal.
     */
    Utils.sha256Hex = async function (text) {
      const enc = new TextEncoder().encode(text);
      const buf = await window.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    };
  
    /**
     * Raccourci pour document.getElementById.
     * @param {string} id - ID de l'élément.
     * @returns {HTMLElement|null} L'élément trouvé.
     */
    Utils.byId = function (id) { 
      return document.getElementById(id); 
    };
  
    /**
     * Crée un élément DOM avec des attributs et un contenu HTML.
     * ATTENTION SECURITE : Si le paramètre 'html' contient des données saisies 
     * par l'utilisateur, il DOIT être préalablement passé par Utils.escapeHtml() 
     * pour éviter les failles XSS. Ne pas utiliser innerHTML avec des données brutes.
     * @param {string} tag - Nom de la balise (ex: 'div', 'span').
     * @param {Object} attrs - Objet des attributs (ex: {class: 'btn', onClick: fn}).
     * @param {string} html - Contenu HTML interne (doit être échappé si dynamique).
     * @returns {HTMLElement} L'élément créé.
     */
    Utils.el = function (tag, attrs = {}, html = '') {
      const node = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') {
          node.className = v;
        } else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2), v);
        } else {
          node.setAttribute(k, v);
        }
      });
      if (html) {
        node.innerHTML = html;
      }
      return node;
    };
  
    // Exposition de l'objet Utils dans l'espace de nom global App
    App.Utils = Utils;
  
  })(window.App = window.App || {});