/* js/index_filters.js - filtering pipeline (no module) */
(function () {
  const { $, parseSelectedRange } = window.indexCore;
  const state = window.indexState;
  const { loadBookingsForRange, isResourceOpenForRange, matchCategory } = window.indexData;

  async function applyFilters() {
    const cat = $("category")?.value || "all";
    const reservedFilter = $("reservedFilter")?.value || "all";
    const kw = ($("keyword")?.value || "").trim().toLowerCase();
    const range = parseSelectedRange();

    await loadBookingsForRange(range);

    const sorted = [...state.resources].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    const now = Date.now();

    const filtered = sorted.filter((r) => {
      if (!matchCategory(r, cat)) return false;
      if (range && !isResourceOpenForRange(r, range)) return false;

      if (kw) {
        const hay = `${r.name} ${r.location || ""} ${r.description || ""} ${r.category || ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }

      const st = window.indexData.deriveReserveState(r, range);

      if (reservedFilter === "available" && !st.canReserve) return false;

      if (reservedFilter === "reserved") {
        if (st.canReserve) return false;

        const hasOverlap = state.bookings.some((b) => b.resource_id === r.id);
        if (!hasOverlap) return false;

        const inUse = state.bookings.some((b) => {
          if (b.resource_id !== r.id) return false;
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return bs <= now && now < be;
        });
        if (inUse) return false;
      }

      if (reservedFilter === "inuse") {
        const inUse = state.bookings.some((b) => {
          if (b.resource_id !== r.id) return false;
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return bs <= now && now < be;
        });
        if (!inUse) return false;
      }

      return true;
    });

    window.indexCards.renderCards(filtered, range);

    const countEl = $("countHint");
    if (countEl) countEl.textContent = `${filtered.length}`;
  }

  function bindFilters() {
    $("apply") && ($("apply").onclick = () => applyFilters());
    $("reset") && ($("reset").onclick = () => {
      $("category").value = "all";
      $("reservedFilter").value = "all";
      $("keyword").value = "";
      applyFilters();
    });

    ["category", "reservedFilter", "date", "start", "end"].forEach((id) => {
      $(id)?.addEventListener("change", () => applyFilters());
    });
    $("keyword")?.addEventListener("keydown", (e) => { if (e.key === "Enter") applyFilters(); });
  }

  window.indexFilters = { applyFilters, bindFilters };
})();
