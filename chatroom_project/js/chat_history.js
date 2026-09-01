/**
 * chat_history.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室紀錄下載功能。
 *
 * 主要功能：
 * 1. 在聊天框上方自動建立「下載聊天紀錄」按鈕。
 * 2. 根據目前所在聊天室，下載當前聊天室紀錄。
 * 3. 支援私人聊天室與群組聊天室。
 * 4. 下載格式為 HTML 檔案，並由 server.js 產生美編後的 HTML。
 * 5. 本檔案只處理前端按鈕與下載事件，不處理資料庫儲存。
 *
 * 修正重點：
 * 若同一個瀏覽器同時登入兩個使用者，Express session cookie 可能被後登入者覆蓋。
 * 因此下載聊天紀錄時，會額外帶上 owner=目前頁面使用者，
 * 讓 server.js 可以正確知道是哪一個使用者按下下載。
 * ------------------------------------------------------------
 */

(function setupChatHistoryModule() {
  if (window.ChatHistoryModule) return;

  let downloadBtn = null;
  let getCurrentChat = null;
  let getCurrentUser = null;
  let translate = null;

  function getText(key) {
    /*
     * 優先使用 index.js 傳進來的 t() 函式。
     * 若沒有傳入，則改用 window.i18n.t()。
     * 若兩者都不存在，才使用最後的預設文字。
     */
    if (typeof translate === 'function') {
      return translate(key);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key);
    }

    const fallbackText = {
      downloadChatHistory: '下載聊天紀錄',
      selectChatFirst: '請先選擇聊天室。',
    };

    return fallbackText[key] || key;
  }

  function injectStyle() {
    if (document.getElementById('chatHistoryStyle')) return;

    const style = document.createElement('style');
    style.id = 'chatHistoryStyle';

    style.textContent = `
      /*
       * 聊天紀錄下載按鈕樣式
       */
      .chat-history-download-btn {
        border: 0;
        border-radius: 14px;
        padding: 8px 13px;
        background: rgba(255, 250, 241, 0.9);
        color: #5b4b3d;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.10);
        transition: transform 0.18s ease, background 0.18s ease;
      }

      .chat-history-download-btn:hover {
        transform: translateY(-1px);
        background: rgba(255, 250, 241, 1);
      }

      .chat-history-download-btn:disabled {
        opacity: 0.48;
        cursor: not-allowed;
        transform: none;
      }
    `;

    document.head.appendChild(style);
  }

  function createButton(config) {
    if (document.getElementById('downloadChatHistoryBtn')) {
      downloadBtn = document.getElementById('downloadChatHistoryBtn');
      return;
    }

    downloadBtn = document.createElement('button');
    downloadBtn.id = 'downloadChatHistoryBtn';
    downloadBtn.type = 'button';
    downloadBtn.className = 'chat-history-download-btn';
    downloadBtn.textContent = getText('downloadChatHistory');

    /*
     * 嘗試將按鈕放到聊天室標題列。
     * 若找不到合適位置，就放在聊天室訊息區上方。
     */
    const chatTargetName = document.getElementById('chatTargetName');
    const messageArea = document.getElementById('messageArea');

    if (chatTargetName && chatTargetName.parentElement) {
      chatTargetName.parentElement.appendChild(downloadBtn);
    } else if (messageArea && messageArea.parentElement) {
      messageArea.parentElement.insertBefore(downloadBtn, messageArea);
    } else {
      document.body.appendChild(downloadBtn);
    }

    downloadBtn.addEventListener('click', downloadCurrentChatHistory);

    updateButtonState();
  }

  function updateButtonText() {
    if (!downloadBtn) return;
    downloadBtn.textContent = getText('downloadChatHistory');
  }

  function updateButtonState() {
    if (!downloadBtn || typeof getCurrentChat !== 'function') return;

    const currentChat = getCurrentChat();

    const canDownload =
      currentChat &&
      (
        currentChat.type === 'group' ||
        (currentChat.type === 'private' && currentChat.target)
      );

    downloadBtn.disabled = !canDownload;
  }

  function getOwnerQueryString() {
    /*
     * 從 index.js 傳入目前頁面的 currentUser。
     * 這可以避免同一個瀏覽器開兩個帳號時，
     * server.js 的 session cookie 被後登入者覆蓋。
     */
    const currentUser = typeof getCurrentUser === 'function'
      ? getCurrentUser()
      : '';

    return `owner=${encodeURIComponent(currentUser || '')}`;
  }

  function downloadCurrentChatHistory() {
    if (typeof getCurrentChat !== 'function') return;

    const currentChat = getCurrentChat();

    if (!currentChat || currentChat.type === 'none') {
      alert(getText('selectChatFirst'));
      return;
    }

    const ownerQuery = getOwnerQueryString();
    let url = '';

    if (currentChat.type === 'group') {
      url = `/api/chat-history/download?type=group&${ownerQuery}`;
    } else if (currentChat.type === 'private' && currentChat.target) {
      url = `/api/chat-history/download?type=private&target=${encodeURIComponent(currentChat.target)}&${ownerQuery}`;
    } else {
      alert(getText('selectChatFirst'));
      return;
    }

    /*
     * 使用 window.location.href 觸發檔案下載。
     */
    window.location.href = url;
  }

  function init(config) {
    getCurrentChat = config.getCurrentChat;
    getCurrentUser = config.getCurrentUser;
    translate = config.translate;

    injectStyle();
    createButton(config);

    window.addEventListener('languageChanged', () => {
      updateButtonText();
    });
  }

  window.ChatHistoryModule = {
    init,
    updateButtonState,
    downloadCurrentChatHistory,
  };
})();