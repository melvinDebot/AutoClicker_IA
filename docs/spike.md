# Spike — Instagram web dans WKWebView (étape 1)

But : vérifier **sur l'iPhone 13 Pro**, avant d'écrire le moteur, que la version web mobile d'Instagram fonctionne dans la WebView de l'app, et relever les vrais libellés du DOM.
Statut : **pas encore fait** (le dev build n'a pas encore tourné sur l'iPhone).

## Préparation

1. CocoaPods réparé (voir README, « Prérequis »).
2. iPhone branché en USB, déverrouillé, **Mode développeur** activé (Réglages › Confidentialité et sécurité).
3. `npx expo run:ios --device` puis choisir l'iPhone 13 Pro. Xcode signe avec l'équipe du compte développeur payant.
4. Optionnel : Safari sur le Mac › Développement › iPhone › page instagram.com, pour inspecter le DOM (actif seulement en dev).

## Checklist (à faire ensemble)

À la main, dans la WebView de l'onglet Accueil :

| # | Vérification | Résultat | Notes |
|---|---|---|---|
| 1 | Connexion sur la page officielle (identifiant + mot de passe, 2FA si demandé) | ☐ | |
| 2 | Connexion conservée après fermeture et réouverture de l'app (cookies) | ☐ | |
| 3 | Fenêtres après connexion (« Enregistrer vos identifiants », notifications, « Ouvrir l'app ») | ☐ | lesquelles ? |
| 4 | Ouvrir un profil puis la liste de ses abonnés (`/<nom>/followers/`) | ☐ | liste complète ou limitée ? |
| 5 | Défiler la liste : de nouveaux comptes se chargent | ☐ | indicateur de chargement ? |
| 6 | Ouvrir une story depuis l'anneau du profil | ☐ | passe-t-elle seule à la story suivante ? |
| 7 | Liker une story (cœur) | ☐ | |
| 8 | Ouvrir un post de la grille et le liker | ☐ | |

Puis avec l'écran de debug (icône insecte en haut de l'Accueil, dev uniquement) :

| # | Vérification | Résultat | Notes |
|---|---|---|---|
| 9 | « Analyser » sur la liste d'abonnés : rôle, aria-label, liens `/<nom>/` | ☐ | |
| 10 | « Analyser » sur un profil, une story, un post : libellés du cœur, retour, fermer | ☐ | FR / EN |
| 11 | « Capture » : les cadres DOM tombent sur les éléments de la capture native | ☐ | décalage ? |
| 12 | « Toucher (test) » sur le cœur d'un post **non liké** : le like est-il pris en compte (libellé avant → après, et après rechargement) ? | ☐ | point bloquant si non |
| 13 | Idem sur le cœur d'une story | ☐ | |
| 14 | Aucune injection sur `/accounts/login/` : le bouton « Analyser » y affiche « Injection refusée » | ☐ | |

« Exporter » écrit le dump dans la console Metro (`[AC-DUMP] …`). Ces dumps contiennent des noms d'utilisateurs : on en tire `rules.ts`, on ne les commite pas (`docs/dumps/` est ignoré par git).

## Si un point bloque

Arrêt, point avec Melvin avant d'aller plus loin. En particulier : si le point 12 échoue (événements DOM ignorés, `isTrusted = false`), il n'y a pas d'alternative dans les garde-fous (pas d'injection de vrai toucher sur iOS, pas de faux user-agent).
