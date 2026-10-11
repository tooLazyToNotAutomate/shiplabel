/** App shell: bottom-nav router. Pages register themselves on window.Pages. */
const App = {
  tabs: [
    { id: "process", label: "Process", icon: "🏷️" },
    { id: "templates", label: "Templates", icon: "📐" },
    { id: "history", label: "History", icon: "📜" },
    { id: "settings", label: "Settings", icon: "⚙️" }
  ],

  init() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "shared/vendor/pdf.worker.min.js";
    const nav = document.getElementById("nav");
    for (const t of App.tabs) {
      nav.append(h("button", { "data-tab": t.id, onclick: () => App.show(t.id) }, h("span", { class: "ico" }, t.icon), t.label));
    }
    App.show("process");
    App.setupNative();
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
