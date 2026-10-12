# Releasing ShipLabel (Android)

Two update channels, one signed manifest.

| Change | Channel | User action |
|---|---|---|
| UI, CSS, copy, JS logic, bug fixes in web code (`android/src`, `shared/`) | **OTA** | none (toast, then restart) |
| New/updated Capacitor plugin, anything in `android/native`, permissions, icon, `capacitor.config.json` plugin config | **APK** | download + install |
| Unsure | **APK** | an OTA that calls a missing native plugin crashes the app |

## Versioning rules

- `android/package.json` `version` is the single source of truth.
- **APK versions are major-only: `N.0.0`**, `versionCode = N`, tag `vN` (v1, v2, v3 ...).
- **OTA versions sit between majors**: after APK `2.0.0`, OTAs are `2.0.1`, `2.1.0` ...
- OTA must be strictly greater than the installed APK, or devices skip it. Published versions are immutable: a fix is always a new version.

## Where things live

| Item | Location |
|---|---|
| APK releases `vN` (asset `ShipLabel.apk`) | `tooLazyToNotAutomate/shiplabel-apk` **and** `tooLazyToNotAutomate/shiplabel` |
| OTA zips | `shiplabel-apk` prerelease tagged `ota` (never "Latest") |
| Signed manifest | `shiplabel-apk/manifest.json` (`{payload, sig}`) |

## One-time setup

1. Create the public release repo: `gh repo create tooLazyToNotAutomate/shiplabel-apk --public --add-readme`
2. Create the OTA signing key: `node scripts/ota-keygen.mjs`
   - private key: `.ota-keys/ota-private.pem` (gitignored). **Back it up offline.** If it is lost, installed apps can never accept another OTA; you would have to ship a new APK with a new public key.
   - public key: `android/src/components/update-keys.js` (compiled into the APK).
3. Create the APK signing keystore (keep it forever; a different signature cannot update an installed app):
   `keytool -genkeypair -v -keystore shiplabel-release.jks -alias shiplabel -keyalg RSA -keysize 4096 -validity 10000`
   Store the `.jks` outside the repo and back it up. Then create `android/native/keystore.properties` (gitignored):
   ```
   storeFile=C:/path/to/shiplabel-release.jks
   storePassword=...
   keyAlias=shiplabel
   keyPassword=...
   ```
4. Release the **first signed APK** (below). Phones need it once; OTA works from then on.

## OTA release (UI / JS-only)

```
[ ] 0. Confirm NO native change
[ ] 1. Bump android/package.json version (> build.gradle versionName)
[ ] 2. npm run test:updater      (inside android/, or: node scripts/test-updater.mjs)
[ ] 3. npm run release:ota       (build -> zip -> sha256 -> upload -> verify -> signed manifest LAST)
        RELEASE_NOTES="..." CRITICAL=1 are optional env vars
[ ] 4. Output must show: bundle built, hosted, URL verified, signed manifest published
        (if the manifest line is missing, do NOT push; use the recovery values the script prints)
[ ] 5. git add . && git commit -m "release: ota vX.Y.Z" && git push
[ ] 6. On a device with an older build: open app, wait ~5 s, toast, "Restart now", Settings shows the new version
```

## APK release (native change)

```
[ ] 1. Bump android/package.json to the next MAJOR (N.0.0), then: npm run version:sync
[ ] 2. cd android && npm run apk:release     (build + cap sync + assembleRelease, signed with the permanent keystore)
[ ] 3. Install it over the previous version on a device: it must upgrade in place and launch
[ ] 4. npm run release:apk   (creates release vN in BOTH repos, HEAD-checks the URL, then publishes the manifest)
        RECOMMENDED_ONLY=1 publishes the APK without forcing the blocker screen
[ ] 5. git add . && git commit -m "release: apk vN" && git push
[ ] 6. On a device with the OLD APK: open app, blocker appears, button downloads the APK, install, blocker gone
```

## Security model

- The manifest is signed with ECDSA P-256. The app verifies the signature over the exact payload before reading any field, rejects older (replayed) manifests, and only accepts bundle/APK URLs under the two allow-listed GitHub release paths.
- The payload carries the bundle SHA-256, which the native plugin verifies again after download.
- Compromising GitHub alone cannot push code to phones: an attacker also needs `.ota-keys/ota-private.pem`.
- Update checks are one anonymous GET of a static file. No label, file, or identifier is ever sent. Capgo's own telemetry is disabled (`statsUrl`, `channelUrl`, `updateUrl` are empty in `capacitor.config.json`).

## Propagation delay

`raw.githubusercontent.com` caches `manifest.json` for up to **5 minutes** and ignores query-string cache-busting. After `release:ota` or `release:apk`, phones may keep seeing the previous manifest for up to 5 minutes, so "Check for updates" can say "latest" briefly. This is normal; wait and retry. (The GitHub API shows the true current manifest immediately: `gh api repos/tooLazyToNotAutomate/shiplabel-apk/contents/manifest.json`.)

## Emergency rollback

- Bad OTA: publish a **new, higher** version containing the previous good code. Devices that crashed on the bad one roll back automatically and blacklist it locally.
- Bad APK: publish the next major with the fix. If users are locked out, republish a manifest with a lower `min_apk_version` (re-run `release:apk` with `RECOMMENDED_ONLY=1`).
