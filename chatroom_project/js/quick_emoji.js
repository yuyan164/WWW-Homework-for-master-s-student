/**
 * quick_emoji.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責「快捷表情」功能。
 *
 * 規則：
 * 1. 快捷表情只存在目前瀏覽器記憶體。
 * 2. 不存 localStorage、不寫入 SQLite。
 * 3. 切換 memo、私人、群組聊天室時共用。
 * 4. 最多顯示 8 個。
 * 5. 如果點到已存在的 emoji，不改變它的位置。
 * 6. 如果點到新的 emoji，會放在最後方。
 * 7. 超過 8 個時，刪除最早出現的 emoji。
 * ------------------------------------------------------------
 */

(function setupQuickEmojiModule() {
  if (window.QuickEmojiModule) return;

  const MAX_QUICK_EMOJIS = 8;

  let emojiPanel = null;
  let messageInput = null;
  let translate = null;
  let onInsert = null;
  let quickBar = null;

  const quickEmojis = [];

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
    if (document.getElementById('quickEmojiStyle')) return;

    const style = document.createElement('style');
    style.id = 'quickEmojiStyle';

    style.textContent = `
      .quick-emoji-bar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 8px 0;
      }

      .quick-emoji-bar:empty {
        display: none;
      }

      .quick-emoji-btn {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(117, 97, 79, 0.16);
        border-radius: 12px;
        background: rgba(219, 232, 204, 0.78);
        font-size: 20px;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      }

      .quick-emoji-btn:hover {
        transform: translateY(-1px);
        background: rgba(219, 232, 204, 0.95);
      }
    `;

    document.head.appendChild(style);
  }

  function createQuickBar() {
    if (quickBar) return quickBar;

    quickBar = document.getElementById('quickEmojiBar');

    if (!quickBar) {
      quickBar = document.createElement('div');
      quickBar.id = 'quickEmojiBar';
      quickBar.className = 'quick-emoji-bar';

      if (emojiPanel && emojiPanel.parentNode) {
        emojiPanel.parentNode.insertBefore(quickBar, emojiPanel);
      } else {
        document.body.appendChild(quickBar);
      }
    }

    quickBar.setAttribute('aria-label', t('quickEmoji'));

    return quickBar;
  }

  function renderQuickBar() {
    const bar = createQuickBar();
    bar.innerHTML = '';

    quickEmojis.forEach((emoji) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-emoji-btn';
      button.textContent = emoji;
      button.title = t('quickEmoji');
      button.setAttribute('aria-label', `${t('quickEmoji')} ${emoji}`);

      button.addEventListener('click', () => {
        insertEmoji(emoji);
      });

      bar.appendChild(button);
    });
  }

  function recordEmoji(emoji) {
    if (!emoji) return;

    /*
     * 如果已經存在，不移動位置。
     */
    if (quickEmojis.includes(emoji)) {
      renderQuickBar();
      return;
    }

    /*
     * 新 emoji 放在最後方。
     */
    quickEmojis.push(emoji);

    /*
     * 超過 8 個時，刪除最早出現的。
     */
    while (quickEmojis.length > MAX_QUICK_EMOJIS) {
      quickEmojis.shift();
    }

    renderQuickBar();
  }

  function insertEmoji(emoji) {
    if (!messageInput) return;

    const start = messageInput.selectionStart || 0;
    const end = messageInput.selectionEnd || 0;
    const value = messageInput.value || '';

    messageInput.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;

    recordEmoji(emoji);

    if (typeof onInsert === 'function') {
      onInsert(emoji);
    }
  }

  function bindEmojiPanel() {
    if (!emojiPanel) return;

    emojiPanel.addEventListener('click', (event) => {
      const button = event.target.closest('.emoji-choice');
      if (!button) return;

      const emoji = button.textContent.trim();
      if (!emoji) return;

      recordEmoji(emoji);
    });
  }

  function updateText() {
    if (quickBar) {
      quickBar.setAttribute('aria-label', t('quickEmoji'));
    }

    renderQuickBar();
  }

  function init(config = {}) {
    emojiPanel = config.emojiPanel;
    messageInput = config.messageInput;
    translate = config.translate;
    onInsert = config.onInsert;

    injectStyle();
    createQuickBar();
    bindEmojiPanel();
    renderQuickBar();

    window.addEventListener('languageChanged', updateText);
  }

  window.QuickEmojiModule = {
    init,
    recordEmoji,
  };
})();