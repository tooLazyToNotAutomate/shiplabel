const HISTORY_KEY = "trimlabel_history";

const HistoryLog = {
  load() {
    try {
      const arr = JSON.parse(Security.storageGet(HISTORY_KEY) || "[]");
      return Array.isArray(arr) ? arr.slice(0, 50).map(Security.sanitizeHistoryEntry).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  },
  add(entry) {
    const clean = Security.sanitizeHistoryEntry(entry);
    if (!clean) return;
    clean.id = "hist_" + Date.now();
    clean.timestamp = new Date().toLocaleString();
    const list = HistoryLog.load();
    list.unshift(clean);
    Security.storageSet(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  },
  clear() { Security.storageRemove(HISTORY_KEY); }
};
window.HistoryLog = HistoryLog;

Pages.history = {
  title: "History",
  render(root) {
    const list = HistoryLog.load();
    if (!list.length) {
      root.append(h("div", { class: "card" }, h("p", { class: "muted" }, "No labels processed yet.")));
      return;
    }
    root.append(
      h("div", { class: "card" },
        list.map(e => h("div", { class: "file-item" },
          h("span", {}, `${e.marketplace} · ${e.filesCount} file${e.filesCount === 1 ? "" : "s"} · ${e.mode}`),
          h("span", { class: "muted" }, e.timestamp)))
      ),
      h("button", { class: "btn danger", onclick: () => { if (confirm("Clear all history?")) { HistoryLog.clear(); App.show("history"); } } }, "Clear history")
    );
  }
};
