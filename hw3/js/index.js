/* js/index.js - entry init (no module) */
(async function () {
  const { $ } = window.indexCore;

  async function init() {
    // 預設日期 = 今天
    if ($("date") && !$("date").value) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      $("date").value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    }

    // bind
    window.indexModal.bindModal();
    window.indexFilters.bindFilters();

    // lang changed -> re-render
    document.addEventListener("langChanged", () => {
      window.indexTopbar.applyTopNavByRole(window.indexState.user?.role || "");
      window.indexTopbar.renderTopbar();
      window.indexFilters.applyFilters();
    });

    // load
    await window.indexAuth.initAuthState();
    await window.indexData.loadResources();

    window.indexTopbar.renderTopbar();
    await window.indexFilters.applyFilters();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => console.warn(e));
  });
})();
