/* js/admin_password.js - password update (DB) */
(function () {
  function bindPwdToggles() {
    const btns = document.querySelectorAll(".pwd-toggle");
    if (!btns.length) return;

    const setText = (btn, isVisible) => {
      btn.textContent = isVisible ? "隱藏" : "顯示";
    };

    btns.forEach((btn) => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      setText(btn, input.type === "text");

      btn.addEventListener("click", () => {
        const willShow = input.type === "password";
        input.type = willShow ? "text" : "password";
        setText(btn, willShow);
        input.focus();
      });
    });
  }

  function bindPwdForm() {
    document.getElementById("pwdForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const oldPwd = document.getElementById("oldPwd").value;
      const newPwd = document.getElementById("newPwd").value;
      const newPwd2 = document.getElementById("newPwd2").value;

      document.getElementById("oldPwdErr").textContent = "";
      document.getElementById("newPwdErr").textContent = "";
      document.getElementById("newPwd2Err").textContent = "";
      document.getElementById("pwdOk").textContent = "";

      let ok = true;
      if (!oldPwd) { document.getElementById("oldPwdErr").textContent = "Required"; ok = false; }
      if (!newPwd || newPwd.length < 8) { document.getElementById("newPwdErr").textContent = "至少 8 碼"; ok = false; }
      if (newPwd !== newPwd2) { document.getElementById("newPwd2Err").textContent = "不一致"; ok = false; }
      if (!ok) return;

      try {
        const resp = await fetch("api/password_update.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) {
          const err = data?.error || "server_error";
          if (err === "incorrect_old_password") document.getElementById("oldPwdErr").textContent = "舊密碼錯誤";
          else document.getElementById("newPwdErr").textContent = "修改失敗";
          return;
        }

        document.getElementById("oldPwd").value = "";
        document.getElementById("newPwd").value = "";
        document.getElementById("newPwd2").value = "";
        document.getElementById("pwdOk").textContent = "Password updated successfully";
      } catch (e2) {
        console.warn(e2);
        document.getElementById("newPwdErr").textContent = "系統錯誤";
      }
    });
  }

  window.bindPwdForm = bindPwdForm;
  window.bindPwdToggles = bindPwdToggles;
})();
