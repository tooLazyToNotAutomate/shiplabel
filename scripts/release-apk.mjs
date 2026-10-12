// APK release (native change). Major-only: tag vN, published to BOTH repos.
// Order: node scripts/sync-versions.mjs --apk  ->  cd android && npm run apk:release  ->  this script.
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  ROOT, ANDROID, RELEASES_REPO, SOURCE_REPO, APK_FILENAME, KEY_FILE, fail, gh, isSemver,
  packageVersion, gradleVersions, readPublishedManifest, buildEnvelope, publishManifest,
} from "./lib/common.mjs";

const pkg = packageVersion();
const { versionName, versionCode } = gradleVersions();
if (!isSemver(pkg) || pkg !== versionName)
  fail(`android/package.json (${pkg}) must equal build.gradle versionName (${versionName}). Run: node scripts/sync-versions.mjs --apk`);
const [major, minor, patch] = versionName.split(".").map(Number);
if (minor !== 0 || patch !== 0) fail(`APK releases are major-only (N.0.0); got ${versionName}. Ship minor/patch changes as OTA.`);
if (versionCode !== major) fail(`versionCode ${versionCode} must equal the major version ${major}.`);
if (!existsSync(KEY_FILE)) fail(`OTA private key missing (${KEY_FILE}).`);

const built = join(ANDROID, "native", "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(built))
  fail(`Signed release APK not found: ${built}. Create android/native/keystore.properties, then run: cd android && npm run apk:release. A debug or unsigned APK must never be shipped.`);

const tag = `v${major}`;
const outDir = join(ROOT, "dist", "apk");
mkdirSync(outDir, { recursive: true });
const apk = join(outDir, APK_FILENAME);
copyFileSync(built, apk);

// Majors are immutable: refuse if the tag already exists in either repo (checked before anything is published).
for (const repo of [RELEASES_REPO, SOURCE_REPO]) {
  let exists = true;
  try { gh(["release", "view", tag, "-R", repo]); } catch { exists = false; }
  if (exists) fail(`Release ${tag} already exists in ${repo}. Bump to the next major.`);
}
for (const repo of [RELEASES_REPO, SOURCE_REPO]) {
  gh(["release", "create", tag, apk, "-R", repo, "--title", `TrimLabel ${tag}`, "--notes", process.env.RELEASE_NOTES || `TrimLabel ${versionName}`]);
}

const url = `https://github.com/${RELEASES_REPO}/releases/download/${tag}/${APK_FILENAME}`;
// The manifest may only point at a link that really downloads.
const head = await fetch(url, { method: "HEAD", redirect: "follow" });
if (!head.ok) fail(`Download URL returned ${head.status}: ${url}. Manifest NOT updated (users would hit a dead link).`);

// APK manifest: raise the floor (unless RECOMMENDED_ONLY=1) and clear any OTA bundle so older zips are not offered.
const prevMin = readPublishedManifest().payload?.min_apk_version || "";
publishManifest(buildEnvelope({
  version: versionName, url: "", checksum: "", critical: false,
  releaseNotes: (process.env.RELEASE_NOTES || `TrimLabel ${versionName}`).slice(0, 500),
  releasedAt: new Date().toISOString(),
  min_apk_version: process.env.RECOMMENDED_ONLY === "1" ? prevMin : versionName,
  apk_download_url: url,
}), `apk ${tag}`);
console.log(`✅ ${tag} released to ${RELEASES_REPO} and ${SOURCE_REPO} · ✅ manifest published`);
