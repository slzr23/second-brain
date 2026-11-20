# Sport et sommeil

Deux chemins, car un raccourci iPhone ne sait pas lire les séances dans Apple Santé :

- **Sommeil et FC au repos** : un raccourci « Santé du matin » lit Apple Santé (Garmin y écrit tes nuits) et les envoie à l'app chaque matin.
- **Séances** : une routine Claude lit chaque soir tes nouvelles sorties avec le connecteur Strava officiel, et les envoie à l'app.

Les deux arrivent par l'endpoint `ingest`, comme les captures.

## 1. Garmin → Apple Santé

- Garmin Connect › Plus › Paramètres › Applications connectées › **Apple Santé** : activer le sommeil et la fréquence cardiaque.
- Santé › Partage › Apps › **Garmin Connect** : autoriser l'écriture de « Analyse du sommeil » et « Fréquence cardiaque au repos ».

## 2. Le raccourci « Santé du matin »

Dans Raccourcis, nouveau raccourci **Santé du matin** :

1. **Rechercher des échantillons de santé** : Type *Analyse du sommeil*, Date de début *dans les derniers 1 jours*, trier par *Date de début*, ordre *Le plus ancien en premier*.
2. **La boucle sur chaque morceau de la nuit.** Santé découpe la nuit en morceaux (une phase « Profond » de 23 h 40 à 0 h 15, puis « Essentiel »…). On transforme chaque morceau en une ligne de texte.
   1. Tape dans la barre de recherche en bas, cherche **Répéter avec chaque** et ajoute-la. Si son champ bleu n'affiche pas déjà *Échantillons de santé*, touche-le et choisis-le. L'action crée deux blocs, **Répéter avec chaque** et **Fin de la répétition** : les actions suivantes vont **entre les deux**. Fais-les glisser là si besoin.
   2. Ajoute **Formater la date**. Touche son champ bleu *Date* › **Élément répété**. Touche ensuite le jeton *Élément répété* que tu viens de mettre : un menu s'ouvre, choisis **Date de début**. Le format par défaut (« 19/11/2026 07:24 ») convient : le serveur lit aussi bien ce format que l'ISO 8601.
   3. Juste en dessous, ajoute **Définir une variable**, nomme-la `Debut`. Elle reçoit la *Date formatée*.
   4. Ajoute encore **Formater la date**, réglée de la même façon, mais avec **Date de fin**. Puis **Définir une variable** `Fin`.
   5. Ajoute **Texte**. Dans la case, touche **Variables** au-dessus du clavier et compose : `Debut` `|` `Fin` `|` *Élément répété*. Touche ensuite ce jeton *Élément répété* et choisis **Valeur**, c'est la phase de sommeil. Pour taper `|` : clavier **123** › **#+=**.
      Une ligne donne par exemple : `2026-11-20T01:00:00+01:00|2026-11-20T02:00:00+01:00|Profond`.
   6. Vérifie que **Texte** est la dernière action avant **Fin de la répétition** : c'est elle qui alimente *Résultats de la répétition*.
3. **Après** *Fin de la répétition*, ajoute **Combiner le texte** : entrée *Résultats de la répétition*, séparateur **Nouvelle ligne**. Toutes les lignes de la nuit ne font plus qu'un texte.
4. **Rechercher des échantillons de santé** : Type *Fréquence cardiaque au repos*, trier par *Date de début*, *Le plus récent en premier*, **limite 1**. Puis **Obtenir les détails des échantillons de santé** : *Valeur*.
5. **Obtenir le contenu de l'URL** : `https://slzr-4701d.web.app/api/ingest`, méthode `POST`, en-tête `Authorization` = `Bearer <jeton>` (le même que Capture), corps JSON :
   - `type` (texte) = `health`
   - `sleep` (texte) = **Texte combiné**, et pas *Texte* : ce jeton-là ne contient que la dernière ligne de la boucle
   - `restingHr` (texte) = *Valeur*
6. **Obtenir la valeur du dictionnaire** `message`, puis **Afficher la notification** : par exemple « Nuit de 7 h 10 · FC repos 52 ».

Puis, dans l'onglet **Automatisation** : *Heure de la journée*, **9 h**, tous les jours, **Exécuter immédiatement**, action *Exécuter le raccourci* › Santé du matin. 9 h laisse le temps à la montre de synchroniser la nuit. Relancer le raccourci dans la journée ne crée pas de doublon : la nuit est rangée sous la date du réveil et simplement remplacée.

La nuit apparaît dans l'onglet Sport : durée, coucher et lever, phases, FC au repos et les 7 dernières nuits. Une sieste de la veille n'est pas comptée : seule la dernière nuit est retenue.

## 3. La routine Strava

Routine **Strava → second-brain** (https://claude.ai/code/routines/trig_015vpopScG45RYwNfETqsEYs), chaque soir à 21 h (22 h l'été) :

- elle lit tes sorties des 3 derniers jours avec le connecteur Strava (FC, effort relatif, calories) ;
- elle les envoie au format de l'import Strava ; une sortie déjà là est mise à jour, jamais dupliquée ;
- elle utilise un jeton à part, `SPORT_TOKEN`, qui ne peut envoyer **que** des activités : s'il fuit, personne ne peut écrire de dépense ou de note.

**L'environnement cloud doit autoriser le domaine de l'app.** Sinon, l'envoi est refusé par le proxy réseau (`CONNECT tunnel failed, response 403`). Le réglage est dans claude.ai › Code › Environnements › Default › Accès réseau : ajouter `slzr-4701d.web.app`.

Pourquoi pas un webhook Strava : il faudrait une application sur l'API Strava, dont l'accord interdit de transmettre les données à une IA. Le connecteur officiel de Claude, lui, est fait pour ça. Une piste pour plus tard : un webhook qui ne transmet que l'identifiant de la sortie et déclenche la routine.

Pour changer le jeton sport : `openssl rand -hex 32 | firebase functions:secrets:set SPORT_TOKEN --data-file=-`, redéployer `ingest`, puis le remplacer dans le texte de la routine.
