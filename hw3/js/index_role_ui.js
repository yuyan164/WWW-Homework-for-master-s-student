/* js/index_role_ui.js - change topbar "goUser" label by role + i18n */

(function () {
  async function fetchMe() {
    const resp = await fetch("api/me.php", { credentials: "include" });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => ({}));
    return data?.user || null;
  }

  function applyByRole(role) {
    const chip = document.getElementById("goUser"); // 你的按鈕 id
    if (!chip) return;

    const isAdmin = String(role || "").toLowerCase() === "admin";

    // ✅ 這裡不要寫中文，改成切換 i18n key
    chip.setAttribute("data-i18n", isAdmin ? "nav_admin" : "nav_user");

    // ✅ 讓 lang.js 重新把文字塞回去（跟語言切換一致）
    if (typeof window.applyI18n === "function") {
      window.applyI18n();
    } else if (typeof window.getTrans === "function") {
      // fallback：若你沒有 applyI18n，就用 getTrans 自己塞
      const key = chip.getAttribute("data-i18n");
      chip.textContent = window.getTrans(key) || chip.textContent;
    }

    // ✅ 點擊導向
    chip.onclick = (e) => {
      e.preventDefault?.();
      window.location.href = isAdmin ? "admin.html" : "user.html";
    };

    // Enter 可操作
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.onkeydown = (e) => {
      if (e.key === "Enter") window.location.href = isAdmin ? "admin.html" : "user.html";
    };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const u = await fetchMe();
    if (!u) return;

    applyByRole(u.role);

    // ✅ 語言切換時，也要再套一次（避免 lang.js 重畫後文字跑掉）
    document.addEventListener("langChanged", () => applyByRole(u.role));
  });
})();
