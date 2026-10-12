// OTA release (UI / JS-only change).
// Strict order: build -> zip -> checksum -> host -> verify -> sign + publish manifest LAST.
//   node scripts/release-ota.mjs            (RELEASE_NOTES="..." and CRITICAL=1 are optional env vars)
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import {
  ROOT, ANDROID, RELEASES_REPO, OTA_TAG, KEY_FILE, fail, gh, sha256, compareVersions, isSemver,
  packageVersion, gradleVersions, readPublishedManifest, buildEnvelope, publishManifest,
} from "./lib/common.mjs";

const version = packageVersion();
if (!isSemver(version)) fail(`android/package.json version "${version}" is not X.Y.Z`);
if (!existsSync(KEY_FILE)) fail(`OTA private key missing (${KEY_FILE}). Run: node scripts/ota-keygen.mjs`);

// Guard 1: OTA must be strictly newer than the installed APK baseline, or devices skip it.
const { versionName } = gradleVersions();
if (!versionName) fail("Cannot read versionName from build.gradle");
if (compareVersions(version, versionName) <= 0)
  fail(`OTA ${version} must be > native APK ${versionName}, or devices will skip it. Bump android/package.json.`);

const zipDir = join(ROOT, "dist", "ota");
const zipPath = join(zipDir, `${version}.zip`);
mkdirSync(zipDir, { recursive: true });
// Guard 2: a published version is immutable.
if (existsSync(zipPath)) fail(`${zipPath} already exists. Published versions are immutable: bump the version instead.`);

// 0. build the web layer
execFileSync(process.execPath, [join(ROOT, "scripts", "build.js"), "android"], { stdio: "inherit" });
const www = join(ANDROID, "www");
if (!existsSync(join(www, "index.html"))) fail("android/www/index.html missing after build");

// 1. zip, index.html at the zip root (uses the already-vendored JSZip: no extra dependency)
const JSZip = createRequire(import.meta.url)(join(ROOT, "shared", "vendor", "jszip.min.js"));
const zip = new JSZip();
(function add(dir, rel = "") {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) add(full, r);
    else zip.file(r, readFileSync(full), { date: new Date(0) }); // fixed date => reproducible bytes
  }
})(www);
const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
writeFileSync(zipPath, zipBytes);

// 2. checksum of the FINAL file
const checksum = sha256(zipBytes);
const url = `https://github.com/${RELEASES_REPO}/releases/download/${OTA_TAG}/${version}.zip`;

// 3. host on the rolling "ota" prerelease (a prerelease never becomes the repo's "Latest")
try { gh(["release", "view", OTA_TAG, "-R", RELEASES_REPO]); }
catch {
  gh(["release", "create", OTA_TAG, "-R", RELEASES_REPO, "--prerelease", "--title", "OTA bundles",
    "--notes", "Rolling host for over-the-air bundles. Not an installable release."]);
}
try { gh(["release", "upload", OTA_TAG, zipPath, "-R", RELEASES_REPO]); }
catch { fail("Upload failed (does this version already exist on the ota release?). Manifest NOT updated; users stay on the previous version."); }

// 4. verify the live bytes match
const res = await fetch(url);
if (!res.ok) fail(`Bundle URL returned ${res.status}: ${url}. Manifest NOT updated.`);
if (sha256(Buffer.from(await res.arrayBuffer())) !== checksum) fail("Hosted zip differs from local zip. Manifest NOT updated.");

// 5. signed manifest LAST; merge so min_apk_version / apk_download_url are never touched
const prev = readPublishedManifest().payload || {};
const envelope = buildEnvelope({
  version, url, checksum,
  critical: process.env.CRITICAL === "1",
  releaseNotes: (process.env.RELEASE_NOTES || `Update ${version}`).slice(0, 500),
  releasedAt: new Date().toISOString(),
  min_apk_version: prev.min_apk_version || "",
  apk_download_url: prev.apk_download_url || "",
});
try { publishManifest(envelope, `ota ${version}`); }
catch {
  console.error("Manifest publish failed. Bundle is hosted but NOT announced. Manual recovery values:");
  console.error(JSON.stringify({ version, url, checksum }, null, 2));
  process.exit(1);
}
console.log(`✅ bundle ${version} built · ✅ hosted · ✅ URL verified · ✅ signed manifest published`);
console.log(`Next: git add . && git commit -m "release: ota v${version}" && git push   (not done automatically)`);
