# ShipLabel Studio — Android app

Capacitor wrapper around the shared JS label engine, with a mobile-first UI of its own.
100% offline: PDFs never leave the phone.

## Layout

```
android/
├── src/                 # Mobile web layer (what the WebView shows)
│   ├── index.html
│   ├── ui/              # theme.css (tokens), layout.css (app bar, bottom nav), components.css
│   ├── components/      # dom.js, toast.js, native.js (save/share), crop-editor.js (touch crop)
│   ├── pages/           # process, templates, history, settings
│   └── js/app.js        # bottom-nav router
├── native/              # Generated Android Studio / Gradle project (Capacitor)
├── www/                 # Build output = src/ + ../shared/  (git-ignored)
├── capacitor.config.json
└── package.json
```

The PDF engine (`pdf_engine.js`, `template_manager.js`, `security.js`, `vendor/`) lives in
[`../shared/`](../shared) and is copied into `www/` by `../scripts/build.js`. Do not edit `www/`.

## Prerequisites

Node 18+, JDK 17+, Android SDK (Android Studio). Create `native/local.properties`:

```
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

## Commands (run inside `android/`)

| Command | What it does |
| :--- | :--- |
| `npm install` | Install Capacitor and plugins |
| `npm run sync` | Rebuild `www/` and copy it into the native project |
| `npm run open` | Open `native/` in Android Studio |
| `npm run run` | Sync, then build and run on a connected device/emulator |
| `npm run apk` | Sync, then build `native/app/build/outputs/apk/debug/app-debug.apk` |

## Mobile-specific notes

- **Saving output:** WebView ignores blob/`<a download>` links, so `components/native.js` writes the
  file to the app cache and opens the Android share sheet (save to Drive/Files, print, WhatsApp).
- **Crop editor:** `components/crop-editor.js` uses Pointer Events (the web version is mouse-only).
- **Storage:** templates, history and settings use WebView `localStorage` (same keys as the web app).
- **Status:** the debug APK builds; it has not yet been exercised on a device/emulator.
