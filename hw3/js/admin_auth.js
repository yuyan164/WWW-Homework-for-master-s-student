/* js/admin_auth.js - admin auth/topbar (no module) */
(function () {
  async function fetchCurrentUser() {
    const resp = await fetch("api/me.php", { credentials: "include" });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => ({}));
    const u = data?.user || {};
    return {
      name: u.username ?? "—",
      email: u.email ?? "—",
      role: u.role ?? "user",
      avatarUrl: u.profile_pic ?? ""
    };
  }

  function renderTopbar() {
    const u = window.adminState.user;
    const isLoggedIn = !!u;

    const who = document.getElementById("who");
    const avatar = document.getElementById("avatar");
    const logoutBtn = document.getElementById("logoutBtn");

    if (who) who.style.display = isLoggedIn ? "flex" : "none";
    if (avatar) avatar.style.display = isLoggedIn ? "block" : "none";
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";

    if (logoutBtn) logoutBtn.onclick = window.logoutReal;

    if (isLoggedIn) {
      document.getElementById("whoName") && (document.getElementById("whoName").textContent = u.name || "—");
      document.getElementById("whoRole") && (document.getElementById("whoRole").textContent = u.role || "user");

      if (avatar) {
        let url = String(u.avatarUrl || "").trim();
        if (!url || url === "null" || url === "undefined") url = "pic/default-avatar.png";
        avatar.style.backgroundImage = url ? `url("${url}")` : "";
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
      }
    }
  }

  async function logoutReal() {
    if (!confirm(window.t("confirm_logout", "是否確認要登出？"))) return;

    try {
      await window.apiFetch("api/logout.php", { method: "POST" });
    } catch (e) {
      console.warn(e);
    }

    window.adminState.user = null;
    renderTopbar();
    window.toast(window.t("toast_logged_out_title", "已登出"), window.t("toast_logged_out_msg", "你已成功登出。"));
    window.location.href = "index.html"; // ✅ 管理者登出也回主頁
  }

  function enforceAdminOnly() {
    const u = window.adminState.user;
    if (!u) return;
    if (String(u.role).toLowerCase() !== "admin") {
      alert("Permission denied: admin only.");
      window.location.href = "user.html";
    }
  }

  function applyTopNavByRole(role) {
    const chip = document.getElementById("goUser");
    if (!chip) return;

    const isAdmin = String(role || "").toLowerCase() === "admin";
    chip.setAttribute("data-i18n", isAdmin ? "nav_admin" : "nav_user");

    // 讓 lang.js 立刻重畫文字（兩種寫法都支援）
    if (typeof window.applyI18n === "function") {
      window.applyI18n();
    } else if (typeof window.getTrans === "function") {
      const key = chip.getAttribute("data-i18n");
      chip.textContent = window.getTrans(key) || chip.textContent;
    }

    // 點擊導頁
    chip.onclick = (e) => {
      e.preventDefault?.();
      window.location.href = isAdmin ? "admin.html" : "user.html";
    };
  }

  // ✅ 在你抓到使用者後呼叫一次（很重要）
  applyTopNavByRole(window.state?.user?.role);

  // ✅ 只要語言切換，就再套一次（避免被 lang.js 用舊 key 重畫）
  document.addEventListener("langChanged", () => {
    applyTopNavByRole(window.state?.user?.role);
  });


  window.fetchCurrentUser = fetchCurrentUser;
  window.renderTopbar = renderTopbar;
  window.logoutReal = logoutReal;
  window.enforceAdminOnly = enforceAdminOnly;
})();
