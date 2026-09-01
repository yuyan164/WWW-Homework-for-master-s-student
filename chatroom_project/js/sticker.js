/**
 * sticker.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責「上傳表情包」功能。
 *
 * 主要功能：
 * 1. 使用 ⭐ 按鈕開啟表情包面板。
 * 2. 使用者可以上傳圖片作為表情包。
 * 3. 表情包只存在目前瀏覽器記憶體中，不存 localStorage、不存 SQLite。
 * 4. 使用者切換 memo、私人、群組聊天室時，都可以使用同一組表情包。
 * 5. 不同使用者、不同瀏覽器之間不共享表情包。
 * 6. 使用者重新整理、關閉頁面或登出後，表情包會消失。
 * ------------------------------------------------------------
 */

(function setupStickerModule() {
  if (window.StickerModule) return;

  const MAX_STICKER_SIZE = 2 * 1024 * 1024;

  let stickerBtn = null;
  let stickerInput = null;
  let emojiPanel = null;
  let panel = null;
  let translate = null;
  let onSendSticker = null;

  const stickers = [];

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function injectStyle() {
    if (document.getElementById('stickerStyle')) return;

    const style = document.createElement('style');
    style.id = 'stickerStyle';

    style.textContent = `
      .sticker-panel {
        width: min(460px, 100%);
        margin: 8px 0;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255, 250, 241, 0.96);
        border: 1px solid rgba(117, 97, 79, 0.18);
        box-shadow: 0 12px 26px rgba(72, 60, 45, 0.12);
      }

      .sticker-panel.hidden {
        display: none !important;
      }

      .sticker-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      .sticker-panel-title {
        font-weight: 900;
        color: #5b4b3d;
      }

      .sticker-add-btn {
        border: 0;
        border-radius: 999px;
        padding: 8px 12px;
        background: #6f7a5c;
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .sticker-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
      }

      .sticker-choice {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
        border: 1px solid rgba(117, 97, 79, 0.15);
        border-radius: 14px;
        background: rgba(219, 232, 204, 0.56);
        cursor: pointer;
        overflow: hidden;
      }

      .sticker-choice img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 4px;
      }

      .sticker-empty {
        padding: 12px;
        border-radius: 14px;
        background: rgba(219, 232, 204, 0.45);
        color: rgba(63, 58, 52, 0.65);
        font-weight: 800;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'stickerPanel';
    panel.className = 'sticker-panel hidden';

    if (emojiPanel && emojiPanel.parentNode) {
      emojiPanel.parentNode.insertBefore(panel, emojiPanel.nextSibling);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  function renderPanel() {
    const currentPanel = createPanel();

    currentPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'sticker-panel-header';

    const title = document.createElement('div');
    title.className = 'sticker-panel-title';
    title.textContent = t('stickerPanelTitle');

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sticker-add-btn';
    addBtn.textContent = `＋ ${t('addSticker')}`;

    addBtn.addEventListener('click', () => {
      if (stickerInput) {
        stickerInput.click();
      }
    });

    header.append(title, addBtn);
    currentPanel.appendChild(header);

    if (stickers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sticker-empty';
      empty.textContent = t('noSticker');
      currentPanel.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'sticker-grid';

    stickers.forEach((sticker) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sticker-choice';

      const img = document.createElement('img');
      img.src = sticker.imageData;
      img.alt = 'Sticker';

      button.appendChild(img);

      button.addEventListener('click', () => {
        if (typeof onSendSticker === 'function') {
          onSendSticker(sticker.imageData);
        }

        currentPanel.classList.add('hidden');
      });

      grid.appendChild(button);
    });

    currentPanel.appendChild(grid);
  }

  function togglePanel() {
    const currentPanel = createPanel();
    renderPanel();
    currentPanel.classList.toggle('hidden');
  }

  function handleStickerFileChange() {
    const file = stickerInput.files && stickerInput.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('stickerOnly'));
      stickerInput.value = '';
      return;
    }

    if (file.size > MAX_STICKER_SIZE) {
      alert(t('stickerTooLarge'));
      stickerInput.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      stickers.push({
        id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        imageData: reader.result,
      });

      stickerInput.value = '';
      renderPanel();

      if (panel) {
        panel.classList.remove('hidden');
      }
    };

    reader.readAsDataURL(file);
  }

  function updateText() {
    if (stickerBtn) {
      stickerBtn.title = t('sticker');
      stickerBtn.setAttribute('aria-label', t('sticker'));
    }

    if (panel && !panel.classList.contains('hidden')) {
      renderPanel();
    }
  }

  function init(config = {}) {
    stickerBtn = config.stickerBtn;
    stickerInput = config.stickerInput;
    emojiPanel = config.emojiPanel;
    translate = config.translate;
    onSendSticker = config.onSendSticker;

    if (!stickerBtn || !stickerInput) return;

    injectStyle();
    createPanel();
    renderPanel();

    stickerBtn.addEventListener('click', togglePanel);
    stickerInput.addEventListener('change', handleStickerFileChange);
    window.addEventListener('languageChanged', updateText);

    updateText();
  }

  window.StickerModule = {
    init,
  };
})();