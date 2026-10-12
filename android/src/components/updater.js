/**
 * Two-channel update system.
 *   Channel A (OTA)  : signed JS/UI bundle, applied on next restart (Capgo updater plugin).
 *   Channel B (APK)  : blocking "update required" screen that opens the APK download.
 *
 * Trust chain: manifest.json is {payload, sig}. The signature (ECDSA P-256, public key compiled
 * into the APK) is verified over the exact payload string BEFORE any field is read. The payload
 * carries the bundle SHA-256, which the native plugin re-verifies after download. Every URL is
 * allow-listed. Nothing about the user, their files or labels is ever sent: update checks are a
 * single anonymous GET of a static file.
 *
 * Everything here fails open: an update problem must never stop the app from working.
 */
const Updater = (() => {
  const CFG = {
    manifestUrl: "https://raw.githubusercontent.com/tooLazyToNotAutomate/shiplabel-apk/main/manifest.json",
    bundlePrefix: "https://github.com/tooLazyToNotAutomate/shiplabel-apk/releases/download/ota/",
    apkPrefix: "https://github.com/tooLazyToNotAutomate/shiplabel-apk/releases/download/",
    fallbackApkUrl: "https://github.com/tooLazyToNotAutomate/shiplabel-apk/releases",
    fetchTimeoutMs: 15000
  };

  // Only these localStorage keys; they hold flags, never version authority.
  const K = {
    nativeVersion: "ota_native_version",
    pendingVersion: "ota_pending_version",
    pendingBundleId: "ota_pending_bundle_id",
    failed: "ota_failed_versions",
    justUpdated: "ota_just_updated",
    seq: "ota_manifest_seq"
  };

  const plugin = (name) => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const get = (k) => Security.storageGet(k);
  const set = (k, v) => Security.storageSet(k, v);
  const del = (k) => Security.storageRemove(k);
  const log = (...a) => { try { console.warn("[updater]", ...a); } catch (e) { /* ignore */ } };

  function compareVersions(a, b) {
    if (!a || !b) return 0;
    const x = String(a).split(".").map((n) => parseInt(n, 10) || 0);
    const y = String(b).split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
    }
    return 0;
  }

  const SEMVER = /^\d+\.\d+\.\d+$/;

  // ---- manifest trust -----------------------------------------------------
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function signatureValid(payload, sigB64, pubKeyB64) {
    try {
      const key = await crypto.subtle.importKey("spki", b64ToBytes(pubKeyB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64ToBytes(sigB64), new TextEncoder().encode(payload));
    } catch (e) {
      return false;
    }
  }

  /** Verify + validate a downloaded envelope. Returns a clean manifest or null. Never throws. */
  async function parseManifest(envelope, pubKeyB64 = window.UPDATE_PUBLIC_KEY) {
    try {
      if (!envelope || typeof envelope.payload !== "string" || typeof envelope.sig !== "string" || !pubKeyB64) return null;
      if (!(await signatureValid(envelope.payload, envelope.sig, pubKeyB64))) {
        log("manifest signature INVALID - ignored");
        return null;
      }
      const m = JSON.parse(envelope.payload);
      if (m.schema !== 1 || !Number.isSafeInteger(m.seq)) return null;
      const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
      const out = {
        seq: m.seq,
        version: str(m.version, 20),
        url: str(m.url, 300),
        checksum: str(m.checksum, 64).toLowerCase(),
        critical: m.critical === true,
        releaseNotes: str(m.releaseNotes, 500),
        min_apk_version: str(m.min_apk_version, 20),
        apk_download_url: str(m.apk_download_url, 300)
      };
      if (!SEMVER.test(out.version)) return null;
      if (out.min_apk_version && !SEMVER.test(out.min_apk_version)) return null;
      // OTA bundle: must be a zip from our own release host, with a sha256.
      if (out.url) {
        if (!out.url.startsWith(CFG.bundlePrefix) || !out.url.endsWith(".zip") || !/^[a-f0-9]{64}$/.test(out.checksum)) return null;
      } else {
        out.url = "";
        out.checksum = "";
      }
      // APK link: only our own release host, otherwise fall back to the releases page.
      if (!out.apk_download_url.startsWith(CFG.apkPrefix)) out.apk_download_url = "";
      return out;
    } catch (e) {
      return null;
    }
  }

  async function fetchManifest() {
    const http = plugin("CapacitorHttp");
    const url = CFG.manifestUrl + "?t=" + Date.now();
    let env;
    if (http) {
      const res = await http.get({ url, headers: { "Cache-Control": "no-cache" }, responseType: "text", connectTimeout: CFG.fetchTimeoutMs, readTimeout: CFG.fetchTimeoutMs });
      if (!res || res.status !== 200) return null;
      env = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } else {
      return null; // WebView fetch is blocked by CSP by design; native HTTP only
    }
    const manifest = await parseManifest(env);
    if (!manifest) return null;
    // Replay protection: never accept an older signed manifest than one already seen.
    const lastSeq = Number(get(K.seq) || 0);
    if (manifest.seq < lastSeq) {
      log("stale manifest ignored");
      return null;
    }
    set(K.seq, String(manifest.seq));
    return manifest;
  }

  // ---- pure decision logic (unit-tested) ---------------------------------
  /** Returns { action: "download" | "skip", reason }. */
  function decideOta({ native, active, remote, failed = [], manual = false }) {
    if (!remote || !remote.version) return { action: "skip", reason: "no-manifest" };
    if (compareVersions(remote.version, native) <= 0) return { action: "skip", reason: "not-newer-than-apk" };
    if (compareVersions(remote.version, active || "0.0.0") <= 0) return { action: "skip", reason: "already-active" };
    if (remote.min_apk_version && compareVersions(native, remote.min_apk_version) < 0) return { action: "skip", reason: "apk-update-required" };
    if (!manual && failed.includes(remote.version)) return { action: "skip", reason: "blacklisted" };
    if (!remote.url) return { action: "skip", reason: "apk-only-release" };
    return { action: "download", reason: "ok" };
  }

  function decideApk({ native, remote }) {
    if (!remote || !remote.min_apk_version || !native) return { required: false };
    if (compareVersions(native, remote.min_apk_version) < 0) {
      return { required: true, url: remote.apk_download_url || CFG.fallbackApkUrl };
    }
    return { required: false };
  }

  // ---- state helpers ------------------------------------------------------
  async function nativeVersion() {
    const app = plugin("App");
    if (!app) return null;
    return (await app.getInfo()).version || null;
  }

  async function activeVersion() {
    const up = plugin("CapacitorUpdater");
    if (!up) return "0.0.0";
    const cur = await up.current();
    const bundle = cur && cur.bundle;
    // The built-in bundle reports the native version, so identify it by id.
    return !bundle || !bundle.version || bundle.id === "builtin" || bundle.version === "builtin" ? "0.0.0" : bundle.version;
  }

  function failedList() {
    try {
      const l = JSON.parse(get(K.failed) || "[]");
      return Array.isArray(l) ? l.filter((v) => typeof v === "string") : [];
    } catch (e) {
      return [];
    }
  }

  function clearOtaState() {
    [K.pendingVersion, K.pendingBundleId, K.failed, K.justUpdated].forEach(del);
  }

  /** New APK installed -> old OTA state is meaningless; return to the bundled web code. */
  async function migrationGuard(native) {
    const stored = get(K.nativeVersion);
    if (stored && stored !== native) {
      clearOtaState();
      const up = plugin("CapacitorUpdater");
      if (up) { try { await up.reset(); } catch (e) { log("reset failed", e); } }
    }
    set(K.nativeVersion, native);
  }

  /** Did the bundle we staged last time actually boot, or did the plugin roll it back? */
  async function verifyPending() {
    const pendingId = get(K.pendingBundleId);
    const pendingVer = get(K.pendingVersion);
    if (!pendingId || !pendingVer) return;
    const up = plugin("CapacitorUpdater");
    if (!up) return;
    const cur = await up.current();
    const id = cur && cur.bundle && cur.bundle.id;
    if (id === pendingId && id !== "builtin") {
      del(K.pendingVersion); del(K.pendingBundleId); // success
    } else if (id !== pendingId) {
      // Staged bundle is not the one running. Either the user hasn't restarted yet (keep waiting)
      // or the plugin rolled it back after a failed boot.
      const next = typeof up.getNextBundle === "function" ? await up.getNextBundle().catch(() => null) : null;
      const stillQueued = next && next.id === pendingId;
      if (!stillQueued) {
        const f = failedList();
        if (!f.includes(pendingVer)) f.push(pendingVer);
        set(K.failed, JSON.stringify(f.slice(-20)));
        del(K.pendingVersion); del(K.pendingBundleId);
      }
    }
  }

  async function downloadAndApply(remote) {
    const up = plugin("CapacitorUpdater");
    if (!up) throw new Error("updater plugin missing");
    set(K.justUpdated, remote.version);
    try {
      const bundle = await up.download({ url: remote.url, version: remote.version, checksum: remote.checksum });
      set(K.pendingVersion, remote.version);
      set(K.pendingBundleId, bundle.id);
      await up.next({ id: bundle.id }); // apply on next launch, never mid-session
      api.promptRestart(remote.version);
    } catch (e) {
      del(K.pendingVersion); del(K.pendingBundleId); del(K.justUpdated);
      throw e;
    }
  }

  // ---- public API ----------------------------------------------------------
  const api = {
    CFG, K, compareVersions, parseManifest, decideOta, decideApk,

    /** Offer "Restart now". The update is already staged and will apply on next launch anyway. */
    promptRestart(version) {
      if (!window.Toast || !Toast.action) return;
      Toast.action(`Update v${version} downloaded`, "Restart now", async () => {
        const up = plugin("CapacitorUpdater");
        const id = get(K.pendingBundleId);
        // set() switches to the staged bundle and reloads; reload() alone would just reload the current one.
        try { if (up && id) await up.set({ id }); else location.reload(); } catch (e) { log("restart failed", e); location.reload(); }
      });
    },

    /** Channel B. Fail-open: any problem means "no update required". */
    async checkApkUpdateRequired(prefetched) {
      try {
        if (!isNative()) return { required: false };
        const native = await nativeVersion();
        if (!native) return { required: false };
        const remote = prefetched === undefined ? await fetchManifest() : prefetched;
        return decideApk({ native, remote });
      } catch (e) {
        log("apk check failed", e);
        return { required: false };
      }
    },

    /** Channel A, run once after boot. Never throws. */
    async init({ onCriticalUpdate, onApkRequired } = {}) {
      try {
        if (!isNative()) return;
        const native = await nativeVersion();
        if (!native) return;
        await migrationGuard(native);
        await verifyPending();
        const remote = await fetchManifest();
        if (!remote) return;
        const apk = decideApk({ native, remote });
        if (apk.required) { if (onApkRequired) onApkRequired(apk.url); return; }
        const verdict = decideOta({ native, active: await activeVersion(), remote, failed: failedList() });
        if (verdict.action !== "download") { log("skip:", verdict.reason); return; }
        if (remote.critical && onCriticalUpdate) onCriticalUpdate();
        await downloadAndApply(remote);
      } catch (e) {
        log("init failed", e);
      }
    },

    /** Settings-screen button. Returns 'latest' | 'downloaded' | 'apk_required' | 'not_supported' | 'error'. */
    async forceCheck({ onApkRequired } = {}) {
      try {
        if (!isNative()) return "not_supported";
        const native = await nativeVersion();
        const remote = await fetchManifest();
        if (!native || !remote) return "error";
        const apk = decideApk({ native, remote });
        if (apk.required) { if (onApkRequired) onApkRequired(apk.url); return "apk_required"; }
        // Explicit user request: retry versions that previously failed.
        const verdict = decideOta({ native, active: await activeVersion(), remote, failed: [], manual: true });
        if (verdict.action !== "download") return "latest";
        del(K.failed);
        await downloadAndApply(remote);
        return "downloaded";
      } catch (e) {
        log("force check failed", e);
        return "error";
      }
    },

    /** "Updated to vX" toast after a restart that applied a bundle. */
    async announceUpdate() {
      try {
        const v = get(K.justUpdated);
        if (!v) return;
        const native = await nativeVersion();
        const active = await activeVersion();
        if (native && compareVersions(v, native) > 0 && compareVersions(active, v) >= 0 && window.Toast) Toast.ok(`Updated to v${v}`);
        if (compareVersions(active, v) >= 0 || !get(K.pendingVersion)) del(K.justUpdated);
      } catch (e) { log("announce failed", e); }
    },

    /** Re-show the restart prompt on resume; drop stale pending state after an APK upgrade. */
    async onResume() {
      try {
        const pv = get(K.pendingVersion);
        if (!pv) return;
        const native = await nativeVersion();
        if (native && compareVersions(pv, native) <= 0) { del(K.pendingVersion); del(K.pendingBundleId); return; }
        api.promptRestart(pv);
      } catch (e) { log("resume failed", e); }
    },

    /** Shown in Settings. Always read from the plugin / native API, never from localStorage. */
    async versions() {
      const out = { apk: null, ota: null };
      try { out.apk = await nativeVersion(); } catch (e) { /* ignore */ }
      try {
        const up = plugin("CapacitorUpdater");
        if (up) {
          const bundle = (await up.current()).bundle;
          out.ota = bundle && bundle.id !== "builtin" && bundle.version && bundle.version !== "builtin" ? bundle.version : null;
        }
      } catch (e) { /* ignore */ }
      return out;
    },

    openApkDownload(url) {
      const target = url && url.startsWith(CFG.apkPrefix) ? url : CFG.fallbackApkUrl;
      const browser = plugin("Browser");
      if (browser) browser.open({ url: target }).catch(() => window.open(target, "_blank", "noopener,noreferrer"));
      else window.open(target, "_blank", "noopener,noreferrer");
    }
  };
  return api;
})();
window.Updater = Updater;
if (typeof module !== "undefined") module.exports = Updater;
