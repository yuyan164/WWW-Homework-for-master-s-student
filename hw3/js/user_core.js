/* js/user_core.js - shared helpers/state (no module) */
// 共用工具、state、modal、toast、apiFetch、格式化等
(function () {
  // ---------- state ----------
  window.state = {
    user: null,               // { name, email, role, avatarUrl }
    tab: "all",               // all | booked | cancelled | completed
    cancelTargetId: null,

    reservations: [],

    // pagination
    page: 1,
    pageSize: 5,
    totalPages: 1
  };

  // ---------- helpers ----------
  window.$ = (sel) => document.querySelector(sel);
  window.$$ = (sel) => document.querySelectorAll(sel);

  // i18n helper: t(key, fallback?)
  window.t = function (key, fallback) {
    try {
      if (typeof window.getTrans === "function") {
        const v = window.getTrans(key);
        if (v && v !== key) return v;
      }
    } catch {}
    return fallback ?? key;
  };

  window.openModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
  };

  window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
  };

  window.clearErr = function (ids) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });
  };

  window.setErr = function (id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  };

  window.setOk = function (id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  };

  window.isEmail = function (str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || "").trim());
  };

  window.escapeHtml = function (s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  };

  // Session cookie API fetch helper
  window.apiFetch = function (url, options = {}) {
    return fetch(url, {
      credentials: "include",
      ...options
    });
  };

  // Minimal toast (you can replace with your own UI toast later)
  window.toast = function (title, msg) {
    alert(`${title}\n${msg}`);
  };

  // datetime display
  window.fmt = function (dtISO) {
    const d = new Date(dtISO);
    if (Number.isNaN(d.getTime())) return String(dtISO || "");
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  };

  // modal close binding (shared)
  window.bindModalClose = function () {
    document.addEventListener("click", (e) => {
      const closeId = e.target?.getAttribute?.("data-close");
      if (closeId) window.closeModal(closeId);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      window.$$(".modal.is-open").forEach((m) => {
        m.classList.remove("is-open");
        m.setAttribute("aria-hidden", "true");
      });
    });
  };

  // go home chip
  window.bindGoHome = function () {
    const goHome = document.getElementById("goHome");
    if (!goHome) return;
    goHome.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "index.html";
    });
  };

  // i18n rerender hook
  window.bindLangChangedRerender = function () {
    document.addEventListener("langChanged", () => {
      // reservations / toggles / menu 會各自更新
      if (typeof window.renderReservations === "function") window.renderReservations();
      if (typeof window.refreshPwdToggleTexts === "function") window.refreshPwdToggleTexts();
    });
  };
})();
