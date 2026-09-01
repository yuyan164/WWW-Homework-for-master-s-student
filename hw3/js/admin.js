/* js/admin.js - entry init (no module) */
(async function () {
  async function init() {
    window.bindGoHome();
    window.bindModalClose();

    // fetch user
    window.adminState.user = await window.fetchCurrentUser();
    if (!window.adminState.user) return; // requireLogin.js should redirect

    // admin only
    window.enforceAdminOnly();

    // render
    window.renderTopbar();
    window.renderProfile();

    // binds
    window.bindAdminMenu?.();
    window.bindProfileModal?.();
    window.bindPwdForm?.();
    window.bindPwdToggles?.();
    window.bindDeleteAccount?.();

    // ✅ init mock modules
    window.initAdminBookings?.();
    window.initAdminResources?.();

    
    // ✅ 預設只顯示「帳戶資訊」
    window.showAdminView("account");

    // 任何你 admin 頁面 init 的地方加上：
    //if (window.initAdminResources) {
    //window.initAdminResources().catch(console.error);
    //}
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => console.warn(e));
  });
})();
