/** Tiny element helper: h("div", {class:"card"}, "text", childEl). Text only ever goes through text nodes. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function selectField(label, options, value, onChange) {
  const sel = h("select", { onchange: e => onChange && onChange(e.target.value) },
    options.map(o => h("option", { value: o.value ?? o, selected: (o.value ?? o) === value }, o.label ?? o)));
  return h("label", { class: "field" }, label, sel);
}

const ICONS = {
  tag: ["M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z", "M7.5 7.5h.01"],
  home: ["M3 11 12 3l9 8", "M5 10v10h14V10", "M10 20v-6h4v6"],
  printer: ["M6 9V3h12v6", "M5 9h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2Z", "M6 15h12v6H6z"],
  crop: ["M6 2v14a2 2 0 0 0 2 2h14", "M18 22V8a2 2 0 0 0-2-2H2"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7v5l3 2"],
  settings: ["M4 7h10M18 7h2M4 17h2M10 17h10", "M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z", "M8 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  shield: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z", "M9 12l2 2 4-4"]
};

/** Inline SVG icon (built with createElementNS, no innerHTML). */
function icon(name, cls = "ico") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name] || []) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

window.h = h;
window.icon = icon;
window.selectField = selectField;
window.Pages = window.Pages || {};
