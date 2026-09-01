/* js/register.js - 註冊頁面邏輯 (支援多語言) */

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const errorMsg = document.getElementById('register-error');
    
    // 圖片上傳相關元素
    const photoInput = document.getElementById('user-photo');
    const previewBox = document.getElementById('preview-box');
    const previewImg = document.getElementById('preview-img');

    // 1. 圖片上傳即時預覽與格式檢查
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            // 取得顯示檔名的元素
            const fileText = document.getElementById('file-chosen-text');
            
            // 清除之前的錯誤
            errorMsg.textContent = '';
            errorMsg.removeAttribute('data-i18n');

            if (file) {
                // [新增] 更新檔名文字
                fileText.textContent = file.name;
                fileText.removeAttribute('data-i18n'); // 移除翻譯標籤，避免切換語言時檔名被蓋掉

                // 檢查檔案類型
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    const errorKey = 'error_photo_type';
                    errorMsg.setAttribute('data-i18n', errorKey);
                    errorMsg.textContent = window.getTrans(errorKey);
                    
                    photoInput.value = ''; 
                    previewBox.style.display = 'none';
                    
                    // [新增] 錯誤時重置文字
                    fileText.setAttribute('data-i18n', 'text_no_file');
                    fileText.textContent = window.getTrans('text_no_file');
                    return;
                }

                // 讀取並顯示縮圖
                const reader = new FileReader();
                reader.onload = function(event) {
                    previewImg.src = event.target.result;
                    previewBox.style.display = 'block'; 
                };
                reader.readAsDataURL(file);
            } else {
                // [新增] 使用者取消選擇時，恢復 "未選擇任何檔案"
                previewBox.style.display = 'none';
                fileText.setAttribute('data-i18n', 'text_no_file');
                fileText.textContent = window.getTrans('text_no_file');
            }
        });
    }

    // 2. 表單提交驗證
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault(); // 暫停提交

            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // 清除錯誤
            errorMsg.textContent = '';
            errorMsg.removeAttribute('data-i18n');

            // 檢查空白欄位（不含 file）
            const inputs = registerForm.querySelectorAll('input[required]:not([type="file"])');
            for (let input of inputs) {
            if (!input.value.trim()) {
                const errorKey = 'error_all_required';
                errorMsg.setAttribute('data-i18n', errorKey);
                errorMsg.textContent = window.getTrans(errorKey);
                return;
            }
            }

            // Email trim + 內建格式檢查
            const emailInput = document.getElementById('reg-email');
            emailInput.value = emailInput.value.trim();
            emailInput.setCustomValidity("");
            if (!emailInput.checkValidity()) {
            const errorKey = 'error_email_format';
            errorMsg.setAttribute('data-i18n', errorKey);
            errorMsg.textContent = window.getTrans(errorKey);
            emailInput.focus();
            return;
            }

            // 檢查密碼是否一致 [作業 2.2.2 - Figure 2-3]
            if (password !== confirmPassword) {
                const errorKey = 'error_mismatch';
                errorMsg.setAttribute('data-i18n', errorKey);
                errorMsg.textContent = window.getTrans(errorKey);
                return;
            }

            // 前端驗證通過
            // 前端驗證通過
            console.log('註冊前端驗證通過，準備傳送...');

            const fd = new FormData(registerForm); // 會自動包含 photo (若有選)

            fetch('api/register.php', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd
            })
            .then(async (res) => {
            // 盡量用 JSON 解析（若伺服器噴 HTML error，這裡會 throw）
            const data = await res.json();
            return { ok: res.ok, data };
            })
            .then(({ ok, data }) => {
            if (!ok || !data.ok) {
                // 後端回傳 error code，前端映射成 i18n key 顯示
                const map = {
                missing_fields: 'error_all_required',
                password_mismatch: 'error_mismatch',
                email_exists: 'error_email_exists',        // 你 lang.js 需要有對應字串
                password_format: 'error_password_format',  // 你 lang.js 需要有對應字串
                invalid_photo_type: 'error_photo_type',
                photo_too_large: 'error_photo_too_large',  // 你 lang.js 需要有對應字串
                upload_failed: 'error_upload_failed',
                server_error: 'error_server',
                email_format: 'error_email_format'
                };

                const key = map[data.error] || 'error_server';
                errorMsg.setAttribute('data-i18n', key);
                errorMsg.textContent = window.getTrans(key);
                return;
            }

            // ✅ 註冊成功：你可以跳登入頁
            window.location.href = 'login.html';
            })
            .catch((err) => {
            console.error(err);
            const key = 'error_server';
            errorMsg.setAttribute('data-i18n', key);
            errorMsg.textContent = window.getTrans(key);
            });

        });
    }
});

// 3. 密碼顯示切換功能 (全域函式)
// 為了配合 HTML 中的 onclick="toggleRegPassword(...)"
window.toggleRegPassword = function(fieldId, btn) {
    const input = document.getElementById(fieldId);
    
    if (input.type === 'password') {
        input.type = 'text';
        // 更新按鈕文字並加上翻譯標籤
        btn.setAttribute('data-i18n', 'toggle_hide');
        btn.textContent = window.getTrans('toggle_hide');
    } else {
        input.type = 'password';
        // 更新按鈕文字並加上翻譯標籤
        btn.setAttribute('data-i18n', 'toggle_show');
        btn.textContent = window.getTrans('toggle_show');
    }
};