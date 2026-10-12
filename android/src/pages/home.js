/** Home page: welcome hero, live stats, quick actions and recent activity. */
Pages.home = {
  title: "TrimLabel",
  render(root) {
    const history = HistoryLog.load();
    const labels = history.reduce((n, e) => n + (Number(e.filesCount) || 0), 0);

    const stat = (value, label, delay) =>
      h("div", { class: "stat", style: `animation-delay:${delay}s` }, h("b", {}, value), h("span", {}, label));

    const step = (title, text) => h("li", { class: "step" }, h("b", {}, title), h("span", {}, text));

    const tile = (id, ico, title, sub, delay) =>
      h("button", { class: "tile", id: `home-tile-${id}`, style: `animation-delay:${delay}s`, onclick: () => App.show(id) },
        h("span", { class: "ico-wrap" }, icon(ico)),
        h("b", {}, title),
        h("span", { class: "sub" }, sub));

    root.append(
      h("section", { class: "hero" },
        h("span", { class: "hero-tag" }, "Free · Works offline · No sign-up"),
        h("h2", {}, "Shipping labels, print-ready in seconds."),
        h("p", {}, "Drop your marketplace PDFs. TrimLabel trims each label and lays them out for your printer, right on your phone."),
        h("button", { class: "btn", id: "home-start-btn", onclick: () => App.show("process") }, "Start processing", icon("arrow"))
      ),

      h("div", { class: "chips" }, ["Flipkart", "Meesho", "Amazon", "Shiprocket"].map(n => h("span", { class: "chip" }, n))),

      h("h3", { class: "section-title" }, "Three steps. No setup."),
      h("ol", { class: "steps" },
        step("Add your PDFs", "One file or many. Marketplaces are recognised automatically."),
        step("We trim the label", "Only the shipping label is kept. Invoices and margins are cut away."),
        step("Print and ship", "A4 sheets with cut marks, thermal 3x5 / 4x6 or PNG images.")
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
