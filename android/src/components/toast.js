const Toast = {
  show(message, kind = "", ms = 3500) {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  },
  ok(m) { Toast.show(m, "ok"); },
  /** Toast with one action button (e.g. "Restart now"). Stays until used or dismissed. */
  action(message, label, onClick, ms = 20000) {
    const el = document.createElement("div");
    el.className = "toast action";
    el.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = message;
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", () => { el.remove(); onClick(); });
    el.append(text, btn);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  },
  error(m) { Toast.show(m, "error", 6000); }
};
window.Toast = Toast;
