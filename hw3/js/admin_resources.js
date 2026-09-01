// js/admin_resources.js
(function () {
  const $ = (id) => document.getElementById(id);

  function t(key, fallback = "") {
    if (window.getTrans) return window.getTrans(key);
    return fallback || key;
  }

  function getLang() {
    return localStorage.getItem("appLang") || "en";
  }

  function apiFetch(url, options = {}) {
    return fetch(url, { credentials: "same-origin", ...options });
  }

  async function readJson(resp) {
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  // ====== bitmask -> weekday text ======
  // bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
  function decodeOpenDays(mask) {
    const lang = getLang();
    const names = [
      { bit: 2, key: "wd_mon", fallback: "Mon" },
      { bit: 4, key: "wd_tue", fallback: "Tue" },
      { bit: 8, key: "wd_wed", fallback: "Wed" },
      { bit: 16, key: "wd_thu", fallback: "Thu" },
      { bit: 32, key: "wd_fri", fallback: "Fri" },
      { bit: 64, key: "wd_sat", fallback: "Sat" },
      { bit: 1, key: "wd_sun", fallback: "Sun" },
    ];

    const m = Number(mask || 0);

    if (m === 62) return lang === "zh" ? "週一～週五" : "Mon–Fri";
    if (m === 127) return lang === "zh" ? "週一～週日" : "Mon–Sun";

    const picked = names
      .filter(x => (m & x.bit) === x.bit)
      .map(x => t(x.key, x.fallback));

    return picked.length ? picked.join(lang === "zh" ? "、" : ", ") : "-";
  }

  function encodeOpenDaysFromUI() {
    const wrap = $("res_open_days");
    if (!wrap) return 0;
    let sum = 0;
    wrap.querySelectorAll('input[type="checkbox"][data-bit]').forEach((cb) => {
      if (cb.checked) sum += Number(cb.getAttribute("data-bit") || 0);
    });
    return sum;
  }

  function fillOpenDaysToUI(mask) {
    const wrap = $("res_open_days");
    if (!wrap) return;
    const m = Number(mask || 0);
    wrap.querySelectorAll('input[type="checkbox"][data-bit]').forEach((cb) => {
      const bit = Number(cb.getAttribute("data-bit") || 0);
      cb.checked = (m & bit) === bit;
    });
  }

  function typeLabel(v) {
    if (v === "equipment") return t("opt_equipment", "Equipment");
    if (v === "space") return t("opt_space", "Space");
    return v || "-";
  }

  function statusLabel(v) {
    if (v === "active") return t("opt_status_active", "active");
    if (v === "inactive") return t("opt_status_inactive", "inactive");
    if (v === "maintenance") return t("opt_status_maintenance", "maintenance");
    return v || "-";
  }

  function statusBadgeClass(s) {
    if (s === "active") return "badge status-booked";
    if (s === "inactive") return "badge status-cancelled";
    if (s === "maintenance") return "badge status-completed";
    return "badge";
  }

  // ====== modal open/close ======
  function openModal(id) {
    const m = $(id);
    if (!m) return;
    m.setAttribute("aria-hidden", "false");
    m.classList.add("open");
    document.body.classList.add("modal-open");
  }

  function closeModal(id) {
    const m = $(id);
    if (!m) return;
    m.setAttribute("aria-hidden", "true");
    m.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  function bindModalClose() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-close]");
      if (!btn) return;
      const mid = btn.getAttribute("data-close");
      closeModal(mid);
    });
  }

  // ====== state ======
  const S = {
    page: 1,
    pageSize: 5,
    items: [],
    filtered: [],
    type: "all",
    status: "all",
    keyword: "",
    editing: null,   // current object reference (edit mode)
    mode: "edit",    // "edit" | "create"
  };

  function renderPager(totalPages) {
    const pager = $("resourcePager");
    if (!pager) return;

    pager.style.display = totalPages > 1 ? "" : "none";
    $("resourcePageInfo").textContent = `Page ${S.page} / ${totalPages}`;

    $("resourcePrev").disabled = S.page <= 1;
    $("resourceNext").disabled = S.page >= totalPages;
  }

  function slicePage(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / S.pageSize));
    if (S.page > totalPages) S.page = totalPages;

    const start = (S.page - 1) * S.pageSize;
    const end = start + S.pageSize;
    renderPager(totalPages);
    return list.slice(start, end);
  }

  function applyLocalFilter() {
    const kw = (S.keyword || "").trim().toLowerCase();
    const type = S.type;
    const status = S.status;

    S.filtered = S.items.filter((r) => {
      if (type !== "all" && r.resource_type !== type) return false;
      if (status !== "all" && r.status !== status) return false;

      if (kw) {
        const hay = `${r.resource_id} ${r.resource_name} ${r.location || ""} ${r.category || ""} ${r.description || ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    renderList();
  }

  function renderList() {
    const box = $("resourceList");
    if (!box) return;

    box.innerHTML = "";

    if (!S.filtered.length) {
      box.innerHTML = `<div class="empty">${t("empty_no_resource", "沒有符合條件的資源")}</div>`;
      renderPager(1);
      return;
    }

    const pageItems = slicePage(S.filtered);

    pageItems.forEach((r) => {
      const card = document.createElement("div");
      card.className = "resource-card";

      const openDaysText = decodeOpenDays(r.open_days);
      const openTimeText = `${(r.open_start || "-").toString().slice(0,5)}–${(r.open_end || "-").toString().slice(0,5)}`;

      card.innerHTML = `
        <div class="resource-top">
          <div style="min-width:0;">
            <div class="resource-title">
              ${r.resource_name}
              <span style="opacity:.45; font-weight:600; margin-left:6px;">#${r.resource_id}</span>
            </div>

            <div class="resource-meta">
              <div>${t("label_location","地點")}：${r.location || "-"}</div>
              <div>${t("label_category","分類")}：${r.category || "-"}</div>
              <div>${t("modal_type","分類")}：${typeLabel(r.resource_type)}</div>
              <div>${t("label_status","狀態")}：${statusLabel(r.status)}</div>
              <div>${t("admin_res_open_days","開放星期")}：${openDaysText}</div>
              <div>${t("admin_res_open_start","開放時間")}：${openTimeText}</div>
            </div>

            ${r.description ? `<div style="margin-top:10px; color:#6b5b50; line-height:1.55;">${r.description}</div>` : ""}
          </div>

          <div class="badges">
            <span class="${statusBadgeClass(r.status)}">${r.status}</span>
          </div>
        </div>

        <div class="resource-actions">
          <button type="button" class="btn-primary inline js-edit">${t("admin_btn_edit","編輯")}</button>
        </div>
      `;

      card.querySelector(".js-edit").onclick = () => openEditModal(r);

      box.appendChild(card);
    });
  }

  function openEditModal(resource) {
    S.mode = "edit";
    S.editing = resource;

    $("resourceModalTitle").textContent = t("admin_res_modal_edit_title", "Edit Resource");

    $("res_id").value = resource.resource_id ?? "";
    $("res_name").value = resource.resource_name ?? "";
    $("res_type").value = resource.resource_type ?? "equipment";
    $("res_category").value = resource.category ?? "";
    $("res_location").value = resource.location ?? "";
    $("res_desc").value = resource.description ?? "";
    $("res_status").value = resource.status ?? "active";

    $("res_open_start").value = (resource.open_start ?? "08:00:00").toString().slice(0, 5);
    $("res_open_end").value = (resource.open_end ?? "18:00:00").toString().slice(0, 5);

    fillOpenDaysToUI(resource.open_days ?? 62);

    $("res_ok").textContent = "";
    $("res_warning").style.display = "none";
    $("res_warning").textContent = "";
    $("res_name_err").textContent = "";

    openModal("resourceModal");
  }

  function openCreateModal() {
    S.mode = "create";
    S.editing = null;

    $("resourceModalTitle").textContent = t("admin_res_modal_create_title", "Add Resource");

    $("res_id").value = "0";
    $("res_name").value = "";
    $("res_type").value = "equipment";
    $("res_category").value = "";
    $("res_location").value = "";
    $("res_desc").value = "";
    $("res_status").value = "active";

    $("res_open_start").value = "08:00";
    $("res_open_end").value = "18:00";

    // 預設 Mon–Fri = 62
    fillOpenDaysToUI(62);

    $("res_ok").textContent = "";
    $("res_warning").style.display = "none";
    $("res_warning").textContent = "";
    $("res_name_err").textContent = "";

    openModal("resourceModal");
  }

  async function loadList() {
    const url = `api/admin_resources_list.php?page=1&pageSize=500`;
    const resp = await apiFetch(url);
    const data = await readJson(resp);

    if (!resp.ok || !data || !data.ok) {
      throw new Error((data && data.error) ? data.error : "server_error");
    }

    S.items = Array.isArray(data.items) ? data.items : [];
  }

  async function reload() {
    await loadList();
    applyLocalFilter();
  }

  function bindFilters() {
    $("resourceKeyword")?.addEventListener("input", (e) => {
      S.keyword = e.target.value || "";
      S.page = 1;
      applyLocalFilter();
    });

    $("resourceType")?.addEventListener("change", (e) => {
      S.type = e.target.value || "all";
      S.page = 1;
      applyLocalFilter();
    });

    $("resourceStatus")?.addEventListener("change", (e) => {
      S.status = e.target.value || "all";
      S.page = 1;
      applyLocalFilter();
    });

    $("resourcePrev")?.addEventListener("click", () => {
      S.page = Math.max(1, S.page - 1);
      renderList();
    });

    $("resourceNext")?.addEventListener("click", () => {
      S.page = S.page + 1;
      renderList();
      console.count("resourcePrev click");
    });

    document.addEventListener("langChanged", () => {
      renderList();
    });
  }

  function bindAddButton() {
    const btn = $("resourceAddBtn");
    if (!btn) return;
    btn.addEventListener("click", () => openCreateModal());
  }

  function bindModalActions() {
    const form = $("resourceForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        $("res_ok").textContent = "";
        $("res_name_err").textContent = "";

        const resource_id = Number($("res_id").value || 0);
        const resource_name = ($("res_name").value || "").trim();
        const resource_type = $("res_type").value || "equipment";
        const category = ($("res_category").value || "").trim();
        const location = ($("res_location").value || "").trim();
        const description = ($("res_desc").value || "").trim();
        const status = $("res_status").value || "active";
        const open_days = encodeOpenDaysFromUI();
        const open_start = ($("res_open_start").value || "").trim();
        const open_end = ($("res_open_end").value || "").trim();

        if (!resource_name) {
          $("res_name_err").textContent = t("err_required", "此欄位必填");
          return;
        }

        if (!open_start || !open_end || open_start >= open_end) {
          $("res_warning").style.display = "";
          $("res_warning").textContent = t("toast_time_error_msg", "請確認開始/結束時間。");
          return;
        }

        // 提醒：改成 inactive/maintenance 會取消未開始預約（由後端做）
        if (status === "inactive" || status === "maintenance") {
          $("res_warning").style.display = "";
          $("res_warning").textContent =
            getLang() === "zh"
              ? "提示：若此資源有「未開始」預約，系統會自動取消並寫入取消原因。"
              : "Note: upcoming bookings for this resource will be cancelled automatically with a reason.";
        } else {
          $("res_warning").style.display = "none";
        }

        $("res_save_btn").disabled = true;

        try {
          const isCreate = (S.mode === "create") || resource_id === 0;
          const url = isCreate ? "api/admin_resource_create.php" : "api/admin_resource_update.php";

          const resp = await apiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_id,
              resource_name,
              resource_type,
              category,
              location,
              description,
              status,
              open_days,
              open_start,
              open_end
            })
          });

          const data = await readJson(resp);
          if (!resp.ok || !data || !data.ok) {
            $("res_ok").textContent = (data && data.error) ? `Error: ${data.error}` : "Error";
            return;
          }

          // ✅ 更新前端列表
          if (isCreate) {
            // 後端回傳 item 或 resource_id
            const created = data.item || null;

            if (created) {
              S.items.unshift(created);
            } else {
              // 若後端只回 resource_id，就重新抓一次最穩
              await reload();
              closeModal("resourceModal");
              return;
            }

            $("res_ok").textContent = t("admin_res_create_ok", "Created");
          } else {
            const r = S.editing;
            if (r) {
              r.resource_name = resource_name;
              r.resource_type = resource_type;
              r.category = category;
              r.location = location;
              r.description = description;
              r.status = status;
              r.open_days = open_days;
              r.open_start = open_start;
              r.open_end = open_end;
            }

            const n = Number(data.cancelled_bookings || 0);
            if (n > 0) {
              $("res_ok").textContent =
                getLang() === "zh"
                  ? `已更新（已取消未開始預約：${n}）`
                  : `Updated (cancelled upcoming bookings: ${n})`;
            } else {
              $("res_ok").textContent = t("admin_res_update_ok", "Updated");
            }
          }

          closeModal("resourceModal");
          applyLocalFilter();

        } catch (err) {
          $("res_ok").textContent = t("error_server", "系統錯誤，請稍後再試");
        } finally {
          $("res_save_btn").disabled = false;
        }
      });
    }

    const delBtn = $("res_delete_btn");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        const r = S.editing;
        if (!r) return;

        const ok = confirm(t("admin_res_delete_confirm", "確定要刪除此資源嗎？"));
        if (!ok) return;

        delBtn.disabled = true;
        $("res_ok").textContent = "";

        try {
          const resp = await apiFetch("api/admin_resource_delete.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource_id: r.resource_id,
              reason: "admin deleted resource"
            })
          });

          const data = await readJson(resp);
          if (!resp.ok || !data || !data.ok) {
            $("res_ok").textContent = (data && data.error) ? `Error: ${data.error}` : "Error";
            return;
          }

          S.items = S.items.filter(x => x.resource_id !== r.resource_id);
          closeModal("resourceModal");
          applyLocalFilter();
          await reload();

        } catch (err) {
          $("res_ok").textContent = t("error_server", "系統錯誤，請稍後再試");
        } finally {
          delBtn.disabled = false;
        }
      });
    }
  }

  // 對外提供 init
  window.initAdminResources = async function initAdminResources() {
    bindModalClose();
    bindFilters();
    bindAddButton();     // ✅ 新增：綁「新增資源」
    bindModalActions();
    await reload();
  };
})();