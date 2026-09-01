/**
 * emoji_panel.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室 emoji 面板。
 *
 * 主要功能：
 * 1. 建立 emoji 按鈕。
 * 2. 點選 emoji 後插入到訊息輸入框游標位置。
 * 3. 插入 emoji 後通知主流程觸發 typing 狀態。
 * ------------------------------------------------------------
 */

(function setupEmojiPanelModule() {
  if (window.EmojiPanel) return;

  const emojis = [
    '😊', '😂', '🤣', '😍', '🥺', '😭', '😎', '😜',
    '👍', '❤️', '🔥', '✨', '🎉', '🎁', '🙏', '💪',
    '🤔', '😳', '😴', '😆', '😇', '🥳', '🥹', '💩',
  ];

  function insertEmoji(input, emoji, onInsert) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;

    input.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;

    if (typeof onInsert === 'function') {
      onInsert();
    }
  }

  function render(config) {
    const emojiPanel = config.emojiPanel;
    const messageInput = config.messageInput;
    const onInsert = config.onInsert;

    emojiPanel.innerHTML = '';

    emojis.forEach((emoji) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'emoji-choice';
      button.textContent = emoji;

      button.addEventListener('click', () => {
        insertEmoji(messageInput, emoji, onInsert);
      });

      emojiPanel.appendChild(button);
    });
  }

  function bindToggle(emojiBtn, emojiPanel) {
    emojiBtn.addEventListener('click', () => {
      emojiPanel.classList.toggle('hidden');
    });
  }

  window.EmojiPanel = {
    render,
    bindToggle,
  };
})();