/* js/user_auth.js - current user, topbar, logout */

(function () {
  // Get current user from api/me.php
  window.fetchCurrentUser = async function () {
    const resp = await window.apiFetch("api/me.php", { method: "GET" });
    if (!resp.ok) return null;

    const data = await resp.json().catch(() => ({}));
    const u = data?.user || {};

    return {
      name: u.username ?? "—",
      email: u.email ?? "—",
      role: u.role ?? "user",
      avatarUrl: u.profile_pic ?? ""
    };
  };

  window.enforceRoleRouting = function () {
    if (!window.state.user) return;
    if (String(window.state.user.role).toLowerCase() === "admin") {
      window.location.href = "admin.html";
    }
  };

  // topbar render (login/logout visibility)
  window.renderTopbar = function () {
    const isLoggedIn = !!window.state.user;

    const who = document.getElementById("who");
    const avatar = document.getElementById("avatar");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (who) who.style.display = isLoggedIn ? "flex" : "none";
    if (avatar) avatar.style.display = isLoggedIn ? "block" : "none";
    if (loginBtn) loginBtn.style.display = isLoggedIn ? "none" : "inline-block";
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";

    // bind login
    if (loginBtn) {
      loginBtn.onclick = () => (window.location.href = "login.html");
    }

    // bind logout (keep using logoutReal)
    if (logoutBtn) logoutBtn.onclick = window.logoutReal;

    if (isLoggedIn) {
      const whoName = document.getElementById("whoName");
      const whoRole = document.getElementById("whoRole");
      if (whoName) whoName.textContent = window.state.user.name || "—";
      if (whoRole) whoRole.textContent = window.state.user.role || "user";

      if (avatar) {
        let url = String(window.state.user.avatarUrl || "").trim();
        if (!url || url === "null" || url === "undefined") url = "pic/default-avatar.png";
        avatar.style.backgroundImage = url ? `url("${url}")` : "";
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
      }
    }
  };

  // ✅ logoutReal: call api/logout.php and redirect to homepage
  window.logoutReal = async function () {
    if (!confirm(window.t("confirm_logout", "是否確認要登出？"))) return;

    try {
      await window.apiFetch("api/logout.php", { method: "POST" });
    } catch (e) {
      console.warn("logout failed:", e);
    }

    window.state.user = null;

    // update UI
    if (typeof window.renderTopbar === "function") window.renderTopbar();

    // toast then redirect
    window.toast(
      window.t("toast_logged_out_title", "已登出"),
      window.t("toast_logged_out_msg", "你已成功登出。")
    );

    // ✅ ensure back to homepage
    window.location.href = "index.html";
  };
})();
