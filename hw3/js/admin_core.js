/* js/admin_core.js - shared helpers/state (no module) */
(function () {
  window.adminState = {
    user: null,
    view: "account", // account | bookings | resources | pwd | delete
  };

  window.$ = (sel) => document.querySelector(sel);
  window.$$ = (sel) => document.querySelectorAll(sel);

  window.t = function t(key, fallback) {
    if (typeof window.getTrans === "function") return window.getTrans(key) || fallback || key;
    return fallback || key;
  };

  window.apiFetch = function apiFetch(url, options = {}) {
    return fetch(url, { credentials: "include", ...options });
  };

  window.toast = window.toast || function (title, msg) {
    alert(`${title}\n${msg}`);
  };

  window.openModal = window.openModal || function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
  };

  window.closeModal = window.closeModal || function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  };

  window.bindGoHome = function bindGoHome() {
    const goHome = document.getElementById("goHome");
    if (!goHome) return;
    goHome.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "index.html";
    });
  };

  window.bindModalClose = function bindModalClose() {
    document.addEventListener("click", (e) => {
      const closeId = e.target?.getAttribute?.("data-close");
      if (closeId) window.closeModal(closeId);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".modal.is-open").forEach((m) => {
        m.classList.remove("is-open");
        m.setAttribute("aria-hidden", "true");
      });
    });
  };

  window.bindLangChangedRerender = function bindLangChangedRerender() {
    // 你可在這裡加 rerender hooks；目前先留空不影響
  };

  window.escapeHtml = function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  };

  window.fmt = function fmt(dtISO) {
    if (!dtISO) return "—";
    const d = new Date(dtISO);
    if (isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  };

  window.showAdminView = function showAdminView(view) {
    window.adminState.view = view;

    document.querySelectorAll(".view-section").forEach((sec) => {
      const v = sec.getAttribute("data-view");
      sec.style.display = (v === view) ? "" : "none";
    });

    // 捲到上方更順
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
})();
