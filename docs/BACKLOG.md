# Backlog

Où en est le projet. Mis à jour à chaque livraison : ce qui est fait, ce qui attend une action de ma part, ce qui vient ensuite.

Dernière mise à jour : 26 novembre 2026

## 🙋 À faire de mon côté

- [x] Autoriser `slzr-4701d.web.app` dans l'environnement cloud : la routine Strava envoie les sorties (testée le 20 novembre)
- [x] Raccourci « Santé du matin » : nuit et FC au repos arrivent (testé le 20 novembre)
- [x] Automatisation « Santé du matin » à 9 h
- [ ] Surveiller le sommeil profond : à 0 sur la première nuit reçue (Garmin le transmet-il à Santé ?)
- [ ] Supprimer les 3 lignes de test de Finance (« Test », « Test retour », « Mcdonald » à −1 €)
- [ ] Comparer chaque compte de l'app avec l'appli de la banque ou de la plateforme, noter les écarts
- [ ] Rappel mensuel sur l'iPhone : solde du Livret A, parts du PEE, réimport Bitstack et Revolut
- [ ] Activer GitHub Pages pour la démo : Settings › Pages › Source : « GitHub Actions » (plus tard)

## 🚧 En cours

**Priorité : que les données arrivent toutes seules.** Tant qu'il faut importer à la main, l'app ne sert pas au quotidien ; le travail de Claude (tri, comptes rendus, synthèses) vient ensuite.

**Où on en est :** les captures iPhone, Apple Pay et le compte courant arrivent tout seuls. Pour le sport et le sommeil, le code est déployé ([docs/sante.md](sante.md)) ; reste la configuration de mon côté.

**Sport et sommeil.** Un raccourci ne sait pas lire les séances dans Apple Santé, d'où deux chemins :
- **Séances** : routine Claude chaque soir à 21 h, qui lit les sorties via le connecteur Strava et les envoie avec un jeton limité aux activités. Les sorties du 31 octobre au 19 novembre ont été rattrapées à la main le 20 novembre.
- **Sommeil et FC au repos** : raccourci « Santé du matin » à 9 h, carte Sommeil dans l'onglet Sport.

## 📋 À venir, dans l'ordre

1. **Finance : catégories automatiques et tri par Claude.** *Code prêt le 20 novembre (fonction `classifyNow`, tri après la synchro du matin, cartes à glisser, catégorie modifiable d'un geste) ; en attente de la clé API Anthropic (`firebase functions:secrets:set ANTHROPIC_API_KEY`) pour être déployé.* Chaque dépense reçoit une catégorie déduite du marchand ou du libellé (Courses, Sorties, Transport, Logement et factures, Abonnements, Santé, Shopping, Loisirs et sport, Voyages, Autres), corrigeable d'un geste. Claude propose aussi la nécessité (essentiel, social, superflu) ; l'historique (~870) se trie carte par carte en glissant (inspiré du *Swipe deck* de bencho.dev). Urgent : la synchro bancaire n'a pas les catégories de la banque, 30 dépenses sur 47 de novembre sont à trier.

2. **Sport : n'afficher que les 3 dernières activités**, avec un lien vers l'historique complet.

3. **Pensées : catégories de notes et envies d'achat.**
   - Types de notes, choisis depuis l'Action Button : *Idée*, *À faire*, *Réflexion* (note de fond) et *Envie d'achat*. *Proposition, à valider.*
   - Une envie d'achat précise son genre (livre, vêtement, tech, autre) et un prix, si connu. Elle rejoint une liste dans Finance, où Claude dit si c'est raisonnable maintenant compte tenu du budget du mois, ou s'il vaut mieux attendre.

4. **Sport : compte rendu de Claude après chaque sortie**, et propositions d'ajustement des séances suivantes dans Google Agenda (stockées dans `proposals`, appliquées seulement si je valide).

5. **Pensées : synthèse hebdomadaire des rêves** (thèmes de la semaine).

6. **Sport : le tableau de bord** : allures, zones cardiaques, tendances.

7. **UI : confirmation façon Dynamic Island** (inspirée de bencho.dev) quand une capture arrive ou qu'une dépense est enregistrée.

8. **Sport : FC de tout l'historique** (l'import la contient depuis août 2026), si les tendances sur plusieurs années deviennent utiles.

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

- **Webhook Strava** (une sortie dans l'app dès qu'elle est sur Strava) : une application sur l'API Strava est soumise à un accord qui interdit de transmettre les données à une IA. Piste : un webhook qui ne transmet que l'identifiant et déclenche la routine, qui lit la sortie via le connecteur officiel.
- **Livret A hors synchro** : la Caisse d'Épargne n'a partagé que le compte courant (l'accès DSP2 ne couvre en principe que les comptes de paiement). Son solde se met à jour à la main ; les virements depuis le compte courant sont bien reconnus comme épargne.
- **PEE Amundi** : pas d'API. Les fonds suivent le cours de l'action Airbus, mais leurs parts doivent être mises à jour à la main de temps en temps.
- **Historique du PEE** : il n'est connu que depuis sa saisie, donc les graphiques reportent sa valeur actuelle dans le passé. Un export des opérations Amundi (versements, abondements) permettrait de reconstruire la vraie courbe.
- **Courbe crypto exacte** : les mois passés sont valorisés au prix du dernier achat, avec une ligne droite d'un mois à l'autre. Pour suivre le vrai cours jour par jour, il faudrait récupérer l'historique des cours côté serveur.
- **Ethena (ENA)** : vérifier que Yahoo Finance fournit un cours `ENA-EUR`, sinon la ligne garde son dernier prix connu.

## 🔧 Dette technique

- [ ] Le jeton d'ingestion est copié dans chaque raccourci du dossier Capture et dans l'automatisation Apple Pay : un seul raccourci « Envoyer » appelé par tous les autres le garderait à un seul endroit
- [ ] Tester les règles Firestore dans la CI (l'émulateur n'est pas installable dans mon environnement actuel)
- [ ] Mettre à jour les captures d'écran du README avec la nouvelle partie Finance

## ✅ Fait

**Finance : Compte courant et Patrimoine séparés** (23 novembre, inspiré de Personal Finance de Claude)
- Deux parties : *Compte courant* (le quotidien) et *Patrimoine* (épargne et placements seulement, sans le compte courant ni total « tout compris »)
- Mois calé sur le jour où le salaire arrive vraiment (le 27 par défaut), reconnu même sans le mot « salaire » dans le libellé
- « Il te reste avant la paie » : solde moins les prélèvements attendus d'ici la paie
- Ce mois-ci : gagné, dépensé, mis de côté, comparés au mois dernier, avec la moyenne et la capacité d'épargne
- « Où est passé ton salaire » : dépenses par catégorie, moyenne et écart au mois dernier ; un appui ouvre la catégorie
- « À surveiller » : découvert prévu, frais bancaires sur 12 mois (nets des remises), paiements en double, abonnements en hausse
- « Chaque mois » : les dépenses récurrentes repérées seules, avec leur coût annuel
- Argent gagné par type (salaire, aides, virements reçus) comparé au mois dernier
- Hors budget (26 novembre) : un prêt, un don ou une grosse rentrée ponctuelle sont repérés seuls et comptés à part, hors revenus, dépenses, moyennes et épargne ; ce qui en reste sur le compte n'entre pas dans « Il te reste avant la paie ». N'importe quel mouvement peut être sorti du budget (ou y être remis) d'un geste
- Salaire versé en avance : le mois démarre le jour où il arrive, dès le 15

**Socle**
- PWA React installable sur l'écran d'accueil de l'iPhone, connexion Google, données rangées sous mon seul compte
- Point d'entrée `ingest` avec jeton secret (tolérant sur la façon de l'écrire dans un raccourci) ; un jeton refusé est journalisé sans jamais écrire le jeton
- CI GitHub Actions, démo publique sur données fictives
- Interface façon iOS : gros titres, barre d'onglets en verre, mode sombre
- Backlog tenu à jour dans le repo

**Captures iPhone**
- Dossier « Capture » sur l'Action Button : 5 raccourcis avec leurs icônes (Rêve, Note, Dépense, Entrée, Eau) et une notification de confirmation
- Automatisation Apple Pay : chaque paiement arrive tout seul (en service depuis le 9 novembre)

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
- **Synchro bancaire chaque matin** (Enable Banking, [docs/banque.md](banque.md)) : opérations et solde du compte courant, sans CSV ; consentement jusqu'au 8 mai 2027, rappel dans l'app 14 jours avant. Pas de doublon avec les imports CSV, opérations datées du jour d'achat, un commerçant déjà trié garde sa catégorie, un prêt n'est pas compté comme revenu
- Saisie de toute entrée ou sortie d'argent depuis le bouton + ou l'Action Button, avec « plus tard » pour trier ensuite
- Tri des dépenses : essentiel, social, superflu
- Fusion : un paiement Apple Pay ou une dépense saisie dans l'app et la même ligne bancaire (synchro ou relevé) ne comptent qu'une fois (même montant, débit dans les 5 jours) ; le libellé et la catégorie donnés dans l'app sont gardés
- Import des relevés Caisse d'Épargne (compte courant, Livret A), avec détection des virements entre mes comptes
- Import des historiques Bitstack et Revolut, positions calculées par plateforme et wallet ; plusieurs fichiers ajoutés un par un ou par glisser-déposer
- Patrimoine global avec répartition en anneau
- Évolution façon Revolut : une courbe du patrimoine total, ou une courbe par compte à sa vraie valeur (sans empilement), axe en euros, variation sur la période, un point par jour jusqu'à 1 an
- Une page par compte, logos des cryptos
- Page Dépenses : mois en cours comparé aux 3 précédents, barres par semaine, mois ou année
- Cours mis à jour chaque soir (Airbus, cryptos) et patrimoine enregistré jour par jour
