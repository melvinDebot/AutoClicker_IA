# Checklist de test manuel sur iPhone

À faire sur l'iPhone 13 Pro avec le dev build, Instagram connecté dans la WebView.
Toujours commencer par l'**essai à blanc** (activé par défaut dans Réglages).

## 1. Essai à blanc

| # | Action | Attendu | OK |
|---|---|---|---|
| 1 | Accueil sur une page qui n'est pas une liste d'abonnés → Lancer | Échec du scan : « Ouvrez la liste des abonnés d'un compte dans la WebView. » | ☐ |
| 2 | Ouvrir la liste d'abonnés d'un compte → Lancer | 3 contrôles verts, puis la feuille Récapitulatif (compte, story, posts, plafonds, essai à blanc « Activé ») | ☐ |
| 3 | Valider | Compte à rebours de 3 s avec « Annuler » | ☐ |
| 4 | Laisser démarrer | Écran verrouillé, barre d'onglets masquée, HUD (compte, étape, « Compte X · Y détectés », chrono) | ☐ |
| 5 | Toucher la page pendant l'exécution | Rien ne se passe sur Instagram, l'indice « Écran verrouillé… » s'affiche | ☐ |
| 6 | Observer un compte public avec story | Ouverture du profil, de la story ; cœur surligné en orange « J'aime (essai à blanc) » ; aucun j'aime envoyé | ☐ |
| 7 | Observer un compte privé | « Compte privé · rien à toucher », retour à la liste | ☐ |
| 8 | Maintenir « Arrêter » ~1,5 s | Résumé « En pause · Arrêtée par vous » | ☐ |
| 9 | Sessions → la session | Badge « Essai à blanc », comptes traités avec « like simulé » | ☐ |

## 2. Reprise et arrêts

| # | Action | Attendu | OK |
|---|---|---|---|
| 10 | Sessions → détail → Reprendre | Retour à l'Accueil sur la liste du compte ; Lancer → Récap propose « Reprendre la session » | ☐ |
| 11 | Reprendre | HUD « Rattrapage : N comptes déjà traités ignorés », aucun profil déjà traité rouvert | ☐ |
| 12 | Pendant l'exécution, revenir à l'écran d'accueil iOS puis rouvrir l'app | Session « En pause · Application passée en arrière-plan », rien ne redémarre seul | ☐ |
| 13 | Tuer l'app pendant une exécution puis la relancer | Session « Interrompue » dans Sessions | ☐ |
| 14 | Arrêt automatique 15 min (Réglages) | Pause « Arrêt automatique (15 min) » | ☐ |
| 15 | Laisser la liste aller jusqu'au bout (petit compte) | « Terminée · Fin de la liste » après 2 défilements sans nouveau compte | ☐ |

## 3. Exécution réelle (seulement après le n° 12 du spike validé)

Réglages : plafond par session à **3**, essai à blanc **désactivé**.

| # | Action | Attendu | OK |
|---|---|---|---|
| 16 | Lancer → Récap | Encadré rouge « Exécution réelle » | ☐ |
| 17 | Story non likée | Cœur rempli après le toucher, HUD « Story likée » ; vérifiable dans Instagram | ☐ |
| 18 | Post déjà liké | Jamais touché (« déjà likée ») | ☐ |
| 19 | 3 likes atteints | Pause « Plafond de la session atteint (3 likes) » | ☐ |
| 20 | Réglages → Likes aujourd'hui | Compteur à jour | ☐ |

## Si ça s'arrête

Le message du résumé dit pourquoi (élément introuvable, désaccord DOM/capture, avertissement d'Instagram…). Noter l'écran et le message : c'est généralement `src/recognition/rules.ts` à ajuster, avec les relevés DOM (`[AC-DUMP]` dans Metro).
