/**
 * avatar.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室大頭貼功能。
 *
 * 主要功能：
 * 1. 在目前登入使用者 nickname 旁顯示自己的大頭貼。
 * 2. 在左側線上使用者列表顯示其他使用者的大頭貼。
 * 3. 預設大頭貼為 /uploads/default.png。
 * 4. 使用者可透過「更換大頭貼」按鈕上傳圖片。
 * 5. 上傳成功後，server 會廣播更新，讓其他使用者同步看到新大頭貼。
 * 6. 點擊自己或他人的大頭貼可以放大檢視。
 * 7. 按鈕文字與錯誤提示支援 i18n.js 中英轉換。
 * ------------------------------------------------------------
 */

(function setupAvatarModule() {
  if (window.AvatarModule) return;

  const DEFAULT_AVATAR_URL = '/uploads/default.png';
  const MAX_AVATAR_SIZE = 1 * 1024 * 1024;

  let currentAvatarImg = null;
  let changeAvatarBtn = null;
  let avatarInput = null;
  let translate = null;
  let getSocket = null;

  function t(key) {
    if (typeof translate === 'function') {
      return translate(key);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key);
    }

    return key;
  }

  function injectStyle() {
    if (document.getElementById('avatarStyle')) return;

    const style = document.createElement('style');
    style.id = 'avatarStyle';

    style.textContent = `
      /*
       * 大頭貼功能樣式
       */

      .current-avatar-wrap {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 10px;
        vertical-align: middle;
      }

      .avatar-image {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 250, 241, 0.92);
        background: #f6efe4;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.14);
        cursor: zoom-in;
      }

      .avatar-image:hover {
        transform: scale(1.04);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        box-shadow: 0 12px 24px rgba(45, 42, 36, 0.20);
      }

      .user-list-avatar {
        flex: 0 0 auto;
        width: 42px;
        height: 42px;
      }

      .change-avatar-btn {
        border: 0;
        border-radius: 999px;
        padding: 7px 11px;
        background: rgba(255, 250, 241, 0.92);
        color: #5b4b3d;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.10);
        white-space: nowrap;
      }

      .change-avatar-btn:hover {
        transform: translateY(-1px);
        background: rgba(255, 250, 241, 1);
      }

      .avatar-viewer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 28px;
        background: rgba(45, 42, 36, 0.72);
        backdrop-filter: blur(8px);
      }

      .avatar-viewer-backdrop.hidden {
        display: none !important;
      }

      .avatar-viewer-card {
        position: relative;
        display: grid;
        place-items: center;
        padding: 20px;
        border-radius: 28px;
        background: rgba(255, 250, 241, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.72);
        box-shadow: 0 28px 70px rgba(35, 30, 24, 0.32);
      }

      .avatar-viewer-img {
        width: min(72vw, 420px);
        height: min(72vw, 420px);
        border-radius: 50%;
        object-fit: cover;
        display: block;
        border: 6px solid rgba(255, 255, 255, 0.84);
        background: #f6efe4;
      }

      .avatar-viewer-close {
        position: absolute;
        top: -14px;
        right: -14px;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 50%;
        background: #75614f;
        color: #ffffff;
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(35, 30, 24, 0.24);
      }
    `;

    document.head.appendChild(style);
  }

  function createAvatarViewer() {
    let modal = document.getElementById('avatarViewerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'avatarViewerModal';
    modal.className = 'avatar-viewer-backdrop hidden';

    modal.innerHTML = `
      <section class="avatar-viewer-card">
        <button id="closeAvatarViewerBtn" type="button" class="avatar-viewer-close">×</button>
        <img id="avatarViewerImg" class="avatar-viewer-img" src="" alt="Avatar">
      </section>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#closeAvatarViewerBtn');
    closeBtn.addEventListener('click', closeAvatarViewer);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeAvatarViewer();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeAvatarViewer();
      }
    });

    return modal;
  }

  function openAvatarViewer(src) {
    if (!src) return;

    const modal = createAvatarViewer();
    const img = document.getElementById('avatarViewerImg');

    img.src = src;
    modal.classList.remove('hidden');
  }

  function closeAvatarViewer() {
    const modal = document.getElementById('avatarViewerModal');
    const img = document.getElementById('avatarViewerImg');

    if (modal) modal.classList.add('hidden');
    if (img) img.removeAttribute('src');
  }

  function createAvatarImage(src, className = '') {
    const img = document.createElement('img');
    img.className = `avatar-image ${className}`.trim();
    img.src = src || DEFAULT_AVATAR_URL;
    img.alt = 'Avatar';

    img.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAvatarViewer(img.src);
    });

    img.onerror = () => {
      img.src = DEFAULT_AVATAR_URL;
    };

    return img;
  }

  function createUserListAvatar(user) {
    return createAvatarImage(user.avatarUrl || DEFAULT_AVATAR_URL, 'user-list-avatar');
  }

  function updateCurrentAvatar(avatarUrl) {
    if (!currentAvatarImg) return;
    currentAvatarImg.src = avatarUrl || DEFAULT_AVATAR_URL;
  }

  function updateFromOnlineUsers(users, currentUser) {
    const me = users.find((user) => user.nickname === currentUser);
    if (me) {
      updateCurrentAvatar(me.avatarUrl);
    }
  }

  function updateText() {
    if (changeAvatarBtn) {
      changeAvatarBtn.textContent = t('changeAvatar');
    }
  }

  function createCurrentAvatarUI(currentNicknameElement) {
    if (!currentNicknameElement) return;

    if (document.getElementById('currentAvatarWrap')) return;

    const wrap = document.createElement('span');
    wrap.id = 'currentAvatarWrap';
    wrap.className = 'current-avatar-wrap';

    currentAvatarImg = createAvatarImage(DEFAULT_AVATAR_URL, 'current-user-avatar');

    changeAvatarBtn = document.createElement('button');
    changeAvatarBtn.id = 'changeAvatarBtn';
    changeAvatarBtn.type = 'button';
    changeAvatarBtn.className = 'change-avatar-btn';
    changeAvatarBtn.textContent = t('changeAvatar');

    avatarInput = document.createElement('input');
    avatarInput.id = 'avatarInput';
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.hidden = true;

    changeAvatarBtn.addEventListener('click', () => {
      avatarInput.click();
    });

    avatarInput.addEventListener('change', handleAvatarFileChange);

    wrap.append(currentAvatarImg, changeAvatarBtn, avatarInput);

    currentNicknameElement.insertAdjacentElement('afterend', wrap);
  }

  function handleAvatarFileChange() {
    const file = avatarInput.files && avatarInput.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('avatarOnly'));
      avatarInput.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      alert(t('avatarTooLarge'));
      avatarInput.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const socket = typeof getSocket === 'function' ? getSocket() : null;

      if (!socket) {
        alert(t('avatarUploadFailed'));
        return;
      }

      socket.emit('updateAvatar', {
        imageData: reader.result,
      }, (response = {}) => {
        if (!response.ok) {
          alert(t('avatarUploadFailed'));
          return;
        }

        updateCurrentAvatar(response.avatarUrl);
      });
    };

    reader.readAsDataURL(file);
  }

  function init(config) {
    translate = config.translate;
    getSocket = config.getSocket;

    injectStyle();
    createAvatarViewer();
    createCurrentAvatarUI(config.currentNicknameElement);
    updateText();

    window.addEventListener('languageChanged', updateText);
  }

  window.AvatarModule = {
    init,
    createUserListAvatar,
    updateCurrentAvatar,
    updateFromOnlineUsers,
    DEFAULT_AVATAR_URL,
  };
})();