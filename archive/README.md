# Archive

Code that is not part of the current product but is kept for later. Nothing here is built, deployed or loaded by the website.

| Folder | What it is | Status |
| :--- | :--- | :--- |
| `android/` | The Android app (Capacitor + native Gradle project), its OTA/APK release scripts (`android/scripts/`), the release guide (`android/RELEASING.md`) and the local OTA signing keys (`android/.ota-keys/`, git-ignored) | On hold. The website already works on phones |

## Restoring the Android app

1. Move `archive/android/` back to `android/` in the project root.
2. Move `android/scripts/*` back to `scripts/` (`ota-keygen.mjs`, `release-apk.mjs`, `release-ota.mjs`, `sync-versions.mjs`, `test-updater.mjs`, and the `lib/` folder), and `android/RELEASING.md` back to the root.
3. Move `android/.ota-keys/` back to the project root (keep it git-ignored and backed up).
4. In `scripts/build.js` add the target back:
   ```js
   android: { src: path.join(root, "android", "src"), out: path.join(root, "android", "www"), skip: [] },
   ```
   and in `package.json` add `"build:android": "node scripts/build.js android"`.
5. In `.gitignore` change the `archive/android/...` entries back to `android/...`.
6. Re-add the Android mentions to `shared/legal/privacy.html` (an "Android app" section about update checks and the Internet permission), `terms.html` (website **and** Android app; app updates) and `notices.html` (Capacitor MIT, Capgo Capacitor Updater MPL-2.0).
7. Run `cd android && npm install && npm run sync`.

Paths inside the moved scripts assume the original locations, so they only work again after step 1 to 3.
