/* js/user_profile.js - profile render + edit profile (FormData upload) */

(function () {
  window.renderProfile = function () {
    if (!window.state.user) return;

    const u = window.state.user;

    const nameEl = document.getElementById("profileName");
    const emailEl = document.getElementById("profileEmail");
    const roleEl = document.getElementById("profileRole");

    if (nameEl) nameEl.textContent = u.name || "—";
    if (emailEl) emailEl.textContent = u.email || "—";
    if (roleEl) roleEl.textContent = u.role || "user";

    const box = document.getElementById("profileAvatarBox");
    if (box) {
      box.innerHTML = "";
      let url = String(u.avatarUrl || "").trim();
      if (!url || url === "null" || url === "undefined") url = "pic/default-avatar.png";
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "avatar";
        box.appendChild(img);
      }
    }
  };

  window.bindProfileModal = function () {
    const editBtn = document.getElementById("editProfileBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        document.getElementById("editName").value = window.state.user?.name || "";
        document.getElementById("editEmail").value = window.state.user?.email || "";

        const fileInput = document.getElementById("editAvatarFile");
        if (fileInput) fileInput.value = "";

        window.clearErr(["editNameErr", "editEmailErr", "editAvatarErr"]);
        window.setOk("profileOk", "");
        window.openModal("profileModal");
      });
    }

    const form = document.getElementById("profileForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      window.clearErr(["editNameErr", "editEmailErr", "editAvatarErr"]);
      window.setOk("profileOk", "");

      const name = document.getElementById("editName").value.trim();
      const email = document.getElementById("editEmail").value.trim();

      let ok = true;
      if (!name) { window.setErr("editNameErr", window.t("err_required", "必填")); ok = false; }
      if (!email) { window.setErr("editEmailErr", window.t("err_required", "必填")); ok = false; }
      else if (!window.isEmail(email)) { window.setErr("editEmailErr", window.t("err_email_format", "Email 格式不正確")); ok = false; }
      if (!ok) return;

      // FormData (username/email + optional file)
      const fd = new FormData();
      fd.append("username", name);
      fd.append("email", email);

      const fileInput = document.getElementById("editAvatarFile");
      const file = fileInput?.files?.[0];
      if (file) fd.append("profile_pic", file);

      try {
        const resp = await fetch("api/user_update.php", {
          method: "POST",
          body: fd,
          credentials: "include"
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.ok) {
          const err = data.error || "";
          if (err === "invalid_profile_pic") window.setErr("editAvatarErr", window.t("err_avatar_format", "頭貼格式不正確，請上傳圖片檔"));
          else if (err === "photo_too_large") window.setErr("editAvatarErr", window.t("error_photo_too_large", "圖片檔案太大（上限 2MB）"));
          else if (err === "email_exists") window.setErr("editEmailErr", window.t("error_email_exists", "此 Email 已被使用"));
          else window.setErr("editEmailErr", window.t("error_server", "更新失敗，請稍後再試"));
          return;
        }

        // update state.user by backend response
        window.state.user = {
          name: data.user?.username ?? name,
          email: data.user?.email ?? email,
          role: data.user?.role ?? (window.state.user?.role || "user"),
          avatarUrl: data.user?.profile_pic ?? (window.state.user?.avatarUrl || "")
        };

        window.renderTopbar();
        window.renderProfile(); // Changed from reloadProfileInfo to renderProfile as per original code
        window.setOk("profileOk", window.t("ok_profile", "更新成功"));
        setTimeout(() => { window.closeModal("profileModal"); }, 800);

      } catch (e) {
        console.warn(e); // Kept original console.warn
        window.setErr("editEmailErr", window.t("error_server", "系統錯誤，請稍後再試"));
      }
    });
  };
})();
