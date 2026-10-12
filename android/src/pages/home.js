/** Home page: welcome hero, live stats, quick actions and recent activity. */
Pages.home = {
  title: "TrimLabel",
  render(root) {
    const history = HistoryLog.load();
    const labels = history.reduce((n, e) => n + (Number(e.filesCount) || 0), 0);

    const stat = (value, label, delay) =>
      h("div", { class: "stat", style: `animation-delay:${delay}s` }, h("b", {}, value), h("span", {}, label));

    const tile = (id, ico, title, sub, delay) =>
      h("button", { class: "tile", id: `home-tile-${id}`, style: `animation-delay:${delay}s`, onclick: () => App.show(id) },
        h("span", { class: "ico-wrap" }, icon(ico)),
        h("b", {}, title),
        h("span", { class: "sub" }, sub));

    root.append(
      h("section", { class: "hero" },
        h("span", { class: "hero-tag" }, "Offline label studio"),
        h("h2", {}, "Crop & print shipping labels"),
        h("p", {}, "Flipkart, Meesho, Amazon and Shiprocket PDFs to thermal or A4 sheets, right on your phone."),
        h("button", { class: "btn", id: "home-start-btn", onclick: () => App.show("process") }, "Start processing", icon("arrow"))
      ),

      h("div", { class: "stats" },
        stat(labels, "Files processed", 0.05),
        stat(history.length, "Sessions", 0.1)
      ),

      h("h3", { class: "section-title" }, "Quick actions"),
      h("div", { class: "tiles" },
        tile("process", "printer", "Process", "Crop and export PDFs", 0.1),
        tile("history", "clock", "History", "Past sessions", 0.2),
        tile("settings", "settings", "Settings", "Defaults and options", 0.25)
      ),

      h("h3", { class: "section-title" }, "Recent activity"),
      h("div", { class: "card recent" },
        history.length
          ? history.slice(0, 3).map(e => h("div", { class: "file-item" },
              h("span", {}, `${e.marketplace} · ${e.filesCount} file${e.filesCount === 1 ? "" : "s"}`),
              h("span", { class: "muted" }, e.timestamp)))
          : h("p", { class: "muted" }, "Nothing yet. Process your first label to see it here.")
      ),

      h("div", { class: "card privacy" }, icon("shield"), "100% offline. Your PDFs never leave this device.")
    );
  }
};
