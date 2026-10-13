/**
 * Native bridge: saving/sharing generated files. Android's WebView ignores
 * blob / <a download> links, so output is written to the app cache with the
 * Capacitor Filesystem plugin and handed to the system share sheet
 * (save to Drive/Files, print, WhatsApp, ...). Outside Capacitor (desktop
 * browser testing) it falls back to a normal download.
 */
const Native = {
  get isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  },

  toBase64(bytes) {
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  },

  async saveAndShare(bytes, filename, mimeType) {
    if (!Native.isNative) {
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const a = h("a", { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    const { Filesystem, Share } = window.Capacitor.Plugins;
    const written = await Filesystem.writeFile({ path: filename, data: Native.toBase64(bytes), directory: "CACHE" });
    await Share.share({ title: filename, files: [written.uri], dialogTitle: "Save or print label" });
  }
};
window.Native = Native;
