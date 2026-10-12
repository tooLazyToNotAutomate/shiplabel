/** Home page (ported from the TrimLabel phone design board): hero, three illustrated steps, shortcuts, privacy note. */
const HOME_STEP_ART = {
  add: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="14" y="8" width="30" height="40" rx="6" fill="#fff" stroke="#3965FA" stroke-width="2.4"/><rect x="20" y="15" width="14" height="8" rx="3" fill="#3965FA"/><rect x="20" y="29" width="20" height="3" rx="1.5" fill="#DDE0F2"/><rect x="20" y="36" width="15" height="3" rx="1.5" fill="#DDE0F2"/><circle cx="46" cy="46" r="12" fill="#3965FA"/><path d="M46 52V41M41 45l5-5 5 5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trim: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="12" y="6" width="38" height="52" rx="6" fill="#fff" stroke="#DDE0F2" stroke-width="2"/><rect x="17" y="11" width="28" height="22" rx="4" fill="#E9EBFF"/><path d="M21 22h20M24 22v7M28 22v7M32 22v7M36 22v7" stroke="#1B1B39" stroke-width="2"/><rect x="17" y="39" width="26" height="3" rx="1.5" fill="#EDEDED"/><rect x="17" y="46" width="20" height="3" rx="1.5" fill="#EDEDED"/><path d="M13 14V9h5M49 14V9h-5M13 30v5h5M49 30v5h-5" stroke="#3965FA" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -3)"/><circle cx="50" cy="16" r="9" fill="#047857"/><path d="m45.5 16 3 3 6-6.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  print: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="12" y="5" width="40" height="54" rx="6" fill="#fff" stroke="#3965FA" stroke-width="2.4"/><rect x="17" y="10" width="14" height="20" rx="3" fill="#E9EBFF" stroke="#99B7FC" stroke-width="1.4"/><rect x="33" y="10" width="14" height="20" rx="3" fill="#E9EBFF" stroke="#99B7FC" stroke-width="1.4"/><rect x="17" y="33" width="14" height="20" rx="3" fill="#E9EBFF" stroke="#99B7FC" stroke-width="1.4"/><rect x="33" y="33" width="14" height="20" rx="3" fill="#E9EBFF" stroke="#99B7FC" stroke-width="1.4"/><rect x="38" y="38" width="22" height="18" rx="6" fill="#1B1B39"/><path d="M43 46v-3h12v3M43 51h12" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/** Static, trusted SVG markup only (never user data). */
function svgEl(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

Pages.home = {
  title: "TrimLabel",
  render(root) {
    const step = (n, art, title, text) =>
      h("div", { class: "step-row" },
        h("div", { class: "step-art" }, svgEl(HOME_STEP_ART[art])),
        h("div", { class: "step-body" },
          h("span", { class: "step-kicker" }, `STEP ${n}`),
          h("b", {}, title),
          h("span", {}, text)));

    const shortcut = (id, ico, title) =>
      h("button", { class: "tile", id: `home-tile-${id}`, onclick: () => App.show(id) },
        h("span", { class: "ico-wrap" }, icon(ico)),
        h("b", {}, title));

    root.append(
      h("section", { class: "hero" },
        h("span", { class: "hero-tag" }, "Free · Private · Offline"),
        h("h2", {}, "Shipping labels, print-ready in seconds."),
        h("p", {}, "Drop your PDFs. We trim and arrange them for printing."),
        h("button", { class: "btn", id: "home-start-btn", onclick: () => App.show("process") }, "Print labels", icon("arrow"))
      ),

      h("h3", { class: "section-title big" }, "How it works"),
      h("div", { class: "steps-col" },
        step(1, "add", "Add your PDFs", "One file or hundreds."),
        step(2, "trim", "We trim the label", "Invoices removed automatically."),
        step(3, "print", "Print or share", "Sheets ready for any printer.")
      ),

      h("div", { class: "tiles" },
        shortcut("history", "clock", "Activity"),
        shortcut("settings", "settings", "Settings")
      ),

      h("div", { class: "card privacy" }, icon("shield"),
        h("span", { class: "privacy-text" }, h("b", {}, "Private by design"), h("span", {}, "Files never leave your phone.")))
    );
  }
};
