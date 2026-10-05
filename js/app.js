/**
 * app.js — Point d'entrée de l'application.
 * Initialise le stockage, l'écran de verrouillage, construit le shell 
 * (barre latérale + barre du haut) et démarre le routeur et la boucle 
 * de sauvegarde automatique.
 */
(function (App) {
    'use strict';
  
    const { DB, Store, Auth, Backup, Router, C, Utils, Perm } = App;
  
    // Métadonnées de l'application (À modifier si nécessaire)
    const APP_ABOUT = {
      name: 'Tsiriniaina R.',
      role: "Développeur et éditeur de l'application — à l'origine de l'idée de sa création.",
      links: [
        { label: 'Facebook', url: 'https://web.facebook.com/tsiriniaina.rakotondramanana.2025/' },
        { label: 'Facebook (page)', url: 'https://web.facebook.com/profile.php?id=61593870373577' }
      ],
      email: ''
    };
  
    /** Ouvre la modale "À propos" avec les informations de l'éditeur. */
    function openAboutModal() {
      C.openModal({
        title: 'À propos de PostProd Manager',
        bodyHtml: `
          <p style="margin-bottom:2px;"><strong>${Utils.escapeHtml(APP_ABOUT.name)}</strong></p>
          <p class="hint" style="margin-top:0;">${Utils.escapeHtml(APP_ABOUT.role)}</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
            ${APP_ABOUT.links.map((l) => `<a href="${Utils.escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--ghost btn--sm" style="justify-content:flex-start;">${Utils.escapeHtml(l.label)} ↗</a>`).join('')}
            ${APP_ABOUT.email
              ? `<a href="mailto:${Utils.escapeHtml(APP_ABOUT.email)}" class="btn btn--ghost btn--sm" style="justify-content:flex-start;">✉ ${Utils.escapeHtml(APP_ABOUT.email)}</a>`
              : `<p class="hint" style="margin:0;">Adresse mail à venir.</p>`}
          </div>
        `,
        footerButtons: [{ label: 'Fermer', className: 'btn--ghost', onClick: ({ overlay }) => overlay.remove() }]
      });
    }
  
    /** Construit l'interface principale (Shell) de l'application. */
    function buildShell() {
      // CORRECTION : Utilisation de createElement pour ne pas écraser la balise <noscript> 
      // qui pourrait être présente dans le body.
      const shell = document.createElement('div');
      shell.id = 'app-shell';
      shell.innerHTML = `
        <aside class="sidebar" id="sidebar">
          <div class="sidebar__brand" id="sidebar-brand-btn" style="cursor:pointer;" title="À propos de PostProd Manager">
            <img src="icons/icon.svg" alt="">
            <div>
              <div class="sidebar__brand-text">PostProd Manager</div>
              <div class="sidebar__brand-sub">Post-production</div>
            </div>
          </div>
          <ul class="nav" id="nav-list"></ul>
          <div class="sidebar__footer">
            <div id="sidebar-user" style="margin-bottom:8px;"></div>
            <button class="btn btn--ghost btn--sm" id="switch-user-btn" style="width:100%;justify-content:flex-start;">${C.icons.switchUser} Changer d'utilisateur</button>
            <button class="btn btn--ghost btn--sm" id="my-code-btn" style="width:100%;justify-content:flex-start;margin-top:4px;">${C.icons.shieldLock} Mon code d'accès</button>
            <div style="margin-top:8px;">100% hors-ligne</div>
            <div style="margin-top:4px;font-size:11px;color:var(--text-faint);">Créé par Tsiriniaina R.</div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="btn btn--ghost btn--icon" id="burger" style="display:none;">☰</button>
            <div class="topbar__title" id="topbar-title">Tableau de bord</div>
            <div class="topbar__spacer"></div>
            <select class="topbar__project-select" id="topbar-project"></select>
            <button class="btn btn--ghost btn--icon" id="quick-save-btn" title="Sauvegarde rapide (Ctrl+S)" style="display:none;">${C.icons.backup}</button>
            <button class="btn btn--ghost btn--icon" id="theme-toggle" title="Changer d'apparence (jour/nuit)"></button>
            <button class="btn btn--ghost btn--icon" id="security-toggle" title="Verrouillage sécurité" style="display:none;"></button>
            <div class="save-indicator" id="save-indicator"><span class="save-indicator__dot"></span><span id="save-indicator-text">à jour</span></div>
            <button class="btn btn--ghost btn--icon" id="lock-btn" title="Verrouiller">${C.icons.lock}</button>
          </header>
          <main class="content" id="content"></main>
        </div>
      `;
  
      // Supprime l'ancien shell s'il existe (utile en cas de rechargement à chaud)
      const existingShell = document.getElementById('app-shell');
      if (existingShell) existingShell.remove();
      
      document.body.appendChild(shell);
  
      // Attachement des événements
      Utils.byId('burger').addEventListener('click', () => Utils.byId('sidebar').classList.toggle('is-open'));
      Utils.byId('sidebar-brand-btn').addEventListener('click', openAboutModal);
      Utils.byId('lock-btn').addEventListener('click', () => { App.Security.lock(); Auth.lock(); });
      
      Utils.byId('switch-user-btn').addEventListener('click', () => {
        App.Security.lock();
        Auth.switchIdentity(() => {
          refreshIdentityDisplay();
          Router.renderPage();
        });
      });
      
      Utils.byId('my-code-btn').addEventListener('click', async () => {
        const u = Perm.currentUser();
        if (!u) return;
        const result = await App.Security.promptSetPersonalCode(u, true);
        if (!result) return;
        const patch = result.removed ? { personalCodeHash: null } : { personalCodeHash: result.hash };
        await Store.save('users', Object.assign({}, u, patch));
        C.toast(result.removed ? 'Code personnel retiré.' : 'Code personnel enregistré.', 'success');
      });
      
      Utils.byId('theme-toggle').addEventListener('click', async () => {
        const u = Perm.currentUser();
        if (!u) return;
        const next = u.themeMode === 'light' ? 'dark' : 'light';
        await Store.save('users', Object.assign({}, u, { themeMode: next }));
        applyThemeMode(next);
      });
      
      Utils.byId('security-toggle').addEventListener('click', async () => {
        if (App.Security.isUnlocked()) App.Security.lock();
        else await App.Security.promptUnlock();
      });
      
      Utils.byId('quick-save-btn').addEventListener('click', triggerQuickSave);
      
      // Raccourci clavier global pour la sauvegarde rapide
      document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 's' && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          triggerQuickSave();
        }
      });
      
      App.Security.onStateChange(refreshSecurityBadge);
      refreshSecurityBadge();
      refreshQuickSaveButton();
      refreshIdentityDisplay();
      refreshProjectSelect();
      
      Utils.byId('topbar-project').addEventListener('change', async (e) => {
        await Store.saveSettings({ currentProjectId: e.target.value || null });
        Router.renderPage();
      });
  
      // Gestion responsive de la barre latérale
      function checkResponsive() {
        Utils.byId('burger').style.display = window.innerWidth <= 880 ? 'inline-flex' : 'none';
      }
      checkResponsive();
      window.addEventListener('resize', checkResponsive);
    }
  
    /** Déclenche une sauvegarde rapide (instantané). */
    async function triggerQuickSave() {
      if (!Perm.canBackupAction('snapshot')) {
        C.toast('Ton rôle ne permet pas de créer des sauvegardes.', 'danger');
        return;
      }
      await Backup.createSnapshot('Manuelle');
      C.toast('Copie de sauvegarde créée.', 'success');
      if (Router.current() === 'backup') Router.renderPage();
    }
  
    function refreshQuickSaveButton() {
      const btn = Utils.byId('quick-save-btn');
      if (!btn) return;
      btn.style.display = Perm.canBackupAction('snapshot') ? 'inline-flex' : 'none';
    }
  
    function refreshSecurityBadge() {
      const btn = Utils.byId('security-toggle');
      if (!btn) return;
      if (!App.Security.isConfigured()) { btn.style.display = 'none'; return; }
      btn.style.display = 'inline-flex';
      const unlocked = App.Security.isUnlocked();
      btn.innerHTML = unlocked ? C.icons.unlock : C.icons.lock;
      btn.title = unlocked ? 'Suppressions/modifications sensibles déverrouillées — cliquer pour reverrouiller' : 'Suppressions/modifications sensibles verrouillées — cliquer pour déverrouiller';
      btn.style.color = unlocked ? 'var(--accent-amber)' : '';
    }
  
    function applyThemeMode(mode) {
      document.documentElement.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
      const btn = Utils.byId('theme-toggle');
      if (btn) btn.innerHTML = mode === 'light' ? C.icons.moon : C.icons.sun;
    }
  
    function refreshIdentityDisplay() {
      const el = Utils.byId('sidebar-user');
      if (!el) return;
      const u = Perm.currentUser();
      el.innerHTML = u ? `
        <div style="display:flex;align-items:center;gap:8px;">
          ${C.avatarHtml(u, 30)}
          <div>
            <div>${Utils.escapeHtml(u.name)}</div>
            ${C.roleBadge(u.role)}
          </div>
        </div>` : '';
      applyThemeMode(u ? u.themeMode : 'dark');
      refreshQuickSaveButton();
    }
  
    function refreshProjectSelect() {
      const sel = Utils.byId('topbar-project');
      if (!sel) return;
      const cur = Store.state.settings.currentProjectId;
      sel.innerHTML = `<option value="">— Choisir un projet —</option>` +
        Store.state.projects.map((p) => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${Utils.escapeHtml(p.title)}</option>`).join('');
    }
  
    function updateSaveIndicator() {
      const el = Utils.byId('save-indicator');
      const txt = Utils.byId('save-indicator-text');
      if (!el) return;
      if (Store.isDirty()) { 
        el.classList.add('is-saving'); 
        txt.textContent = 'sauvegarde…'; 
      } else { 
        el.classList.remove('is-saving'); 
        txt.textContent = 'à jour'; 
      }
    }
  
    let appStarted = false;
  
    /** Fonction principale de démarrage de l'application. */
    async function boot() {
      // 1. Initialisation des données en mémoire
      await Store.init();
      
      // 2. Application du thème global
      if (App.applyTheme) {
        App.applyTheme(Store.state.settings.theme);
      }
  
      // 3. Initialisation de l'authentification et du flux principal
      Auth.init(() => {
        if (!appStarted) {
          appStarted = true;
          buildShell();
          C.initToasts();
          Router.init();
          Auth.armInactivityWatcher();
          Backup.startAutosaveLoop(updateSaveIndicator);
          
          // Abonnement global : mise à jour de l'UI à chaque changement de données
          Store.subscribe(() => {
            refreshProjectSelect();
            updateSaveIndicator();
            refreshIdentityDisplay();
            refreshSecurityBadge();
            refreshQuickSaveButton();
          });
        } else {
          // Reprise après un simple re-verrouillage (PIN) : le shell existe déjà.
          refreshIdentityDisplay();
          Router.renderPage();
        }
        showWelcomeBanner();
      });
  
      // 4. Enregistrement du Service Worker (PWA, fonctionnement hors-ligne)
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').catch((err) => {
          // CORRECTION : Ne pas masquer silencieusement les erreurs de registration
          console.warn('Échec de l\'enregistrement du Service Worker:', err);
        });
      }
    }
  
    /** Affiche une bannière de bienvenue temporaire avec animation. */
    function showWelcomeBanner() {
      const s = Store.state.settings;
      if (!s.welcomeEnabled) return;
      const u = Perm.currentUser();
      const existing = Utils.byId('welcome-banner');
      if (existing) existing.remove();
      
      const el = Utils.el('div', { class: 'welcome-banner', id: 'welcome-banner' });
      el.innerHTML = `
        ${u ? C.avatarHtml(u, 24) : '<img src="icons/icon.svg" alt="" style="width:24px;height:24px;">'}
        <div>
          <div class="welcome-banner__title">${Utils.escapeHtml(s.welcomeMessage || 'Bienvenue')}</div>
          ${u ? `<div class="welcome-banner__sub">Connecté en tant que ${Utils.escapeHtml(u.name)}</div>` : ''}
        </div>`;
        
      document.body.appendChild(el);
      
      // Déclenchement de l'animation CSS
      requestAnimationFrame(() => el.classList.add('is-visible'));
      setTimeout(() => {
        el.classList.remove('is-visible');
        setTimeout(() => el.remove(), 500);
      }, 2600);
    }
  
    // Démarrage automatique une fois le DOM chargé
    document.addEventListener('DOMContentLoaded', boot);
  
  })(window.App);