/* js/index_topbar.js - topbar rendering + role nav (no module) */
(function () {
  const { $, t, goLogin } = window.indexCore;
  const state = window.indexState;

  function applyTopNavByRole(role) {
    const chip = $("goUser");
    if (!chip) return;

    const isAdmin = String(role || "").toLowerCase() === "admin";

    // ✅ 讓 lang.js 不會覆蓋回 nav_user
    chip.setAttribute("data-i18n", isAdmin ? "nav_admin" : "nav_user");

    if (typeof window.applyI18n === "function") {
      window.applyI18n();
    } else if (typeof window.getTrans === "function") {
      const key = chip.getAttribute("data-i18n");
      chip.textContent = window.getTrans(key) || chip.textContent;
    }

    chip.onclick = (e) => {
      e.preventDefault?.();
      window.location.href = isAdmin ? "admin.html" : "user.html";
    };
  }

  function renderTopbar() {
    const isIn = state.isLoggedIn;

    $("loginBtn") && ($("loginBtn").style.display = isIn ? "none" : "inline-flex");
    $("logoutBtn") && ($("logoutBtn").style.display = isIn ? "inline-flex" : "none");
    $("who") && ($("who").style.display = isIn ? "flex" : "none");

    const avatarEl = $("avatar");
    const defaultPic = "pic/default-avatar.png";
    let pic = String(state.user.profile_pic || "").trim();
    if (!pic || pic === "null" || pic === "undefined") pic = defaultPic;

    if (avatarEl) {
      avatarEl.style.display = isIn ? "block" : "none";
      avatarEl.style.backgroundImage = `url("${pic}")`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.style.backgroundRepeat = "no-repeat";
      avatarEl.title = t("avatar_title", "使用者頭貼");
    }

    $("whoName") && ($("whoName").textContent = state.user.name || "");
    $("whoRole") && ($("whoRole").textContent = state.user.role || "");

    $("loginBtn") && ($("loginBtn").onclick = () => goLogin("index.html"));
    $("logoutBtn") && ($("logoutBtn").onclick = window.indexAuth.logoutReal);

    if (!state.isLoggedIn) {
      const chip = $("goUser");
      if (chip) {
        chip.setAttribute("data-i18n", "nav_user");
        if (typeof window.applyI18n === "function") window.applyI18n();
        chip.onclick = () => {
          window.indexCore.toast(
            t("toast_need_login_title", "需要登入"),
            t("toast_need_login_userpage", "請先登入後再前往使用者頁面。"),
            "warn"
          );
        };
      }
    } else {
      applyTopNavByRole(state.user.role);
    }

    $("goHome") && ($("goHome").onclick = (e) => {
      e.preventDefault();
      const here = location.pathname.split("/").pop();
      if (here === "index.html" || here === "") window.scrollTo({ top: 0, behavior: "smooth" });
      else location.href = "index.html";
    });
  }

  window.indexTopbar = { renderTopbar, applyTopNavByRole };
})();
