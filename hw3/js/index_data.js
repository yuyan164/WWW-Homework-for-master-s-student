/* js/index_data.js - resources/bookings + open-hours logic (no module) */
(function () {
  const { apiFetch, safeReadJson, toISODateTimeLocal, t } = window.indexCore;
  const state = window.indexState;

  async function loadResources() {
    try {
      const resp = await apiFetch("api/resources.php");
      const data = await safeReadJson(resp);

      if (!resp.ok || !data || !data.ok) {
        state.resources = [];
        console.warn("loadResources failed:", data);
        return;
      }
      state.resources = Array.isArray(data.resources) ? data.resources : [];
    } catch (e) {
      console.warn("loadResources error:", e);
      state.resources = [];
    }
  }

  async function loadBookingsForRange(range) {
    if (!range) {
      state.bookings = [];
      state.bookingsKey = "";
      return;
    }

    const start = toISODateTimeLocal(range.start);
    const end = toISODateTimeLocal(range.end);
    const key = `${start}__${end}`;
    if (state.bookingsKey === key) return;

    try {
      const url = `api/bookings.php?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const resp = await apiFetch(url);

      if (!resp.ok) {
        state.bookings = [];
        state.bookingsKey = key;
        return;
      }

      const data = await safeReadJson(resp);
      if (!data || !data.ok) {
        state.bookings = [];
        state.bookingsKey = key;
        return;
      }

      state.bookings = Array.isArray(data.bookings) ? data.bookings : [];
      state.bookingsKey = key;
    } catch (e) {
      console.warn("loadBookingsForRange error:", e);
      state.bookings = [];
      state.bookingsKey = key;
    }
  }

  function timeToMinutes(hhmmss) {
    const s = String(hhmmss || "00:00:00");
    const parts = s.split(":");
    const hh = parseInt(parts[0] || "0", 10);
    const mm = parseInt(parts[1] || "0", 10);
    return hh * 60 + mm;
  }

  function isResourceOpenForRange(resource, range) {
    if (!range) return true;

    const day = range.start.getDay(); // 0=Sun..6=Sat
    const bit = 1 << day;

    const openDays = Number(resource.openDays ?? 62);
    if ((openDays & bit) === 0) return false;

    const startMin = range.start.getHours() * 60 + range.start.getMinutes();
    const endMin = range.end.getHours() * 60 + range.end.getMinutes();

    const openStartMin = timeToMinutes(resource.openStart ?? "08:00:00");
    const openEndMin = timeToMinutes(resource.openEnd ?? "18:00:00");

    return startMin >= openStartMin && endMin <= openEndMin;
  }

  function matchCategory(resource, selectedCat) {
    if (selectedCat === "all") return true;
    if (selectedCat === "space") return resource.type === "space";

    const c = (resource.category || "").toLowerCase();

    if (selectedCat === "3c") {
      return c.includes("3c") || c.includes("3 c") || c.includes("device") || c.includes("電子") || c.includes("器材");
    }
    if (selectedCat === "book") {
      return c.includes("book") || c.includes("書");
    }
    return c === selectedCat.toLowerCase();
  }

  function statusText(type) {
    if (type === "space") return t("type_space", "空間");
    if (type === "equipment") return t("type_equipment", "設備");
    return t("type_other", "其他");
  }

  function deriveReserveState(resource, range) {
    if (resource.status !== "active") {
      if (resource.status === "maintenance") return { label: t("status_maintenance", "維護中"), canReserve: false };
      if (resource.status === "inactive") return { label: t("status_inactive", "停用"), canReserve: false };
      return { label: t("status_unavailable", "不可用"), canReserve: false };
    }

    if (!range) return { label: t("status_available", "可預約"), canReserve: true };

    if (!Array.isArray(state.bookings) || state.bookings.length === 0) {
      return { label: t("status_available", "可預約"), canReserve: true };
    }

    const now = Date.now();
    const hasOverlap = state.bookings.some((b) => b.resource_id === resource.id);

    if (!hasOverlap) return { label: t("status_available", "可預約"), canReserve: true };

    const inUse = state.bookings.some((b) => {
      if (b.resource_id !== resource.id) return false;
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return bs <= now && now < be;
    });

    if (inUse) return { label: t("reserved_inuse", "使用中"), canReserve: false };
    return { label: t("status_reserved_in_range", "該時段已被預約"), canReserve: false };
  }

  window.indexData = {
    loadResources,
    loadBookingsForRange,
    isResourceOpenForRange,
    matchCategory,
    statusText,
    deriveReserveState
  };
})();
