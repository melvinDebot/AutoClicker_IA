# Captures de test (hors git)

Ces captures contiennent des noms et des photos d'autres personnes : **elles ne sont jamais commitées** (voir `.gitignore`). Seul ce fichier est versionné.
Les tests qui en dépendent sont sautés quand les fichiers sont absents.

## Format attendu (étape 2)

Une capture par écran, prise dans Safari sur iPhone (instagram.com, web mobile), PNG d'origine via AirDrop :

```
fixtures/screens/
  01-followers-top.png
  01-followers-top.json      # résultats attendus (écrits à l'étape 2)
  02-followers-scrolled.png
  03-profile-public-story.png
  04-profile-private.png
  05-story-heart-empty.png
  06-story-heart-filled.png
  07-post-heart-empty.png
  08-post-heart-filled.png
  09-dialog.png              # « Pas maintenant », notifications, « Ouvrir l'app »…
  10-profile-public-no-story.png
```

`*.json` décrit ce que le repérage doit trouver : type d'écran, textes (OCR), icônes attendues et leurs zones approximatives.
