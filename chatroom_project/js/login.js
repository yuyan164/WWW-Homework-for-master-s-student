/*
 * 檔案名稱：login.js
 * 檔案用途：本檔案負責登入頁面的前端互動邏輯。
 *
 * 主要功能：
 * 1. 讀取使用者輸入的 nickname。
 * 2. 檢查 nickname 是否為空白。
 * 3. 將 nickname 送往後端，確認是否已被其他使用者使用。
 * 4. 若登入成功，將「本分頁登入狀態」暫存於 sessionStorage。
 * 5. 若登入失敗，顯示錯誤訊息。
 * 6. 套用中文與英文雙語介面文字。
 *
 * 注意事項：
 * sessionStorage 只存在目前分頁。
 * 因此同一個瀏覽器開新分頁貼上 index.html，不會被視為已登入。
 */

(function setupLoginPage() {
  const TAB_LOGIN_KEY = 'chatroom-current-tab-login';

  /*
   * 只要回到登入頁，就先清除目前分頁的登入狀態。
   */
  sessionStorage.removeItem(TAB_LOGIN_KEY);

  const loginForm = document.getElementById('loginForm');
  const nicknameInput = document.getElementById('nicknameInput');
  const loginError = document.getElementById('loginError');

  function showError(message) {
    loginError.textContent = message;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nickname = nicknameInput.value.trim();

    if (!nickname) {
      showError(window.i18n.t('nicknameRequired'));
      return;
    }

    showError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        sessionStorage.removeItem(TAB_LOGIN_KEY);

        if (response.status === 409) {
          showError(window.i18n.t('duplicatedNickname'));
          return;
        }

        showError(result.message || window.i18n.t('loginFailed'));
        return;
      }

      /*
       * 重要：
       * 只有真正從登入頁登入成功的這個分頁，
       * 才會有這個 sessionStorage 標記。
       */
      sessionStorage.setItem(
        TAB_LOGIN_KEY,
        JSON.stringify({
          nickname: result.nickname || nickname,
          loginAt: Date.now(),
        })
      );

      window.location.href = '/index.html';
    } catch (error) {
      console.error('Login error:', error);
      sessionStorage.removeItem(TAB_LOGIN_KEY);
      showError(window.i18n.t('loginFailed'));
    }
  });

  window.addEventListener('languageChanged', () => {
    if (loginError.textContent) {
      loginError.textContent = '';
    }
  });
})();