# SòlPèp

Application web progressive (PWA) pour gérer un sòl (tontine) : membres, tours, paiements (même partiels), notes et totaux.
Elle s'installe sur le téléphone et fonctionne **sans Internet**. Interface en créole haïtien.

> Outil de suivi uniquement. L'application ne manipule **aucun argent réel**.

## Lancer l'application

Les modules JavaScript et le service worker **ne fonctionnent pas en double-cliquant sur `index.html`** (protocole `file://`).
Il faut un petit serveur local :

```bash
cd jere-sol
python3 -m http.server 8080
# puis ouvrir http://localhost:8080 dans Chrome
```

Autres options : `npx serve .`, ou l'extension « Live Server » de VS Code.

### Publier gratuitement (obligatoire pour installer sur un vrai téléphone)

L'installation PWA exige **HTTPS** (sauf `localhost`). Déposez simplement le dossier sur :
Netlify (glisser-déposer), GitHub Pages, Cloudflare Pages ou Vercel. Aucun build n'est nécessaire.

### Installer sur le téléphone

- **Android / Chrome** : menu ⋮ → « Installer l'application » (ou le bouton affiché sur l'accueil).
- **iPhone / Safari** : Partager → « Sur l'écran d'accueil ».

Après la première visite en ligne, tout est en cache : testez en mode avion.

## Structure

```
jere-sol/
├── index.html            Coquille de l'application
├── manifest.json         Nom, icônes, couleurs, mode « standalone »
├── service-worker.js     Cache hors-ligne (precache + mise à jour en arrière-plan)
├── css/styles.css        Design mobile
├── icons/                Icônes 192, 512, maskable et Apple
└── js/
    ├── app.js            Point d'entrée : routeur (hash), migration, service worker
    ├── db.js             Couche données IndexedDB + migration depuis localStorage
    ├── calc.js           Tous les calculs (totaux par membre, par tour, global)
    ├── format.js         Format HTG « 1 500,00 HTG » et lecture des montants
    ├── ui.js             Fenêtres du bas, confirmations, toasts, téléchargement
    ├── install.js        Bouton « Enstale aplikasyon an »
    ├── lib/idb.js        Enveloppe IndexedDB compatible avec l'API de `idb`
    └── views/
        ├── home.js       Liste des sòl + création
        └── group.js      Onglets Manch / Tablo / Manm, paiements, export CSV
```

## Fonctionnalités

| Demande | Où |
|---|---|
| Renommer un membre | Onglet **Manm** → « Chanje non » |
| « Supprimer » un membre = le rendre inactif (grisé, rien n'est effacé) | Onglet **Manm** → « Dezaktive » (confirmation) puis « Reaktive » |
| Paiement partiel (montant réel) | Touchez un membre (onglet Manch) ou une case (onglet Tablo) : champ montant + boutons *Peye nèt / Mwatye / Vide* |
| Note par paiement | Même fenêtre, champ « Nòt » (un point apparaît dans le tableau) |
| Total par membre (peye / dwe / rete) | Onglet **Manm** |
| Format `1 500,00 HTG` | `js/format.js`, partout |
| Confirmation avant effacement | Désactiver un membre, effacer un paiement, effacer un sòl |
| Design mobile | Barre d'onglets, pièces de tour, fenêtres du bas, colonne « Manm » figée dans le tableau |
| IndexedDB | `js/db.js` (stores `groups`, `members`, `payments`, `meta`) |
| Installable + hors-ligne | `manifest.json` + `service-worker.js` |

Autres : export CSV (séparateur `;`, virgule décimale, UTF-8 avec BOM : s'ouvre directement dans Excel/LibreOffice en français), modification du nom/montant d'un sòl, ajout de membres, suppression d'un sòl.

## Règles de calcul

- Nombre de tours = nombre de membres (inactifs inclus, pour que l'ordre ne change pas). Le membre de rang *r* reçoit le tour *r*.
- Chaque membre **actif** doit `montant × nombre de tours`.
- Un membre **inactif** ne doit plus rien ; ses paiements déjà faits restent comptés dans « Lajan kolekte ».
- Une case est « payée » si montant ≥ montant du sòl, « partielle » si 0 < montant < montant du sòl.

## Migration depuis la version MVP (localStorage)

Au premier lancement, si l'ancienne clé `jere_sol_v1` existe, ses sòl, membres et paiements sont copiés dans IndexedDB
(chaque ancien ✓ devient un paiement égal au montant du sòl). L'ancienne donnée est conservée sous `jere_sol_v1_backup`.

## À propos de la bibliothèque `idb`

`js/lib/idb.js` est une mini-implémentation locale **compatible avec l'API de `idb`** (`openDB`, `get`, `getAll`, `getAllFromIndex`, `put`, `delete`, `transaction`, `tx.done`),
écrite pour que le projet fonctionne hors ligne sans téléchargement.
Pour utiliser la vraie bibliothèque : remplacez ce fichier par le contenu de
`https://cdn.jsdelivr.net/npm/idb@8/build/index.js` (même nom de fichier). Rien d'autre à modifier.

## Mettre à jour l'application

Après une modification, changez `VERSION` dans `service-worker.js` (ex. `v1.0.1`) pour que les téléphones rechargent les nouveaux fichiers.
Si vous ajoutez un fichier, ajoutez-le aussi à la liste `ASSETS`.

## Limites connues

- Les données restent **sur l'appareil** : changer de téléphone ou vider les données du navigateur les efface. Exportez régulièrement en CSV.
- Pas de comptes, pas de synchronisation entre appareils, pas de réorganisation de l'ordre des membres.
- Pas de mode sombre.


## Firebase : statistiques anonymes, rapèl push et administration

Fichiers ajoutés : `js/firebase-config.js`, `js/cloud.js`, `js/views/settings.js`, `admin.html`, `js/admin.js`, `css/admin.css`,
`scripts/` (envoi des notifications) et `.github/workflows/notify.yml` (tâche planifiée toutes les 15 minutes).

- **Aucune donnée personnelle n'est envoyée** : jamais de nom, de nom de sòl ni de montant. Seulement un identifiant anonyme, la version,
  la plate-forme, la dernière ouverture et, si l'utilisateur active les rappels, un jeton de notification et les dates des manch (`2026-11-24|3`).
- L'utilisateur peut tout désactiver dans **Rapèl ak konfidansyalite** (page d'accueil).
- **Rappels** : une notification la veille et le jour de chaque manch, vers 8 h (heure d'Haïti), envoyée par `scripts/notify.mjs` via GitHub Actions.
- **Admin** : `https://<votre-site>/admin.html` (connexion e-mail + mot de passe). Statistiques, mode maintenance, annonce, version minimale obligatoire,
  notification à tous.
- **Secret requis** dans GitHub (*Settings → Secrets and variables → Actions*) : `FIREBASE_SERVICE_ACCOUNT` = contenu JSON de la clé de compte de service.
  Ne jamais mettre ce fichier dans le dépôt.
- Garder `APP_VERSION` (`js/version.js`) et `VERSION` (`service-worker.js`) identiques.


## Kòd sòl, istorik ak sovgad kont (v1.5.0)

- Chak sòl gen yon **kòd inik** (`SOL-K7M4QX`), visible dans le menu du sòl (« Wè kòd sòl la »).
- **Rien n'est effacé** : « Achive sòl la » ou « Make sòl la fini » grise le sòl et le place dans l'onglet **Istorik**.
  Pour le réactiver, il faut saisir son code (5 essais, puis 30 secondes d'attente).
- **Sovgad kont** : connexion avec Google (Firebase Auth). Chaque sòl est copié dans Firestore (`users/{uid}/sols/{solId}`).
  Sur un nouveau téléphone : se connecter restaure tous les sòl. En cas de conflit, la version la plus récente gagne (par sòl).
- Règles de sécurité : `firestore.rules` (à copier dans Firebase → Firestore → Règles → Publier).
