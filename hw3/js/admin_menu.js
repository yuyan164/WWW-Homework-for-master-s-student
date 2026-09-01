/* js/admin_menu.js - dropdown + view switch */
(function () {
  function bindAdminMenu() {
    const btn = document.getElementById("adminMenuBtn");
    const menu = document.getElementById("adminMenuList");
    const wrap = document.getElementById("adminMenu");
    if (!btn || !menu || !wrap) return;

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
    const toggle = () => (menu.classList.contains("is-open") ? close() : open());

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (!item) return;

      const target = item.getAttribute("data-target");
      close();

      // 對應 view
      const map = {
        "#accountSection": "account",
        "#bookingSection": "bookings",
        "#resourceSection": "resources",
        "#pwdSection": "pwd",
        "#deleteSection": "delete",
      };

      const view = map[target] || "account";
      window.showAdminView(view);
    });

    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("is-open")) return;
      if (!wrap.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  window.bindAdminMenu = bindAdminMenu;
})();
