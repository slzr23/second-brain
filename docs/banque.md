# Synchro bancaire

Chaque matin à 6 h 15, les fonctions récupèrent les opérations et les soldes du compte courant et du Livret A via [Enable Banking](https://enablebanking.com), un agrégateur agréé DSP2. Plus besoin d'importer de relevé CSV.

- Seules les opérations **comptabilisées** sont prises. Les opérations en attente arrivent le lendemain, une fois passées.
- Une opération déjà importée par CSV n'est pas recréée : même compte, même montant, à 3 jours près.
- Un paiement Apple Pay ou une dépense saisie est **remplacé** par sa ligne bancaire, comme à l'import (même montant, débité de la veille à 5 jours après). Le libellé et la catégorie que tu as donnés sont gardés.
- Le solde de chaque compte et son historique mensuel sont mis à jour dans Patrimoine.
- Un déblocage de prêt (« BPCE FINANCEMENT ») n'est pas compté comme un revenu.
- Une opération par carte est datée du jour de l'achat (`FACT 081026` dans le libellé), comme dans le relevé CSV, et non du jour où elle passe sur le compte.
- Un commerçant déjà trié garde sa catégorie.

## Mise en place (une fois)

1. **Créer l'application** sur https://enablebanking.com/cp/applications :
   - environnement **Production**, option de clé par défaut ;
   - redirect URL : `https://slzr-4701d.web.app/api/bank/callback`.

   Le navigateur télécharge `<id-de-l-app>.pem`, la clé privée. Ne la mets jamais dans le repo.
2. **L'activer gratuitement** : bouton « Activate by linking accounts », puis lier ses propres comptes. L'application passe en *mode restreint* : elle ne lit que les comptes liés, ce qui suffit pour un usage personnel.
3. **Configurer les fonctions** :

   ```bash
   firebase functions:secrets:set ENABLE_BANKING_KEY --data-file=~/Téléchargements/<id>.pem
   # dans functions/.env.slzr-4701d :
   ENABLE_BANKING_APP_ID=<id>
   BANK_ASPSP="Caisse d'Epargne Normandie"   # nom exact listé par GET /aspsps
   APP_URL=https://slzr-4701d.web.app
   ```

   Puis déployer **en nommant les fonctions**. Le projet Firebase héberge aussi les fonctions d'un autre projet (`createGame`, `joinGame`…) : un `--only functions` proposerait de les supprimer.

   ```bash
   firebase deploy --only functions:ingest,functions:refreshPrices,functions:bankConnect,functions:bankCallback,functions:bankSync,functions:bankSyncNow,hosting
   ```

4. **Connecter la banque** : Finance › Comptes › **Synchro bancaire** › Connecter. Tu t'identifies sur le site de la Caisse d'Épargne, puis tu reviens dans l'app. Une première synchro reprend les 10 jours précédant le dernier import CSV.

## Au quotidien

- La ligne **Synchro bancaire** donne l'heure de la dernière synchro et le nombre de jours restants du consentement.
- Un appui lance une synchro tout de suite. Les banques limitent les lectures sans toi à quelques-unes par jour : n'en abuse pas.
- **Tous les 180 jours au plus**, le consentement expire. La ligne passe en orange 14 jours avant : un appui sur **Reconnecter** relance la connexion.
- En cas d'erreur, le message de la banque s'affiche sur la ligne, et le détail est dans `firebase functions:log --only bankSync`.
