# PostProd Manager

Application de gestion de post-production audiovisuelle — 100% hors-ligne,
sans serveur, sans framework (HTML5 / CSS3 / JavaScript ES6+ natif,
IndexedDB comme moteur de stockage).

## Lancer l'application

**Option recommandée (PWA installable, service worker actif) :**
```bash
cd postprod
python3 -m http.server 8080
# puis ouvrir http://localhost:8080 dans Chrome/Edge/Firefox
```
Le navigateur proposera "Installer l'application" (icône dans la barre
d'adresse) pour un fonctionnement en fenêtre autonome, y compris hors-ligne
après le premier chargement.

**Option simple :** double-cliquer sur `index.html` fonctionne aussi
(IndexedDB reste disponible en `file://` dans Chrome/Edge). Seul le service
worker (cache offline avancé + installation PWA) nécessite un serveur —
l'app le détecte et ne tente pas de l'enregistrer dans ce cas.

Premier lancement : l'app demande de créer un code PIN à 4 chiffres, puis
de créer un premier projet.

## Architecture

```
postprod/
├── index.html            Shell HTML unique (SPA)
├── manifest.json / sw.js  PWA : installation + cache offline
├── css/styles.css         Thème sombre, variables CSS (palette modifiable)
└── js/
    ├── utils.js           Fonctions génériques (id, dates, durées…)
    ├── db.js               Accès IndexedDB (moteur de stockage)
    ├── store.js            État mémoire + CRUD tracé (créé/modifié par/le)
    ├── calc.js             Calculs automatiques (progression, durées, stats)
    ├── validation.js       Détection d'anomalies (doublons, incohérences…)
    ├── backup.js           Autosave, export/import JSON, fusion, historique
    ├── components.js       UI partagée (modales, toasts, badges, icônes)
    ├── auth.js             Verrouillage par PIN + inactivité
    ├── router.js            Navigation (hash routing)
    ├── app.js               Bootstrap
    └── pages/*.js           Un fichier par page (Dashboard, Projets, Épisodes,
                              Scènes, Rushs & Disques, Recherche, Rapports,
                              Sauvegardes, Paramètres)
```

Chaque module s'accroche à un espace de nom global `window.App` (pas de
bundler, pas d'imports ES — garantit un fonctionnement direct en `file://`).

## Choix assumés (le cahier des charges ne les précisait pas)

Ces points ont été tranchés pour pouvoir livrer une version complète et
cohérente ; ils sont tous ajustables si tu veux une autre approche :

- **Stockage** : IndexedDB comme moteur principal (validé avec toi).
- **Type "Film"** : scènes rattachées directement au projet, sans
  saison/épisode (validé avec toi).
- **"Nombre d'épisodes"** à la création d'un projet Série/Documentaire est
  interprété comme le nombre d'épisodes **par saison** (identique pour
  chaque saison).
- **Sauvegarde "toutes les 5 secondes"** : chaque action (créer/modifier/
  supprimer) écrit *immédiatement* dans IndexedDB — aucune perte de donnée
  possible. Le cycle de 5 s ne fait que rafraîchir l'indicateur "à jour" et
  vérifie s'il faut créer un instantané d'historique (limité en nombre,
  réglable dans Paramètres, intervalle par défaut 10 min + bouton "Créer une
  copie maintenant").
- **PIN** : un seul code par installation (par poste de travail), modifiable
  dans Paramètres. Chaque monteur travaille sur sa propre installation/
  copie de données, comme décrit dans le cahier des charges.
- **Disques de stockage** : gérés comme un inventaire global (partagé entre
  projets), pas par projet, car un disque physique circule souvent entre
  plusieurs tournages dans une petite structure.
- **Palette / thème "TR Academy"** : je n'avais pas de référence exacte pour
  ce thème, j'ai donc proposé une palette sombre "salle de montage"
  (accents cyan/ambre, chips "timecode" en police mono). Elle est
  entièrement modifiable dans **Paramètres > Palette**.

## Fonctionnalités couvertes (V1)

Connexion PIN + verrouillage auto · Projets (Film/Série/Documentaire/
Émission/Publicité) avec génération automatique de la structure ·
Saisons/Épisodes · Scènes (avec règles métier Appel/VO/Spéciale/Validation
verrouillée) · Rushs journaliers liés à N scènes + disques source/sauvegarde
avec suivi de capacité · Recherche globale multi-critères · 6 types de
rapports imprimables · Tableau de bord avec alertes automatiques (doublons,
incohérences, champs manquants, disques presque pleins, épisodes sous
seuil) · Sauvegarde auto + historique + export/import JSON avec fusion
intelligente multi-monteurs (journal d'import détaillé) · Paramètres
(seuils métier, sécurité, palette).

## Utilisateurs, équipes et droits d'accès

Au premier lancement, après le code PIN, l'app demande de créer le premier
compte : il reçoit automatiquement le rôle **Admin**. Ensuite, depuis
**Utilisateurs** (visible uniquement pour un Admin) :

- **Onglet Comptes** : ajouter les membres de l'équipe (nom + rôle parmi
  Admin / Chef monteur / Monteur / Script / Autre). Il doit toujours rester
  au moins un compte Admin actif (garde-fou anti-blocage).
- **Onglet Rôles & droits** : pour chacun des 4 rôles non-admin, matrice
  complète — accès par page (aucun / lecture seule / lecture-écriture),
  droit de création et de suppression par entité (Projets/Épisodes/Scènes/
  Rushs/Disques), et **liste précise des champs modifiables** dans chaque
  formulaire. Les actions de Sauvegardes (export/import/copie/réinitialiser)
  sont aussi contrôlées individuellement. Le rôle Admin n'est pas éditable :
  il garde toujours tous les droits, pour ne jamais se retrouver bloqué.

**Connexion** : un seul code PIN protège l'accès à l'appareil (partagé,
comme avant). Une fois déverrouillé, chacun choisit son nom dans une liste
("Qui es-tu ?") — bouton **Changer d'utilisateur** dans la barre latérale
pour basculer d'une personne à l'autre sans ressaisir le PIN. C'est un choix
volontaire et assumé : léger et rapide, mais ce n'est pas une authentification
individuelle forte.

**Répartition par défaut des champs de scène** entre Script et Monteur,
reprise directement de la logique du cahier des charges ("donnée source
venue du tournage" vs "données insérées par les monteurs après montage") :
- **Script** peut créer des scènes et modifier : numéro, date, description,
  lieu, caractéristique, contre-champ/VO *attendus*, commentaires. Peut
  aussi créer/modifier les rushs journaliers (disque, capacité, caméra/son).
- **Monteur** peut créer des scènes et modifier : durées, statut, monteur/
  pré-monteur assignés, contre-champ/VO *réalisés*, commentaires. Accès
  lecture seule aux Rushs & Disques et aux Projets. Ne peut pas supprimer.
- **Chef monteur** : accès complet en lecture-écriture à Projets, Épisodes,
  Scènes, Rushs, Disques, et aux Sauvegardes (export/import/copie — pas la
  réinitialisation complète, réservée à l'Admin).
- **Autre** : lecture seule partout, aucun droit de modification par défaut
  (rôle "observateur", à ajuster au cas par cas depuis Rôles & droits).

Tout ceci est un point de départ **entièrement modifiable** par un Admin.

### Important : ce que ce système protège (et ne protège pas)

L'application tourne 100% côté navigateur, sans serveur. Les droits
bloquent les boutons/champs dans l'interface et empêchent les actions
correspondantes dans le code — c'est une protection d'usage efficace contre
les erreurs et bien adaptée à un outil d'équipe interne. Ce n'est en
revanche pas un coffre-fort : quelqu'un à l'aise avec les outils
développeur du navigateur pourrait techniquement contourner une
restriction. Pas de serveur = pas de sécurité "dure" possible ici.

### Export / import et comptes

Les comptes utilisateurs et la matrice de droits sont **propres à chaque
installation** (poste de travail) et ne sont *pas* inclus dans les exports
JSON destinés à être partagés/fusionnés entre monteurs — pour éviter qu'un
import écrase la configuration d'équipe d'un autre poste. Ils sont en
revanche inclus dans les **instantanés locaux** (Sauvegardes > Créer une
copie), qui restaurent fidèlement l'état complet de l'appareil.

## Nouveautés de cette version

- **Lien automatique scène ↔ rush** : le nombre de scènes d'un rush se
  déduit désormais automatiquement de la date de tournage de chaque scène
  (plus besoin de les sélectionner à la main). Un second champ optionnel
  reste disponible dans le formulaire rush pour rattacher manuellement une
  scène "cas particulier" (autre date), en complément — jamais à la place —
  du lien automatique.
- **Mode jour / nuit** : bouton dédié épinglé dans la barre du haut (icône
  soleil/lune). Le choix est personnel : chaque compte garde sa propre
  préférence, indépendamment des autres membres de l'équipe.
- **Nom du fichier export** : désormais `nom_AAAA-MM-JJ_HHhMM_ppm2.json`
  (nom de la personne connectée + horodatage + identifiant de version de
  l'app). L'export propose maintenant systématiquement de **choisir
  l'emplacement de sauvegarde** via la fenêtre native du système, sur les
  navigateurs qui le permettent (Chrome/Edge ordinateur). Sur les autres
  navigateurs (Firefox, Safari, Chrome Android — l'API nécessaire n'existe
  pas encore partout), le fichier part automatiquement dans le dossier
  Téléchargements du navigateur, comme avant ; c'est indiqué dans l'app.
- **Verrouillage sécurité des projets** (Paramètres, admin) : un code distinct
  du PIN, une fois activé, est demandé avant toute **suppression** (projet,
  épisode, scène, rush, disque) et avant la modification des **informations
  principales d'un projet existant**. Une fois saisi correctement, l'accès
  reste ouvert pour la session via le bouton cadenas dans la barre du haut
  (pas besoin de ressaisir à chaque suppression) — un clic sur ce bouton
  reverrouille immédiatement, sans code. Choix par défaut faute de réponse
  précise sur le périmètre exact : suppressions partout + modifications des
  informations principales du projet uniquement (le travail quotidien sur
  les scènes/épisodes/rushs n'est pas concerné). Ajustable si besoin.

**Synchronisation cloud** : mise en attente à la demande de l'utilisateur —
non développée dans cette version. L'app reste 100% locale/hors-ligne.

## Statut de scène automatique

Le champ Statut se calcule désormais tout seul à chaque enregistrement,
selon les données remplies :

| Données présentes | Statut |
|---|---|
| Rien | À faire |
| Date + durée tournage | En cours |
| Durée montage final (scène Normale/Appel/VO complète) | Terminé |
| Durée montage final mais contre-champ/VO manquant | Non complet |
| Scène Spéciale/Autre, même complète | En cours (validation manuelle requise) |

**Règle de recalcul pur** (mise à jour à ta demande) : le statut suit
toujours l'état réel des données, dans les deux sens. Il peut monter (En
cours → Terminé dès que la durée de montage est saisie) tout comme
redescendre (Terminé → Non complet ou En cours si une information devient
manquante ou une durée effacée). Seul "Validé" reste un choix 100% manuel
qui verrouille définitivement la scène — c'est le seul cas où le champ
Statut n'est plus recalculé automatiquement.

Trois compléments ont été ajoutés à ta demande :
- **Badge Auto/Manuel** : visible dans le tableau des scènes et dans la
  fiche, indique si le statut affiché vient du calcul automatique ou d'un
  choix manuel qui a pris le dessus.
- **Alerte de retard** : une scène "En cours" depuis plus de X jours sans
  qu'aucune durée de montage ne soit saisie remonte dans les alertes du
  tableau de bord (seuil réglable dans Paramètres, 5 jours par défaut).
- **Historique du statut** : chaque changement de statut (date, ancien →
  nouveau, auto ou manuel) est conservé sur la scène et consultable dans
  un menu dépliant "Historique du statut" de sa fiche.

## Alertes cliquables (tableau de bord)

Chaque alerte est maintenant une carte cliquable avec un bouton
"Corriger →" : le clic navigue directement vers la scène ou l'épisode
concerné et ouvre sa fiche d'édition, prêt à corriger. Un badge de
compteur (nombre d'anomalies) apparaît aussi directement sur les entrées
"Scènes"/"Épisodes"/"Rushs & Disques" du menu latéral.

## Ajustements tableau des scènes et complétude Appel/VO

- Le tableau des scènes distingue maintenant **Chrono-T** (durée de
  tournage) et **Durée montage** (durée de montage final) en deux colonnes
  séparées, au lieu d'une seule colonne "Durée" qui affichait la première
  valeur disponible.
- **Correction importante** : la condition "Non complet" pour les scènes
  Appel/Voix Off/Appel+VO est désormais **inconditionnelle**, conforme au
  cahier des charges d'origine. Avant ce correctif, elle ne se déclenchait
  que si la case "Contre-champ/VO attendu" était cochée — ce qui pouvait
  laisser passer une scène en "Terminé" par erreur si cette case avait été
  oubliée. Maintenant : dès qu'une scène est de type Appel ou VO, elle
  reste "Non complet" tant que le contre-champ/la VO n'est pas marqué
  **réalisé**, sans condition préalable. Les cases "attendu" restent des
  champs informatifs (utiles pour le Script en note de tournage) mais
  n'interviennent plus dans le calcul du statut.
- Ces scènes "Non complet" remontent maintenant explicitement dans les
  **alertes du tableau de bord**, avec le détail de ce qui manque
  (contre-champ et/ou voix off), cliquables comme les autres alertes.

## Sauvegarde rapide

Bouton épinglé dans la barre du haut (icône disquette), relié directement
à "Créer une copie maintenant" — un clic crée un instantané manuel, sans
passer par la page Sauvegardes. Raccourci clavier **Ctrl+S** (Cmd+S sur
Mac) disponible partout dans l'app pour la même action. Visible/actif
uniquement pour les rôles ayant le droit de créer des sauvegardes (le
raccourci clavier prévient d'un message si le rôle courant n'a pas ce
droit, plutôt que de ne rien faire silencieusement).

## Masque de saisie des durées

Tous les champs de durée (tournage, pré-montage, montage final, durée
cible d'épisode, seuil de durée minimale dans Paramètres) fonctionnent
maintenant comme un chronomètre : on tape uniquement des chiffres, les
deux-points s'insèrent automatiquement. 4 chiffres -> MM:SS (ex: `1234` ->
`12:34`), 5 ou 6 chiffres -> H:MM:SS / HH:MM:SS (ex: `12345` -> `1:23:45`,
`123456` -> `12:34:56`). Toute frappe d'un caractère non numérique
(dont les deux-points) est ignorée.

- **Rôle du disque** : simplifié à deux choix seulement — Source ou
  Sauvegarde (l'option "Les deux" a été retirée).
- **Réinitialiser toutes les données** est maintenant aussi protégé par le
  code de sécurité (même code que pour les suppressions et la modification
  des infos principales d'un projet) — c'était le seul trou restant dans le
  verrouillage sécurité.

- **Rapport quotidien** : la colonne "Scènes" du tableau "Rushs du jour"
  (qui affichait un simple total) est remplacée par **"Montées / Liées"**
  au format `2/3` — Montées = scènes de ce rush ayant déjà une durée de
  montage saisie (donc à valider) ; Liées = total des scènes rattachées à
  ce rush ce jour-là (lien automatique + manuel).

## Pipeline d'états des épisodes

Les statuts d'épisode ont été entièrement refondus pour correspondre au
flux de post-production réel :

| État | Déclenchement |
|---|---|
| Non commencé | Par défaut |
| Prêt à assembler | **Automatique** : quand 50 % ou plus des scènes ont une durée de montage saisie |
| Assembler | Manuel |
| Exporter | Manuel |
| Livraison 1 | Manuel |
| Retour pige | Manuel |
| Validé | Manuel |

La promotion "Non commencé → Prêt à assembler" se déclenche automatiquement
à chaque enregistrement de scène. Une fois l'épisode avancé manuellement
au-delà de "Prêt à assembler", l'automatisation ne s'applique plus.

Le tableau de la page Épisodes a aussi été simplifié : les colonnes Titre
et Durée cible disparaissent du tableau (la donnée reste dans la fiche,
accessible en cliquant sur la ligne). Les boutons Modifier/Supprimer
disparaissent aussi du tableau — la modification se fait en cliquant sur
la ligne, et la suppression via un bouton "Supprimer" directement dans la
fiche ouverte. Ces simplifications s'appliquent aussi au rapport épisode.

## Lot d'ajustements — nomenclature, dashboard, alertes, tri

- **Statuts scène renommés** : "En cours" → "Tournée", "Terminée" →
  "Pré-montée" (logique d'automatisation inchangée, seuls les noms
  changent).
- **Caractéristiques réduites** : "Appel + VO" et "Autre" supprimées —
  restent Normal / Appel / Voix Off / Spéciale.
- **Commentaire obligatoire** pour toute scène dont la caractéristique
  n'est pas "Normal" (bloque l'enregistrement + remonte dans les alertes).
- **Icône œil** sur tous les champs mot de passe/code (PIN, code de
  sécurité, code Admin) pour voir la saisie.
- **Saisie clavier + Entrée** pour le PIN et les formulaires de code
  (plus besoin de cliquer les pavés numériques à l'écran sur ordinateur).
- **Code Admin (2ᵉ facteur)** : configurable dans Paramètres, demandé en
  plus dès qu'on sélectionne un compte Admin dans l'écran "Qui es-tu ?".
- **Tableau de bord** : nouvelle box "Progression de tournage" (% de
  scènes avec une date de tournage renseignée) avant "Progression globale
  de montage" (renommée). "Durée montée cumulée" devient "Durée des
  scènes montées", avec la durée totale au tournage en sous-texte. Les
  alertes ignorent maintenant les scènes juste "pas encore tournées"
  (normal, pas une anomalie), sont triées par priorité (doublons en tête,
  puis contre-champ manquant, puis voix off manquante), et la liste
  affichée est passée de 20 à 50.
- **Tableau des scènes** : colonnes réordonnées (Date de tournage après
  Caractéristiques), "Description" remplacée par "Commentaire" en fin de
  tableau (survol de la cellule = détail des alertes de cette scène),
  lignes colorées selon le type d'alerte (rouge/orange), filtre par plage
  de dates de tournage (Du/Au), et tri croissant/décroissant sur toutes
  les colonnes en cliquant l'en-tête (mémorisé pour la session).
- **Tableau des épisodes** : colonne "Scènes" renommée "Scènes Terminées".
- **Toutes les colonnes "Date" liées au tournage** renommées "Date de
  tournage" (scènes, rushs, recherche, rapports).
- **Message de bienvenue** paramétrable (texte + activer/désactiver dans
  Paramètres), avec fondu à l'ouverture et nom de la personne connectée.
- **Commentaire du disque** affiché directement sous chaque carte disque.

## Nomenclature et statuts (dernier lot)

- **Statuts de scène renommés** (logique d'automatisation inchangée) :
  "En cours" → **Tournée**, "Terminée" → **Pré-montée**. "À faire",
  "Non complet" et "Validé" restent identiques.
- **Caractéristiques de scène réduites** : "Appel + VO" et "Autre" ont été
  supprimées. Restent : Normal, Appel, Voix Off, Spéciale.
- **Commentaire recommandé** pour toute scène dont la caractéristique
  n'est pas "Normal" : une alerte apparaît au tableau de bord si le
  commentaire est vide (non bloquant à l'enregistrement, volontairement,
  pour ne pas interrompre la saisie rapide).

## Tableau des scènes — réorganisation

- Colonnes réordonnées : Épisode, Scène, **Caractéristique, puis Date de
  tournage** (déplacée après Caractéristique), Statut, Chrono-T, Durée
  montage, Monteur, **Commentaire** (remplace Description, en dernière
  colonne).
- **Survol de la colonne Commentaire** : une bulle affiche le détail des
  alertes concernant cette scène, si elle en a.
- **Couleur de ligne selon le type d'alerte** : fond rouge léger pour une
  alerte bloquante (danger), orange léger pour un avertissement.
- **Filtre "Date de tournage" en plage** (du/au) en plus des filtres
  existants.
- **Tri par colonne** : cliquer sur un en-tête trie croissant, un second
  clic trie décroissant, un troisième clic retire le tri. Le tri est
  mémorisé pour la durée de la session (perdu à la fermeture de l'app),
  disponible sur les tableaux Scènes pour l'instant.
- "Date" renommé en "**Date de tournage**" partout où c'était ambigu
  (Recherche, Rushs, rapport hebdomadaire, rapport quotidien).

## Tableau de bord

- Nouvelle carte **"Progression de tournage"** (% de scènes ayant une
  date de tournage renseignée), affichée avant les autres cartes, avec le
  détail "X tournée(s) · Y restante(s)".
- "Progression globale" renommée **"Progression globale de montage"**.
- "Durée montée cumulée" renommée **"Durée des scènes montées"**, avec en
  dessous la durée totale cumulée au tournage pour comparaison.
- "Scènes terminées" renommée **"Scènes pré-montées"** (cohérence avec le
  nouveau nom de statut).
- **Alertes** : la fausse alerte "date de tournage manquante" a été
  retirée (normal qu'une scène pas encore tournée n'ait pas de date).
  Les alertes sont maintenant triées par ordre de priorité métier :
  doublons en premier, puis contre-champ non réalisé, puis voix off non
  réalisée, puis le reste. La liste affichée passe de 20 à 50 alertes.

## Sécurité — Code Admin (2ᵉ facteur)

Nouveau code, distinct du PIN et du code de sécurité existant, configurable
dans **Paramètres > Code Admin**. Une fois activé, il est redemandé à
chaque fois qu'une personne sélectionne le compte **Admin** dans l'écran
"Qui es-tu ?" — empêche quiconque de simplement cliquer sur "Admin" dans
la liste sans autorisation.

## Accueil personnalisable

Message de bienvenue configurable dans **Paramètres > Accueil** (activable/
désactivable, texte libre), affiché en fondu (fade-in/fade-out, ~2.5s) après
chaque déverrouillage, avec le nom de la personne connectée affiché juste
en dessous.

## Icône œil sur les champs sensibles

Tous les champs de saisie de code (code de sécurité, code Admin) affichent
désormais un bouton œil pour basculer entre masqué/visible. Le champ PIN à
pavé numérique n'est pas concerné (pas de champ texte à afficher).

## Saisie clavier pour le PIN

L'écran de code PIN accepte maintenant la saisie au clavier physique (0-9,
Backspace/Suppr pour effacer, Entrée pour valider dès que 4 chiffres sont
saisis), en plus du pavé tactile.

## Points en attente (prochaine passe)

Pour rester sur des lots gérables et fiables, plusieurs demandes du dernier
message restent à faire dans une prochaine session, notamment : export/
import de la configuration complète (comptes, rôles, PIN) entre appareils,
export d'un seul projet sélectionné, verrouillage par projet avec code
dédié, rôles de disque supplémentaires (Livraison/Autre), plusieurs disques
de sauvegarde par rush, vue détaillée du contenu d'un disque, date d'arrivée
du rush, suppression du champ pré-montage/pré-monteur, liste déroulante
utilisateurs pour le champ Monteur, sélecteur de rush pour auto-remplir la
date de scène, réversibilité du statut Validé, avatars utilisateurs,
couleurs de ligne dans les rapports, sélecteur de colonnes par rapport,
redimensionnement manuel des tableaux, et le reste des points "Optionnel"
de la liste. Dis-moi par quoi tu veux continuer.

## Export/Import et verrouillage (lot 3)

- **Export d'un seul projet** : dans Sauvegardes, un sélecteur permet de
  choisir "Tous les projets" ou un projet précis avant d'exporter. Un
  export ciblé n'embarque que les données de ce projet (saisons, épisodes,
  scènes, rushs) et uniquement les disques réellement référencés par ses
  rushs — pas tout l'inventaire de l'appareil. Le nom de fichier inclut le
  titre du projet dans ce cas.
- **Export/Import de configuration complète** (Utilisateurs > onglet
  "Export/Import config", admin uniquement) : exporte comptes, rôles &
  droits, PIN, code de sécurité, code Admin, seuils métier et palette dans
  un fichier séparé des données de tournage. L'import **remplace
  entièrement** (pas une fusion) la configuration de l'appareil cible, pour
  répliquer exactement la même installation sur plusieurs postes en un
  clic. Après import, l'appareil se reverrouille et redemande le choix
  d'identité.
- **Verrouillage par projet** : en plus du code de sécurité général (deux
  niveaux distincts), un Admin peut poser un code propre à un projet
  (icône cadenas sur la carte projet). Une fois posé, ce code est demandé
  — en plus du code de sécurité — pour modifier ou supprimer ce projet.
  Le code voyage avec le projet dans les exports JSON (hashé, jamais en
  clair).

## Disques et rushs (lot 3)

- **Rôles de disque étendus** : Source, Sauvegarde, **Livraison**,
  **Autre** (commentaire obligatoire pour "Autre", contrôlé à
  l'enregistrement et remonté en alerte s'il manque).
- **Plusieurs disques de sauvegarde par rush** : bouton "+" pour ajouter
  autant de disques de sauvegarde que nécessaire (copies multiples), au
  lieu d'un seul disque de sauvegarde fixe.
- **Rattachement manuel de scènes supprimé** : le lien scène ↔ rush est
  désormais exclusivement automatique (par date de tournage), comme
  demandé pour simplifier la saisie.
- **Vue "Contenu du disque"** : cliquer sur une carte disque ouvre la liste
  des rushs qui s'y trouvent (source ou sauvegarde), avec un bouton pour
  retirer un rush de ce disque précis. Le rush n'est pas supprimé — seul
  son lien avec ce disque l'est, la capacité se recalcule automatiquement,
  et un historique "Anciennement sur…" reste visible dans la fiche du rush
  pour garder une trace.
- **Date d'arrivée des rushs** : second champ de date dans le formulaire
  rush, distinct de la date de tournage. Quand elle est renseignée, elle
  devient la référence pour l'alerte de retard de montage (une scène ne
  peut pas être "en retard" avant que ses rushs ne soient physiquement
  arrivés) ; sinon, le calcul retombe sur la date à laquelle la scène est
  passée "Tournée".

## Correctif important

Un bug affectant **toutes les notifications toast** de l'application a été
trouvé et corrigé pendant les tests de ce lot : le conteneur des
notifications était détruit au démarrage par la construction de
l'interface principale, ce qui empêchait silencieusement l'affichage de
tout message de confirmation ou d'erreur (sauvegardes, formulaires,
imports...). C'est corrigé — les notifications s'affichent maintenant
normalement partout.

## Fiche scène et rapports (lot 4)

- **Champs pré-montage/pré-monteur supprimés** : la fiche scène ne garde
  plus qu'une seule durée de montage ("Montage final"). Le calcul de durée
  affichée partout retombe directement sur la durée de tournage si le
  montage final n'est pas encore renseigné (le pré-montage n'était plus
  qu'une étape intermédiaire redondante).
- **Champ Monteur → liste déroulante** : fini la saisie libre, on choisit
  parmi les comptes actifs de l'application. Si une scène avait déjà un
  nom saisi à la main qui ne correspond à aucun compte, il reste visible
  en haut de la liste pour ne pas perdre l'information silencieusement.
- **Sélecteur "Rush journalier" dans la fiche scène** : une liste
  déroulante des rushs existants du projet, juste avant le champ Date de
  tournage. La sélection remplit automatiquement la date — pratique pour
  saisir plusieurs scènes du même jour sans re-taper la date à chaque
  fois. Le rush doit être créé en premier ; le lien scène↔rush reste
  ensuite basé sur la correspondance de date, comme avant.
- **Statut "Validé" réversible** : un vrai bug empêchait la réversibilité
  promise plus tôt — même après avoir déverrouillé une scène validée, le
  statut revenait systématiquement à "Validé" à l'enregistrement. Corrigé :
  après déverrouillage (bouton dédié + confirmation), choisir un autre
  statut dans le formulaire relance normalement le calcul automatique.
- **Couleurs de ligne dans les rapports** : les tableaux de scènes/épisodes
  des rapports (général, épisode, quotidien, hebdomadaire) affichent
  désormais un fond de ligne coloré selon le statut, assorti à la couleur
  de la pastille correspondante — conservé à l'impression/export PDF.

## Avatars utilisateurs

Mini-banque de 10 avatars (silhouette simple + couleurs reprises de la
palette des rôles déjà utilisée pour les badges — cyan, violet, vert,
ambre, rouge — déclinées en fond rond ou carré arrondi pour la variété),
sélectionnables dans le formulaire de compte (Utilisateurs > Comptes).
Affichés dans le tableau des comptes, l'écran "Qui es-tu ?", la barre
latérale et la bannière de bienvenue. Un compte sans avatar choisi retombe
automatiquement sur un cercle coloré (couleur de son rôle) avec son
initiale, pour ne jamais laisser de trou visuel.

## Édition en ligne, tri, codes personnels (lot 5)

- **Édition en ligne dans le tableau des scènes** : les colonnes "Durée
  montage" et "Monteur" restent modifiables directement dans le tableau —
  double-clic sur la cellule, ou clic sur la petite icône crayon qui
  apparaît au survol. Entrée ou perte de focus valide, Échap annule. Le
  formulaire complet de la scène reste bien sûr disponible en parallèle
  (les deux marchent ensemble, aucune dépendance entre les deux).
- **Tri par colonne dans "Contenu du disque"** : mêmes en-têtes cliquables
  que les autres tableaux triables de l'app (Projet, Dossier, Date, Rôle
  ici, Capacité).
- **Code d'accès personnel par utilisateur** (2ᵉ facteur, même mécanisme
  que le Code Admin déjà existant, étendu à tous les rôles) : demandé
  juste après avoir choisi son nom dans "Qui es-tu ?", si le compte en a
  un configuré. Définissable par un Admin depuis la fiche du compte
  (Utilisateurs > Comptes), ou par la personne elle-même via le bouton
  "Mon code d'accès" dans la barre latérale (qui redemande l'ancien code
  avant d'en fixer un nouveau, si un code existait déjà). Les deux
  mécanismes (Code Admin + code personnel) se cumulent si un compte Admin
  a aussi défini son propre code.
- **Colonne "Date d'arrivée" dans le tableau des rushs journaliers**,
  juste après "Date de tournage", comme demandé.
- **Colonne "Placement" dans le tableau des scènes** : affiche le nom du
  rush lié (par date de tournage) et son disque source ; un survol révèle
  les disques de sauvegarde associés.
- **Résolution des doublons de scènes** : l'alerte "Doublon" du tableau de
  bord ouvre désormais un écran de comparaison — les exemplaires en
  question sont affichés côte à côte (date, statut, durée, monteur,
  commentaire, auteur et date de création) avec deux issues possibles :
  garder l'un et supprimer les autres, ou marquer le doublon comme accepté
  (les garder tous volontairement, ce qui arrête l'alerte pour ce groupe —
  un petit badge "⚠ dupl." reste visible dans le tableau pour le rappeler).

## Correctif

Un bug de fermeture (accès à une variable avant son initialisation) a été
trouvé et corrigé dans la fenêtre "Contenu du disque", qui provoquait une
erreur silencieuse à l'ouverture dans certains cas.

## Correction des durées cumulées (épisode / projet)

Un vrai bug a été corrigé : les totaux de durée d'un épisode et d'un projet
("Durée des scènes montées" au tableau de bord, colonne "Durée" de
l'avancement par épisode, "Durée actuelle" dans la page Épisodes, et les
rapports Général/Épisode/Monteur/Hebdomadaire) prenaient à tort en compte
la **durée de tournage** des scènes pas encore montées dès que leur durée
de montage final était vide — gonflant artificiellement ces totaux avec du
temps de tournage brut au lieu de ne compter que le travail de montage
réellement effectué.

Désormais, tous ces totaux ne comptent **que** la durée de montage final
des scènes qui en ont une (0 sinon, jamais de repli sur le tournage) :
- Tableau de bord : la carte "Durée des scènes montées" affiche ce total
  strict, avec en dessous la "Durée totale au tournage" (somme des durées
  de tournage, à titre de comparaison, inchangée).
- Page Épisodes et tableau "Avancement par épisode" du tableau de bord :
  la colonne "Durée actuelle" reflète le même calcul strict.
- Rapports Général et Épisode : mêmes totaux corrigés ; dans le détail
  scène par scène du rapport épisode, une scène sans montage affiche
  désormais un tiret plutôt que sa durée de tournage.
- Rapports Monteur et Hebdomadaire : les durées cumulées par monteur et
  par semaine suivent la même logique stricte.

La colonne "Durée montage" du tableau des scènes n'était pas concernée
par ce bug (elle affichait déjà la valeur stricte).

## Non développé (explicitement V2 dans le cahier des charges)



Synchronisation cloud, comptes utilisateurs distants, photos de scripts,
QR codes, notifications système, export Excel/PDF natif (l'impression
navigateur couvre le besoin "rapport imprimable" en V1), planning,
calendrier, API.

## Tests effectués

L'application a été testée de bout en bout avec un navigateur automatisé
(création PIN, verrouillage/déverrouillage, création de projet Série et
Film, génération automatique de la structure, création de scènes/disques/
rushs, détection de doublon, export JSON, puis import de ce même export
dans une seconde installation "vierge" pour valider la fusion sans perte de
données). Aucune erreur JavaScript n'a été détectée durant ces parcours.

Le système de comptes/droits a été testé spécifiquement : création des 5
comptes (Admin + 4 rôles), vérification que chaque rôle voit exactement les
boutons et champs attendus (ex. Monteur ne peut pas modifier "Description"
mais peut modifier "Statut" ; Script c'est l'inverse), blocage de la
navigation directe vers une page non autorisée, et prise d'effet immédiate
d'une modification de la matrice de droits par l'Admin sur les autres
comptes.
