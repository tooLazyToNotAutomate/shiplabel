// Offline tests for the update system: version compare, manifest trust chain, decision matrix, release guards.
//   node scripts/test-updater.mjs
import { createRequire } from "module";
import { generateKeyPairSync, sign, webcrypto } from "crypto";
import { execFileSync } from "child_process";
import { join } from "path";
import { ROOT, compareVersions } from "./lib/common.mjs";

const require = createRequire(import.meta.url);
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// Load the real client module in Node with browser stubs.
const store = new Map();
globalThis.window = { Capacitor: {} };
globalThis.Security = {
  storageGet: (k) => (store.has(k) ? store.get(k) : null),
  storageSet: (k, v) => { store.set(k, v); return true; },
  storageRemove: (k) => store.delete(k),
};
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
const U = require(join(ROOT, "android", "src", "components", "updater.js"));

// 1. compareVersions (client and release scripts agree)
for (const [a, b, want] of [["1.10.0", "1.9.0", 1], ["1.0", "1.0.0", 0], ["", "1.0.0", 0], ["1.0.1", "1.1.0", -1], ["2.0.0", "1.99.99", 1]]) {
  ok(`compareVersions(${a || "''"}, ${b}) = ${want}`, U.compareVersions(a, b) === want);
}
ok("client and script compareVersions agree", U.compareVersions("1.2.3", "1.2.4") === compareVersions("1.2.3", "1.2.4"));

// 2. Manifest trust chain: sign in Node (ieee-p1363), verify with WebCrypto in the client code.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const goodZip = U.CFG.bundlePrefix + "1.0.1.zip";
const sum = "a".repeat(64);
const mk = (fields, key = privateKey) => {
  const payload = JSON.stringify({ schema: 1, seq: 1000, version: "1.0.1", url: goodZip, checksum: sum, min_apk_version: "", apk_download_url: "", ...fields });
  return { payload, sig: sign("sha256", Buffer.from(payload), { key, dsaEncoding: "ieee-p1363" }).toString("base64") };
};
ok("valid signed manifest accepted", (await U.parseManifest(mk({}), pub))?.version === "1.0.1");
const tampered = mk({}); tampered.payload = tampered.payload.replace("1.0.1", "9.9.9");
ok("tampered payload rejected", (await U.parseManifest(tampered, pub)) === null);
const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
ok("signature from a different key rejected", (await U.parseManifest(mk({}, other.privateKey), pub)) === null);
ok("garbage signature rejected", (await U.parseManifest({ payload: mk({}).payload, sig: "AAAA" }, pub)) === null);
ok("bundle URL outside allow-list rejected", (await U.parseManifest(mk({ url: "https://evil.example/x.zip" }), pub)) === null);
ok("bundle without sha256 rejected", (await U.parseManifest(mk({ checksum: "" }), pub)) === null);
ok("APK link outside allow-list is dropped", (await U.parseManifest(mk({ apk_download_url: "https://evil.example/a.apk" }), pub)).apk_download_url === "");
ok("APK link on our release host kept", (await U.parseManifest(mk({ apk_download_url: U.CFG.apkPrefix + "v2/ShipLabel.apk" }), pub)).apk_download_url.endsWith("ShipLabel.apk"));
ok("non-semver version rejected", (await U.parseManifest(mk({ version: "1.0" }), pub)) === null);

// 3. Decision matrix (from the template, adapted)
const R = (o) => ({ version: "1.0.1", url: goodZip, checksum: sum, min_apk_version: "", ...o });
const rows = [
  ["native 1.0.0, builtin, remote 1.0.1 zip -> download", { native: "1.0.0", active: "0.0.0", remote: R({}) }, "download"],
  ["already active 1.0.1 -> skip", { native: "1.0.0", active: "1.0.1", remote: R({}) }, "skip"],
  ["remote <= native -> skip", { native: "1.1.0", active: "0.0.0", remote: R({ version: "1.0.5" }) }, "skip"],
  ["min_apk above native -> skip OTA", { native: "1.0.0", active: "0.0.0", remote: R({ min_apk_version: "1.1.0" }) }, "skip"],
  ["APK-only (no url) -> skip", { native: "1.0.0", active: "0.0.0", remote: R({ url: "" }) }, "skip"],
  ["blacklisted -> skip", { native: "1.0.0", active: "0.0.0", remote: R({}), failed: ["1.0.1"] }, "skip"],
  ["blacklisted but manual check -> download", { native: "1.0.0", active: "0.0.0", remote: R({}), failed: ["1.0.1"], manual: true }, "download"],
  ["no manifest (offline) -> skip, no crash", { native: "1.0.0", active: "0.0.0", remote: null }, "skip"],
];
for (const [name, input, want] of rows) ok(name, U.decideOta(input).action === want);
ok("APK blocker shown when native < min_apk", U.decideApk({ native: "1.0.0", remote: R({ min_apk_version: "2.0.0" }) }).required === true);
ok("APK blocker not shown when native >= min_apk", U.decideApk({ native: "2.0.0", remote: R({ min_apk_version: "2.0.0" }) }).required === false);
ok("APK blocker not shown offline", U.decideApk({ native: "1.0.0", remote: null }).required === false);
ok("APK blocker falls back to releases page", U.decideApk({ native: "1.0.0", remote: R({ min_apk_version: "2.0.0" }) }).url === U.CFG.fallbackApkUrl);

// 4. Release-script guards (no network: they must abort before any publishing)
const run = (script, env = {}) => {
  try { execFileSync(process.execPath, [join(ROOT, "scripts", script)], { env: { ...process.env, ...env }, stdio: "pipe" }); return { code: 0, out: "" }; }
  catch (e) { return { code: e.status, out: String(e.stderr) + String(e.stdout) }; }
};
const apk = run("sync-versions.mjs");
ok("sync-versions without --apk refuses", apk.code !== 0);
const rel = run("release-apk.mjs");
ok("release-apk refuses without signed release APK / valid versions", rel.code !== 0 && /❌/.test(rel.out));

console.log(failed ? `\n${failed} FAILED` : "\nAll tests passed");
process.exit(failed ? 1 : 0);
