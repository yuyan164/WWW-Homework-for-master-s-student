/* js/index_cards.js - render resource cards (no module) */
(function () {
  const { $, t, toast } = window.indexCore;
  const state = window.indexState;
  const { statusText, deriveReserveState } = window.indexData;

  function renderCards(list, range) {
    const cards = $("cards");
    if (!cards) return;

    cards.innerHTML = "";

    if (!list.length) {
      cards.innerHTML = `<div class="empty">${t("empty_no_resource", "沒有符合條件的資源")}</div>`;
      return;
    }

    list.forEach((r) => {
      const st = deriveReserveState(r, range);

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div class="card-head">
          <div class="pill">${statusText(r.type)}</div>
          <div class="badge ${st.canReserve ? "ok" : "bad"}">${st.label}</div>
        </div>
        <h3 class="card-title">${r.name}</h3>
        <div class="card-meta">
          <div>${t("label_location", "地點")}：${r.location || "-"}</div>
          <div>${t("label_category", "分類")}：${r.category || "-"}</div>
        </div>
        <p class="card-desc">${r.description || ""}</p>
        <div class="card-actions">
          <button type="button" class="reserve">${t("btn_reserve", "預約")}</button>
          <button type="button" class="info">${t("btn_info", "查看資訊")}</button>
        </div>
      `;

      const reserveBtn = card.querySelector(".reserve");
      const infoBtn = card.querySelector(".info");

      reserveBtn.disabled = false;

      reserveBtn.onclick = () => {
        if (!state.isLoggedIn) {
          toast(t("toast_need_login_title", "需要登入"), t("toast_need_login_reserve", "請先登入後再進行預約。"), "warn");
          return;
        }
        if (!st.canReserve) {
          toast(t("toast_cannot_reserve_title", "無法預約"), st.label || t("toast_cannot_reserve_msg", "此資源在所選時段不可預約。"), "err");
          return;
        }
        window.indexModal.openReserve(r, range);
      };

      infoBtn.onclick = () => {
        toast(
          t("toast_resource_info_title", "資源資訊"),
          `${r.name}｜${r.location || "-"}\n${t("label_status", "狀態")}：${st.label}`
        );
      };

      cards.appendChild(card);
    });
  }

  window.indexCards = { renderCards };
})();