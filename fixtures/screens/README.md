# Dataset de captures (hors git)

Les captures contiennent des noms et des photos d'autres personnes : **elles ne sont jamais commitées** (voir `.gitignore`). Seul ce fichier est versionné. Les tests qui en dépendent (`src/recognition/__tests__/dataset.test.ts`) sont sautés quand les fichiers manquent.

Ce dataset ne sert **pas** à entraîner un modèle (beaucoup trop peu d'images). Il sert à écrire et tester les règles de repérage :
- les **textes** lus par l'OCR Vision ;
- les **types d'écran** ;
- les **zones à éviter** (suggestions, « À la une ») ;
- les premiers **gabarits d'icônes** (`assets/templates/`).

Le format reste exportable vers un détecteur plus tard (étape 5, seulement sur accord).

## Hiérarchie

```
fixtures/screens/
  app-ios/                         captures de l'APP Instagram (≠ WebView) : textes et types d'écran
    followers_list/                liste d'abonnés d'un compte
    profile_public/with_posts/     profil public avec grille de publications
    profile_public/no_posts/       profil public sans publication (« No posts yet »)
    profile_private/               profil privé (« This profile is private »)
    loading/                       page en cours de chargement (vignettes grises)
  web-iphone/                      captures de la WebView sur l'iPhone 13 Pro (debug › Capture) : référence finale — à venir
```

Pour chaque capture `IMG_xxxx.png` :
- `IMG_xxxx.json` : annotations, c'est-à-dire ce que le repérage doit trouver (format `AnnotatedScreen` dans `src/recognition/dataset.ts`) ;
- `IMG_xxxx.ocr.json` : sortie brute de l'OCR Vision, régénérable avec :

  ```bash
  swift tools/ocr.swift --write $(find fixtures/screens -name "*.png")
  ```

## Lot du 02/11/2026 (9 captures, app iOS, anglais, mode sombre, 1206×2622 px @3x)

| Fichier | Dossier | Contenu |
|---|---|---|
| IMG_2117 | profile_public/no_posts | 0 post, suggestions, « No posts yet » |
| IMG_2118 | profile_public/no_posts | 0 post, 1 « À la une », badge NEW, suggestions |
| IMG_2121 | profile_public/no_posts | 0 post, 5 « À la une », suggestions |
| IMG_2119 | profile_public/with_posts | 292 posts, 3 « À la une », 6 vignettes épinglées |
| IMG_2120 | profile_public/with_posts | 1 post, badge NEW |
| IMG_2122 | profile_private | privé, cadenas, suggestions |
| IMG_2124 | profile_private | privé, suggestions en cours de chargement |
| IMG_2125 | loading | profil public, grille pas encore chargée |
| IMG_2123 | followers_list | 10 lignes, 2 avatars avec anneau de story |

## Éléments annotés

| Élément | Comment on le reconnaît | Rôle pour le moteur |
|---|---|---|
| `back_button` | chevron « < » en haut à gauche (rond sur la liste) ; l'OCR ne le lit qu'une fois sur trois → gabarit | revenir |
| `followers_list` | onglet « 12,1K followers » + colonne de boutons Follow à droite | scan, défilement |
| `user_row` | nom d'utilisateur (OCR approximatif, le DOM donne la valeur exacte) | compte suivant |
| `avatar_story` | anneau dégradé rose-orange autour de l'avatar | ouvrir la story |
| `highlight` | anneau **gris** + libellé dessous (« À la une ») | **jamais une story** |
| `new_badge` | « NEW » sur l'avatar | **pas un anneau de story** |
| `private_notice` / `private_icon` | « This profile is private » + cadenas | compte privé : ne rien toucher |
| `empty_posts_notice` / `empty_posts_icon` | « No posts yet » + appareil photo | rien à liker |
| `post_tile` | vignettes de la grille sous les onglets | ouvrir un post |
| `follow_button` | « Follow », « Follow back », « Message » | **ne jamais toucher** |
| `suggested_section` | « Suggested for you » | zone à exclure : ce ne sont pas les comptes du profil |
| `loading_placeholder` | blocs gris unis (squelettes) | attendre |

## Pièges relevés par l'OCR

- « followers » lu « tollowers » avec une confiance de 1.0 : d'où la comparaison tolérante (`src/recognition/text.ts`).
- Noms d'utilisateur : « ı » au lieu de « i », « I » au lieu de « l ». L'OCR ne fait que confirmer, le DOM donne le nom exact.
- Le chiffre « 0 » seul n'est pas lu : les compteurs du profil ne sont qu'indicatifs.
- La liste affiche « 12,1K » : arrondi, jamais un total fiable.

## Ce qui manque encore

- Une story ouverte (cœur vide, puis cœur rempli, croix pour fermer).
- Un post ouvert (cœur vide, puis cœur rouge).
- Une fenêtre par-dessus la page (« Not now », notifications, cookies…).
- **Les mêmes écrans dans la WebView** (version web), via debug › Capture sur l'iPhone 13 Pro.
