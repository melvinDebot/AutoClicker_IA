# AutoClicker

App iPhone personnelle (Expo, dev build) : dans une WebView Instagram où vous êtes connecté, elle parcourt la liste des abonnés d'un compte et like la story et 0 à 3 posts de chaque compte, avec validation, essai à blanc par défaut, plafonds et arrêt immédiat sur tout avertissement d'Instagram.

> Les likes automatisés sont contraires aux conditions d'utilisation d'Instagram et peuvent entraîner la restriction du compte. Usage personnel uniquement, pas de publication sur l'App Store.

## État

Étape 1 (socle + spike) en cours. Voir [docs/spike.md](docs/spike.md).

| Partie | État |
|---|---|
| Onglets, thème, Sessions, Détail, Réglages | Fait, données factices en dev |
| SQLite (Drizzle) + migrations, réglages (kv-store) | Fait |
| WebView Instagram (cookies persistants, aucune injection sur les pages de connexion) | Écrit, **pas testé sur iPhone** |
| Module natif `vision-check` (capture WKWebView, effacement des données WebView) | Écrit, **pas encore compilé** |
| Écran de debug DOM | Écrit, **pas testé sur iPhone** |
| Scan, récapitulatif, moteur, mode verrouillé | Étape 3 (« Lancer » et « Reprendre » sont des bouchons) |
| OCR, gabarits d'icônes, `rules.ts` complet | Étape 2 |

## Prérequis

- macOS sur Apple Silicon, Xcode 27, Node 24.
- **CocoaPods en arm64.** L'ancien Homebrew Intel (`/usr/local`) ne fonctionne pas sans Rosetta (« Bad CPU type »). Installer Homebrew arm64 puis CocoaPods :

  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

  ```bash
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
  ```

  ```bash
  brew install cocoapods watchman
  ```

  Vérifier : `pod --version` et `which pod` → `/opt/homebrew/bin/pod`.
- Compte développeur Apple (signature du dev build).
- Le projet vit dans une image disque APFS sur le SSD (le SSD est en exFAT) : la monter avant de travailler.

  ```bash
  hdiutil attach "/Volumes/Extreme SSD/Dev/autoClicker.sparsebundle"
  ```

## Lancer

```bash
npm install
```

```bash
npx expo run:ios --device
```

Ensuite, pour le JavaScript seul : `npm start` (Metro, dev client).

## Vérifier

```bash
npm run typecheck
```

```bash
npm test
```

## Architecture

```
app/                      expo-router : (tabs)/index|sessions|settings, sessions/[id] (feuille)
src/engine/               TypeScript pur, testé avec Jest (types, réglages, stats ; moteur à l'étape 3)
src/recognition/          rules.ts (versionné), url.ts (garde-fou d'injection), scripts du debug
src/adapters/             store (Drizzle + expo-sqlite), settings (kv-store), webview (RPC postMessage)
src/ui/                   thème, composants, Accueil (WebView), debug DOM
modules/vision-check/     module Expo en Swift (WKWebView snapshot ; OCR et empreintes à l'étape 2)
drizzle/                  migrations générées (`npm run db:generate`)
fixtures/screens/         captures de test, hors git
```

Garde-fous appliqués dans le code dès l'étape 1 : aucun user-agent modifié, aucun script global injecté, injection à la demande uniquement hors des pages de connexion et de compte (`src/recognition/url.ts`, testé), liens vers l'app Instagram bloqués, captures temporaires supprimées après usage, « Tout effacer » vide aussi les cookies de la WebView.

## Quand Instagram change son interface

À compléter à l'étape 2 : mise à jour de `src/recognition/rules.ts` (et de `RULES_VERSION`) et régénération des gabarits.
