/* js/admin_profile.js - profile render/edit (no module) */
(function () {
  function renderProfile() {
    const u = window.adminState.user;
    if (!u) return;

    document.getElementById("profileName") && (document.getElementById("profileName").textContent = u.name || "—");
    document.getElementById("profileEmail") && (document.getElementById("profileEmail").textContent = u.email || "—");
    document.getElementById("profileRole") && (document.getElementById("profileRole").textContent = u.role || "user");

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
  }

  function bindProfileModal() {
    const btn = document.getElementById("editProfileBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      document.getElementById("editName").value = window.adminState.user?.name || "";
      document.getElementById("editEmail").value = window.adminState.user?.email || "";
      const fileInput = document.getElementById("editAvatarFile");
      if (fileInput) fileInput.value = "";

      document.getElementById("editNameErr").textContent = "";
      document.getElementById("editEmailErr").textContent = "";
      document.getElementById("editAvatarErr").textContent = "";
      document.getElementById("profileOk").textContent = "";

      window.openModal("profileModal");
    });

    document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("editName").value.trim();
      const email = document.getElementById("editEmail").value.trim();
      const file = document.getElementById("editAvatarFile")?.files?.[0];

      document.getElementById("editNameErr").textContent = "";
      document.getElementById("editEmailErr").textContent = "";
      document.getElementById("editAvatarErr").textContent = "";
      document.getElementById("profileOk").textContent = "";

      let ok = true;
      if (!name) { document.getElementById("editNameErr").textContent = "Required"; ok = false; }
      if (!email) { document.getElementById("editEmailErr").textContent = "Required"; ok = false; }
      if (!ok) return;

      const fd = new FormData();
      fd.append("username", name);
      fd.append("email", email);
      if (file) fd.append("profile_pic", file);

      try {
        const resp = await fetch("api/user_update.php", {
          method: "POST",
          credentials: "include",
          body: fd,
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) {
          const err = data?.error || "server_error";
          if (err === "invalid_profile_pic") document.getElementById("editAvatarErr").textContent = "圖片格式不正確";
          else if (err === "photo_too_large") document.getElementById("editAvatarErr").textContent = "圖片太大";
          else if (err === "email_exists") document.getElementById("editEmailErr").textContent = "Email 已被使用";
          else document.getElementById("editEmailErr").textContent = "更新失敗";
          return;
        }

        // 更新 state
        window.adminState.user = {
          name: data.user.username,
          email: data.user.email,
          role: data.user.role,
          avatarUrl: data.user.profile_pic || "",
        };

        window.renderTopbar();
        renderProfile();
        document.getElementById("profileOk").textContent = "更新成功";
        window.closeModal("profileModal");
      } catch (e2) {
        console.warn(e2);
        document.getElementById("editEmailErr").textContent = "系統錯誤";
      }
    });
  }

  window.renderProfile = renderProfile;
  window.bindProfileModal = bindProfileModal;
})();
