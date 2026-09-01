/* js/user_password.js - password update + show/hide toggles */

(function () {
  window.bindPwdForm = function () {
    const form = document.getElementById("pwdForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      window.clearErr(["oldPwdErr", "newPwdErr", "newPwd2Err"]);
      window.setOk("pwdOk", "");

      const oldPwd = document.getElementById("oldPwd")?.value || "";
      const newPwd = document.getElementById("newPwd")?.value || "";
      const newPwd2 = document.getElementById("newPwd2")?.value || "";

      let ok = true;
      if (!oldPwd) { window.setErr("oldPwdErr", window.t("err_required", "必填")); ok = false; }

      if (!newPwd) { window.setErr("newPwdErr", window.t("err_required", "必填")); ok = false; }
      else if (newPwd.length < 8) { window.setErr("newPwdErr", window.t("error_password_format", "至少 8 碼")); ok = false; }

      if (!newPwd2) { window.setErr("newPwd2Err", window.t("err_required", "必填")); ok = false; }
      else if (newPwd !== newPwd2) { window.setErr("newPwd2Err", window.t("error_mismatch", "兩次密碼不一致")); ok = false; }

      if (!ok) return;

      try {
        const resp = await fetch("api/password_update.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            old_password: oldPwd,
            new_password: newPwd
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data?.ok) {
          const err = data?.error || "server_error";
          if (err === "wrong_old_password") window.setErr("oldPwdErr", window.t("err_wrong_old_pwd", "舊密碼不正確"));
          else if (err === "weak_password") window.setErr("newPwdErr", window.t("error_password_format", "密碼格式不符合規定"));
          else if (err === "not_logged_in") window.location.href = "login.html?next=" + encodeURIComponent("user.html");
          else window.setErr("newPwdErr", window.t("error_server", "系統錯誤，請稍後再試"));
          return;
        }

        // success
        document.getElementById("oldPwd").value = "";
        document.getElementById("newPwd").value = "";
        document.getElementById("newPwd2").value = "";
        window.setOk("pwdOk", window.t("ok_pwd", "已更新密碼"));
      } catch (e2) {
        console.warn(e2);
        window.setErr("newPwdErr", window.t("error_server", "系統錯誤，請稍後再試"));
      }
    });
  };

  // show/hide toggle buttons for password inputs
  window.bindPwdToggles = function () {
    const btns = document.querySelectorAll(".pwd-toggle");
    if (!btns.length) return;

    const setText = (btn, isVisible) => {
      btn.textContent = isVisible ? window.t("toggle_hide", "隱藏") : window.t("toggle_show", "顯示");
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

    // expose for langChanged update
    window.refreshPwdToggleTexts = function () {
      document.querySelectorAll(".pwd-toggle").forEach((btn) => {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;
        btn.textContent = (input.type === "text")
          ? window.t("toggle_hide", "隱藏")
          : window.t("toggle_show", "顯示");
      });
    };
  };
})();
