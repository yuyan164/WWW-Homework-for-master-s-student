/**
 * reply_message.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室「回覆訊息」功能。
 *
 * 主要功能：
 * 1. 點擊任一訊息泡泡後，將該訊息設定為目前要回覆的訊息。
 * 2. 在輸入框上方顯示正在回覆的訊息摘要。
 * 3. 送出新訊息時，將回覆資訊一起送出。
 * 4. 新訊息泡泡內會顯示「回覆某人的某段訊息」。
 * 5. 支援文字訊息、emoji、圖片訊息。
 * 6. 支援中英雙語。
 * ------------------------------------------------------------
 */

(function setupReplyMessageModule() {
  if (window.ReplyMessage) return;

  let selectedReply = null;
  let replyPreview = null;
  let replyPreviewText = null;
  let cancelReplyBtn = null;
  let messageInput = null;
  let translate = null;

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
    if (document.getElementById('replyMessageStyle')) return;

    const style = document.createElement('style');
    style.id = 'replyMessageStyle';

    style.textContent = `
      /*
       * 輸入框上方的回覆預覽列
       */
      .reply-preview-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 6px 0 8px;
        padding: 9px 12px;
        border-radius: 16px;
        background: rgba(232, 242, 220, 0.82);
        border: 1px solid rgba(111, 125, 91, 0.18);
        color: #5b4b3d;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.08);
      }

      .reply-preview-bar.hidden {
        display: none !important;
      }

      .reply-preview-content {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .reply-preview-title {
        font-size: 12px;
        font-weight: 900;
        color: #6f7d5b;
      }

      .reply-preview-text {
        max-width: 520px;
        font-size: 13px;
        font-weight: 700;
        color: #5b4b3d;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .reply-cancel-btn {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: rgba(117, 97, 79, 0.16);
        color: #5b4b3d;
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
      }

      .reply-cancel-btn:hover {
        background: rgba(117, 97, 79, 0.26);
      }

      /*
       * 訊息泡泡內的「回覆引用區」
       */
      .reply-quote {
        margin-bottom: 8px;
        padding: 8px 10px;
        border-left: 4px solid rgba(111, 125, 91, 0.52);
        border-radius: 10px;
        background: rgba(255, 250, 241, 0.58);
      }

      .reply-quote-title {
        margin-bottom: 3px;
        font-size: 12px;
        font-weight: 900;
        color: #6f7d5b;
      }

      .reply-quote-text {
        font-size: 13px;
        font-weight: 700;
        color: #5b4b3d;
        opacity: 0.88;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /*
       * 讓訊息泡泡看起來可以點擊回覆
       */
      .message-bubble {
        cursor: pointer;
      }
    `;

    document.head.appendChild(style);
  }

  function getMessagePreviewText(message) {
    if (!message) return '';

    const text = typeof message.text === 'string' ? message.text.trim() : '';

    if (text) {
      return text.length > 80 ? `${text.slice(0, 80)}...` : text;
    }

    if (message.imageData) {
      return t('replyImage');
    }

    return '';
  }

  function normalizeReplyFromMessage(message) {
    if (!message) return null;

    const previewText = getMessagePreviewText(message);

    if (!previewText) return null;

    return {
      messageId: message.id || '',
      from: message.from || '',
      text: previewText,
      hasImage: Boolean(message.imageData),
      timestamp: message.timestamp || '',
    };
  }

  function createPreviewUI() {
    if (document.getElementById('replyPreviewBar')) {
      replyPreview = document.getElementById('replyPreviewBar');
      replyPreviewText = document.getElementById('replyPreviewText');
      cancelReplyBtn = document.getElementById('cancelReplyBtn');
      return;
    }

    replyPreview = document.createElement('div');
    replyPreview.id = 'replyPreviewBar';
    replyPreview.className = 'reply-preview-bar hidden';

    const content = document.createElement('div');
    content.className = 'reply-preview-content';

    const title = document.createElement('div');
    title.id = 'replyPreviewTitle';
    title.className = 'reply-preview-title';

    replyPreviewText = document.createElement('div');
    replyPreviewText.id = 'replyPreviewText';
    replyPreviewText.className = 'reply-preview-text';

    cancelReplyBtn = document.createElement('button');
    cancelReplyBtn.id = 'cancelReplyBtn';
    cancelReplyBtn.type = 'button';
    cancelReplyBtn.className = 'reply-cancel-btn';
    cancelReplyBtn.textContent = '×';
    cancelReplyBtn.title = t('cancelReply');
    cancelReplyBtn.setAttribute('aria-label', t('cancelReply'));

    cancelReplyBtn.addEventListener('click', clearReply);

    content.append(title, replyPreviewText);
    replyPreview.append(content, cancelReplyBtn);

    /*
     * 嘗試把回覆預覽列放在輸入框上方。
     */
    const inputArea = messageInput.closest('.message-input-area, .input-area, .chat-input-area')
      || messageInput.parentElement;

    if (inputArea && inputArea.parentElement) {
      inputArea.parentElement.insertBefore(replyPreview, inputArea);
    } else {
      messageInput.insertAdjacentElement('beforebegin', replyPreview);
    }
  }

  function updatePreviewText() {
    if (!replyPreview || !selectedReply) return;

    const title = replyPreview.querySelector('#replyPreviewTitle');

    if (title) {
      title.textContent = t('replyingTo', {
        name: selectedReply.from || '',
      });
    }

    if (replyPreviewText) {
      replyPreviewText.textContent = selectedReply.text || '';
    }

    if (cancelReplyBtn) {
      cancelReplyBtn.title = t('cancelReply');
      cancelReplyBtn.setAttribute('aria-label', t('cancelReply'));
    }
  }

  function setReply(message) {
    const nextReply = normalizeReplyFromMessage(message);

    if (!nextReply) return;

    selectedReply = nextReply;
    updatePreviewText();
    replyPreview.classList.remove('hidden');

    if (messageInput) {
      messageInput.focus();
    }
  }

  function clearReply() {
    selectedReply = null;

    if (replyPreview) {
      replyPreview.classList.add('hidden');
    }
  }

  function getReplyPayload() {
    if (!selectedReply) return null;

    return {
      messageId: selectedReply.messageId,
      from: selectedReply.from,
      text: selectedReply.text,
      hasImage: selectedReply.hasImage,
      timestamp: selectedReply.timestamp,
    };
  }

  function createReplyQuoteElement(replyTo) {
    if (!replyTo) return null;

    const quote = document.createElement('div');
    quote.className = 'reply-quote';

    const title = document.createElement('div');
    title.className = 'reply-quote-title';
    title.textContent = t('replyTo', {
      name: replyTo.from || '',
    });

    const text = document.createElement('div');
    text.className = 'reply-quote-text';
    text.textContent = replyTo.text || (replyTo.hasImage ? t('replyImage') : '');

    quote.append(title, text);
    return quote;
  }

  function prepareMessageRow(row, message) {
    if (!row || !message) return;

    /*
     * 系統訊息與遊戲邀請不作為回覆目標。
     */
    if (message.type === 'system' || message.type === 'gameInvitation') return;

    const bubble = row.querySelector('.message-bubble');

    if (!bubble) return;

    bubble.addEventListener('click', (event) => {
      /*
       * 避免點擊圖片放大、按鈕等功能時誤觸回覆。
       */
      if (
        event.target.closest('button') ||
        event.target.closest('a') ||
        event.target.closest('.read-receipt')
      ) {
        return;
      }

      setReply(message);
    });
  }

  function init(config = {}) {
    messageInput = config.messageInput;
    translate = config.translate;

    injectStyle();
    createPreviewUI();

    window.addEventListener('languageChanged', () => {
      updatePreviewText();
    });
  }

  window.ReplyMessage = {
    init,
    prepareMessageRow,
    createReplyQuoteElement,
    getReplyPayload,
    clearReply,
  };
})();