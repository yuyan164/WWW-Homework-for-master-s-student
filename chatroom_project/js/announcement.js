/**
 * announcement.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室的公告功能。
 *
 * 主要功能：
 * 1. 每則訊息泡泡可設為公告。
 * 2. 公告會顯示在目前聊天室頂端。
 * 3. 點擊公告後，畫面會跳到原始訊息位置。
 * 4. 支援私人聊天室、群組聊天室與備忘錄。
 * 5. 私人聊天室與群組聊天室透過 Socket.io 同步公告。
 * 6. 備忘錄公告暫存在 localStorage。
 * 7. 支援 i18n.js 中英切換。
 *
 * 響應式修正：
 * 公告文字再長也不可以撐開聊天室版面。
 * 因此公告外層會建立 announcement-banner-shell，
 * 並強制 width / max-width / min-width / overflow 限制。
 * ------------------------------------------------------------
 */

(function setupAnnouncementModule() {
  if (window.AnnouncementModule) return;

  const MEMO_ANNOUNCEMENT_PREFIX = 'chatroom_memo_announcement_';

  let bannerShell = null;
  let banner = null;
  let bannerText = null;
  let messageArea = null;
  let chatHeaderElement = null;
  let translate = null;
  let getSocket = null;
  let getCurrentChat = null;
  let getCurrentUser = null;

  const announcements = new Map();

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function getCurrentUserName() {
    return typeof getCurrentUser === 'function' ? getCurrentUser() : 'guest';
  }

  function getChatKey(chat) {
    if (!chat) return 'none';

    if (chat.type === 'group') return 'group';
    if (chat.type === 'memo') return `memo::${getCurrentUserName()}`;
    if (chat.type === 'private') return `private::${chat.target}`;

    return 'none';
  }

  function getMemoStorageKey() {
    return `${MEMO_ANNOUNCEMENT_PREFIX}${getCurrentUserName()}`;
  }

  function injectStyle() {
    if (document.getElementById('announcementStyle')) return;

    const style = document.createElement('style');
    style.id = 'announcementStyle';

    style.textContent = `
      /*
       * =====================================================
       * 公告響應式版面修正
       * =====================================================
       * 重點：
       * 1. 任何裝公告的容器都要 min-width: 0。
       * 2. 公告外層 shell 限制寬度，避免長文字撐開主畫面。
       * 3. 公告文字只保留一行，超出自動變成 ...
       */

      .announcement-host {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      .announcement-banner-shell {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        display: block !important;
        margin-top: 8px;
      }

      .announcement-banner {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;

        display: flex;
        align-items: center;
        gap: 10px;

        padding: 10px 14px;
        border-radius: 16px;
        background: rgba(255, 250, 241, 0.96);
        border: 1px solid rgba(117, 97, 79, 0.12);
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.08);
        color: #5b4b3d;
        cursor: pointer;
      }

      .announcement-banner.hidden {
        display: none !important;
      }

      .announcement-icon {
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(232, 242, 220, 0.92);
        font-size: 15px;
      }

      .announcement-text {
        flex: 1 1 0;
        width: 0;
        min-width: 0;
        max-width: 100%;

        font-size: 14px;
        font-weight: 800;
        color: #5b4b3d;
        line-height: 1.3;

        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /*
       * 訊息泡泡上的設為公告按鈕
       */
      .message-bubble {
        position: relative;
      }

      .announcement-pin-btn {
        position: absolute;
        top: -9px;
        right: -9px;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(255, 250, 241, 0.98);
        color: #6f7d5b;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.14);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease, transform 0.16s ease;
      }

      .message-bubble:hover .announcement-pin-btn {
        opacity: 1;
        pointer-events: auto;
      }

      .announcement-pin-btn:hover {
        transform: scale(1.08);
        background: #fffaf1;
      }

      /*
       * 點公告跳轉後，原訊息短暫高亮
       */
      .message-row.announcement-jump-highlight .message-bubble {
        outline: 3px solid rgba(255, 193, 94, 0.86);
        box-shadow: 0 0 0 6px rgba(255, 193, 94, 0.18), 0 12px 26px rgba(45, 42, 36, 0.14);
      }

      /*
       * 小視窗時公告更緊湊，避免擠壓標題區。
       */
      @media (max-width: 760px) {
        .announcement-banner {
          padding: 8px 10px;
          gap: 8px;
        }

        .announcement-icon {
          flex-basis: 24px;
          width: 24px;
          height: 24px;
          font-size: 13px;
        }

        .announcement-text {
          font-size: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function forceSafeHeaderLayout() {
    if (!chatHeaderElement) return;

    /*
     * 強制標題區不要被公告或長文字撐開。
     */
    chatHeaderElement.classList.add('announcement-host');

    chatHeaderElement.style.width = '100%';
    chatHeaderElement.style.maxWidth = '100%';
    chatHeaderElement.style.minWidth = '0';
    chatHeaderElement.style.boxSizing = 'border-box';
    chatHeaderElement.style.overflow = 'hidden';

    /*
     * 再往上找幾層父容器，補上 min-width: 0。
     * 這可以處理 grid / flex 子元素預設 min-width:auto 導致撐開的問題。
     */
    let parent = chatHeaderElement.parentElement;
    let depth = 0;

    while (parent && depth < 5) {
      parent.style.minWidth = '0';
      parent.style.boxSizing = 'border-box';

      /*
       * 不直接對所有父層加 overflow:hidden，
       * 避免影響整個聊天室捲動；只處理 header 附近的寬度。
       */
      depth += 1;
      parent = parent.parentElement;
    }
  }

  function createBanner() {
    if (document.getElementById('announcementBanner')) {
      banner = document.getElementById('announcementBanner');
      bannerText = document.getElementById('announcementBannerText');
      bannerShell = document.getElementById('announcementBannerShell') || banner.parentElement;
      forceSafeHeaderLayout();
      return;
    }

    forceSafeHeaderLayout();

    bannerShell = document.createElement('div');
    bannerShell.id = 'announcementBannerShell';
    bannerShell.className = 'announcement-banner-shell';

    banner = document.createElement('div');
    banner.id = 'announcementBanner';
    banner.className = 'announcement-banner hidden';
    banner.title = t('jumpToAnnouncement');

    const icon = document.createElement('div');
    icon.className = 'announcement-icon';
    icon.textContent = '📌';

    bannerText = document.createElement('div');
    bannerText.id = 'announcementBannerText';
    bannerText.className = 'announcement-text';

    banner.append(icon, bannerText);
    bannerShell.appendChild(banner);

    banner.addEventListener('click', jumpToAnnouncement);

    if (chatHeaderElement) {
      chatHeaderElement.appendChild(bannerShell);
    } else {
      document.body.prepend(bannerShell);
    }
  }

  function getMessagePreview(message) {
    if (!message) return '';

    const text = typeof message.text === 'string' ? message.text.trim() : '';

    if (text) {
      return text;
    }

    if (message.imageData) {
      return t('announcementImage');
    }

    if (message.fileData) {
      return `${t('announcementFile')} ${message.fileData.fileName || ''}`.trim();
    }

    return '';
  }

  function normalizeAnnouncement(message) {
    const preview = getMessagePreview(message);

    if (!message || !preview) return null;

    return {
      messageId: message.id || '',
      from: message.from || '',
      text: preview,
      timestamp: message.timestamp || '',
      setAt: new Date().toISOString(),
    };
  }

  function buildAnnouncementDisplayText(announcement) {
    const name = (announcement.from || '').trim();
    const text = (announcement.text || '').trim();

    if (name && text) {
      return `${name} | ${text}`;
    }

    return name || text || '';
  }

  function updateBanner() {
    if (!banner || !bannerText) return;

    forceSafeHeaderLayout();

    const chat = typeof getCurrentChat === 'function' ? getCurrentChat() : null;
    const key = getChatKey(chat);
    const announcement = announcements.get(key);

    if (!announcement) {
      banner.classList.add('hidden');
      return;
    }

    bannerText.textContent = buildAnnouncementDisplayText(announcement);
    banner.title = t('jumpToAnnouncement');
    banner.classList.remove('hidden');
  }

  function jumpToAnnouncement() {
    const chat = typeof getCurrentChat === 'function' ? getCurrentChat() : null;
    const key = getChatKey(chat);
    const announcement = announcements.get(key);

    if (!announcement || !announcement.messageId || !messageArea) return;

    const rows = Array.from(messageArea.querySelectorAll('.message-row'));
    const targetRow = rows.find((row) => row.dataset.messageId === announcement.messageId);

    if (!targetRow) return;

    targetRow.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    targetRow.classList.add('announcement-jump-highlight');

    window.setTimeout(() => {
      targetRow.classList.remove('announcement-jump-highlight');
    }, 1600);
  }

  function setMemoAnnouncement(announcement) {
    const key = getChatKey({ type: 'memo' });

    announcements.set(key, announcement);
    localStorage.setItem(getMemoStorageKey(), JSON.stringify(announcement));
    updateBanner();
  }

  function loadMemoAnnouncement() {
    const raw = localStorage.getItem(getMemoStorageKey());

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      announcements.set(getChatKey({ type: 'memo' }), parsed);
    } catch (error) {
      localStorage.removeItem(getMemoStorageKey());
    }
  }

  function setAnnouncement(message) {
    const chat = typeof getCurrentChat === 'function' ? getCurrentChat() : null;
    const announcement = normalizeAnnouncement(message);

    if (!chat || !announcement) return;

    if (chat.type === 'memo') {
      setMemoAnnouncement(announcement);
      return;
    }

    const socket = typeof getSocket === 'function' ? getSocket() : null;

    if (!socket) {
      alert(t('announcementSetFailed'));
      return;
    }

    socket.emit(
      'setChatAnnouncement',
      {
        chatType: chat.type,
        target: chat.target || '',
        announcement,
      },
      (response = {}) => {
        if (!response.ok) {
          alert(t('announcementSetFailed'));
        }
      }
    );
  }

  function requestCurrentAnnouncement() {
    const chat = typeof getCurrentChat === 'function' ? getCurrentChat() : null;

    if (!chat || chat.type === 'none') {
        updateBanner();
        return;
    }

    const key = getChatKey(chat);

    /*
    * 先清除目前聊天室本地快取的公告。
    * 這樣切換聊天室或重新進群組時，不會先看到上一個聊天室的殘留公告。
    * 若 server 仍有有效公告，下面 request 回來後會再顯示。
    */
    if (chat.type === 'group' || chat.type === 'private') {
        announcements.delete(key);
        updateBanner();
    }

    if (chat.type === 'memo') {
        loadMemoAnnouncement();
        updateBanner();
        return;
    }

    const socket = typeof getSocket === 'function' ? getSocket() : null;

    if (!socket) {
        updateBanner();
        return;
    }

    socket.emit(
        'requestChatAnnouncement',
        {
        chatType: chat.type,
        target: chat.target || '',
        },
        (response = {}) => {
        if (!response.ok) {
            updateBanner();
            return;
        }

        handleAnnouncementUpdated({
            chatType: response.chatType,
            target: response.target || '',
            announcement: response.announcement || null,
        });
        }
    );
    }

  function handleAnnouncementUpdated(payload = {}) {
    const chatType = payload.chatType;
    const target = payload.target || '';
    const announcement = payload.announcement || null;

    let key = 'none';

    if (chatType === 'group') {
      key = 'group';
    } else if (chatType === 'private') {
      key = `private::${target}`;
    }

    if (announcement) {
      announcements.set(key, announcement);
    } else {
      announcements.delete(key);
    }

    updateBanner();
  }

  function prepareMessageRow(row, message) {
    if (!row || !message) return;
    if (message.type === 'system' || message.type === 'gameInvitation') return;

    row.dataset.messageId = message.id || '';

    const bubble = row.querySelector('.message-bubble');

    if (!bubble) return;

    if (bubble.querySelector('.announcement-pin-btn')) return;

    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'announcement-pin-btn';
    pinBtn.textContent = '📌';
    pinBtn.title = t('setAsAnnouncement');
    pinBtn.setAttribute('aria-label', t('setAsAnnouncement'));

    pinBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAnnouncement(message);
    });

    bubble.appendChild(pinBtn);
  }

  function updateText() {
    if (banner) {
      banner.title = t('jumpToAnnouncement');
    }

    document.querySelectorAll('.announcement-pin-btn').forEach((button) => {
      button.title = t('setAsAnnouncement');
      button.setAttribute('aria-label', t('setAsAnnouncement'));
    });

    updateBanner();
  }

  function init(config = {}) {
    messageArea = config.messageArea;
    chatHeaderElement = config.chatHeaderElement;
    translate = config.translate;
    getSocket = config.getSocket;
    getCurrentChat = config.getCurrentChat;
    getCurrentUser = config.getCurrentUser;

    injectStyle();
    createBanner();
    loadMemoAnnouncement();
    updateBanner();

    window.addEventListener('languageChanged', updateText);
    window.addEventListener('resize', updateBanner);
  }

  window.AnnouncementModule = {
    init,
    prepareMessageRow,
    requestCurrentAnnouncement,
    handleAnnouncementUpdated,
    updateBanner,
  };
})();