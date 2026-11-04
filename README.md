<div align="center">
  <img src="assets/icon.png" width="120" alt="Logo AutoClicker" />

  <h1>AutoClicker</h1>

  <p><strong>Like les stories et les posts des abonnés d'un compte Instagram, lentement, avec validation et essai à blanc par défaut.</strong></p>

  <p>
    <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white" />
    <img alt="React Native 0.88" src="https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black" />
    <img alt="TypeScript 6.0" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" />
    <img alt="iOS" src="https://img.shields.io/badge/Plateforme-iOS-lightgrey?logo=apple&logoColor=white" />
    <img alt="Usage personnel" src="https://img.shields.io/badge/Usage-personnel-orange" />
  </p>
</div>

---

> ⚠️ Les likes automatisés sont contraires aux conditions d'utilisation d'Instagram et peuvent entraîner la restriction du compte. Usage personnel uniquement, pas de publication sur l'App Store.

## ✨ Présentation

**AutoClicker** est une app iPhone personnelle construite avec **Expo** (dev build) et **React Native**.
Dans une `WebView` Instagram où vous êtes connecté, elle :

1. **Scanne** la liste des abonnés d'un compte ouverte à l'écran et affiche un récapitulatif à valider.
2. **Parcourt** chaque compte et like sa story et 0 à 3 de ses posts.
3. **S'arrête** au quota du jour, ou immédiatement sur tout avertissement d'Instagram, suivi de 48 h sans vrai like.

L'**essai à blanc** est activé par défaut : l'app fait tout le parcours sans toucher au bouton j'aime. Chaque like réel est confirmé sur une capture (OCR, couleurs, empreintes d'icônes) par un module natif en Swift.

## 📋 État

Étapes 1 à 4 codées. Rien n'est validé sur Instagram tant que la [checklist iPhone](docs/test-checklist.md) n'est pas faite.

| Partie | État |
|---|---|
| Onglets, thème, Sessions, Détail, Réglages | ✅ Fait |
| SQLite (Drizzle) + migrations, réglages (kv-store) | ✅ Fait |
| Dev build | ✅ Compilé et lancé sur l'iPhone 13 Pro |
| Module natif `vision-check` (capture, OCR, couleurs, empreintes) | 🟡 Compilé, **pas testé sur iPhone** |
| Règles DOM + script d'inspection | 🟡 Testés dans un DOM simulé, **libellés à vérifier sur le vrai Instagram** (`0.3.0-dom-unverified`) |
| Moteur (parcours, essai à blanc, quota, reprise, arrêts) | 🟡 Testé avec un faux Instagram (Jest), **pas encore sur iPhone** |
| Scan, récap, compte à rebours, mode verrouillé, résumé | 🟡 Écrit, **pas encore essayé sur iPhone** |
| Dataset de captures + règles de textes OCR | ✅ Fait, testé sur les captures |
| Notification « session en pause » | ⚪ Non faite (optionnelle ; `expo-notifications` retiré pour éviter l'autorisation push) |

## 🚀 Fonctionnalités

- 🔎 **Scan et récapitulatif** avant chaque exécution (compte, story, posts, likes par jour, rythme, essai à blanc).
- 🧪 **Essai à blanc par défaut** : tout le parcours, aucun vrai like.
- 📊 **Un seul quota par jour** (40 par défaut) : toutes les sessions du jour s'additionnent.
- 🐢 **Rythme lent** avec des pauses tirées au hasard entre deux comptes et sur chaque post.
- 🛑 **Arrêt immédiat** sur « Réessayez plus tard », puis 48 h sans vrai like.
- 🔒 **Écran verrouillé** pendant l'exécution, avec HUD (compte, étape, chrono) et compte à rebours annulable.
- 💾 **Sessions persistées** (SQLite) et reprise d'une session interrompue.
- 🟢 **Carte d'état des réglages** : prudents, risqués, ou en pause après un avertissement.

## 🧱 Stack technique

| Domaine | Technologie |
| --- | --- |
| Framework | [Expo SDK 58](https://docs.expo.dev/) · React Native 0.88 · React 19.3 · dev client |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (onglets + feuilles) |
| Navigateur embarqué | [`react-native-webview`](https://github.com/react-native-webview/react-native-webview) + RPC `postMessage` |
| Données | [`drizzle-orm`](https://orm.drizzle.team/) + `expo-sqlite`, réglages en kv-store |
| Natif | Module Expo en Swift `vision-check` (snapshot WKWebView, OCR Vision, couleurs, empreintes) |
| Tests | Jest (`jest-expo`), faux Instagram, DOM simulé |
| Divers | `expo-haptics`, `expo-keep-awake`, `expo-linear-gradient`, `react-native-svg`, `expo-updates` |

## 📦 Prérequis

- macOS sur Apple Silicon, **Xcode 27**, **Node 24**.
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
- **Signature** : `ios.appleTeamId` dans `app.json` (équipe personnelle pour l'instant, profil valable 7 jours ; remplacer par l'équipe payante une fois ajoutée dans Xcode › Réglages › Comptes).

### 💽 Où vit le projet

- **Le code de référence** (dépôt git) est dans `/Volumes/Extreme SSD/Dev/autoClicker`. Le SSD est en exFAT (blocs de 1 Mo, fichiers `._*`, espace dans le chemin) : on n'y installe pas `node_modules` et on n'y compile pas.
- **La copie de build** vit dans une image disque APFS sur le même SSD, avec `node_modules`, le projet Xcode et Metro. La monter, puis récupérer le code :

  ```bash
  hdiutil attach "/Volumes/Extreme SSD/Dev/autoClicker.sparsebundle"
  ```

  ```bash
  cd /Volumes/autoClicker/autoclicker && git pull ssd feature/foundation-spike && npm install
  ```

  Si le SSD a été débranché sans éjection et que l'image refuse de se monter (« aucun système de fichiers montable ») : `hdiutil detach diskN -force` sur l'ancienne image, puis l'attacher à nouveau.

## ▶️ Installation & lancement

```bash
git clone https://github.com/melvinDebot/AutoClicker_IA.git
```

```bash
cd AutoClicker_IA && npm install
```

```bash
npx expo run:ios --device
```

Ensuite, pour le JavaScript seul : `npm start` (Metro, dev client). L'iPhone et le Mac doivent être sur le même Wi-Fi ; si l'app reste sur l'écran du client de dev, choisir le serveur `http://<IP du Mac>:8081`.

### Raccourcis npm

| Commande | Effet |
| --- | --- |
| `npm start` | Metro pour le dev client |
| `npm run ios` | Compile et lance sur le simulateur iOS |
| `npm run ios:device` | Compile et lance sur l'iPhone branché |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest |
| `npm run db:generate` | Génère les migrations Drizzle |

## ✅ Vérifier

```bash
npm run typecheck
```

```bash
npm test
```

Sur le simulateur sans toucher à Instagram : `node tools/fixture-server.mjs`, puis debug › « Liste factice » (voir la [checklist](docs/test-checklist.md)).

## 🐢 Rythme et limites

Instagram ne publie pas ses limites ; « Try again later » / « Réessayez plus tard » vient d'un trop grand nombre d'actions (likes, mais aussi profils ouverts) dans un court laps de temps. D'où, par défaut :

- un seul quota, **40 likes par jour** (réglable dans le récap, conseillé : 60 au plus) : toutes les sessions du jour s'additionnent, une session continue jusqu'au quota puis s'arrête ;
- rythme **Lent** : 20 à 45 s de pause tirée au hasard entre deux comptes, 2 à 5 s sur chaque post avant le j'aime (Normal 8–20 s, Très lent 45–90 s) ;
- après un avertissement d'Instagram, **aucun vrai like pendant 48 h** (l'essai à blanc reste possible).

En haut des Réglages, une carte dit si les réglages (likes par jour et rythme) sont prudents ou risqués, avec le nombre conseillé (`settingsStatus`, `src/engine/settings.ts`) ; le récap le rappelle avant une exécution réelle.

## 🗂️ Structure du projet

```
AutoClicker_IA/
├── app/                   # expo-router : (tabs)/index|sessions|settings, sessions/[id] (feuille)
├── src/
│   ├── engine/            # TypeScript pur, testé avec Jest (moteur, types, réglages, stats)
│   ├── recognition/       # rules.ts (versionné), url.ts (garde-fou d'injection), scripts du debug
│   ├── adapters/          # store (Drizzle + expo-sqlite), settings (kv-store), webview (RPC postMessage)
│   └── ui/                # thème, composants, Accueil (WebView), exécution, debug DOM
├── modules/vision-check/  # module Expo en Swift (snapshot WKWebView, OCR, couleurs, empreintes)
├── drizzle/               # migrations générées (npm run db:generate)
├── fixtures/screens/      # dataset de captures annotées, hors git (voir son README)
├── assets/templates/      # gabarits d'icônes + templates.json
├── tools/                 # ocr.swift (OCR Vision sur le Mac), fixture-server.mjs
└── docs/                  # checklist de test sur iPhone
```

### Comment ça marche ?

1. La `WebView` affiche Instagram ; un script d'inspection est injecté **à la demande** pour lire le DOM (libellés `aria-label`, textes, formes de liens, jamais de classes CSS).
2. Le **moteur** (`src/engine`) enchaîne scan → récap → compte à rebours → parcours des comptes, en respectant quota, rythme et arrêts.
3. Avant de compter un like réel, le module **`vision-check`** capture la WebView et confirme le cœur rempli (OCR, couleurs, empreintes).
4. Les sessions, likes et avertissements sont enregistrés en **SQLite** ; un avertissement bloque les vrais likes pendant 48 h.

### 🛡️ Garde-fous

Appliqués dans le code dès l'étape 1 : aucun user-agent modifié, aucun script global injecté, injection à la demande uniquement hors des pages de connexion et de compte (`src/recognition/url.ts`, testé), liens vers l'app Instagram bloqués, captures temporaires supprimées après usage, « Tout effacer » vide aussi les cookies de la WebView.

## 🔧 Quand Instagram change son interface

Le repérage s'arrête (pause « élément introuvable ») au lieu de toucher au mauvais endroit. Pour corriger :

1. Lancer le dev build, ouvrir l'écran concerné dans la WebView : le relevé du DOM part dans Metro (`[AC-DUMP] …`), ou via l'icône insecte › Analyser › Exporter.
2. Repérer le nouveau libellé (`aria-label`, texte, forme du lien) et mettre à jour `DOM` ou `TEXT` dans `src/recognition/rules.ts`. Jamais de nom de classe CSS.
3. Incrémenter `RULES_VERSION` (enregistrée avec chaque session).
4. Si une icône a changé : debug › Capture, puis régénérer le gabarit dans `assets/templates/` et `templates.json`.
5. `npm test` (le script d'inspection est testé dans `src/recognition/__tests__/domScript.test.ts`), puis un essai à blanc.

---

## 🚢 Publier sur Expo — EAS Update

Compte `verseapp`, runtime `exposdk:58.0.0` :

```bash
npx eas-cli@latest update --branch preview --environment preview --platform ios --message "…"
```

La mise à jour s'ouvre dans **Expo Go** avec le QR code du tableau de bord EAS, ou le lien `exp://u.expo.dev/<projectId>/group/<groupId>`.

> ℹ️ Dans Expo Go, le module natif `vision-check` n'existe pas : l'app reste en **essai à blanc** (pas de confirmation sur capture, donc aucun vrai like). Les vrais likes demandent le dev build ou un build EAS.

> 📚 Références : [Development builds](https://docs.expo.dev/develop/development-builds/introduction/) · [EAS Update](https://docs.expo.dev/eas-update/introduction/)

---

## 📄 Licence

Projet personnel, sans licence open source : tous droits réservés.
