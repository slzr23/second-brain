# Second cerveau

Une app perso qui rassemble mon entraînement, mes pensées et mes dépenses, et qui utilise Claude pour en tirer des conseils plutôt que des tableaux de chiffres.

**[Voir la démo](https://slzr23.github.io/second-brain/)** (données fictives, aucun compte nécessaire)

<p>
  <img src="docs/screenshots/sport.png" width="260" alt="Onglet Sport : volume de la semaine, zones cardiaques et compte rendu de chaque sortie">
  <img src="docs/screenshots/pensees.png" width="260" alt="Onglet Pensées : saisie rapide et journal des rêves et notes">
  <img src="docs/screenshots/finance.png" width="260" alt="Onglet Finance : dépenses du mois triées entre essentiel, social et superflu">
</p>

## Pourquoi

Les stats de course sont dans Garmin et Strava, les rêves dans les notes du téléphone, les dépenses nulle part. Chaque outil montre tout, aucun ne dit quoi en faire. Ce projet réunit les trois avec une règle : peu de chiffres, ceux qui servent, et un avis clair quand il y a quelque chose à changer.

## Ce que fait la V1

| Onglet | Fonction | État |
| --- | --- | --- |
| Pensées | Noter un rêve ou une idée en 2 secondes avec l'Action Button de l'iPhone | ✅ |
| Pensées | Journal filtrable des rêves et des notes | ✅ |
| Finance | Saisir une dépense depuis l'Action Button ou le bouton + de l'app | ✅ |
| Finance | Import automatique des paiements Apple Pay | ✅ |
| Finance | Trier chaque dépense : essentielle, sociale ou superflue | ✅ |
| Sport | Import des sorties Strava, FC, allures et zones | 🚧 |
| Sport | Compte rendu de Claude après chaque sortie, ajustement des séances de Google Agenda | 🚧 |
| Sport | Sommeil et FC au repos via Apple Santé | 🚧 |
| Pensées | Synthèse hebdomadaire des thèmes de mes rêves | 🚧 |
| Finance | Import de l'historique bancaire et crypto, patrimoine et évolution par compte | ✅ |
| Finance | Cours des actions et des cryptos à jour chaque soir | ✅ |
| Finance | Synchronisation bancaire automatique | 🚧 |

## Architecture

```mermaid
flowchart LR
  subgraph iPhone
    AB[Action Button] --> SC[Raccourci Capture]
    AP[Paiement Apple Pay] --> AU[Automatisation Cartes]
    HS[Apple Santé] -.-> AH[Automatisation du matin]
  end

  SC & AU & AH -->|POST + jeton| ING[ingest]
  STR[Strava] -.->|webhook| SW[stravaWebhook]
  EB[Enable Banking] -.->|chaque jour| BS[bankSync]

  subgraph Firebase
    ING & SW & BS --> FS[(Firestore)]
    SW -.-> CL[API Claude]
    SW -.-> GC[Google Agenda]
    FS <--> APP[PWA React]
  end
```

Les traits pleins existent, les pointillés sont les prochaines étapes.

- **PWA React + Vite** installée sur l'écran d'accueil de l'iPhone, sans passer par l'App Store.
- **Un seul point d'entrée, `ingest`**, pour tout ce qui vient du téléphone. Il valide chaque requête avec Zod et renvoie un message que le raccourci affiche en notification.
- **Claude n'est appelé qu'avec des données déjà calculées** (un résumé JSON de la sortie, pas les flux bruts), une fois par sortie et une fois par semaine pour les rêves. Le coût reste de l'ordre de quelques centimes par mois.
- **Claude propose, je valide** : un ajustement de séance est stocké dans `proposals` et ne touche l'agenda qu'après acceptation.

### Modèle de données

Tout est rangé sous `users/{uid}` :

| Collection | Contenu | Écrit par |
| --- | --- | --- |
| `entries` | Rêves et notes | Raccourci, app |
| `dreamReports` | Thèmes de la semaine | Function hebdo |
| `transactions` | Montant signé en centimes, catégorie, source | Raccourci, Apple Pay, banque |
| `accounts`, `holdings` | Comptes, livrets, positions | Synchro banque, cours |
| `netWorth` | Patrimoine jour par jour | Function quotidienne |
| `activities` | Sorties et compte rendu de Claude | Webhook Strava |
| `dailyHealth` | Sommeil, FC au repos | Apple Santé |
| `weeklyStats` | Agrégats de la semaine, prêts à afficher | Function |
| `proposals` | Ajustements d'entraînement en attente | Function, puis moi |

Les montants sont des centimes entiers, pour éviter les erreurs d'arrondi. Les règles Firestore n'autorisent l'app qu'à écrire ce dont elle a besoin : créer une note, catégoriser une dépense, accepter une proposition.

## Lancer le projet

### La démo, sans rien configurer

```bash
cd web
npm install
npm run dev:demo
```

### Avec Firebase

Prérequis : Node 22, la CLI `firebase`, et un projet Firebase en offre Blaze avec Firestore et l'authentification Google activés. `.firebaserc` et `web/.env.production` pointent vers mon projet : pour le tien, lance `firebase use --add` et remplace les valeurs.

```bash
echo "VITE_FIREBASE_API_KEY=<clé>" > web/.env.local   # gardée hors de git
(cd functions && npm ci) && (cd web && npm ci)

openssl rand -base64 32 | tee ingest-token.txt | firebase functions:secrets:set INGEST_TOKEN --data-file=-
firebase deploy
```

Connecte-toi une fois sur l'app, récupère ton uid (console Firebase > Authentication), puis :

```bash
echo "OWNER_UID=<uid>" > functions/.env.<id-du-projet>
firebase deploy --only functions
```

Ensuite, configure les raccourcis iPhone : [docs/action-button.md](docs/action-button.md).

### Tests

```bash
cd functions && npm test
```

## Vie privée

Ce dépôt est public, mes données non. Elles vivent uniquement dans Firestore, lisibles par mon seul compte. Les secrets (jeton d'ingestion, clés Strava, Claude et Enable Banking) sont dans Secret Manager. La démo publique ne tourne que sur des données inventées.

## Feuille de route

Le détail, mis à jour à chaque livraison, est dans [docs/BACKLOG.md](docs/BACKLOG.md).

1. ~~Socle : PWA, Firebase, capture depuis l'Action Button~~
2. ~~Finance : import de l'historique, patrimoine, cours quotidiens~~
3. Finance : tri de l'historique des dépenses par Claude
4. Sport : historique Strava, statistiques, compte rendu Claude, ajustements dans Google Agenda
5. Sport : sommeil et FC au repos depuis Apple Santé
6. Pensées : synthèse hebdomadaire des rêves
7. Finance : synchronisation bancaire automatique

## Stack

- **Interface** : React 19, Vite, TypeScript, PWA (Workbox). Look iOS natif : SF Pro sur Apple (Geist ailleurs), couleurs système d'Apple, gros titres, barre d'onglets flottante en verre.
- **Composants** : [Motion](https://motion.dev) pour les animations, [NumberFlow](https://number-flow.barvian.me) pour les montants animés, [Recharts](https://recharts.org) pour les graphiques, [Vaul](https://vaul.emilkowal.ski) pour la feuille de saisie, [Sonner](https://sonner.emilkowal.ski) pour les notifications, [Phosphor](https://phosphoricons.com) pour les icônes.
- **Backend** : Firebase Auth, Firestore, Cloud Functions v2 (Node 22), Zod, Vitest.
- **Outillage** : GitHub Actions (CI et démo sur GitHub Pages). La démo ne télécharge jamais Firebase : le code connecté est chargé à la demande.
