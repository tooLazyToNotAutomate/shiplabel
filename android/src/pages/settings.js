/** Settings page + persisted defaults (also read by the Process page). */
const Settings = {
  key: "trimlabel_m_settings",
  defaults: { defaultMode: "A4 Sheet (4-up Grid)", cutMarks: true },

  load() {
    try {
      const p = JSON.parse(Security.storageGet(Settings.key) || "{}");
      return {
        defaultMode: Security.pick(p.defaultMode, Security.OUTPUT_MODES, Settings.defaults.defaultMode),
        cutMarks: typeof p.cutMarks === "boolean" ? p.cutMarks : Settings.defaults.cutMarks
      };
    } catch (e) {
      return { ...Settings.defaults };
    }
  },
  save(s) { Security.storageSet(Settings.key, JSON.stringify(s)); }
};
window.Settings = Settings;

Pages.settings = {
  title: "Settings",
  render(root) {
    const s = Settings.load();
    const versionLine = h("p", { class: "muted" }, "Checking version...");
    const checkUpdates = async () => {
      const r = await Updater.forceCheck({ onApkRequired: url => UpdateScreens.apkRequired(url) });
      if (r === "latest") Toast.ok("You have the latest version");
      else if (r === "downloaded") { /* restart prompt is shown by the updater */ }
      else if (r === "not_supported") Toast.show("Updates are only available in the installed app");
      else if (r === "error") Toast.error("Could not check for updates. Check your connection.");
    };
    const update = patch => { Object.assign(s, patch); Settings.save(s); Toast.ok("Saved"); };
    root.append(
      h("div", { class: "card stack" },
        h("h2", {}, "Defaults"),
        selectField("Output mode", Security.OUTPUT_MODES, s.defaultMode, v => update({ defaultMode: v })),
        h("label", { class: "switch-row" }, "Draw cut marks on grids",
          h("input", { type: "checkbox", checked: s.cutMarks, onchange: e => update({ cutMarks: e.target.checked }) }))
      ),
      h("div", { class: "card stack" },
        h("h2", {}, "About"),
        h("p", { class: "muted" }, "TrimLabel Studio crops and formats marketplace shipping labels. Everything runs on this phone: PDFs are never uploaded anywhere."),
        h("h3", {}, "Need a new label layout?"),
        h("p", { class: "muted" }, "Using a courier or marketplace we don't support yet? Email a sample PDF (remove customer details first) and we'll try to add it."),
        h("a", { class: "btn secondary", href: "mailto:swill8580@gmail.com?subject=TrimLabel%20template%20request" }, "Email swill8580@gmail.com"),
        versionLine,
        h("button", { class: "btn secondary", onclick: checkUpdates }, "Check for updates")
      )
    );
    Updater.versions().then(v => {
      versionLine.textContent = v.apk
        ? `App version ${v.apk}` + (v.ota ? ` · update ${v.ota}` : "")
        : "Version information is available in the installed app.";
    });
  }
};
