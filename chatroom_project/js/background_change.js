/*
 * 檔案名稱：background_change.js
 * 檔案用途：本檔案負責聊天室背景更換功能。
 *
 * 主要功能：
 * 1. 使用者可以選擇純色作為聊天背景。
 * 2. 使用者可以上傳圖片作為聊天背景。
 * 3. 背景設定只會儲存在目前瀏覽器的 localStorage。
 * 4. 背景設定不會透過 Socket.io 傳給其他使用者，所以只會影響自己畫面。
 * 5. 每個 nickname 會有獨立的背景設定。
 * 6. 本檔案會自動建立「背景」按鈕、背景設定視窗與需要的 CSS。
 */

(function setupBackgroundChange() {
  if (window.__backgroundChangeReady) return;
  window.__backgroundChangeReady = true;

  const DEFAULT_COLOR = '#fff8ec';
  const MAX_BACKGROUND_IMAGE_SIZE = 2 * 1024 * 1024;

  const presetColors = [
    '#fff8ec',
    '#ead6ba',
    '#d8c2aa',
    '#c8d4b2',
    '#aebd9c',
    '#7b8a68',
    '#d6a574',
    '#b1886b',
    '#75614f',
  ];

  let selectedImageData = '';

  function getLanguage() {
    if (window.i18n && typeof window.i18n.getLanguage === 'function') {
      return window.i18n.getLanguage();
    }

    return 'zh';
  }

  function text(zh, en) {
    return getLanguage() === 'en' ? en : zh;
  }

  function getCurrentNickname() {
    const nicknameElement = document.getElementById('currentNickname');
    const nickname = nicknameElement ? nicknameElement.textContent.trim() : '';
    return nickname || 'guest';
  }

  function getStorageKey() {
    return `chatroom_background_${getCurrentNickname()}`;
  }

  function injectStyle() {
    if (document.getElementById('backgroundChangeStyle')) return;

    const style = document.createElement('style');
    style.id = 'backgroundChangeStyle';

    style.textContent = `
      .background-change-btn {
        border: 0;
        border-radius: 16px;
        padding: 10px 16px;
        background: rgba(255, 250, 241, 0.86);
        color: #55483b;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.12);
      }

      .background-change-btn:hover {
        transform: translateY(-1px);
        background: rgba(255, 250, 241, 0.98);
      }

      .background-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9500;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(45, 42, 36, 0.58);
        backdrop-filter: blur(6px);
      }

      .background-modal-backdrop.hidden {
        display: none !important;
      }

      .background-modal-card {
        width: min(92vw, 520px);
        border-radius: 26px;
        padding: 24px;
        background: rgba(255, 250, 241, 0.98);
        color: #514538;
        box-shadow: 0 26px 60px rgba(35, 30, 24, 0.28);
        border: 1px solid rgba(255, 255, 255, 0.78);
      }

      .background-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
      }

      .background-modal-title {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
      }

      .background-modal-close {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: #75614f;
        color: white;
        font-size: 22px;
        font-weight: 900;
        cursor: pointer;
      }

      .background-section {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(117, 97, 79, 0.16);
      }

      .background-section-title {
        margin: 0 0 10px;
        font-size: 15px;
        font-weight: 900;
        color: #5d6b4f;
      }

      .background-color-row,
      .background-action-row,
      .background-preset-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .background-color-picker {
        width: 54px;
        height: 42px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        cursor: pointer;
      }

      .background-preset-btn {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.9);
        cursor: pointer;
        box-shadow: 0 8px 16px rgba(45, 42, 36, 0.16);
      }

      .background-file-input {
        width: 100%;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid rgba(117, 97, 79, 0.22);
        background: rgba(255, 255, 255, 0.55);
      }

      .background-preview {
        min-height: 120px;
        margin-top: 12px;
        border-radius: 18px;
        border: 1px dashed rgba(117, 97, 79, 0.28);
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        display: grid;
        place-items: center;
        color: #776858;
        font-weight: 700;
        overflow: hidden;
      }

      .background-action-row {
        justify-content: flex-end;
        margin-top: 20px;
      }

      .background-action-btn {
        border: 0;
        border-radius: 14px;
        padding: 11px 16px;
        font-weight: 900;
        cursor: pointer;
      }

      .background-action-btn.primary {
        background: #6f7d5b;
        color: white;
      }

      .background-action-btn.secondary {
        background: #ead6ba;
        color: #55483b;
      }

      .background-action-btn.danger {
        background: #8b6a55;
        color: white;
      }

      body.personal-bg-solid #messageArea {
        background-image: none !important;
        background-color: var(--personal-chat-bg-color, #fff8ec) !important;
      }

      body.personal-bg-image #messageArea {
        background-image:
          linear-gradient(rgba(255, 250, 241, 0.68), rgba(255, 250, 241, 0.68)),
          var(--personal-chat-bg-image) !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }
    `;

    document.head.appendChild(style);
  }

  function createButton() {
    if (document.getElementById('backgroundChangeBtn')) return;

    const button = document.createElement('button');
    button.id = 'backgroundChangeBtn';
    button.type = 'button';
    button.className = 'background-change-btn';
    button.textContent = text('背景', 'Background');

    const leaderboardBtn = document.getElementById('leaderboardBtn');

    if (leaderboardBtn && leaderboardBtn.parentElement) {
      leaderboardBtn.parentElement.insertBefore(button, leaderboardBtn);
    } else {
      document.body.appendChild(button);
    }

    button.addEventListener('click', openModal);
  }

  function createModal() {
    if (document.getElementById('backgroundChangeModal')) return;

    const modal = document.createElement('div');
    modal.id = 'backgroundChangeModal';
    modal.className = 'background-modal-backdrop hidden';

    modal.innerHTML = `
      <section class="background-modal-card">
        <header class="background-modal-header">
          <h2 id="backgroundModalTitle" class="background-modal-title"></h2>
          <button id="closeBackgroundModalBtn" type="button" class="background-modal-close">×</button>
        </header>

        <section class="background-section">
          <p id="solidColorTitle" class="background-section-title"></p>
          <div class="background-color-row">
            <input id="backgroundColorInput" class="background-color-picker" type="color" value="${DEFAULT_COLOR}">
            <button id="applySolidBackgroundBtn" type="button" class="background-action-btn primary"></button>
          </div>
        </section>

        <section class="background-section">
          <p id="presetColorTitle" class="background-section-title"></p>
          <div id="backgroundPresetRow" class="background-preset-row"></div>
        </section>

        <section class="background-section">
          <p id="imageBackgroundTitle" class="background-section-title"></p>
          <input id="backgroundImageInput" class="background-file-input" type="file" accept="image/*">
          <div id="backgroundPreview" class="background-preview"></div>
          <button id="applyImageBackgroundBtn" type="button" class="background-action-btn primary" style="margin-top: 12px;"></button>
        </section>

        <footer class="background-action-row">
          <button id="resetBackgroundBtn" type="button" class="background-action-btn danger"></button>
          <button id="cancelBackgroundBtn" type="button" class="background-action-btn secondary"></button>
        </footer>
      </section>
    `;

    document.body.appendChild(modal);

    document.getElementById('closeBackgroundModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBackgroundBtn').addEventListener('click', closeModal);
    document.getElementById('applySolidBackgroundBtn').addEventListener('click', applySelectedColor);
    document.getElementById('applyImageBackgroundBtn').addEventListener('click', applySelectedImage);
    document.getElementById('resetBackgroundBtn').addEventListener('click', resetBackground);
    document.getElementById('backgroundImageInput').addEventListener('change', previewSelectedImage);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    renderPresetColors();
    updateText();
  }

  function updateText() {
    const textMap = {
      backgroundChangeBtn: ['背景', 'Background'],
      backgroundModalTitle: ['更換背景', 'Change Background'],
      solidColorTitle: ['選擇純色背景', 'Choose a Solid Color'],
      presetColorTitle: ['快速選擇大地色', 'Earth Tone Presets'],
      imageBackgroundTitle: ['上傳圖片背景', 'Upload an Image Background'],
      applySolidBackgroundBtn: ['套用純色', 'Apply Color'],
      applyImageBackgroundBtn: ['套用圖片', 'Apply Image'],
      resetBackgroundBtn: ['恢復預設背景', 'Reset Background'],
      cancelBackgroundBtn: ['關閉', 'Close'],
    };

    Object.entries(textMap).forEach(([id, pair]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = text(pair[0], pair[1]);
    });

    const preview = document.getElementById('backgroundPreview');
    if (preview && !preview.style.backgroundImage) {
      preview.textContent = text('尚未選擇圖片', 'No image selected');
    }
  }

  function renderPresetColors() {
    const row = document.getElementById('backgroundPresetRow');
    if (!row || row.dataset.ready === 'true') return;

    presetColors.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'background-preset-btn';
      button.style.background = color;
      button.title = color;

      button.addEventListener('click', () => {
        const colorInput = document.getElementById('backgroundColorInput');
        if (colorInput) colorInput.value = color;
        applySolidBackground(color);
      });

      row.appendChild(button);
    });

    row.dataset.ready = 'true';
  }

  function applySolidBackground(color) {
    document.body.classList.remove('personal-bg-image');
    document.body.classList.add('personal-bg-solid');

    document.documentElement.style.setProperty('--personal-chat-bg-color', color);
    document.documentElement.style.removeProperty('--personal-chat-bg-image');

    localStorage.setItem(getStorageKey(), JSON.stringify({
      type: 'solid',
      color,
    }));
  }

  function applyImageBackground(imageData) {
    document.body.classList.remove('personal-bg-solid');
    document.body.classList.add('personal-bg-image');

    document.documentElement.style.setProperty('--personal-chat-bg-image', `url("${imageData}")`);
    document.documentElement.style.removeProperty('--personal-chat-bg-color');

    localStorage.setItem(getStorageKey(), JSON.stringify({
      type: 'image',
      imageData,
    }));
  }

  function applySelectedColor() {
    const input = document.getElementById('backgroundColorInput');
    applySolidBackground(input ? input.value : DEFAULT_COLOR);
  }

  function previewSelectedImage() {
    const input = document.getElementById('backgroundImageInput');
    const preview = document.getElementById('backgroundPreview');
    const file = input.files && input.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(text('請選擇圖片檔案。', 'Please select an image file.'));
      input.value = '';
      return;
    }

    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      alert(text('圖片不可超過 2MB。', 'The image must be under 2MB.'));
      input.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      selectedImageData = reader.result;
      preview.textContent = '';
      preview.style.backgroundImage = `url("${selectedImageData}")`;
    };

    reader.readAsDataURL(file);
  }

  function applySelectedImage() {
    if (!selectedImageData) {
      alert(text('請先選擇圖片。', 'Please choose an image first.'));
      return;
    }

    applyImageBackground(selectedImageData);
  }

  function resetBackground() {
    document.body.classList.remove('personal-bg-solid', 'personal-bg-image');
    document.documentElement.style.removeProperty('--personal-chat-bg-color');
    document.documentElement.style.removeProperty('--personal-chat-bg-image');
    localStorage.removeItem(getStorageKey());

    selectedImageData = '';

    const input = document.getElementById('backgroundImageInput');
    const preview = document.getElementById('backgroundPreview');

    if (input) input.value = '';

    if (preview) {
      preview.style.backgroundImage = '';
      preview.textContent = text('尚未選擇圖片', 'No image selected');
    }
  }

  function loadSavedBackground() {
    const saved = localStorage.getItem(getStorageKey());
    if (!saved) return;

    try {
      const setting = JSON.parse(saved);

      if (setting.type === 'solid' && setting.color) {
        applySolidBackground(setting.color);
      }

      if (setting.type === 'image' && setting.imageData) {
        applyImageBackground(setting.imageData);
      }
    } catch (error) {
      console.warn('背景設定讀取失敗，已恢復預設。', error);
      localStorage.removeItem(getStorageKey());
    }
  }

  function openModal() {
    updateText();
    document.getElementById('backgroundChangeModal').classList.remove('hidden');
  }

  function closeModal() {
    const modal = document.getElementById('backgroundChangeModal');
    if (modal) modal.classList.add('hidden');
  }

  function observeNicknameThenLoadBackground() {
    const nicknameElement = document.getElementById('currentNickname');

    if (!nicknameElement) {
      loadSavedBackground();
      return;
    }

    const observer = new MutationObserver(() => {
      loadSavedBackground();
    });

    observer.observe(nicknameElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    setTimeout(loadSavedBackground, 500);
  }

  function init() {
    injectStyle();
    createButton();
    createModal();
    observeNicknameThenLoadBackground();

    window.addEventListener('languageChanged', updateText);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();