// Single source of truth: android/package.json "version".
//   node scripts/sync-versions.mjs --apk   -> writes versionName/versionCode to build.gradle (APK release)
// APK versions are MAJOR-ONLY (N.0.0, versionCode N). Everything in between ships as OTA.
import { readFileSync, writeFileSync } from "fs";
import { GRADLE, packageVersion, isSemver, fail } from "./lib/common.mjs";

if (!process.argv.includes("--apk")) fail("Pass --apk. (OTA releases do not touch build.gradle.)");
const v = packageVersion();
if (!isSemver(v)) fail(`android/package.json version "${v}" is not X.Y.Z`);
const [major, minor, patch] = v.split(".").map(Number);
if (minor !== 0 || patch !== 0) fail(`APK releases are major-only (N.0.0). "${v}" must ship as an OTA, or bump to ${major + 1}.0.0 for a new APK.`);

let g = readFileSync(GRADLE, "utf-8");
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${v}"`).replace(/versionCode\s+\d+/, `versionCode ${major}`);
writeFileSync(GRADLE, g);
console.log(`✅ build.gradle → versionName ${v}, versionCode ${major}`);
