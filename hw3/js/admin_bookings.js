/* js/admin_bookings.js - admin bookings (DB + pagination + complete/cancel/delete) */
/* no module */

(function () {
  const PAGE_SIZE = 5;
  const API_LIST = "api/admin_bookings_list.php";
  const API_COMPLETE = "api/admin_booking_complete.php";
  const API_CANCEL = "api/admin_booking_cancel.php";
  const API_DELETE = "api/admin_booking_delete.php";

  // 防止 init 被呼叫多次 → 綁定重複
  if (window.__adminBookingsLoaded) {
    // 仍提供 reload 給外部用
    window.reloadAdminBookings?.();
    return;
  }
  window.__adminBookingsLoaded = true;

  const $ = (id) => document.getElementById(id);

  function t(key, fallback = "") {
    if (window.getTrans) return window.getTrans(key);
    return fallback || key;
  }

  function apiFetch(url, options = {}) {
    return fetch(url, { credentials: "same-origin", ...options });
  }

  async function readJson(resp) {
    const text = await resp.text();
    try {
      const json = JSON.parse(text);
      json.__rawText = text; // 方便 debug
      return json;
    } catch {
      // 不是 JSON（多半是 PHP Fatal/Notice HTML）
      return { ok: false, error: "non_json_response", status: resp.status, text };
    }
  }

  function escapeHtml(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function fmt(dtISO) {
    if (window.fmt) return window.fmt(dtISO);
    const d = new Date(dtISO);
    if (isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function openModal(id) {
    if (window.openModal) return window.openModal(id);
    $(id)?.classList.add("is-open");
    $(id)?.setAttribute("aria-hidden", "false");
  }

  const S = {
    page: 1,
    totalPages: 1,
    totalItems: 0,
    items: [],
    keyword: "",
    status: "all",
  };

  function statusText(status) {
    if (status === "reserved") return t("resv_status_booked", "Booked");
    if (status === "completed") return t("resv_status_completed", "Completed");
    if (status === "cancelled") return t("resv_status_cancelled", "Cancelled");
    return status || "-";
  }

  function statusClass(status) {
    // 借用你 user 的 badge class（status-booked/status-cancelled/status-completed）
    if (status === "reserved") return "status-booked";
    if (status === "cancelled") return "status-cancelled";
    if (status === "completed") return "status-completed";
    return "";
  }

  async function fetchList() {
    const qs = new URLSearchParams();
    qs.set("page", String(S.page));
    qs.set("pageSize", String(PAGE_SIZE));
    qs.set("status", S.status);
    if (S.keyword.trim()) qs.set("keyword", S.keyword.trim());

    const resp = await apiFetch(`${API_LIST}?${qs.toString()}`);
    const data = await readJson(resp);

    if (!resp.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : "server_error");
    }

    S.items = Array.isArray(data.items) ? data.items : [];
    S.totalPages = Number(data.totalPages || 1);
    S.totalItems = Number(data.totalItems || 0);
    S.page = Number(data.page || S.page);

    if (S.page < 1) S.page = 1;
    if (S.page > S.totalPages) S.page = S.totalPages;
  }

  function renderPager() {
    const pager = $("bookingPager");
    const info = $("bookingPageInfo");
    const prev = $("bookingPrev");
    const next = $("bookingNext");

    if (pager) pager.style.display = (S.totalPages > 1) ? "flex" : "none";
    if (info) info.textContent = `Page ${S.page} / ${S.totalPages}`;
    if (prev) prev.disabled = S.page <= 1;
    if (next) next.disabled = S.page >= S.totalPages;
  }

  function renderList() {
    const list = $("bookingList");
    if (!list) return;

    list.innerHTML = "";

    if (!S.items.length) {
      list.innerHTML = `<div class="hint">${escapeHtml(t("resv_empty", "沒有符合的預約"))}</div>`;
      renderPager();
      return;
    }

    S.items.forEach((b) => {
      const div = document.createElement("div");
      div.className = "resv-item card"; // card樣式加上去

      const title = `${escapeHtml(b.resourceName)} <span style="color:#888;font-weight:700">(B-${escapeHtml(String(b.booking_id))})</span>`;

      div.innerHTML = `
        <div class="resv-top">
          <div class="resv-title">${title}</div>
          <div class="badges">
            <span class="badge ${statusClass(b.status)}">${escapeHtml(statusText(b.status))}</span>
          </div>
        </div>

        <div class="resv-meta">
          <div>👤 Who: ${escapeHtml(b.whoEmail || b.whoName || "-")}</div>
          <div>📍 Where: ${escapeHtml(b.location || "-")}</div>
          <div>🕒 When: ${escapeHtml(fmt(b.startISO))} → ${escapeHtml(fmt(b.endISO))}</div>
          ${b.status === "cancelled"
          ? `<div>❗ ${escapeHtml(t("cancel_reason", "Cancel reason"))}: ${escapeHtml(b.cancelReason || "-")}</div>`
          : ""
        }
        </div>

        <div class="resv-actions">
          <button class="btn-primary inline ghost" data-act="detail" data-id="${escapeHtml(String(b.booking_id))}">
            ${escapeHtml(t("resv_details", "查看細節"))}
          </button>
          <button class="btn-primary inline" data-act="complete" data-id="${escapeHtml(String(b.booking_id))}">
            ${escapeHtml(t("admin_btn_mark_completed", "標記完成"))}
          </button>
          <button class="btn-primary inline danger-btn" data-act="cancel" data-id="${escapeHtml(String(b.booking_id))}">
            ${escapeHtml(t("resv_cancel", "取消預約"))}
          </button>

        </div>
      `;

      list.appendChild(div);
    });

    renderPager();
  }

  function showDetail(b) {
    const body = $("detailBody");
    if (!body) return;

    body.innerHTML = `
      <div><div class="k">Booking ID</div><div class="v">${escapeHtml(String(b.booking_id))}</div></div>
      <div><div class="k">Who</div><div class="v">${escapeHtml(b.whoEmail || b.whoName || "-")}</div></div>
      <div><div class="k">What</div><div class="v">${escapeHtml(b.resourceName || "-")}</div></div>
      <div><div class="k">Where</div><div class="v">${escapeHtml(b.location || "-")}</div></div>
      <div><div class="k">When</div><div class="v">${escapeHtml(fmt(b.startISO))} → ${escapeHtml(fmt(b.endISO))}</div></div>
      <div><div class="k">Status</div><div class="v">${escapeHtml(b.status || "-")}</div></div>
      ${b.status === "cancelled"
        ? `<div><div class="k">${escapeHtml(t("cancel_reason", "取消理由"))}</div><div class="v">${escapeHtml(b.cancelReason || "-")}</div></div>`
        : ""
      }
    `;
    openModal("detailModal");
  }

  async function actionComplete(id) {
    const ok = confirm(t("admin_booking_complete_confirm", "確定要標記為完成嗎？"));
    if (!ok) return;

    const resp = await apiFetch(API_COMPLETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: Number(id) })
    });
    const data = await readJson(resp);
    if (!resp.ok || !data || !data.ok) {
      const msg = data?.message || data?.text || "";
      throw new Error(`${data?.error || "server_error"}${msg ? " | " + String(msg).slice(0, 200) : ""}`);
    }
  }

  async function actionCancel(id) {
    const reason = prompt(t("admin_booking_cancel_prompt", "請輸入取消理由（必填）"), "Cancelled by admin");
    if (reason === null) return; // 使用者按取消
    const r = String(reason || "").trim();
    if (!r) {
      alert(t("err_required", "此欄位必填"));
      return;
    }

    const resp = await apiFetch(API_CANCEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: Number(id), cancel_reason: r })
    });
    const data = await readJson(resp);
    if (!resp.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : "server_error");
    }
  }

  async function actionDelete(id) {
    const ok = confirm(t("admin_booking_delete_confirm", "確定要刪除此預約？此操作無法復原。"));
    if (!ok) return;

    const resp = await apiFetch(API_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: Number(id) })
    });
    const data = await readJson(resp);
    if (!resp.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : "server_error");
    }
  }

  async function reload() {
    await fetchList();
    renderList();
  }
  window.reloadAdminBookings = reload;

  // debounce keyword
  let kwTimer = null;
  function onKeywordInput(v) {
    S.keyword = v || "";
    S.page = 1;
    if (kwTimer) clearTimeout(kwTimer);
    kwTimer = setTimeout(() => reload().catch(console.warn), 250);
  }

  function bind() {
    $("bookingRefreshBtn")?.addEventListener("click", () => reload().catch(console.warn));

    $("bookingKeyword")?.addEventListener("input", (e) => onKeywordInput(e.target.value));

    $("bookingStatus")?.addEventListener("change", (e) => {
      S.status = e.target.value || "all";
      S.page = 1;
      reload().catch(console.warn);
    });

    $("bookingPrev")?.addEventListener("click", () => {
      if (S.page <= 1) return;
      S.page -= 1;
      reload().catch(console.warn);
    });

    $("bookingNext")?.addEventListener("click", () => {
      if (S.page >= S.totalPages) return;
      S.page += 1;
      reload().catch(console.warn);
    });

    $("bookingList")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      const item = S.items.find((x) => String(x.booking_id) === String(id));
      if (!item) return;

      try {
        if (act === "detail") return showDetail(item);
        if (act === "complete") { await actionComplete(id); return reload(); }
        if (act === "cancel") { await actionCancel(id); return reload(); }
        if (act === "delete") { await actionDelete(id); return reload(); }
      } catch (err) {
        console.warn(err);
        alert(`Error: ${err.message || "server_error"}`);
      }
    });

    document.addEventListener("langChanged", () => {
      // 只需要重畫文字即可
      renderList();
      renderPager();
    });
  }

  window.initAdminBookings = function initAdminBookings() {
    bind();
    reload().catch((e) => {
      console.warn(e);
      const list = $("bookingList");
      if (list) list.innerHTML = `<div class="hint">load bookings failed: ${escapeHtml(e.message || "server_error")}</div>`;
      renderPager();
    });
  };
})();