/* js/index_auth.js - auth/session + logout (no module) */
(function () {
  const { apiFetch, safeReadJson, t, toast } = window.indexCore;
  const state = window.indexState;

  async function initAuthState() {
    try {
      const resp = await apiFetch("api/me.php");
      if (!resp.ok) {
        state.isLoggedIn = false;
        state.user = { name: "", role: "", profile_pic: null };
        return;
      }

      const data = await safeReadJson(resp);
      if (data && data.ok) {
        state.isLoggedIn = true;
        state.user.name = data.user?.username || data.user?.email || "User";
        state.user.role = data.user?.role || "user";
        state.user.profile_pic = data.user?.profile_pic || null;
      } else {
        state.isLoggedIn = false;
        state.user = { name: "", role: "", profile_pic: null };
      }
    } catch (e) {
      console.warn("initAuthState failed:", e);
      state.isLoggedIn = false;
      state.user = { name: "", role: "", profile_pic: null };
    }
  }

  async function logoutReal() {
    if (!confirm(t("confirm_logout", "是否確認要登出？"))) return;

    try {
      await apiFetch("api/logout.php", { method: "POST" });
    } catch (e) {
      console.warn("logout failed:", e);
    }

    state.isLoggedIn = false;
    state.user = { name: "", role: "", profile_pic: null };

    // 交給 topbar/filter 重新渲染
    window.indexTopbar?.renderTopbar?.();
    await window.indexFilters?.applyFilters?.();

    toast(t("toast_logged_out_title", "已登出"), t("toast_logged_out_msg", "你已成功登出。"));
  }

  window.indexAuth = { initAuthState, logoutReal };
})();
