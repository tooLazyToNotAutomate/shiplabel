/** App shell: bottom-nav router. Pages register themselves on window.Pages. */
const App = {
  tabs: [
    { id: "home", label: "Home", icon: "home" },
    { id: "process", label: "Process", icon: "printer" },
    { id: "templates", label: "Templates", icon: "crop" },
    { id: "history", label: "History", icon: "clock" },
    { id: "settings", label: "Settings", icon: "settings" }
  ],

  async init() {
    // MUST be the first await: if the plugin isn't told the bundle booted, it rolls the OTA back.
    try {
      const up = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
      if (up) await up.notifyAppReady();
    } catch (e) { /* never block startup */ }

    pdfjsLib.GlobalWorkerOptions.workerSrc = "shared/vendor/pdf.worker.min.js";
    const nav = document.getElementById("nav");
    for (const t of App.tabs) {
      nav.append(h("button", { "data-tab": t.id, onclick: () => App.show(t.id) }, icon(t.icon), t.label));
    }
    document.getElementById("appbar-logo").append(icon("tag"));
    App.show("home");
    App.setupNative();
    App.setupUpdates();
  },

  /** Update checks never block rendering; they start ~3 s after the UI is up. */
  setupUpdates() {
    if (!Native.isNative) return;
    Updater.announceUpdate();
    const appPlugin = window.Capacitor.Plugins.App;
    if (appPlugin && appPlugin.addListener) {
      appPlugin.addListener("appStateChange", s => { if (s.isActive) Updater.onResume(); });
    }
    setTimeout(async () => {
      let stopCritical = null;
      await Updater.init({
        onApkRequired: url => UpdateScreens.apkRequired(url),
        onCriticalUpdate: () => { stopCritical = UpdateScreens.critical(); }
      });
      if (stopCritical) stopCritical();
    }, 3000);
  },

  show(id) {
    const page = Pages[id];
    if (!page) return;
    document.getElementById("title").textContent = page.title;
    for (const b of document.querySelectorAll("#nav button")) b.classList.toggle("active", b.dataset.tab === id);
    const root = document.getElementById("page");
    root.replaceChildren();
    root.scrollTop = 0;
    page.render(root);
  },

  setupNative() {
    if (!Native.isNative) return;
    const { StatusBar } = window.Capacitor.Plugins;
    if (StatusBar) {
      StatusBar.setBackgroundColor({ color: "#1b1b39" }).catch(() => {});
      StatusBar.setStyle({ style: "DARK" }).catch(() => {});
    }
  }
};
window.App = App;
window.Pages = window.Pages || {};
document.addEventListener("DOMContentLoaded", App.init);
