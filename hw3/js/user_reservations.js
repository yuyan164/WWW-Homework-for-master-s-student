/* js/user_reservations.js - reservations module (DB + pagination + cancel)
 * no module, attach to window
 */
(function () {
  const PAGE_SIZE = 5;

  const resvState = {
    tab: "all",          // all | reserved | cancelled | completed
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
    hasNext: false,      // fallback if backend doesn't return totalPages
    items: [],
    cancelTargetId: null,
  };

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);

  const t = (key, fallback) => {
    if (typeof window.getTrans === "function") return window.getTrans(key) || fallback || key;
    return fallback || key;
  };

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function fmt(dtISO) {
    if (!dtISO) return "—";
    const d = new Date(dtISO);
    if (isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function statusLabel(status) {
    if (status === "reserved") return t("resv_status_booked", "Booked");
    if (status === "cancelled") return t("resv_status_cancelled", "Cancelled");
    if (status === "completed") return t("resv_status_completed", "Completed");
    return status || "—";
  }

  function statusClass(status) {
    if (status === "reserved") return "status-booked";
    if (status === "cancelled") return "status-cancelled";
    if (status === "completed") return "status-completed";
    return "";
  }

  function resourceTypeLabel(rt) {
    if (rt === "equipment") return "Equipment";
    if (rt === "space") return "Space";
    return rt || "—";
  }

  function canCancel(item) {
    if (!item) return false;
    if (item.status !== "reserved") return false;
    if (!item.startISO) return false;
    return new Date() < new Date(item.startISO);
  }

  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }
  function setOk(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }

  // ---------- API ----------
  async function fetchReservationsFromDB() {
    const qs = new URLSearchParams();
    qs.set("page", String(resvState.page));
    qs.set("pageSize", String(resvState.pageSize));
    qs.set("status", resvState.tab); // all/reserved/cancelled/completed

    const resp = await fetch(`api/bookings_list.php?${qs.toString()}`, { credentials: "include" });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data?.ok) {
      throw new Error(data?.error || "server_error");
    }

    const items = Array.isArray(data.items) ? data.items : [];

    resvState.items = items.map((row) => {
      let mappedReason = row.cancelReason ?? "";
      if (mappedReason === "Not completed within the reserved time" || mappedReason === "未在預約時間內完成") {
        mappedReason = t("cancel_reason_auto", "Not completed within the reserved time");
      }

      return {
        id: String(row.id ?? ""),
        resourceName: row.resourceName ?? "—",
        resourceType: row.resourceType ?? "",
        location: row.location ?? "—",
        startISO: row.startISO ?? "",
        endISO: row.endISO ?? "",
        status: row.status ?? "",
        cancelReason: mappedReason,
      };
    });

    // ✅ 以後端為主（你現在頁碼會顯示 1/2、3/4 代表後端其實有回 totalPages）
    if (Number.isFinite(+data.page)) resvState.page = +data.page;
    if (Number.isFinite(+data.totalPages)) resvState.totalPages = Math.max(1, +data.totalPages);
    if (Number.isFinite(+data.totalItems)) resvState.totalItems = +data.totalItems;

    // fallback：如果後端沒回 totalPages，就用 hasNext 推估
    if (!data.totalPages) {
      resvState.hasNext = items.length === resvState.pageSize;
      resvState.totalPages = Math.max(1, resvState.page + (resvState.hasNext ? 1 : 0));
    } else {
      // 有 totalPages 就不用 hasNext 判斷
      resvState.hasNext = resvState.page < resvState.totalPages;
    }

    // 邊界修正
    if (resvState.page < 1) resvState.page = 1;
    if (resvState.page > resvState.totalPages) resvState.page = resvState.totalPages;
  }

  async function cancelReservationOnDB(id, reason) {
    const bookingId = Number(id); // 確保是數字

    const resp = await fetch("api/bookings_cancel.php", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: bookingId,      // ✅ 後端主要吃這個
        id: bookingId,              // ✅ 同時帶著，避免你舊後端只吃 id
        cancel_reason: reason
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      const err = data?.error || "server_error";
      throw new Error(err);
    }
    return data;
  }


  // ---------- render ----------
  function renderPager() {
    const pager = document.getElementById("pager");
    const prev = document.getElementById("prevPageBtn");
    const next = document.getElementById("nextPageBtn");
    const info = document.getElementById("pageInfo");

    if (!pager || !prev || !next || !info) return;

    // ✅ 沒有多頁就隱藏（你想永遠顯示也可以把這行刪掉）
    const shouldShow = resvState.totalPages > 1;
    pager.style.display = shouldShow ? "flex" : "none";

    info.textContent = `Page ${resvState.page} / ${resvState.totalPages}`;

    prev.disabled = resvState.page <= 1;
    next.disabled = resvState.page >= resvState.totalPages;
  }

  function renderReservations() {
    const list = document.getElementById("reservationList");
    if (!list) return;

    list.innerHTML = "";

    if (!resvState.items.length) {
      list.innerHTML = `<div class="hint">${escapeHtml(t("resv_empty", "No reservations."))}</div>`;
      renderPager();
      return;
    }

    resvState.items.forEach((r) => {
      const item = document.createElement("div");
      item.className = "resv-item";

      item.innerHTML = `
        <div class="resv-top">
          <div class="resv-title">${escapeHtml(r.resourceName || "—")}</div>
          <div class="badges">
            <span class="badge">${escapeHtml(resourceTypeLabel(r.resourceType))}</span>
            <span class="badge ${escapeHtml(statusClass(r.status))}">${escapeHtml(statusLabel(r.status))}</span>
          </div>
        </div>

        <div class="resv-meta">
          <div>📍 ${escapeHtml(r.location)}</div>
          <div>🕒 ${escapeHtml(fmt(r.startISO))} → ${escapeHtml(fmt(r.endISO))}</div>
          <div>ID: ${escapeHtml(r.id)}</div>
          ${r.status === "cancelled"
          ? `<div>❗ ${escapeHtml(t("cancel_reason", "Cancel reason"))}：${escapeHtml(r.cancelReason || "-")}</div>`
          : ""}
        </div>

        <div class="resv-actions">
          <button class="btn-primary inline ghost" type="button" data-action="detail" data-id="${escapeHtml(r.id)}">
            ${escapeHtml(t("resv_details", "Details"))}
          </button>

          ${r.status === "reserved" ? `
            <button class="btn-primary inline danger-btn" type="button" data-action="cancel" data-id="${escapeHtml(r.id)}"
              ${canCancel(r) ? "" : "disabled"}
              title="${canCancel(r) ? "" : escapeHtml(t("resv_cancel_block", "Cannot cancel"))}">
              ${escapeHtml(t("resv_cancel", "Cancel"))}
            </button>
          ` : ""}
        </div>
      `;

      // action bind (per item)
      item.querySelector('[data-action="detail"]')?.addEventListener("click", () => showDetail(r));
      item.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
        resvState.cancelTargetId = r.id;
        const input = document.getElementById("cancelReason");
        if (input) input.value = "";
        setErr("cancelReasonErr", "");
        if (typeof window.openModal === "function") window.openModal("cancelModal");
        else document.getElementById("cancelModal")?.classList.add("is-open");
      });

      list.appendChild(item);
    });

    renderPager();
  }

  function showDetail(r) {
    const body = document.getElementById("detailBody");
    if (!body) return;

    body.innerHTML = `
      <div><div class="k">Resource</div><div class="v">${escapeHtml(r.resourceName)}</div></div>
      <div><div class="k">Type</div><div class="v">${escapeHtml(resourceTypeLabel(r.resourceType))}</div></div>
      <div><div class="k">Location</div><div class="v">${escapeHtml(r.location)}</div></div>
      <div><div class="k">Time</div><div class="v">${escapeHtml(fmt(r.startISO))} → ${escapeHtml(fmt(r.endISO))}</div></div>
      <div><div class="k">Status</div><div class="v">${escapeHtml(statusLabel(r.status))}</div></div>
      ${r.status === "cancelled"
        ? `<div><div class="k">${escapeHtml(t("cancel_reason", "Cancel reason"))}</div><div class="v">${escapeHtml(r.cancelReason || "-")}</div></div>`
        : ""}
      <div><div class="k">Reservation ID</div><div class="v">${escapeHtml(r.id)}</div></div>
    `;

    if (typeof window.openModal === "function") window.openModal("detailModal");
    else document.getElementById("detailModal")?.classList.add("is-open");
  }

  // ---------- binds ----------
  function setTab(tab) {
    resvState.tab = tab;
    resvState.page = 1;

    const map = {
      all: "#tabAll",
      reserved: "#tabUpcoming",
      cancelled: "#tabCancelled",
      completed: "#tabCompleted",
    };

    Object.values(map).forEach((sel) => $(sel)?.classList.remove("is-active"));
    $(map[tab])?.classList.add("is-active");

    window.reloadReservations();
  }

  function bindTabs() {
    $("#tabAll")?.addEventListener("click", () => setTab("all"));
    $("#tabUpcoming")?.addEventListener("click", () => setTab("reserved"));
    $("#tabCancelled")?.addEventListener("click", () => setTab("cancelled"));
    $("#tabCompleted")?.addEventListener("click", () => setTab("completed"));

    $("#refreshBtn")?.addEventListener("click", () => window.reloadReservations());
  }

  function bindCancelFlow() {
    $("#confirmCancelBtn")?.addEventListener("click", async () => {
      setErr("cancelReasonErr", "");
      const reason = (document.getElementById("cancelReason")?.value || "").trim();
      if (!reason) {
        setErr("cancelReasonErr", t("err_required", "Required"));
        return;
      }
      const id = resvState.cancelTargetId;
      if (!id) return;

      try {
        await cancelReservationOnDB(id, reason);

        if (typeof window.closeModal === "function") window.closeModal("cancelModal");
        else document.getElementById("cancelModal")?.classList.remove("is-open");

        await window.reloadReservations();
        setOk("delOk", t("ok_cancel", "Cancelled"));
      } catch (e) {
        console.warn(e);
        setErr("cancelReasonErr", "Cancel failed");
      }
    });
  }

  function bindPager() {
    const pager = document.getElementById("pager");
    const prev = document.getElementById("prevPageBtn");
    const next = document.getElementById("nextPageBtn");

    if (!pager || !prev || !next) return;

    // ✅ 防止重複綁定（避免按一下跳兩頁）
    if (pager.dataset.bound === "1") return;
    pager.dataset.bound = "1";

    prev.addEventListener("click", async (e) => {
      e.preventDefault();
      if (resvState.page <= 1) return;
      resvState.page -= 1;
      await window.reloadReservations();
    });

    next.addEventListener("click", async (e) => {
      e.preventDefault();
      if (resvState.page >= resvState.totalPages) return;
      resvState.page += 1;
      await window.reloadReservations();
    });
  }

  // ---------- public API ----------
  window.initReservationsModule = function initReservationsModule() {
    bindTabs();
    bindCancelFlow();
  };

  window.bindPager = bindPager;

  window.reloadReservations = async function reloadReservations() {
    try {
      await fetchReservationsFromDB();
      renderReservations();
    } catch (e) {
      console.warn("load reservations failed:", e);
      const list = document.getElementById("reservationList");
      if (list) list.innerHTML = `<div class="hint">load reservations failed: ${escapeHtml(e.message || "server_error")}</div>`;
      renderPager();
    }
  };
})();
