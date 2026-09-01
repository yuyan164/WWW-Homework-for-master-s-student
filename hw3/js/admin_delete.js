/* js/admin_delete.js - delete account */
(function () {
  async function doDeleteAccount() {
    if (!confirm("此操作無法復原，確定要刪除帳號？")) return;

    try {
      const resp = await fetch("api/delete_account.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        const err = data?.error || "server_error";
        document.getElementById("delOk").textContent = `刪除失敗 (${err})`;
        return;
      }

      window.closeModal("deleteModal");
      window.toast("已刪除", "帳號已刪除，將返回主頁。");
      window.location.href = "index.html";
    } catch (e) {
      console.warn(e);
      document.getElementById("delOk").textContent = "刪除失敗";
    }
  }

  function bindDeleteAccount() {
    const check = document.getElementById("delConfirmCheck");
    const openBtn = document.getElementById("deleteAccountBtn");
    const confirmBtn = document.getElementById("confirmDeleteBtn");

    if (check && openBtn) {
      openBtn.disabled = !check.checked;
      check.addEventListener("change", (e) => {
        openBtn.disabled = !e.target.checked;
      });
    }

    openBtn?.addEventListener("click", () => window.openModal("deleteModal"));
    confirmBtn?.addEventListener("click", doDeleteAccount);
  }

  window.bindDeleteAccount = bindDeleteAccount;
})();
