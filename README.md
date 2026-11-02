# AutoClicker

App iPhone personnelle (Expo, dev build) : dans une WebView Instagram où vous êtes connecté, elle parcourt la liste des abonnés d'un compte et like la story et 0 à 3 posts de chaque compte, avec validation, essai à blanc par défaut, plafonds et arrêt immédiat sur tout avertissement d'Instagram.

> Les likes automatisés sont contraires aux conditions d'utilisation d'Instagram et peuvent entraîner la restriction du compte. Usage personnel uniquement, pas de publication sur l'App Store.

## État

Étape 1 (socle + spike) en cours. Voir [docs/spike.md](docs/spike.md).

| Partie | État |
|---|---|
| Onglets, thème, Sessions, Détail, Réglages | Fait, données factices en dev |
| SQLite (Drizzle) + migrations, réglages (kv-store) | Fait |
| Dev build | Compilé, installé et lancé sur l'iPhone 13 Pro le 02/11 (JS chargé sans erreur) |
| WebView Instagram (cookies persistants, aucune injection sur les pages de connexion) | Écrit, **parcours pas encore testé sur iPhone** |
| Module natif `vision-check` (capture WKWebView, effacement des données WebView) | Compilé, **pas encore testé sur iPhone** |
| Écran de debug DOM | Écrit, **pas testé sur iPhone** |
| Dataset de captures (9 captures de l'app iOS, annotées) + règles de textes OCR | Fait, testé sur les captures (Jest) |
| Scan, récapitulatif, moteur, mode verrouillé | Étape 3 (« Lancer » et « Reprendre » sont des bouchons) |
| OCR dans l'app, gabarits depuis la WebView, sélecteurs DOM dans `rules.ts` | Étape 2 |

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

  En attendant, CocoaPods 1.16.2 est installé avec le Ruby du système, sans `sudo`, dans `~/.local/share/cocoapods-gems` (supprimable). Pour l'utiliser :

  ```bash
  export GEM_HOME="$HOME/.local/share/cocoapods-gems" GEM_PATH="$HOME/.local/share/cocoapods-gems" PATH="$HOME/.local/share/cocoapods-gems/bin:$PATH" LANG=en_US.UTF-8
  ```
- Signature : `ios.appleTeamId` dans `app.json` (équipe personnelle pour l'instant, profil valable 7 jours ; remplacer par l'équipe payante une fois ajoutée dans Xcode › Réglages › Comptes).
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

Ensuite, pour le JavaScript seul : `npm start` (Metro, dev client). L'iPhone et le Mac doivent être sur le même Wi-Fi ; si l'app reste sur l'écran du client de dev, choisir le serveur `http://<IP du Mac>:8081`.

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
fixtures/screens/         dataset de captures annotées, hors git (voir son README)
assets/templates/         gabarits d'icônes + templates.json
tools/ocr.swift           OCR Vision sur le Mac pour annoter et tester les captures
```

Garde-fous appliqués dans le code dès l'étape 1 : aucun user-agent modifié, aucun script global injecté, injection à la demande uniquement hors des pages de connexion et de compte (`src/recognition/url.ts`, testé), liens vers l'app Instagram bloqués, captures temporaires supprimées après usage, « Tout effacer » vide aussi les cookies de la WebView.

## Quand Instagram change son interface

À compléter à l'étape 2 : mise à jour de `src/recognition/rules.ts` (et de `RULES_VERSION`) et régénération des gabarits.
