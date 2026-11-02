# AutoClicker

App iPhone personnelle (Expo, dev build) : dans une WebView Instagram où vous êtes connecté, elle parcourt la liste des abonnés d'un compte et like la story et 0 à 3 posts de chaque compte, avec validation, essai à blanc par défaut, plafonds et arrêt immédiat sur tout avertissement d'Instagram.

> Les likes automatisés sont contraires aux conditions d'utilisation d'Instagram et peuvent entraîner la restriction du compte. Usage personnel uniquement, pas de publication sur l'App Store.

## État

Étapes 1 à 4 codées. Rien n'est validé sur Instagram tant que la [checklist iPhone](docs/test-checklist.md) n'est pas faite.

| Partie | État |
|---|---|
| Onglets, thème, Sessions, Détail, Réglages | Fait |
| SQLite (Drizzle) + migrations, réglages (kv-store) | Fait |
| Dev build | Compilé et lancé sur l'iPhone 13 Pro |
| Module natif `vision-check` (capture, OCR, couleurs, empreintes) | Compilé, **pas testé sur iPhone** |
| Règles DOM + script d'inspection | Testés dans un DOM simulé, **libellés à vérifier sur le vrai Instagram** (`0.3.0-dom-unverified`) |
| Moteur (parcours, essai à blanc, plafonds, reprise, arrêts) | Testé avec un faux Instagram (Jest), **pas encore sur iPhone** |
| Scan, récap, compte à rebours, mode verrouillé, résumé | Écrit, **pas encore essayé sur iPhone** |
| Dataset de captures + règles de textes OCR | Fait, testé sur les captures |
| Notification « session en pause » | Non faite (optionnelle ; `expo-notifications` retiré pour éviter l'autorisation push) |

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

### Publier sur Expo (EAS Update, compte `verseapp`)

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "…"
```

La mise à jour (runtime `exposdk:58.0.0`) s'ouvre dans **Expo Go** avec le QR code du tableau de bord EAS, ou le lien `exp://u.expo.dev/<projectId>/group/<groupId>`.
Dans Expo Go, le module natif `vision-check` n'existe pas : l'app reste en **essai à blanc** (pas de confirmation sur capture, donc aucun vrai like). Les vrais likes demandent le dev build ou un build EAS.

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

Le repérage s'arrête (pause « élément introuvable ») au lieu de toucher au mauvais endroit. Pour corriger :

1. Lancer le dev build, ouvrir l'écran concerné dans la WebView : le relevé du DOM part dans Metro (`[AC-DUMP] …`), ou via l'icône insecte › Analyser › Exporter.
2. Repérer le nouveau libellé (`aria-label`, texte, forme du lien) et mettre à jour `DOM` ou `TEXT` dans `src/recognition/rules.ts`. Jamais de nom de classe CSS.
3. Incrémenter `RULES_VERSION` (enregistrée avec chaque session).
4. Si une icône a changé : debug › Capture, puis régénérer le gabarit dans `assets/templates/` et `templates.json`.
5. `npm test` (le script d'inspection est testé dans `src/recognition/__tests__/domScript.test.ts`), puis un essai à blanc.
