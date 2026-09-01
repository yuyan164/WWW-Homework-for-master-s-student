/* js/user_menu.js - dropdown menu: show only selected section (no module) */
(function () {
  const $ = (sel) => document.querySelector(sel);

  function showOnly(sectionId) {
    const ids = ["accountSection", "resvSection", "pwdSection", "deleteSection"];

    // 若要顯示全部
    if (!sectionId || sectionId === "all") {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "";
      });
      return;
    }

    // 只顯示指定的 section
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = (id === sectionId) ? "" : "none";
    });
  }

  window.showOnlySection = showOnly; // 讓其他檔也能呼叫（可選）

  window.bindUserMenu = function bindUserMenu() {
    const btn = document.getElementById("userMenuBtn");
    const menu = document.getElementById("userMenuList");
    const wrap = document.getElementById("userMenu");
    if (!btn || !menu) return;

    const open = () => {
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      menu.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains("is-open")) close();
      else open();
    });

    // 點 menu item：改成「只顯示該區塊」
    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (!item) return;

      const target = item.getAttribute("data-target"); // 例如 "#pwdSection"
      close();

      // ✅ 支援 "#xxx"
      if (target && target.startsWith("#")) {
        const id = target.slice(1);
        showOnly(id);
        // 想要順便回到頁面頂部可加這行
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // ✅ 你如果想加「全部」選項，data-target="all"
      if (target === "all") {
        showOnly("all");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    // 點空白處關閉
    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("is-open")) return;
      if (wrap && !wrap.contains(e.target)) close();
    });

    // ESC 關閉
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  };
})();
