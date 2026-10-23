# Capture depuis l'iPhone

Deux raccourcis iOS envoient tout vers l'endpoint `ingest` :

- **Capture**, lancé par l'Action Button : rêve, note, dépense ou entrée d'argent.
- **Paiement Apple Pay**, une automatisation Cartes qui envoie chaque paiement sans rien faire.

## Avant de commencer

Il te faut deux valeurs :

| Valeur | Où la trouver |
| --- | --- |
| URL | `https://<ton-projet>.web.app/api/ingest` |
| Jeton | Celui créé avec `firebase functions:secrets:set INGEST_TOKEN` |

Le jeton reste uniquement dans tes raccourcis. Si ton téléphone est perdu, change-le avec la même commande puis redéploie.

## 1. Le raccourci « Capture »

Dans l'app Raccourcis, crée un raccourci nommé **Capture** :

1. **Choisir dans le menu** avec 4 options : `Rêve`, `Note`, `Dépense`, `Entrée`.
2. Dans **Rêve** :
   - **Dicter le texte** (pratique au réveil, les yeux à moitié fermés), ou **Demander une entrée** de type Texte avec « Autoriser plusieurs lignes ».
   - **Obtenir le contenu de l'URL** : méthode `POST`, en-tête `Authorization` = `Bearer <jeton>`, corps `JSON` :
     - `type` (texte) = `dream`
     - `text` (texte) = le texte dicté
3. Dans **Note** : la même chose avec `type` = `note`.
4. Dans **Dépense** :
   - **Demander une entrée** de type Nombre : « Combien ? »
   - **Demander une entrée** de type Texte : « Pour quoi ? »
   - **Choisir dans la liste** : `essentiel`, `social`, `superflu`, `plus tard`
   - **Obtenir le contenu de l'URL**, corps JSON :
     - `type` = `expense`
     - `amount` (nombre) = le montant
     - `label` = le texte
     - `necessity` = l'élément choisi. Si c'est `plus tard`, ne mets pas ce champ : la dépense apparaîtra dans « À trier ».
5. Dans **Entrée** : montant et libellé, avec `type` = `income`.
6. Après le menu : **Obtenir la valeur du dictionnaire** `message` dans le résultat, puis **Afficher la notification**. Tu verras par exemple « Dépense de 12,50 € enregistrée ».

Ensuite : **Réglages > Bouton Action > Raccourci > Capture**.

## 2. L'automatisation Apple Pay

Dans Raccourcis, onglet **Automatisation** :

1. **Nouvelle automatisation > Transaction**, choisis tes cartes, puis **Exécuter immédiatement**.
2. Action **Obtenir le contenu de l'URL**, `POST`, même en-tête, corps JSON :
   - `type` = `apple_pay`
   - `amount` = *Entrée du raccourci* > **Montant**
   - `merchant` = *Entrée du raccourci* > **Marchand**
   - `card` = *Entrée du raccourci* > **Carte**

Ces paiements arrivent sans catégorie : tu les tries d'un geste dans l'onglet Finance.

## Ce que l'endpoint accepte

```jsonc
{ "type": "dream",     "text": "…", "tags": "vol, lucide" }       // tags optionnels
{ "type": "note",      "text": "…" }
{ "type": "expense",   "amount": "12,50", "label": "Bières", "necessity": "social", "date": "2026-10-22" }
{ "type": "income",    "amount": 900, "label": "Salaire" }
{ "type": "apple_pay", "amount": "4,20 €", "merchant": "Boulangerie", "card": "Visa" }
```

Les montants acceptent les formats iOS français (`1 234,56 €`). Le signe est déduit du type.

Pour tester sans iPhone :

```bash
curl -X POST "https://<ton-projet>.web.app/api/ingest" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"note","text":"Test depuis le terminal"}'
```
