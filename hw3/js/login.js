/* js/login.js - 登入頁面互動邏輯 (支援多語言) */
/* Updated: implements real login via PHP API + redirect back with ?next= */

/*
【整體登入運作簡圖】
1) 使用者開啟：login.html?next=某頁.html
2) 使用者輸入 email / password 按登入
3) 前端 login.js 檢查欄位與格式
4) 前端用 fetch() 呼叫後端：POST api/login.php
   - api/login.php 會：
     a. include api/db.php 建立資料庫連線 (PDO)
     b. 查詢 users 表：SELECT ... WHERE email=?
     c. password_verify(使用者輸入密碼, users.hash_password)
     d. 成功就寫 session (如 $_SESSION['user_id'], $_SESSION['role']...) 並回傳 JSON：{ ok:true, user:{...} }
     e. 失敗就回傳 JSON：{ ok:false, message:"..." }（並設定 http 狀態碼 401/400 等）
5) 前端收到 ok:true 後，讀取網址的 next 參數，跳回原頁（例如 index.html / user.html）
6) 之後其他需要登入的 API，會用 api/auth.php 來檢查 session（這支 JS 目前不會直接呼叫 auth.php）
*/

document.addEventListener('DOMContentLoaded', function() {
    // =========================
    // 取得 DOM 元素
    // =========================
    const loginForm = document.getElementById('loginForm');      // 登入表單
    const emailInput = document.getElementById('email');         // Email input
    const passwordInput = document.getElementById('password');   // Password input
    const toggleBtn = document.getElementById('togglePasswordBtn'); // 顯示/隱藏密碼按鈕
    const errorDisplay = document.getElementById('login-error'); // 顯示錯誤訊息的區塊

    // =========================
    // helper：顯示錯誤訊息
    // =========================
    function showError(msg, i18nKey = null){
        // msg：要顯示給使用者的文字
        // i18nKey：若你有多語系系統，可用 data-i18n 交給翻譯系統重新渲染
        if(!errorDisplay) return;
        errorDisplay.textContent = msg || '';

        if(i18nKey){
            errorDisplay.setAttribute('data-i18n', i18nKey);
        }else{
            errorDisplay.removeAttribute('data-i18n');
        }
    }

    // =========================
    // helper：保護 next 參數（避免 open redirect）
    // =========================
    function sanitizeNext(raw){
        /*
          目的：
          - 防止有人把 next 設成 https://evil.com 造成「登入後跳去惡意網站」
          - 只允許站內相對路徑 + .html，例如：
              "index.html"
              "pages/user.html"
          - 其他格式一律回到 index.html
        */
        if(!raw) return "index.html";
        const s = String(raw).trim();

        // 允許英數 _ - / 組成，且必須以 .html 結尾
        if(/^[a-zA-Z0-9_\-/]+\.html$/.test(s)) return s;
        return "index.html";
    }

    // =========================
    // loginUser：真正「打後端 PHP」做登入
    // =========================
    async function loginUser(email, password){
        /*
          這裡會呼叫：
            POST api/login.php
          傳送 JSON：
            { email: "...", password: "..." }

          重要：
          - credentials: 'same-origin' 讓瀏覽器會帶 cookie（session id）
          - 後端若 session_start()，成功登入後會把 session 資訊存起來
          - 之後同一個網站（same-origin）呼叫其他 API 就能辨識你是否已登入
        */
        const resp = await fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email, password })
        });

        // 嘗試把回應轉為 JSON
        let data = null;
        try{
            data = await resp.json();
        }catch(e){
            // 如果後端回傳不是 JSON（例如 PHP 出錯印出 HTML），就會進來
            throw new Error('伺服器回應格式錯誤（非 JSON）');
        }

        // 判斷是否登入成功：
        // - resp.ok：HTTP status 在 200~299
        // - data.ok === true：後端 JSON 自訂成功旗標
        if(!resp.ok || !data || data.ok !== true){
            // 後端可能回傳 message 或 error
            const msg = (data && (data.message || data.error)) || '登入失敗，請稍後再試';
            throw new Error(msg);
        }

        // 回傳後端提供的 user 資訊（例如 user_id / username / role）
        return data.user;
    }

    // =========================
    // 1) 密碼顯示 / 隱藏功能（純前端 UI）
    // =========================
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function() {
            if (passwordInput.type === 'password') {
                // 切換成明文顯示
                passwordInput.type = 'text';
                this.setAttribute('data-i18n', 'toggle_hide');
                this.textContent = window.getTrans ? window.getTrans('toggle_hide') : '隱藏';
            } else {
                // 切回密碼遮罩
                passwordInput.type = 'password';
                this.setAttribute('data-i18n', 'toggle_show');
                this.textContent = window.getTrans ? window.getTrans('toggle_show') : '顯示';
            }
        });
    }

    // =========================
    // 2) 表單提交：前端驗證 + 呼叫後端登入 API
    // =========================
    if (loginForm) {
        // ✅ 注意：這裡是 async function，因為下面要用 await loginUser()
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // 不走傳統 form submit（避免整頁刷新）

            const emailValue = (emailInput?.value || '').trim();
            const passwordValue = (passwordInput?.value || '').trim();

            // 清除之前的錯誤狀態
            showError('');
            if(emailInput) emailInput.style.borderColor = '';
            if(passwordInput) passwordInput.style.borderColor = '';

            // 2-1) 檢查空白欄位
            if (!emailValue || !passwordValue) {
                const errorKey = 'error_required';
                showError(window.getTrans ? window.getTrans(errorKey) : '請輸入 Email 與密碼', errorKey);

                if(!emailValue && emailInput) emailInput.style.borderColor = 'var(--accent-error)';
                if(!passwordValue && passwordInput) passwordInput.style.borderColor = 'var(--accent-error)';
                return;
            }

            // 2-2) Email 格式簡易檢查（避免明顯錯誤就送到後端）
            const emailOk = /^\S+@\S+\.\S+$/.test(emailValue);
            if(!emailOk){
                showError('Email 格式不正確');
                if(emailInput) emailInput.style.borderColor = 'var(--accent-error)';
                return;
            }

            // 2-3) 防止連點送出（double-submit）
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const oldText = submitBtn ? submitBtn.textContent : null;
            if(submitBtn){
                submitBtn.disabled = true;
                submitBtn.textContent = (window.getTrans ? window.getTrans('btn_logging_in') : '登入中…') || '登入中…';
            }

            try{
                console.log('前端驗證通過，準備發送資料到後端...');

                // ✅ 3) 這行會真的打後端：api/login.php
                // 後端成功會建立 session，並回傳 { ok:true, user:{...} }
                await loginUser(emailValue, passwordValue);

                // ✅ 4) 登入成功：回到原頁（next 參數）
                // login.html?next=index.html
                // login.html?next=user.html
                const params = new URLSearchParams(location.search);
                const nextRaw = params.get('next') || 'index.html';

                // 避免跳到站外
                const next = sanitizeNext(nextRaw);

                // 跳回原頁
                location.href = next;

            }catch(err){
                // 後端登入失敗（帳密錯、查無此帳號、伺服器錯誤…）
                // 會在這裡顯示錯誤訊息
                showError(err?.message || '登入失敗');

            }finally{
                // 無論成功/失敗，最後都恢復按鈕狀態
                if(submitBtn){
                    submitBtn.disabled = false;
                    if(oldText) submitBtn.textContent = oldText;
                }
            }
        });

        // =========================
        // 3) 使用者開始輸入時，移除紅色警告框（改善 UX）
        // =========================
        [emailInput, passwordInput].forEach(input => {
            if(!input) return;
            input.addEventListener('input', function() {
                this.style.borderColor = '';
                if (errorDisplay && errorDisplay.textContent) showError('');
            });
        });
    }
});
