/* js/index_core.js - shared core (no module) */
(function () {
  function t(key, fallback = "") {
    if (window.getTrans) return window.getTrans(key) || fallback || key;
    return fallback || key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function toast(title, msg, kind = "ok") {
    const wrap = $("toast");
    if (!wrap) return alert(`${title}\n${msg}`);

    const item = document.createElement("div");
    item.className = "toast-item";

    const icon = document.createElement("div");
    icon.className =
      "toast-icon" + (kind === "warn" ? " warn" : kind === "err" ? " err" : "");

    const text = document.createElement("div");
    text.innerHTML = `<b>${title}</b><p>${msg}</p>`;

    item.appendChild(icon);
    item.appendChild(text);
    wrap.appendChild(item);

    setTimeout(() => item.remove(), 3200);
  }

  function apiFetch(url, options = {}) {
    return fetch(url, { credentials: "same-origin", ...options });
  }

  async function safeReadJson(resp) {
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      console.warn("Response is not valid JSON:", text.slice(0, 200));
      return null;
    }
  }

  function sanitizeNext(raw) {
    if (!raw) return "index.html";
    const s = String(raw).trim();
    if (/^[a-zA-Z0-9_\-/]+\.html$/.test(s)) return s;
    return "index.html";
  }

  function goLogin(next) {
    const target = sanitizeNext(next || (location.pathname.split("/").pop() || "index.html"));
    location.href = `login.html?next=${encodeURIComponent(target)}`;
  }

  function toISODateTimeLocal(dt) {
    const pad = (n) => String(n).padStart(2, "0");
    const y = dt.getFullYear();
    const m = pad(dt.getMonth() + 1);
    const d = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const mm = pad(dt.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function parseSelectedRange() {
    const date = $("date")?.value;
    const start = $("start")?.value;
    const end = $("end")?.value;

    if (!date || !start || !end) return null;

    const s = new Date(`${date}T${start}:00`);
    const e = new Date(`${date}T${end}:00`);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    if (e <= s) return null;

    return { start: s, end: e };
  }

  // state 放在 window 讓各檔案共用
  window.indexState = window.indexState || {
    isLoggedIn: false,
    user: { name: "", role: "", profile_pic: null },
    resources: [],
    bookings: [],
    bookingsKey: ""
  };

  window.indexCore = {
    t,
    $,
    toast,
    apiFetch,
    safeReadJson,
    goLogin,
    toISODateTimeLocal,
    parseSelectedRange
  };
})();
