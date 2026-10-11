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

window.h = h;
window.selectField = selectField;
window.Pages = window.Pages || {};
