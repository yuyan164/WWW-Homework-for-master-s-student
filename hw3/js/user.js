/* js/user.js - entry init (no module) */

(function () {
  async function init() {
    // common binds
    window.bindGoHome?.();
    window.bindModalClose?.();
    window.bindLangChangedRerender?.();

    // fetch current user
    window.state.user = await window.fetchCurrentUser();
    if (!window.state.user) return; // requireLogin.js should redirect

    // admin routing
    window.enforceRoleRouting?.();

    // render top/profile
    window.renderTopbar?.();
    window.renderProfile?.();

    // feature binds
    window.bindProfileModal?.();
    window.bindPwdForm?.();
    window.bindPwdToggles?.();

    // optional dropdown menu
    window.bindUserMenu?.();
    // ✅ 預設只顯示「帳戶資訊」
    window.showOnlySection?.("accountSection");

    window.bindDeleteAccount?.();

    // bookings module (DB)
    if (typeof window.initReservationsModule === "function") {
      window.initReservationsModule(); // 這裡面會自己 reloadReservations()
    }

    window.bindPager();
    await window.reloadReservations();
  }

  document.addEventListener("DOMContentLoaded", function () {
    init().catch((e) => console.warn(e));
  });
})();
