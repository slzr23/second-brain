# Backlog

Où en est le projet. Mis à jour à chaque livraison : ce qui est fait, ce qui attend une action de ma part, ce qui vient ensuite.

Dernière mise à jour : 1er novembre 2026

## 🙋 À faire de mon côté

- [ ] Tester l'automatisation Apple Pay sur un vrai paiement : il doit arriver tout seul dans « À trier »
- [ ] Changer le jeton d'ingestion (il est apparu sur une capture d'écran), puis le remplacer dans les 5 raccourcis du dossier Capture
- [ ] Comparer chaque compte de l'app avec l'appli de la banque ou de la plateforme, noter les écarts
- [ ] Activer GitHub Pages pour la démo : Settings › Pages › Source : « GitHub Actions » (plus tard)

## 🚧 En cours

**Priorité : que les données arrivent toutes seules.** Tant qu'il faut importer à la main, l'app ne sert pas au quotidien ; le travail de Claude (tri, comptes rendus, synthèses) vient ensuite.

**Où on en est :** les captures iPhone fonctionnent (rêves, notes, dépenses, entrées d'argent, eau). Côté finance, seul Apple Pay est relié en direct, et pas encore testé sur un vrai paiement : les comptes bancaires restent à brancher.

## 📋 À venir, dans l'ordre

1. **Finance : synchronisation bancaire automatique** (Enable Banking, usage personnel sur ses propres comptes) : opérations et soldes du compte courant et du Livret A chaque nuit, sans CSV. Vérifier les conditions et la durée du consentement (à renouveler tous les 90 à 180 jours en général). La fusion avec Apple Pay et les dépenses saisies s'applique.

2. **Finance : séparer Patrimoine et Compte courant.** Le compte courant monte à chaque salaire et redescend avec les dépenses : mélangé au patrimoine, il rend la courbe illisible alors que le patrimoine, lui, bouge peu. L'onglet Finance devient deux parties :
   - **Patrimoine** : l'épargne et les placements (Livret A, PEE, crypto), avec sa courbe d'évolution et sa répartition. *À confirmer : compte courant exclu.*
   - **Compte courant** :
     - courbe du solde ;
     - mois calé sur le rythme réel : salaire vers le 27, loyer juste après, aides le 5. *À confirmer : un « mois » qui va du salaire au salaire suivant.*
     - argent gagné du mois, détaillé (salaire, aides, remboursements…), et comparé au mois précédent ;
     - dépenses du mois par catégorie (combien en courses, en sorties…), et comparées au mois précédent ;
     - les dépenses à trier.

3. **Finance : catégories automatiques et tri par Claude.** Chaque dépense reçoit une catégorie déduite du marchand ou du libellé (Courses, Sorties, Transport, Logement et factures, Abonnements, Santé, Shopping, Loisirs et sport, Voyages, Autres), corrigeable d'un geste. Claude propose aussi la nécessité (essentiel, social, superflu) ; l'historique (~870) se trie carte par carte en glissant (inspiré du *Swipe deck* de bencho.dev).

4. **Sport et sommeil : un raccourci Apple Santé chaque matin** : séances de la veille (Garmin les écrit dans Santé), FC, sommeil et, si disponible, FC au repos. Remplace le blocage de l'API Strava. Vérifier d'abord ce que Garmin Connect partage (Santé › Partage › Garmin Connect). Le sommeil s'affiche dans l'app dès que Garmin est relié.

5. **Sport : n'afficher que les 3 dernières activités**, avec un lien vers l'historique complet.

6. **Pensées : catégories de notes et envies d'achat.**
   - Choisir le type de note depuis l'Action Button : par exemple *note de fond* (réflexion) ou *envie d'achat*.
   - Une envie d'achat (objet, prix) rejoint une liste dans Finance, où Claude dit si c'est raisonnable maintenant compte tenu du budget du mois, ou s'il vaut mieux attendre.
   - *À préciser : la liste des types de notes.*

7. **Crypto et PEE : rappel mensuel** pour réimporter Bitstack, Revolut et mettre à jour les parts du PEE (pas d'API ; les cours, eux, sont déjà mis à jour chaque soir).

8. **Sport : compte rendu de Claude après chaque sortie**, et propositions d'ajustement des séances suivantes dans Google Agenda (stockées dans `proposals`, appliquées seulement si je valide).

9. **Pensées : synthèse hebdomadaire des rêves** (thèmes de la semaine).

10. **Sport : le tableau de bord** : allures, zones cardiaques, tendances.

11. **UI : confirmation façon Dynamic Island** (inspirée de bencho.dev) quand une capture arrive ou qu'une dépense est enregistrée.

12. **Sport : FC de tout l'historique** (l'import la contient depuis août 2026), si les tendances sur plusieurs années deviennent utiles.

### Plus tard

- **Santé : objectif d'hydratation réglable** (fixé à 2 L pour l'instant).
- **UI : tirer pour actualiser** sur Finance, pour relancer les cours.
- **UI : bouton + en menu radial** (inspiré de bencho.dev et Smooth UI), à la place de la feuille.
- **UI : cartes de comptes qui s'agrandissent** depuis Patrimoine, au lieu de changer de page.

### Règles pour les briques d'UI externes (bencho.dev, Smooth UI…)

- Vérifier la licence avant de reprendre du code : le repo est public. Sans licence claire, réécrire l'effet avec Motion en s'inspirant seulement du principe.
- Porter chaque bloc dans notre CSS (pas de Tailwind ni de nouvelle librairie de styles).
- Respecter le réglage « Réduire les animations » de l'iPhone.
- Deux ou trois effets utiles, pas plus : l'app reste sobre, façon iOS.

## 🧱 Bloqué ou à décider

- **Nouvelles sorties après l'import Strava** : l'accord d'API Strava interdit d'envoyer les données à une IA, et le programme développeur Garmin est fermé. Pistes : Apple Santé (point 4), ou un nouveau fichier d'import via le connecteur Strava de Claude en attendant.
- **PEE Amundi** : pas d'API. Les fonds suivent le cours de l'action Airbus, mais leurs parts doivent être mises à jour à la main de temps en temps.
- **Historique du PEE** : il n'est connu que depuis sa saisie, donc les graphiques reportent sa valeur actuelle dans le passé. Un export des opérations Amundi (versements, abondements) permettrait de reconstruire la vraie courbe.
- **Courbe crypto exacte** : les mois passés sont valorisés au prix du dernier achat, avec une ligne droite d'un mois à l'autre. Pour suivre le vrai cours jour par jour, il faudrait récupérer l'historique des cours côté serveur.
- **Ethena (ENA)** : vérifier que Yahoo Finance fournit un cours `ENA-EUR`, sinon la ligne garde son dernier prix connu.

## 🔧 Dette technique

- [ ] Le jeton d'ingestion est copié dans les 5 raccourcis du dossier Capture : le changer demande 5 modifications
- [ ] Tester les règles Firestore dans la CI (l'émulateur n'est pas installable dans mon environnement actuel)
- [ ] Mettre à jour les captures d'écran du README avec la nouvelle partie Finance

## ✅ Fait

**Socle**
- PWA React installable sur l'écran d'accueil de l'iPhone, connexion Google, données rangées sous mon seul compte
- Point d'entrée `ingest` avec jeton secret (tolérant sur la façon de l'écrire dans un raccourci)
- CI GitHub Actions, démo publique sur données fictives
- Interface façon iOS : gros titres, barre d'onglets en verre, mode sombre
- Backlog tenu à jour dans le repo

**Captures iPhone**
- Dossier « Capture » sur l'Action Button : 5 raccourcis avec leurs icônes (Rêve, Note, Dépense, Entrée, Eau) et une notification de confirmation
- Automatisation Apple Pay : chaque paiement est envoyé tout seul (à tester sur un vrai paiement)

**Sport**
- Import de l'historique Strava (fichier .json) : toutes les activités, distance, allure, durée, dénivelé, effort relatif, FC moyenne et max des sorties récentes
- Semaine calculée à partir des sorties : volume, nombre de sorties, durée, FC moyenne, comparaison avec la moyenne des 4 semaines précédentes
- Liste des activités par sport (course, foot, vélo, natation…)

**Santé**
- Hydratation : chaque verre envoyé depuis l'Action Button, total du jour contre un objectif de 2 L et les 7 derniers jours dans l'onglet Sport

**Pensées**
- Capture d'un rêve ou d'une note depuis l'Action Button, en dictant ou en tapant
- Journal filtrable

**Finance**
- Saisie de toute entrée ou sortie d'argent depuis le bouton + ou l'Action Button, avec « plus tard » pour trier ensuite
- Tri des dépenses : essentiel, social, superflu
- Fusion à l'import : un paiement Apple Pay ou une dépense saisie dans l'app et la même ligne du relevé ne comptent qu'une fois (même montant, débit dans les 5 jours) ; le libellé et la catégorie donnés dans l'app sont gardés
- Import des relevés Caisse d'Épargne (compte courant, Livret A), avec détection des virements entre mes comptes
- Import des historiques Bitstack et Revolut, positions calculées par plateforme et wallet ; plusieurs fichiers ajoutés un par un ou par glisser-déposer
- Patrimoine global avec répartition en anneau
- Évolution façon Revolut : une courbe du patrimoine total, ou une courbe par compte à sa vraie valeur (sans empilement), axe en euros, variation sur la période, un point par jour jusqu'à 1 an
- Une page par compte, logos des cryptos
- Page Dépenses : mois en cours comparé aux 3 précédents, barres par semaine, mois ou année
- Cours mis à jour chaque soir (Airbus, cryptos) et patrimoine enregistré jour par jour
