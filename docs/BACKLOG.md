# Backlog

Où en est le projet. Mis à jour à chaque livraison : ce qui est fait, ce qui attend une action de ma part, ce qui vient ensuite.

Dernière mise à jour : 1er novembre 2026

## 🙋 À faire de mon côté

- [x] Déployer la dernière version : `git pull`, `npm --prefix web install`, `firebase deploy --only hosting`
- [x] Réimporter les 5 fichiers crypto (4 Bitstack et Revolut) et vérifier que la ligne Bitstack couvre bien jusqu'à septembre 2026
- [x] Renseigner le solde réel du compte courant et du Livret A avec les lignes « Ajouter » de Patrimoine
- [ ] Comparer chaque compte de l'app avec l'appli de la banque ou de la plateforme, noter les écarts
- [x] Déployer la version avec l'import Strava : `git pull` puis `firebase deploy --only hosting,firestore:rules` (les règles autorisent maintenant l'écriture des activités)
- [x] Importer `strava-historique.json` (préparé par Claude via le connecteur Strava) avec + › Importer un fichier
- [x] Chantier 1 : `OWNER_UID` dans `functions/.env.slzr-4701d`, jeton `INGEST_TOKEN`, `firebase deploy --only functions`, test `curl`
- [x] Chantier 1 : raccourci « Capture » sur l'Action Button et automatisation Apple Pay sur l'iPhone ([docs/action-button.md](action-button.md)), puis tester un rêve, une dépense et un vrai paiement Apple Pay
- [ ] Activer GitHub Pages pour la démo : Settings › Pages › Source : « GitHub Actions » (plus tard)

## 🚧 En cours

**Priorité : que les données arrivent toutes seules.** Tant qu'il faut importer à la main, l'app ne sert pas au quotidien ; le travail de Claude (tri, comptes rendus, synthèses) vient ensuite.

**Chantier 1 : captures iPhone, terminé.** Rêve, note, dépense, entrée d'argent et eau depuis l'Action Button, paiements Apple Pay automatiques : tout arrive dans l'app. Reste à vérifier sur un vrai paiement Apple Pay, puis à changer le jeton (il est apparu sur une capture d'écran). Prochain chantier : la synchronisation bancaire.

## 📋 À venir, dans l'ordre

1. **Finance : synchronisation bancaire automatique** (Enable Banking, usage personnel sur ses propres comptes) : opérations et soldes du compte courant et du Livret A chaque nuit, sans CSV. Vérifier les conditions et la durée du consentement (à renouveler tous les 90 à 180 jours en général). La même fusion avec Apple Pay s'applique.
2. **Sport et sommeil : un raccourci Apple Santé chaque matin** : séances de la veille (Garmin les écrit dans Santé), FC, sommeil et, si disponible, FC au repos. Remplace le blocage de l'API Strava. Vérifier d'abord ce que Garmin Connect partage (Santé › Partage › Garmin Connect).
3. **Crypto et PEE : rappel mensuel** pour réimporter Bitstack, Revolut et mettre à jour les parts du PEE (pas d'API ; les cours, eux, sont déjà mis à jour chaque soir).
4. **Finance : Claude classe les dépenses.** Chaque nouvelle dépense reçoit une proposition (essentiel, social, superflu), et l'historique (~870) se trie carte par carte en glissant (inspiré du *Swipe deck* de bencho.dev).
5. **Sport : compte rendu de Claude après chaque sortie**, et propositions d'ajustement des séances suivantes dans Google Agenda (stockées dans `proposals`, appliquées seulement si je valide).
6. **Pensées : synthèse hebdomadaire des rêves** (thèmes de la semaine).
7. **Sport : le tableau de bord** : allures, zones cardiaques, tendances.
8. **UI : confirmation façon Dynamic Island** (inspirée de bencho.dev) quand une capture arrive ou qu'une dépense est enregistrée.
9. **Sport : FC de tout l'historique** (l'import la contient depuis août 2026), si les tendances sur plusieurs années deviennent utiles.

### Plus tard

- **UI : tirer pour actualiser** sur Finance, pour relancer les cours.
- **UI : bouton + en menu radial** (inspiré de bencho.dev et Smooth UI), à la place de la feuille.
- **UI : cartes de comptes qui s'agrandissent** depuis Patrimoine, au lieu de changer de page.

### Règles pour les briques d'UI externes (bencho.dev, Smooth UI…)

- Vérifier la licence avant de reprendre du code : le repo est public. Sans licence claire, réécrire l'effet avec Motion en s'inspirant seulement du principe.
- Porter chaque bloc dans notre CSS (pas de Tailwind ni de nouvelle librairie de styles).
- Respecter le réglage « Réduire les animations » de l'iPhone.
- Deux ou trois effets utiles, pas plus : l'app reste sobre, façon iOS.

## 🧱 Bloqué ou à décider

- **Nouvelles sorties après l'import Strava** : l'accord d'API Strava interdit d'envoyer les données à une IA, et le programme développeur Garmin est fermé. Pistes : refaire un fichier d'import via le connecteur Strava de Claude (comme pour l'historique), ou récupérer les entraînements depuis Apple Santé.
- **PEE Amundi** : pas d'API. Les fonds suivent le cours de l'action Airbus, mais leurs parts doivent être mises à jour à la main de temps en temps.
- **Historique du PEE** : il n'est connu que depuis sa saisie, donc les graphiques reportent sa valeur actuelle dans le passé. Un export des opérations Amundi (versements, abondements) permettrait de reconstruire la vraie courbe.
- **Courbe crypto exacte** : les mois passés sont valorisés au prix du dernier achat, avec une ligne droite d'un mois à l'autre. Pour suivre le vrai cours jour par jour, il faudrait récupérer l'historique des cours côté serveur.
- **Ethena (ENA)** : vérifier que Yahoo Finance fournit un cours `ENA-EUR`, sinon la ligne garde son dernier prix connu.

## 🔧 Dette technique

- [ ] Tester les règles Firestore dans la CI (l'émulateur n'est pas installable dans mon environnement actuel)
- [ ] Mettre à jour les captures d'écran du README avec la nouvelle partie Finance

## ✅ Fait

**Socle**
- PWA React installable sur l'iPhone, connexion Google, données rangées sous mon seul compte
- Point d'entrée `ingest` pour l'Action Button et Apple Pay, avec jeton secret
- CI GitHub Actions, démo publique sur données fictives
- Interface façon iOS : gros titres, barre d'onglets en verre, mode sombre

**Sport**
- Import de l'historique Strava (fichier .json) : toutes les activités, distance, allure, durée, dénivelé, effort relatif, FC moyenne et max des sorties récentes
- Semaine calculée à partir des sorties : volume, nombre de sorties, durée, FC moyenne, comparaison avec la moyenne des 4 semaines précédentes
- Liste des activités par sport (course, foot, vélo, natation…)

**Santé**
- Hydratation : chaque verre envoyé depuis l'Action Button (« Eau »), total du jour contre un objectif de 2 L et les 7 derniers jours dans l'onglet Sport

**Pensées**
- Capture d'un rêve ou d'une note en 2 secondes avec l'Action Button
- Journal filtrable

**Finance**
- Saisie de toute entrée ou sortie d'argent depuis le bouton + ou l'Action Button, import automatique des paiements Apple Pay
- Tri des dépenses : essentiel, social, superflu
- Fusion à l'import : un paiement Apple Pay ou une dépense saisie dans l'app et la même ligne du relevé ne comptent qu'une fois (même montant, débit dans les 5 jours) ; le libellé et la catégorie donnés dans l'app sont gardés
- Import des relevés Caisse d'Épargne (compte courant, Livret A), avec détection des virements entre mes comptes
- Import des historiques Bitstack et Revolut, positions calculées par plateforme et wallet ; plusieurs fichiers ajoutés un par un ou par glisser-déposer
- Patrimoine global avec répartition en anneau
- Évolution façon Revolut : une courbe du patrimoine total, ou une courbe par compte à sa vraie valeur (sans empilement), axe en euros, variation sur la période, un point par jour jusqu'à 1 an
- Une page par compte, logos des cryptos
- Page Dépenses : mois en cours comparé aux 3 précédents, barres par semaine, mois ou année
- Cours mis à jour chaque soir (Airbus, cryptos) et patrimoine enregistré jour par jour
