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
  error(m) { Toast.show(m, "error", 6000); }
};
window.Toast = Toast;
