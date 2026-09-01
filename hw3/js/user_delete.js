/* js/user_delete.js - delete account module (no module) */
/* expose: window.bindDeleteAccount() */

(function () {
  const $ = (sel) => document.querySelector(sel);

  function t(key, fallback) {
    // 你目前 user.js 的 t(key) 只有一個參數，我這裡做兼容
    if (typeof window.getTrans === "function") {
      const v = window.getTrans(key);
      return v || fallback || key;
    }
    return fallback || key;
  }
  // Expose t function globally for use in event listeners
  window.t = t;

  function setOk(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }

  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }

  async function apiJson(url, options = {}) {
    const resp = await fetch(url, {
      credentials: "include",
      ...options,
    });

    const data = await resp.json().catch(() => ({}));
    return { resp, data };
  }

  async function doDeleteAccount() {
    // 你可以改成 toast/modal 形式；這裡先用 confirm
    const ok = confirm(t("del_confirm_final", "此操作無法復原，確定要刪除帳號？"));
    if (!ok) return;

    // 清掉提示
    setErr("delOk", "");
    setOk("delOk", "");

    try {
      const { resp, data } = await apiJson("api/delete_account.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // 保留擴充用
      });

      if (!resp.ok || !data?.ok) {
        const err = data?.error || "server_error";
        // 你可以依照後端回傳 error code 做更細分提示
        setErr("delOk", t("del_failed", "刪除失敗，請稍後再試") + ` (${err})`);
        return;
      }

      // 關閉 modal（如果你有共用 closeModal）
      if (typeof window.closeModal === "function") window.closeModal("deleteModal");
      else document.getElementById("deleteModal")?.classList.remove("is-open");

      // 成功提示
      if (typeof window.toast === "function") {
        window.toast(t("del_ok_title", "已刪除"), t("del_ok_msg", "帳號已刪除，將返回主頁。"));
      } else {
        alert(t("del_ok_msg", "帳號已刪除，將返回主頁。"));
      }

      // 清掉前端狀態（避免 topbar 還顯示 user）
      if (window.state) {
        window.state.user = null;
      }

      // 導回主頁
      window.location.href = "index.html";
    } catch (e) {
      console.warn(e);
      setErr("delOk", t("del_failed", "刪除失敗，請稍後再試"));
    }
  }

  function bindDeleteAccount() {
    const check = document.getElementById("delConfirmCheck");
    const openBtn = document.getElementById("deleteAccountBtn");
    const confirmBtn = document.getElementById("confirmDeleteBtn");

    // 1) checkbox 控制刪除按鈕 enable/disable
    if (check && openBtn) {
      openBtn.disabled = !check.checked;
      check.addEventListener("change", (e) => {
        openBtn.disabled = !e.target.checked;
      });
    }

    // 2) 點「刪除帳號」打開 modal
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        setErr("delOk", "");
        setOk("delOk", "");
        if (typeof window.openModal === "function") window.openModal("deleteModal");
        else document.getElementById("deleteModal")?.classList.add("is-open");
      });
    }

    // 3) 點「確認刪除」真的刪除（call api）
    if (confirmBtn) {
      confirmBtn.addEventListener("click", doDeleteAccount);
    }
  }

  window.bindDeleteAccount = bindDeleteAccount;
})();
