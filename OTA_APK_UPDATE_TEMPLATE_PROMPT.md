<!-- Reusable master prompt. Copy everything below the line into a new AI session (Claude/Cursor/Codex/Gemini) for any Capacitor app. -->
<!-- Derived from the Keeguard architecture: Capgo OTA + Firebase Hosting + Firestore manifest + GitHub Releases APK. -->

---

# MASTER PROMPT — Two-Channel Update System (OTA for UI, GitHub APK for native)

You are implementing a **two-channel app update system** in my Capacitor Android app. Read this whole prompt first, then **ask me for the values in §0 before writing any code**. Follow the rules in §6–§8 exactly. Do not add features beyond this spec (YAGNI).

---

## 0. VALUES TO COLLECT FROM ME FIRST (fill in, do not guess)

| Placeholder | Meaning | Example |
|---|---|---|
| `{{APP_NAME}}` | Display name | Keeguard |
| `{{APP_ID}}` | Android applicationId (same in capacitor.config.ts and build.gradle) | com.mohdj.securevault |
| `{{FIREBASE_PROJECT}}` | Firebase project id (Hosting + Firestore) | vault-app-ba6e2 |
| `{{GH_OWNER}}` / `{{GH_RELEASES_REPO}}` | GitHub repo that hosts APK releases | Mohd-afk / apk-releases |
| `{{APK_FILENAME}}` | Exact asset name uploaded to each release (**must be identical every release**) | app-release.apk |
| `{{WEB_FRAMEWORK}}` | Vite / CRA / Next-export etc. and its build output dir | Vite → `dist` |
| `{{CURRENT_VERSION}}` | Current version in package.json AND build.gradle | 1.0.0 |

If the app has no Firebase yet, ask whether to add it (Hosting + Firestore, free Spark plan is enough) or to use another static host + JSON manifest. The rest of this prompt assumes Firebase.

---

## 1. ARCHITECTURE (the mental model)

```
                         ┌──────────────────────────────────────────────┐
                         │ Firestore doc  app_config/latest_version     │
                         │  version, url, checksum, critical,           │
                         │  releaseNotes, releasedAt,                   │
                         │  min_apk_version, apk_download_url           │
                         └───────┬───────────────────────┬──────────────┘
          reads on every app open│                       │
                                 ▼                       ▼
        ┌─────────────────────────────┐     ┌──────────────────────────────┐
        │ CHANNEL A — OTA (JS/UI only)│     │ CHANNEL B — APK (native)     │
        │ updater.ts (Capgo plugin)   │     │ apk-update-checker.ts        │
        │ zip on Firebase Hosting     │     │ APK on GitHub Releases       │
        │ silent download, apply on   │     │ full-screen blocker, opens   │
        │ next restart, auto-rollback │     │ browser to download URL      │
        └─────────────────────────────┘     └──────────────────────────────┘
```

**One Firestore document drives both channels.** Two version numbers must never be confused:

| Term | Source of truth (read at runtime) | Changes when |
|---|---|---|
| **Native/APK version** | `App.getInfo().version` (= `versionName` in build.gradle) | User installs a new APK |
| **Active OTA version** | `CapacitorUpdater.current().bundle.version` (`'builtin'` ⇒ treat as `0.0.0`) | An OTA bundle is activated |

### Decision matrix — which channel do I use?

| Change type | Channel | User action |
|---|---|---|
| UI, CSS, copy, JS/TS logic, bug fixes in web code, new React screens | **OTA** | None (toast → restart) |
| New/updated Capacitor plugin, native Kotlin/Java, AndroidManifest, Gradle, permissions, `capacitor.config.ts` plugin config, app icon/splash, minSdk | **APK** | Download + install APK |
| Unsure | **APK** (OTA of code that calls a missing native plugin crashes the app) | |

### Version-number contract (the core invariant)

```
OTA version  >  native APK version         → OTA bundle is delivered
OTA version  <= native APK version         → OTA is skipped (APK already contains that code)
native APK version < min_apk_version       → blocking "Update required" screen
```
After a new APK is installed, the next OTA must be **strictly greater** than the new APK's versionName.
Example: APK `1.2.0` shipped → next OTA must be `1.2.1+`. Releasing OTA `1.2.0` is silently ignored.

---

## 2. FIRESTORE MANIFEST — `app_config/latest_version`

```jsonc
{
  "version": "1.2.1",                 // OTA bundle version (string, semver)
  "url": "https://{{FIREBASE_PROJECT}}.web.app/bundles/1.2.1.zip", // "" ⇒ APK-only release
  "checksum": "<sha256 hex of the zip>",
  "critical": false,                  // true ⇒ show blocker while downloading (30s safety timeout)
  "releaseNotes": "…",
  "releasedAt": "2026-01-01T00:00:00.000Z",
  "min_apk_version": "1.2.0",         // STRING semver. Raise ONLY on APK releases
  "apk_download_url": "https://github.com/{{GH_OWNER}}/{{GH_RELEASES_REPO}}/releases/download/v1.2.0/{{APK_FILENAME}}"
}
```
Security rules (client read-only, admin SDK writes bypass rules):
```
match /app_config/{document=**} { allow read: if true; }   // no client write rule at all
```
The doc contains nothing secret. Never put secrets in it.

---

## 3. FILES TO CREATE / MODIFY

```
package.json                  scripts: release, release:apk, version:sync, test  + deps
capacitor.config.ts           CapacitorUpdater plugin config
vite.config.ts (or bundler)   NON-HASHED output filenames
firebase.json                 hosting.public = "ota-updates", zip headers
firestore.rules               app_config public read
.gitignore                    bundles, service-account, apk
ota-updates/bundles/.gitkeep  hosted dir
android/app/build.gradle      versionCode / versionName
scripts/release-ota.mjs       build zip → checksum → host → Firestore (strict order)
scripts/release-apk.mjs       raise min_apk_version + apk_download_url (after GH release exists)
scripts/sync-versions.mjs     package.json → build.gradle (single source of truth)
src/services/updater.ts       Channel A
src/services/apk-update-checker.ts   Channel B
src/components/CriticalUpdateScreen.tsx
src/components/ApkUpdateBanner.tsx
src/App.tsx                   boot sequence wiring
Settings screen               "Check for updates" button + version display
RELEASING.md                  the checklist in §8 (agent-readable)
```

### 3.1 Dependencies
```bash
npm i @capgo/capacitor-updater @capacitor/app @capacitor/browser firebase sonner   # sonner = toast; swap for your toast lib
npm i -D firebase-admin firebase-tools @capgo/cli
```
(Use the versions compatible with the app's installed Capacitor major. Check `@capacitor/core` version first.)

### 3.2 `capacitor.config.ts`
```ts
plugins: {
  CapacitorUpdater: {
    autoUpdate: false,        // WE control updates in updater.ts
    appReadyTimeout: 30000,   // plugin auto-rolls-back if notifyAppReady() isn't called in time
    resetWhenUpdate: false,   // keep localStorage across OTA
  },
}
```

### 3.3 Bundler — NON-HASHED filenames (mandatory)
Hashed names (`index-A3bC4d.js`) caused silent 404s inside Capgo's local web server → white screen before React mounts. Vite:
```ts
build: { rollupOptions: { output: {
  entryFileNames: 'assets/[name].js',
  chunkFileNames: 'assets/[name].js',
  assetFileNames: 'assets/[name].[ext]',
}}}
```
Also: use **relative/base `./`** asset paths if the bundler supports it, and keep `index.html` at the zip root.

### 3.4 `firebase.json` (hosting section only)
```json
"hosting": {
  "public": "ota-updates",
  "ignore": ["firebase.json", "**/.*", "**/*.apk"],
  "headers": [
    { "source": "**/*.zip", "headers": [
      { "key": "Cache-Control", "value": "no-cache" },
      { "key": "Content-Type",  "value": "application/zip" } ] },
    { "source": "**", "headers": [ { "key": "X-Content-Type-Options", "value": "nosniff" } ] }
  ]
}
```

### 3.5 `.gitignore` additions
```
ota-updates/bundles/*.zip
*-firebase-adminsdk-*.json
{{FIREBASE_PROJECT}}-*.json
*.apk
*.jks
*.keystore
.env
.env.*
```

### 3.6 `package.json` scripts
```json
"version:sync": "node scripts/sync-versions.mjs",
"release":      "npm test && vite build && node scripts/release-ota.mjs",
"release:apk":  "node scripts/release-apk.mjs",
"test":         "tsc --noEmit"
```

---

## 4. SCRIPTS (reference implementations — adapt, don't invent new behavior)

### 4.1 `scripts/release-ota.mjs` — strict step order
Order is a safety contract: **zip → checksum → host → Firestore**. Firestore is updated **last**, only if hosting succeeded.

```js
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ROOT = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const APP_ID = '{{APP_ID}}', PROJECT = '{{FIREBASE_PROJECT}}';
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'ota-updates', 'bundles');
const zipPath = join(OUT_DIR, `${version}.zip`);
const tmpZip = join(ROOT, `${APP_ID}_${version}.zip`);   // @capgo/cli output name
const fail = (m) => { console.error('❌ ' + m); process.exit(1); };

if (!version) fail('No version in package.json');
if (!existsSync(DIST)) fail('dist/ missing — run the build first');
mkdirSync(OUT_DIR, { recursive: true });

// Guard 1: never reuse/overwrite a published bundle (stale-code protection)
if (existsSync(zipPath)) fail(`${version}.zip already exists. Bump the version (preferred) or delete the zip deliberately.`);

// Guard 2: OTA version must exceed the installed-APK baseline (native versionName in build.gradle)
const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf-8');
const nativeVersion = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
if (!nativeVersion) fail('Cannot read versionName from build.gradle');
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i]||0) !== (y[i]||0)) return (x[i]||0) > (y[i]||0) ? 1 : -1; } return 0; };
if (cmp(version, nativeVersion) <= 0)
  fail(`OTA ${version} must be > native APK ${nativeVersion}, or devices will skip it. Bump package.json.`);

// 1. zip
if (existsSync(tmpZip)) unlinkSync(tmpZip);
execSync(`npx @capgo/cli bundle zip ${APP_ID} -p ./dist -b ${version} --no-code-check`, { stdio: 'inherit', cwd: ROOT });
if (!existsSync(tmpZip)) fail('Capgo CLI did not produce ' + tmpZip);
renameSync(tmpZip, zipPath);

// 2. checksum (computed from the FINAL file)
const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const url = `https://${PROJECT}.web.app/bundles/${version}.zip`;

// 3. host — abort BEFORE touching Firestore on failure
try { execSync('npx firebase-tools deploy --only hosting', { stdio: 'inherit', cwd: ROOT }); }
catch { fail('Hosting deploy failed. Firestore NOT updated; users stay on the previous version.'); }

// 4. verify the URL is actually live and the bytes match
const res = await fetch(url);
if (!res.ok) fail(`Bundle URL returned ${res.status}: ${url}`);
const live = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
if (live !== checksum) fail('Hosted zip checksum differs from local zip — CDN/cache problem. Firestore NOT updated.');

// 5. Firestore manifest (merge:true so min_apk_version / apk_download_url are NEVER touched)
// Credentials: GOOGLE_APPLICATION_CREDENTIALS env var (preferred) or a gitignored service-account JSON.
const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? null : JSON.parse(readFileSync(join(ROOT, process.env.SA_FILE || ''), 'utf-8'));
initializeApp({ credential: sa ? cert(sa) : applicationDefault() });
await getFirestore().collection('app_config').doc('latest_version').set({
  version, url, checksum, critical: false,
  releaseNotes: process.env.RELEASE_NOTES || `OTA release ${version}`,
  releasedAt: new Date().toISOString(),
}, { merge: true });
console.log(`✅ Firestore updated → ${version}`);
```
Rules for this script: never print service-account contents; never use `set` without `merge:true`; on Firestore failure print the exact manual-recovery values (version/url/checksum).

### 4.2 `scripts/release-apk.mjs` — run ONLY after the GitHub release + APK asset exist
```js
// 1. read versionName from build.gradle (the APK's truth) — NOT package.json
// 2. verify package.json version === versionName (else fail)
// 3. HEAD-check the download URL → must be 200/302, else fail (no broken links to users)
// 4. Firestore set (merge:true):
//      min_apk_version : versionName,
//      apk_download_url: `https://github.com/{{GH_OWNER}}/{{GH_RELEASES_REPO}}/releases/download/v${versionName}/{{APK_FILENAME}}`,
//      version         : versionName,   // keep OTA baseline == APK so older OTA zips aren't offered
//      url             : '',            // APK-only release → no OTA bundle
//      checksum        : ''
```
**Order matters:** publish the GitHub release first → then run this script. Raising `min_apk_version` before the APK is downloadable locks every user behind a dead link.

### 4.3 `scripts/sync-versions.mjs`
Reads `package.json.version` and writes `versionName` + increments `versionCode` in `android/app/build.gradle` (only when run for an APK release). Purpose: one source of truth; the original project drifted (package.json 5.1.3 vs gradle 5.0.3) which is legal for OTA-only bumps but must be a *conscious* state. Optional: `versionCode = major*10000 + minor*100 + patch`.

---

## 5. CLIENT CODE (reference skeletons)

### 5.1 Shared helper
```ts
export function compareVersions(a: string, b: string): number {
  if (!a || !b) return 0;
  const x = a.split('.').map(n => parseInt(n, 10) || 0), y = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}
```
Define it **once** (export from updater.ts) and import it in the APK checker — the original duplicated it.

### 5.2 `updater.ts` — Channel A
Exports: `initUpdater({ onCriticalUpdate })`, `forceCheckForUpdate()` → `'latest'|'downloaded'|'not_supported'|'error'`, `OTA_JUST_UPDATED_KEY`, `compareVersions`.

**Native version = `(await App.getInfo()).version` ONLY.** (Never `CapacitorUpdater.current().native` — this repo's checker documented it can mislead; use one source everywhere.)

`initUpdater` flow (each step wrapped; **never throws to the caller**):
1. `if (!Capacitor.isNativePlatform()) return;`
2. **Migration guard:** compare stored `ota_native_version` (localStorage) to current `App.getInfo().version`. If changed (user installed a new APK): remove `ota_pending_version`, `ota_pending_bundle_id`, `ota_failed_versions`, `ota_just_updated`; `await CapacitorUpdater.reset()` (back to builtin); then always store the current native version.
3. **Post-boot verification:** if `ota_pending_*` exists → compare `CapacitorUpdater.current().bundle.id` to pending bundle id. Match & not builtin ⇒ success, clear pending. Else ⇒ rollback happened: add pending version to `ota_failed_versions`, clear pending.
4. `checkForUpdate()`:
   - `getDoc(app_config/latest_version)`; missing ⇒ return.
   - Guards in this order, each a silent `return` with a log line:
     a. `remote.version <= nativeVersion` → skip (APK already contains it)
     b. `remote.version <= activeVersion` → skip (`activeVersion` = current bundle version, `'builtin'`/empty ⇒ `'0.0.0'`)
     c. `min_apk_version` set and `nativeVersion < min_apk_version` → skip (APK channel will handle it)
     d. version is in `ota_failed_versions` → skip (crash-loop prevention)
     e. `!remote.url?.trim()` → skip (APK-only release)
   - `remote.critical` ⇒ call `onCriticalUpdate()`.
   - `downloadAndApply(remote)`.
5. `downloadAndApply`: `CapacitorUpdater.download({ url, version, checksum? })` → **persist** `ota_pending_version`, `ota_pending_bundle_id`, `ota_just_updated` → `CapacitorUpdater.next({ id })` (apply on next launch, **not** immediate) → toast "v{x} downloaded — Restart Now" whose action calls `CapacitorUpdater.reload()` (fallback `window.location.reload()`). On any error: remove the three pending keys, rethrow (caller swallows & logs).

`forceCheckForUpdate()` (manual button) applies the **same guards (a–e)** — the original omitted guard (a) in the manual path; don't. It additionally clears the failed-versions blacklist (user explicitly asked) and shows "already latest" feedback.

**Use `getDocFromServer` in the manual check** so a stale Firestore cache never says "latest".

### 5.3 `apk-update-checker.ts` — Channel B
`checkApkUpdateRequired(): Promise<{ updateRequired: boolean; downloadUrl?: string }>` — **fail-open, never throws**:
1. not native → `{ updateRequired: false }`
2. installed = `(await App.getInfo()).version`; unparseable ⇒ false
3. `getDocFromServer(...)` (bypass cache; network error ⇒ false/fail-open)
4. normalise `min_apk_version`: number `4` ⇒ `"4.0.0"`; string ⇒ trimmed; else ⇒ no requirement
5. `compareVersions(installed, min) < 0` ⇒ `{ updateRequired: true, downloadUrl: apk_download_url || 'https://github.com/{{GH_OWNER}}/{{GH_RELEASES_REPO}}/releases/latest' }`

### 5.4 `ApkUpdateBanner`
Full-screen blocker, one button → `Browser.open({ url })` from `@capacitor/browser` (fallback `window.open(url,'_blank','noopener,noreferrer')`). Android then downloads the APK; user installs it (needs "install unknown apps" permission — mention in the UI text).

### 5.5 `CriticalUpdateScreen`
Full-screen blocker **with a 30 s self-clearing safety timeout** → `onTimeout()` lets the user in. A critical flag with a broken URL must never lock users out forever.

### 5.6 `App.tsx` boot order (do not reorder)
```
1. await CapacitorUpdater.notifyAppReady()   ← FIRST await in the app, native only, try/catch.
                                                Missed within appReadyTimeout ⇒ plugin rolls back the bundle.
2. await withTimeout(initFirebase(), 3000)   ← failure/timeout must not block render
3. setBootComplete(true)                      ← render the UI now; never wait on update checks
4. show "Updated to vX" toast if ota_just_updated is set AND version > native version; clear the key
5. setTimeout(3000): fire-and-forget
      checkApkUpdateRequired() → setApkUpdateRequired / setApkUrl
      initUpdater({ onCriticalUpdate: () => setCritical(true) })
Render priority:  apkUpdateRequired  >  criticalUpdate  >  normal routes
   (a missing native APK outranks an OTA, because OTA code may need the new native plugin)
```
Also add an `App.addListener('appStateChange')` resume handler: if `ota_pending_version` exists **and** is `> native version`, re-show the "Restart Now" toast; if it is `<=` native version, delete the stale pending keys.

### 5.7 Settings screen
Show **both** versions: APK = `App.getInfo().version`, OTA = `CapacitorUpdater.current().bundle.version` (null if builtin). A "Check for updates" button calls `forceCheckForUpdate()` and maps results to toasts (`latest`, `downloaded`, `not_supported` = web, `error` = network). Never read versions from localStorage for display.

---

## 6. HARD RULES (MUST)

1. **`notifyAppReady()` is the first awaited call** in the app on native. No code before it may be able to hang or throw uncaught.
2. **Update code never crashes the app.** Every update path is try/catch, logs, and fails open (`updateRequired:false`, silent return).
3. **Never block render** on a network update check. Checks run after `setBootComplete(true)`, delayed ~3 s.
4. **Version authority is the plugin/native API**, never localStorage. localStorage only tracks *pending/failed/just-updated* flags.
5. **Apply OTA on next restart** (`next()`), never force an immediate reload mid-session (user may be typing / vault unlocked).
6. **Release order:** build → zip → checksum → host → verify URL → Firestore LAST. Any failure before Firestore ⇒ abort, Firestore untouched.
7. **Always `set(..., { merge: true })`.** OTA releases must never overwrite `min_apk_version`/`apk_download_url`; APK releases must clear OTA `url`/`checksum`.
8. **Firestore reads for version gating use `getDocFromServer`** for the APK check and manual check.
9. **Never edit a published bundle.** A published version is immutable; fix = new version.
10. **Non-hashed asset filenames** in the web build (see §3.3).
11. **Consistent APK asset filename** (`{{APK_FILENAME}}`) every release so the download URL is predictable.
12. **Single semver source:** `package.json` drives OTA; `build.gradle versionName` is the APK truth; they may differ only when OTA > APK.
13. **No secrets in repo.** Service-account JSON gitignored; prefer `GOOGLE_APPLICATION_CREDENTIALS`. Run a secret scan in `npm test`. If a key was ever committed, rotate it.
14. **Commit & push to git immediately after every successful release** (so source matches what devices run).
15. **Use the project's logger**, not raw `console.log` (production log level `warn`; don't log UIDs/emails/tokens).
16. **Don't duplicate** `compareVersions`, Firestore path constants, or localStorage key names — define once, import.

## 7. MISTAKES TO AVOID (each one actually happened in the reference project)

| # | Mistake | Consequence | Prevention |
|---|---|---|---|
| 1 | Release script can't find service-account file (wrong filename glob), but hosting already deployed | Zip live, Firestore stale; devices say "latest" or show an old "vX downloaded" toast | Credentials loaded **before** hosting deploy (fail early); verify "Firestore updated" log line every release |
| 2 | OTA version ≤ APK versionName | Device silently skips OTA ("works on my machine" — builtin dev build differs) | Guard 2 in `release-ota.mjs`; always bump above APK |
| 3 | Using `CapacitorUpdater.current().native` for APK version in one file and `App.getInfo()` in another | APK-required screen never appears / wrong comparisons | `App.getInfo().version` everywhere |
| 4 | Reading `min_apk_version` via cached `getDoc` | Blocker persists after installing new APK, or never shows | `getDocFromServer` |
| 5 | Raising `min_apk_version` before the GitHub APK is downloadable | Users locked on blocker with 404 | Release order in §8 + HEAD check in `release-apk.mjs` |
| 6 | Wiping version state on "builtin + no pending" ("poison clear") | Infinite update loops | Removed; authority = plugin `current()` |
| 7 | New APK installed but old OTA state (pending/failed list) kept | New bundle wrongly blacklisted; false rollback | Migration guard resets on native version change |
| 8 | Hashed filenames in the web build | White screen after OTA (404 in plugin web server) | Non-hashed output |
| 9 | Re-zipping an existing version | Devices with that version never get fixed code (version equal) | "bundle already exists" hard error; new version for every fix |
| 10 | Shipping an OTA that calls a native plugin not in the installed APK | Crash on boot → rollback → blacklisted | Native-touching change ⇒ APK channel; raise `min_apk_version` |
| 11 | `critical:true` with unreachable URL and no timeout | Permanent spinner lock-out | 30 s timeout in `CriticalUpdateScreen` |
| 12 | `notifyAppReady()` after Firebase init/other awaits | Healthy bundle rolled back after timeout | First await in boot |
| 13 | Hardcoded user-specific paths (e.g. `C:/Users/…/npm-cache/_npx/<hash>/firebase-tools`) in helper scripts | Scripts break on any other machine / after cache purge | Only use `firebase-admin` + env credentials |
| 14 | Hardcoded versions/notes in one-off Firestore scripts | Wrong manifest written | Always derive from package.json/build.gradle |
| 15 | Different APK filename per release (`app-debug.apk` vs `app-release.apk`) | Broken `apk_download_url` | One constant, HEAD-checked |
| 16 | Shipping a **debug** APK to users | Larger, debuggable, unsigned for upgrades | Release-signed APK with the **same keystore** forever — a different signature cannot update the installed app |
| 17 | Losing/changing the keystore | Users must uninstall (data loss) | Back up keystore + passwords offline; never commit |
| 18 | Forgetting `versionCode` increment | Android refuses to install over existing app | `versionCode` +1 on every APK |
| 19 | Pushing to git before verifying Firestore step | Repo claims a release that devices can't see | Checklist in §8 |
| 20 | Swallowing init errors, then calling Firebase getters at module top level | White screen | Lazy getters; surface boot error UI |
| 21 | Stale "pending" toast on resume after APK upgrade | "Update available" for an already-contained version | Resume handler discards pending ≤ native |
| 22 | Missing `.gitmodules` for a submodule used as the release repo | CI checkout fails | If you keep releases repo as a submodule, commit `.gitmodules`; otherwise don't use a submodule |

---

## 8. RELEASE PLAYBOOKS (put verbatim in `RELEASING.md`)

### 8.1 OTA release (UI / JS-only change)
```
[ ] 0. Confirm NO native change (plugins, android/, manifest, gradle, capacitor.config plugin section)
[ ] 1. Bump package.json version → must be > build.gradle versionName
[ ] 2. npm test            (typecheck + secret scan, 0 errors)
[ ] 3. npm run release     (build → zip → checksum → host → verify → Firestore)
[ ] 4. Confirm in output:  ✅ bundle created · ✅ hosting deployed · ✅ URL verified · ✅ Firestore updated to X.Y.Z
        (if the Firestore line is missing: DO NOT push; set the 3 fields manually in the console, see script output)
[ ] 5. git add . && git commit -m "release: ota vX.Y.Z" && git push
[ ] 6. On a real device with an older build: open app → wait ~5 s → toast → Restart Now → Settings shows OTA vX.Y.Z
```

### 8.2 APK release (native change)
```
[ ] 1. Bump package.json version, build.gradle versionName, versionCode (+1)   (npm run version:sync)
[ ] 2. npm run build && npx cap sync android
[ ] 3. cd android && ./gradlew assembleRelease     (signed with the permanent keystore)
[ ] 4. Install on a device over the previous version → confirm it upgrades in place & launches
[ ] 5. Create GitHub release tag vX.Y.Z in {{GH_OWNER}}/{{GH_RELEASES_REPO}}; upload the APK as {{APK_FILENAME}}
[ ] 6. Open the download URL in a browser → confirms the file downloads (HTTP 200)
[ ] 7. npm run release:apk        (sets min_apk_version, apk_download_url, clears OTA url/checksum)
[ ] 8. git add . && git commit -m "release: apk vX.Y.Z" && git push
[ ] 9. On a device with the OLD APK: open app → blocker appears → button downloads APK → install → blocker gone
```
Optional: `min_apk_version` is a **forcing** switch. If the APK is merely *recommended* (non-breaking), skip step 7's `min_apk_version` change and instead only update `apk_download_url`.

### 8.3 Emergency rollback
- Bad OTA: publish a **new, higher** version containing the previous good code (never reuse a number). Devices that crashed already auto-roll-back and blacklist the bad version locally.
- Bad APK: publish a higher versionCode with the fix; lower `min_apk_version` manually in Firestore if users are locked out.

---

## 9. VERIFICATION TESTS THE AI MUST RUN BEFORE SAYING "DONE"

1. `npx tsc --noEmit` passes.
2. Unit-test `compareVersions` (`1.10.0 > 1.9.0`, `1.0 == 1.0.0`, empty ⇒ 0).
3. Dry-run `release-ota.mjs` guards: (a) existing zip ⇒ error, (b) OTA ≤ native ⇒ error, (c) missing dist ⇒ error.
4. Manifest matrix (state the expected outcome for each in a table in your final answer):

| native | active OTA | remote.version | min_apk | url | Expected |
|---|---|---|---|---|---|
| 1.0.0 | builtin | 1.0.1 | — | zip | download |
| 1.0.0 | 1.0.1 | 1.0.1 | — | zip | skip (already) |
| 1.1.0 | builtin | 1.0.5 | — | zip | skip (≤ native) |
| 1.0.0 | builtin | 1.0.1 | 1.1.0 | zip | skip OTA + APK blocker shown |
| 1.0.0 | builtin | 1.0.1 | — | "" | skip (APK-only) |
| 1.0.0 | builtin | 1.0.1 (blacklisted) | — | zip | skip; manual check retries |
| offline | | | | | no crash, no blocker |

5. Real-device test of the full OTA cycle and the full APK cycle (§8). If you cannot run a device, say so explicitly — do not claim it works.

## 10. HOW TO WORK
- Inspect the existing project (package.json, capacitor config, App entry, Firebase init, logger, toast lib, existing release scripts) **before** writing; reuse what exists.
- Make minimal changes; no new libraries beyond §3.1.
- Do the work in this order: §0 questions → config files (§3) → scripts (§4) → client (§5) → `RELEASING.md` (§8) → tests (§9).
- At the end report: files changed, the Firestore doc shape, the exact commands for OTA and APK releases, anything you could not verify.
- Do not commit or push unless I ask.
