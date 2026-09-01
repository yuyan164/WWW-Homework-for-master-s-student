/**
 * login.js
 * ------------------------------------------------------------
 * This file controls login.html. It validates the nickname,
 * sends it to the Node.js backend, handles duplicate nickname
 * errors, and redirects the user to index.html after login.
 * ------------------------------------------------------------
 */

(function setupLoginPage() {
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
        if (response.status === 409) {
          showError(window.i18n.t('duplicatedNickname'));
          return;
        }
        showError(result.message || window.i18n.t('loginFailed'));
        return;
      }

      window.location.href = '/index.html';
    } catch (error) {
      console.error('Login error:', error);
      showError(window.i18n.t('loginFailed'));
    }
  });

  window.addEventListener('languageChanged', () => {
    if (loginError.textContent) {
      loginError.textContent = '';
    }
  });
})();
