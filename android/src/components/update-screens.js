/** Full-screen blockers for the two update channels. Text only via text nodes (no innerHTML). */
const UpdateScreens = {
  _el: null,

  _mount(node) {
    UpdateScreens.clear();
    UpdateScreens._el = node;
    document.body.appendChild(node);
  },

  clear() {
    if (UpdateScreens._el) UpdateScreens._el.remove();
    UpdateScreens._el = null;
  },

  /** Channel B: native update needed. Outranks everything else. */
  apkRequired(url) {
    UpdateScreens._mount(h("div", { class: "blocker", role: "alertdialog", "aria-modal": "true" },
      h("div", { class: "blocker-card" },
        icon("shield", "ico blocker-ico"),
        h("h2", {}, "Update required"),
        h("p", {}, "A new version of TrimLabel is needed to keep working. Download it, then open the file to install."),
        h("p", { class: "muted" }, "If Android asks, allow your browser to install apps from this source. Your settings are kept."),
        h("button", { class: "btn", onclick: () => Updater.openApkDownload(url) }, "Download update")
      )));
  },

  /** Channel A: critical OTA. Self-clears after 30 s so a bad URL can never lock users out. */
  critical(onTimeout) {
    UpdateScreens._mount(h("div", { class: "blocker", role: "alertdialog", "aria-modal": "true" },
      h("div", { class: "blocker-card" },
        h("div", { class: "spinner", "aria-hidden": "true" }),
        h("h2", {}, "Installing important update"),
        h("p", {}, "This only takes a moment. Please keep the app open.")
      )));
    const t = setTimeout(() => { UpdateScreens.clear(); if (onTimeout) onTimeout(); }, 30000);
    return () => { clearTimeout(t); UpdateScreens.clear(); };
  }
};
window.UpdateScreens = UpdateScreens;
