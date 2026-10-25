# Backlog

Où en est le projet. Mis à jour à chaque livraison : ce qui est fait, ce qui attend une action de ma part, ce qui vient ensuite.

Dernière mise à jour : 25 octobre 2026

## 🙋 À faire de mon côté

- [ ] Déployer la dernière version : `git pull`, `npm --prefix web install`, `firebase deploy --only hosting`
- [ ] Réimporter les 5 fichiers crypto (4 Bitstack et Revolut) et vérifier que la ligne Bitstack couvre bien jusqu'à septembre 2026
- [ ] Renseigner le solde réel du compte courant et du Livret A avec les lignes « Ajouter » de Patrimoine
- [ ] Comparer chaque compte de l'app avec l'appli de la banque ou de la plateforme, noter les écarts
- [ ] Envoyer l'archive Strava dès qu'elle arrive (l'en-tête de `activities.csv` et 2 ou 3 lignes suffisent pour écrire l'import)
- [ ] Activer GitHub Pages pour la démo : Settings › Pages › Source : « GitHub Actions »

## 🚧 En cours

**Finance : refaire le point sur les comptes.** Une fois les imports corrigés, chaque compte doit tomber juste à l'euro près, ou avoir un écart expliqué.

## 📋 À venir, dans l'ordre

1. **Finance : trier l'historique avec Claude.** Environ 870 dépenses importées ne sont pas classées. Claude propose essentiel, social ou superflu par lots, je valide d'un geste.
2. **Sport : importer l'historique Strava** depuis l'archive : sorties, distances, allures, FC, zones.
3. **Sport : le tableau de bord** : volume de la semaine, nombre de sorties, allures, zones cardiaques.
4. **Sport : compte rendu de Claude après chaque sortie**, et propositions d'ajustement des séances suivantes dans Google Agenda (stockées dans `proposals`, appliquées seulement si je valide).
5. **Sport : sommeil et FC au repos** via un raccourci Apple Santé chaque matin.
6. **Pensées : synthèse hebdomadaire des rêves** (thèmes de la semaine).
7. **Finance : synchronisation bancaire automatique** (Enable Banking) pour ne plus exporter de CSV.

## 🧱 Bloqué ou à décider

- **Nouvelles sorties après l'import Strava** : l'accord d'API Strava interdit d'envoyer les données à une IA, et le programme développeur Garmin est fermé. Piste : récupérer les entraînements depuis Apple Santé.
- **PEE Amundi** : pas d'API. Les fonds suivent le cours de l'action Airbus, mais leurs parts doivent être mises à jour à la main de temps en temps.
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

**Pensées**
- Capture d'un rêve ou d'une note en 2 secondes avec l'Action Button
- Journal filtrable

**Finance**
- Saisie de toute entrée ou sortie d'argent depuis le bouton + ou l'Action Button, import automatique des paiements Apple Pay
- Tri des dépenses : essentiel, social, superflu
- Import des relevés Caisse d'Épargne (compte courant, Livret A), avec détection des virements entre mes comptes
- Import des historiques Bitstack et Revolut, positions calculées par plateforme et wallet ; plusieurs fichiers ajoutés un par un ou par glisser-déposer
- Patrimoine global avec répartition en anneau
- Évolution filtrable par compte, de 1 semaine à tout l'historique
- Une page par compte, logos des cryptos
- Page Dépenses : mois en cours comparé aux 3 précédents, barres par semaine, mois ou année
- Cours mis à jour chaque soir (Airbus, cryptos) et patrimoine enregistré jour par jour
