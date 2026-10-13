// Shared helpers for the OTA / APK release scripts.
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execFileSync } from "child_process";
import { createHash, sign as cryptoSign } from "crypto";

export const ROOT = resolve(import.meta.dirname, "..", "..");
export const ANDROID = join(ROOT, "android");
export const GRADLE = join(ANDROID, "native", "app", "build.gradle");

// ---- Release targets (change here only) ------------------------------------
export const OWNER = "tooLazyToNotAutomate";
export const RELEASES_REPO = `${OWNER}/shiplabel-apk`; // APKs, OTA zips and manifest.json
export const SOURCE_REPO = `${OWNER}/trimlabel`;       // also receives the vN release
export const APK_FILENAME = "TrimLabel.apk";           // identical on every release
export const OTA_TAG = "ota";                          // rolling prerelease that hosts OTA zips
export const MANIFEST_PATH = "manifest.json";
export const KEY_FILE = process.env.OTA_PRIVATE_KEY_FILE || join(ROOT, ".ota-keys", "ota-private.pem");

export const fail = (m) => { console.error("❌ " + m); process.exit(1); };

export function compareVersions(a, b) {
  const x = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const y = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}

export const isSemver = (v) => /^\d+\.\d+\.\d+$/.test(v);
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function packageVersion() {
  return JSON.parse(readFileSync(join(ANDROID, "package.json"), "utf-8")).version;
}

export function gradleVersions() {
  const g = readFileSync(GRADLE, "utf-8");
  return {
    versionName: g.match(/versionName\s+"([^"]+)"/)?.[1],
    versionCode: Number(g.match(/versionCode\s+(\d+)/)?.[1]),
  };
}

/** Run gh without a shell (no injection through arguments). */
export function gh(args, opts = {}) {
  return execFileSync("gh", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"], ...opts }).trim();
}

/** Read the currently published manifest payload (unverified; used only to merge fields). */
export function readPublishedManifest() {
  try {
    const raw = gh(["api", `repos/${RELEASES_REPO}/contents/${MANIFEST_PATH}`, "-H", "Accept: application/vnd.github.raw"]);
    const env = JSON.parse(raw);
    return { sha: gh(["api", `repos/${RELEASES_REPO}/contents/${MANIFEST_PATH}`, "--jq", ".sha"]), payload: JSON.parse(env.payload) };
  } catch {
    return { sha: null, payload: null };
  }
}

/** Sign the payload string with ECDSA P-256 (raw r||s, what WebCrypto expects). */
export function signPayload(payloadString) {
  if (!existsSync(KEY_FILE)) fail(`OTA private key not found at ${KEY_FILE}. Run: node scripts/ota-keygen.mjs`);
  const pem = readFileSync(KEY_FILE, "utf-8");
  return cryptoSign("sha256", Buffer.from(payloadString, "utf-8"), { key: pem, dsaEncoding: "ieee-p1363" }).toString("base64");
}

/** Build the signed envelope {payload, sig}. payload is a string so line endings can never alter signed bytes. */
export function buildEnvelope(fields) {
  const payload = JSON.stringify({ schema: 1, ...fields, seq: Date.now() });
  return JSON.stringify({ payload, sig: signPayload(payload) }, null, 2) + "\n";
}

/** Publish manifest.json via the GitHub contents API (single atomic commit). */
export function publishManifest(envelopeText, message) {
  const { sha } = readPublishedManifest();
  const args = ["api", "-X", "PUT", `repos/${RELEASES_REPO}/contents/${MANIFEST_PATH}`,
    "-f", `message=${message}`, "-f", `content=${Buffer.from(envelopeText).toString("base64")}`];
  if (sha) args.push("-f", `sha=${sha}`);
  gh(args);
}
