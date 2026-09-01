/* js/index_modal.js - reserve modal (no module) */
(function () {
  const { $, t, apiFetch } = window.indexCore;
  const state = window.indexState;

  let currentResource = null;

  function setModalMessage(kind, msg) {
    const el = $("modalMsg");
    if (!el) return;

    if (!msg) {
      el.className = "modal-msg";
      el.style.display = "none";
      el.textContent = "";
      return;
    }

    el.className = "modal-msg " + (kind === "ok" ? "ok" : "err");
    el.textContent = msg;
    el.style.display = "block";
  }

  function lockConfirmButton(isLocked) {
    const btn = $("confirmReserve");
    if (!btn) return;
    btn.disabled = !!isLocked;
    btn.style.opacity = isLocked ? "0.65" : "1";
    btn.style.cursor = isLocked ? "not-allowed" : "pointer";
  }

  async function readJsonOrText(resp) {
    const text = await resp.text();
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null, text };
    }
  }

  function closeModal() {
    $("backdrop")?.classList.remove("show");
    currentResource = null;
    setModalMessage("", "");
    lockConfirmButton(false);
  }

  function bookingErrorMessage(code, fallbackText = "") {
    const map = {
      time_conflict: t("err_time_conflict", "此時段已被預約"),
      not_in_open_hours: t("err_not_in_open_hours", "不在可預約的開放時間"),
      resource_unavailable: t("err_resource_unavailable", "此資源目前不可預約"),
      invalid_time_range: t("err_invalid_time_range", "時間區間不正確"),
      not_logged_in: t("err_not_logged_in", "請先登入再預約"),
      session_expired: t("err_session_expired", "登入已逾時，請重新登入"),
      server_error: t("err_server_error", "系統錯誤，請稍後再試"),
      resource_closed: t("err_resource_closed", "此資源在所選日期/時間不開放"),
      cross_day_not_allowed: t("err_cross_day", "不允許跨日預約，請選同一天")
    };
    return map[code] || fallbackText || t("err_unknown", "預約失敗，請稍後再試");
  }

  function openReserve(r, range) {
    currentResource = r;

    setModalMessage("", "");
    lockConfirmButton(false);

    $("mResource").value = r.name;
    $("mType").value = (r.type === "space")
      ? t("modal_type_space", "space（空間）")
      : t("modal_type_equipment", "equipment（設備）");

    const now = new Date();
    const fallbackStart = new Date(now.getTime() + 30 * 60 * 1000);
    const fallbackEnd = new Date(fallbackStart.getTime() + 60 * 60 * 1000);

    if (range) {
      $("mStart").value = window.indexCore.toISODateTimeLocal(range.start);
      $("mEnd").value = window.indexCore.toISODateTimeLocal(range.end);
    } else {
      $("mStart").value = window.indexCore.toISODateTimeLocal(fallbackStart);
      $("mEnd").value = window.indexCore.toISODateTimeLocal(fallbackEnd);
    }

    $("backdrop")?.classList.add("show");
  }

  async function confirmReserveReal(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (!state.isLoggedIn) {
      setModalMessage("err", t("toast_need_login_reserve", "請先登入後再進行預約。"));
      return;
    }
    if (!currentResource) {
      setModalMessage("err", "No resource selected.");
      return;
    }

    const startVal = $("mStart").value;
    const endVal = $("mEnd").value;

    if (!startVal || !endVal) {
      setModalMessage("err", t("toast_time_error_msg", "請確認開始/結束時間。"));
      return;
    }

    const s = new Date(startVal);
    const e2 = new Date(endVal);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e2.getTime()) || e2 <= s) {
      setModalMessage("err", t("toast_time_error_msg", "請確認開始/結束時間。"));
      return;
    }

    setModalMessage("ok", t("msg_submitting", "送出預約中..."));
    lockConfirmButton(true);

    try {
      const resp = await apiFetch("api/bookings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: currentResource.id,
          start: startVal,
          end: endVal
        })
      });

      const { json } = await readJsonOrText(resp);

      if (!resp.ok || !json || !json.ok) {
        const code = json?.error || json?.code || "";
        const msg = bookingErrorMessage(code, json?.message || "");
        setModalMessage("err", msg);
        lockConfirmButton(false);
        return;
      }

      setModalMessage("ok", `${t("toast_reserved_msg_prefix", "已預約：")}${currentResource.name}`);

      await window.indexFilters.applyFilters();
      lockConfirmButton(false);

    } catch (err) {
      console.warn("confirmReserveReal error:", err);
      setModalMessage("err", t("error_server", "系統錯誤，請稍後再試"));
      lockConfirmButton(false);
    }
  }

  function bindModal() {
    $("closeModal") && ($("closeModal").onclick = (e) => { e.preventDefault(); closeModal(); });
    $("cancelReserve") && ($("cancelReserve").onclick = (e) => { e.preventDefault(); closeModal(); });
    $("confirmReserve") && ($("confirmReserve").onclick = confirmReserveReal);
    $("backdrop") && ($("backdrop").onclick = (e) => { if (e.target === $("backdrop")) closeModal(); });
  }

  window.indexModal = { openReserve, bindModal, closeModal };
})();
