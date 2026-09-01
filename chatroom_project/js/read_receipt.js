/**
 * read_receipt.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室「已讀功能」。
 *
 * 主要功能：
 * 1. 私人聊天室已讀：對方點進聊天室後，自己送出的訊息旁顯示「已讀 / Read」。
 * 2. 群組聊天室已讀：其他使用者讀取群組訊息後，自己送出的群組訊息旁顯示「已讀 N / Read N」。
 * 3. 支援文字、emoji、圖片、圖片＋文字訊息。
 * 4. 負責通知 server 目前所在聊天室狀態。
 * 5. 負責接收 server 已讀事件後更新本地訊息資料。
 * 6. 負責建立已讀標籤 DOM 與注入已讀標籤 CSS。
 * ------------------------------------------------------------
 */

(function setupReadReceiptModule() {
  if (window.ReadReceipt) return;

  function getReadReceiptText(message) {
    const isEnglish =
      window.i18n &&
      window.i18n.getLanguage &&
      window.i18n.getLanguage() === 'en';

    if (message && message.type === 'private') {
      return isEnglish ? 'Read' : '已讀';
    }

    if (message && message.type === 'group') {
      const readCount = Array.isArray(message.readBy) ? message.readBy.length : 0;
      return isEnglish ? `Read ${readCount}` : `已讀 ${readCount}`;
    }

    return isEnglish ? 'Read' : '已讀';
  }

  function injectStyle() {
    if (document.getElementById('readReceiptStyle')) return;

    const style = document.createElement('style');
    style.id = 'readReceiptStyle';

    style.textContent = `
      /*
       * 已讀標籤樣式
       * 顯示位置：自己送出的訊息泡泡左側
       * 適用於私人聊天室與群組聊天室。
       */
      .message-row.mine {
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
        gap: 8px;
      }

      .message-row.mine .read-receipt {
        order: 1;
      }

      .message-row.mine .message-bubble {
        order: 2;
      }

      .read-receipt {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        max-width: 120px;
        padding: 4px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        color: #5d6b4f;
        background: rgba(232, 242, 220, 0.92);
        border: 1px solid rgba(111, 125, 91, 0.18);
        line-height: 1.3;
        white-space: nowrap;
        box-shadow: 0 6px 14px rgba(45, 42, 36, 0.08);
      }
    `;

    document.head.appendChild(style);
  }

  function createReadReceiptElement(message, isMine) {
    const shouldShowPrivateRead =
      isMine &&
      message.type === 'private' &&
      message.readAt;

    const shouldShowGroupRead =
      isMine &&
      message.type === 'group' &&
      Array.isArray(message.readBy) &&
      message.readBy.length > 0;

    if (!shouldShowPrivateRead && !shouldShowGroupRead) {
      return null;
    }

    const readReceipt = document.createElement('span');
    readReceipt.className = 'read-receipt';
    readReceipt.textContent = getReadReceiptText(message);

    if (message.type === 'group' && Array.isArray(message.readBy)) {
      readReceipt.title = message.readBy.join('、');
    }

    return readReceipt;
  }

  function markPrivateMessagesRead(context, partnerNickname) {
    if (!context.socket || !partnerNickname) return;

    context.socket.emit('markPrivateMessagesRead', {
      with: partnerNickname,
    });
  }

  function notifyServerActivePrivateChat(context, partnerNickname) {
    if (!context.socket || !partnerNickname) return;

    context.socket.emit('activePrivateChat', {
      with: partnerNickname,
    });

    markPrivateMessagesRead(context, partnerNickname);
  }

  function notifyServerLeavePrivateChat(context) {
    if (!context.socket) return;

    context.socket.emit('leavePrivateChat');
  }

  function notifyServerActiveGroupChat(context) {
    if (!context.socket) return;

    context.socket.emit('activeGroupChat');
  }

  function notifyServerLeaveGroupChat(context) {
    if (!context.socket) return;

    context.socket.emit('leaveGroupChat');
  }

  function applyPrivateReadReceipt(context, partnerNickname, messageIds, readAt) {
    if (!partnerNickname || !Array.isArray(messageIds)) return;

    const idSet = new Set(messageIds);
    const messages = context.getPrivateList(partnerNickname);

    messages.forEach((message) => {
      if (
        message.type === 'private' &&
        message.from === context.currentUser &&
        idSet.has(message.id)
      ) {
        message.readAt = readAt || new Date().toISOString();
      }
    });
  }

  function applyGroupReadReceipt(context, readerNickname, messageIds) {
    if (!readerNickname || !Array.isArray(messageIds)) return;

    const idSet = new Set(messageIds);

    context.groupMessages.forEach((message) => {
      if (
        message.type === 'group' &&
        message.from === context.currentUser &&
        idSet.has(message.id)
      ) {
        if (!Array.isArray(message.readBy)) {
          message.readBy = [];
        }

        if (!message.readBy.includes(readerNickname)) {
          message.readBy.push(readerNickname);
        }
      }
    });
  }

  window.ReadReceipt = {
    injectStyle,
    createReadReceiptElement,
    markPrivateMessagesRead,
    notifyServerActivePrivateChat,
    notifyServerLeavePrivateChat,
    notifyServerActiveGroupChat,
    notifyServerLeaveGroupChat,
    applyPrivateReadReceipt,
    applyGroupReadReceipt,
  };
})();