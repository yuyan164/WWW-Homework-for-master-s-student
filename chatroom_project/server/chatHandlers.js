/**
 * server/chatHandlers.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室相關 Socket.io 事件。
 *
 * 主要功能：
 * 1. 群組聊天室加入
 * 2. 私人訊息
 * 3. 群組訊息
 * 4. typing indicator
 * 5. 私人訊息已讀
 * 6. 群組訊息已讀
 * 7. 聊天室公告
 * 8. 群組聊天室無人時清空群組紀錄
 * 9. 使用者離線時清除相關私人聊天紀錄
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

const {
  recordChatMessage,
  deleteGroupChatMessages,
  deletePrivateChatMessages,
} = require('../db');

const {
  usersBySocketId,
  socketIdByNickname,
  privateMessages,
  chatAnnouncements,
} = require('./state');

const {
  nowIso,
  safeText,
  safeImageData,
  privateRoomKey,
  makeSystemMessage,
  makeId,
} = require('./utils');

const {
  safeFileData,
} = require('./uploadHandlers');

const {
  emitToNickname,
  getUserByNickname,
} = require('./game/gameUtils');

/*
 * 群組聊天室訊息紀錄：
 * 用來支援群組已讀、公告存在性檢查、群組無人時清除。
 *
 * 注意：
 * 這裡是 server 記憶體暫存。
 * SQLite 下載紀錄會由 db.js 的 chat_messages 資料表處理。
 */
const groupMessages = [];

/**
 * 儲存聊天訊息到 SQLite。
 */
function saveChatMessageToDatabase(message) {
  recordChatMessage({
    messageId: message.id,
    chatType: message.type,
    sender: message.from,
    receiver: message.to || null,
    text: message.text || '',
    imageData: message.imageData || '',
    timestamp: message.timestamp,
  }).catch((error) => {
    console.error('Failed to save chat message:', error);
  });
}

/**
 * 整理前端傳來的 replyTo。
 */
function safeReplyTo(replyTo) {
  if (!replyTo || typeof replyTo !== 'object') return null;

  const messageId = safeText(replyTo.messageId);
  const from = safeText(replyTo.from);
  const text = safeText(replyTo.text).slice(0, 120);
  const hasImage = Boolean(replyTo.hasImage);
  const hasFile = Boolean(replyTo.hasFile);
  const timestamp = safeText(replyTo.timestamp).slice(0, 60);

  if (!messageId && !text && !hasImage && !hasFile) return null;

  return {
    messageId,
    from,
    text,
    hasImage,
    hasFile,
    timestamp,
  };
}

/**
 * 建立公告 room key。
 */
function announcementRoomKey(chatType, currentUser, target) {
  if (chatType === 'group') return 'group';

  if (chatType === 'private') {
    return `private::${privateRoomKey(currentUser, target)}`;
  }

  return 'none';
}

/**
 * 整理公告資料。
 */
function safeAnnouncement(announcement) {
  if (!announcement || typeof announcement !== 'object') return null;

  const messageId = safeText(announcement.messageId);
  const from = safeText(announcement.from);
  const text = safeText(announcement.text).slice(0, 160);
  const timestamp = safeText(announcement.timestamp).slice(0, 60);
  const setAt = safeText(announcement.setAt).slice(0, 60) || nowIso();

  if (!messageId || !text) return null;

  return {
    messageId,
    from,
    text,
    timestamp,
    setAt,
  };
}

/**
 * 取得群組目前還有幾位成員。
 */
function getGroupMemberCount(excludingSocketId = '') {
  return Array.from(usersBySocketId.values()).filter((user) => (
    user.joinedGroup &&
    user.socketId !== excludingSocketId
  )).length;
}

/**
 * 群組無人時清空群組資料。
 */
async function clearGroupDataIfGroupEmpty(io, excludingSocketId = '') {
  const remainingGroupMembers = getGroupMemberCount(excludingSocketId);

  if (remainingGroupMembers > 0) return;

  chatAnnouncements.delete('group');
  groupMessages.length = 0;

  if (typeof deleteGroupChatMessages === 'function') {
    try {
      await deleteGroupChatMessages();
      console.log('Group chat messages have been cleared because the group is empty.');
    } catch (error) {
      console.error('Failed to clear group chat messages:', error);
    }
  }

  io.emit('chatAnnouncementUpdated', {
    chatType: 'group',
    target: '',
    announcement: null,
  });
}

/**
 * 標記私人訊息已讀。
 */
function markPrivateMessagesAsRead(readerNickname, partnerNickname) {
  const roomKey = privateRoomKey(readerNickname, partnerNickname);
  const messages = privateMessages.get(roomKey) || [];
  const readAt = nowIso();
  const messageIds = [];

  messages.forEach((message) => {
    if (
      message.type === 'private' &&
      message.from === partnerNickname &&
      message.to === readerNickname &&
      !message.readAt
    ) {
      message.readAt = readAt;
      messageIds.push(message.id);
    }
  });

  return {
    messageIds,
    readAt,
  };
}

/**
 * 標記群組訊息已讀。
 */
function markGroupMessagesAsRead(readerNickname) {
  const readAt = nowIso();
  const readMessageIdsBySender = new Map();

  groupMessages.forEach((message) => {
    if (message.type !== 'group') return;
    if (message.from === readerNickname) return;

    if (!Array.isArray(message.readBy)) {
      message.readBy = [];
    }

    if (message.readBy.includes(readerNickname)) return;

    message.readBy.push(readerNickname);

    if (!readMessageIdsBySender.has(message.from)) {
      readMessageIdsBySender.set(message.from, []);
    }

    readMessageIdsBySender.get(message.from).push(message.id);
  });

  return {
    readAt,
    readMessageIdsBySender,
  };
}

/**
 * 通知群組訊息發送者：哪些訊息被誰讀了。
 */
function notifyGroupMessagesRead(io, readerNickname) {
  const {
    readAt,
    readMessageIdsBySender,
  } = markGroupMessagesAsRead(readerNickname);

  readMessageIdsBySender.forEach((messageIds, senderNickname) => {
    if (messageIds.length === 0) return;

    emitToNickname(io, senderNickname, 'groupMessagesRead', {
      reader: readerNickname,
      messageIds,
      readAt,
    });
  });
}

/**
 * 使用者離線時清除相關私人聊天紀錄。
 */
async function clearPrivateHistoriesForUser(io, leavingNickname) {
  for (const roomKey of Array.from(privateMessages.keys())) {
    const [a, b] = roomKey.split('::');

    if (a !== leavingNickname && b !== leavingNickname) continue;

    privateMessages.delete(roomKey);

    if (typeof deletePrivateChatMessages === 'function') {
      try {
        await deletePrivateChatMessages(a, b);
        console.log(`Private chat messages have been cleared: ${a} / ${b}`);
      } catch (error) {
        console.error('Failed to clear private chat messages:', error);
      }
    }

    const otherNickname = a === leavingNickname ? b : a;

    emitToNickname(io, otherNickname, 'privateHistoryCleared', {
      nickname: leavingNickname,
      timestamp: nowIso(),
    });

    chatAnnouncements.delete(`private::${privateRoomKey(a, b)}`);
  }
}

/**
 * 註冊聊天室 Socket 事件。
 */
function registerChatSocketHandlers(io, socket, options = {}) {
  const showGroupTyping = options.showGroupTyping !== false;
  const broadcastOnlineUsers = options.broadcastOnlineUsers;

  socket.on('joinGroup', () => {
    const user = usersBySocketId.get(socket.id);

    if (!user || user.joinedGroup) return;

    user.joinedGroup = true;
    user.activePrivateTarget = null;

    socket.join('group');

    io.to('group').emit('groupSystem', makeSystemMessage('joinedGroup', {
      nickname: user.nickname,
    }));

    if (typeof broadcastOnlineUsers === 'function') {
      broadcastOnlineUsers();
    }
  });

  socket.on('privateMessage', (payload = {}) => {
    const sender = usersBySocketId.get(socket.id);

    if (!sender) return;

    const to = safeText(payload.to);
    const text = safeText(payload.text);
    const imageData = safeImageData(payload.imageData);
    const fileData = safeFileData(payload.fileData);
    const replyTo = safeReplyTo(payload.replyTo);

    if (!to || (!text && !imageData && !fileData)) return;

    if (!socketIdByNickname.has(to)) {
      socket.emit('messageError', {
        messageKey: 'userOffline',
      });
      return;
    }

    const roomKey = privateRoomKey(sender.nickname, to);
    const receiverUser = getUserByNickname(to);
    const receiverIsViewingThisChat =
      receiverUser && receiverUser.activePrivateTarget === sender.nickname;

    const messageTime = nowIso();

    const message = {
      id: makeId('private'),
      type: 'private',
      from: sender.nickname,
      to,
      text,
      imageData,
      timestamp: messageTime,
      readAt: receiverIsViewingThisChat ? messageTime : null,
      replyTo,
      fileData,
    };

    if (!privateMessages.has(roomKey)) {
      privateMessages.set(roomKey, []);
    }

    privateMessages.get(roomKey).push(message);

    saveChatMessageToDatabase(message);

    emitToNickname(io, sender.nickname, 'privateMessage', message);
    emitToNickname(io, to, 'privateMessage', message);

    /*
     * 如果接收者原本就在該私人聊天室，
     * 發送者也要立即收到已讀通知，讓已讀標籤即時出現。
     */
    if (receiverIsViewingThisChat) {
      emitToNickname(io, sender.nickname, 'privateMessagesRead', {
        reader: to,
        messageIds: [message.id],
        readAt: messageTime,
      });
    }
  });

  socket.on('groupMessage', (payload = {}) => {
    const sender = usersBySocketId.get(socket.id);

    if (!sender || !sender.joinedGroup) return;

    const text = safeText(payload.text);
    const imageData = safeImageData(payload.imageData);
    const fileData = safeFileData(payload.fileData);
    const replyTo = safeReplyTo(payload.replyTo);

    if (!text && !imageData && !fileData) return;

    const messageTime = nowIso();

    const activeReaders = Array.from(usersBySocketId.values())
      .filter((user) => (
        user.nickname !== sender.nickname &&
        user.joinedGroup &&
        user.activeGroupChat
      ))
      .map((user) => user.nickname);

    const message = {
      id: makeId('group'),
      type: 'group',
      from: sender.nickname,
      text,
      imageData,
      timestamp: messageTime,
      readBy: activeReaders,
      replyTo,
      fileData,
    };

    groupMessages.push(message);

    saveChatMessageToDatabase(message);

    io.to('group').emit('groupMessage', message);
  });

  socket.on('typing', (payload = {}) => {
    const sender = usersBySocketId.get(socket.id);

    if (!sender) return;

    const isTyping = Boolean(payload.isTyping);
    const chatType = payload.chatType;

    if (chatType === 'private') {
      const to = safeText(payload.to);

      if (!to || !socketIdByNickname.has(to)) return;

      emitToNickname(io, to, 'privateTyping', {
        from: sender.nickname,
        isTyping,
      });

      return;
    }

    if (chatType === 'group' && showGroupTyping) {
      if (!sender.joinedGroup) return;

      socket.to('group').emit('groupTyping', {
        from: sender.nickname,
        isTyping,
      });
    }
  });

  socket.on('activePrivateChat', (payload = {}) => {
    const reader = usersBySocketId.get(socket.id);

    if (!reader) return;

    const partnerNickname = safeText(payload.with);

    if (!partnerNickname) return;

    reader.activePrivateTarget = partnerNickname;
    reader.activeGroupChat = false;

    const {
      messageIds,
      readAt,
    } = markPrivateMessagesAsRead(reader.nickname, partnerNickname);

    if (messageIds.length === 0) return;

    emitToNickname(io, partnerNickname, 'privateMessagesRead', {
      reader: reader.nickname,
      messageIds,
      readAt,
    });
  });

  socket.on('leavePrivateChat', () => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    user.activePrivateTarget = null;
  });

  socket.on('activeGroupChat', () => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    user.activeGroupChat = true;
    user.activePrivateTarget = null;

    notifyGroupMessagesRead(io, user.nickname);
  });

  socket.on('leaveGroupChat', () => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    user.activeGroupChat = false;
  });

  socket.on('markPrivateMessagesRead', (payload = {}) => {
    const reader = usersBySocketId.get(socket.id);

    if (!reader) return;

    const partnerNickname = safeText(payload.with);

    if (!partnerNickname) return;

    const {
      messageIds,
      readAt,
    } = markPrivateMessagesAsRead(reader.nickname, partnerNickname);

    if (messageIds.length === 0) return;

    emitToNickname(io, partnerNickname, 'privateMessagesRead', {
      reader: reader.nickname,
      messageIds,
      readAt,
    });
  });

  socket.on('markGroupMessagesRead', () => {
    const reader = usersBySocketId.get(socket.id);

    if (!reader) return;

    notifyGroupMessagesRead(io, reader.nickname);
  });

  socket.on('setChatAnnouncement', (payload = {}, callback) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) {
      if (typeof callback === 'function') callback({ ok: false });
      return;
    }

    const chatType = safeText(payload.chatType);
    const target = safeText(payload.target);
    const announcement = safeAnnouncement(payload.announcement);

    if (!announcement) {
      if (typeof callback === 'function') callback({ ok: false });
      return;
    }

    if (chatType === 'group') {
      const key = announcementRoomKey('group', user.nickname, '');

      chatAnnouncements.set(key, announcement);

      io.to('group').emit('chatAnnouncementUpdated', {
        chatType: 'group',
        target: '',
        announcement,
      });

      if (typeof callback === 'function') callback({ ok: true });
      return;
    }

    if (chatType === 'private') {
      if (!target || !socketIdByNickname.has(target)) {
        if (typeof callback === 'function') callback({ ok: false });
        return;
      }

      const key = announcementRoomKey('private', user.nickname, target);

      chatAnnouncements.set(key, announcement);

      emitToNickname(io, user.nickname, 'chatAnnouncementUpdated', {
        chatType: 'private',
        target,
        announcement,
      });

      emitToNickname(io, target, 'chatAnnouncementUpdated', {
        chatType: 'private',
        target: user.nickname,
        announcement,
      });

      if (typeof callback === 'function') callback({ ok: true });
      return;
    }

    if (typeof callback === 'function') callback({ ok: false });
  });

  socket.on('requestChatAnnouncement', (payload = {}, callback) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) {
      if (typeof callback === 'function') callback({ ok: false });
      return;
    }

    const chatType = safeText(payload.chatType);
    const target = safeText(payload.target);

    if (chatType === 'group') {
      const key = announcementRoomKey('group', user.nickname, '');
      const announcement = chatAnnouncements.get(key) || null;

      const announcementMessageStillExists = announcement
        ? groupMessages.some((message) => message.id === announcement.messageId)
        : false;

      if (announcement && !announcementMessageStillExists) {
        chatAnnouncements.delete(key);
      }

      if (typeof callback === 'function') {
        callback({
          ok: true,
          chatType: 'group',
          target: '',
          announcement: announcementMessageStillExists ? announcement : null,
        });
      }

      return;
    }

    if (chatType === 'private') {
      const key = announcementRoomKey('private', user.nickname, target);
      const announcement = chatAnnouncements.get(key) || null;
      const roomKey = privateRoomKey(user.nickname, target);
      const messages = privateMessages.get(roomKey) || [];

      const announcementMessageStillExists = announcement
        ? messages.some((message) => message.id === announcement.messageId)
        : false;

      if (announcement && !announcementMessageStillExists) {
        chatAnnouncements.delete(key);
      }

      if (typeof callback === 'function') {
        callback({
          ok: true,
          chatType: 'private',
          target,
          announcement: announcementMessageStillExists ? announcement : null,
        });
      }

      return;
    }

    if (typeof callback === 'function') {
      callback({
        ok: false,
      });
    }
  });
}

function getGroupMessages() {
  return groupMessages;
}

function clearGroupMessages() {
  groupMessages.length = 0;
}

module.exports = {
  registerChatSocketHandlers,

  groupMessages,
  getGroupMessages,
  clearGroupMessages,

  saveChatMessageToDatabase,
  safeReplyTo,
  safeAnnouncement,
  announcementRoomKey,

  markPrivateMessagesAsRead,
  markGroupMessagesAsRead,
  notifyGroupMessagesRead,

  getGroupMemberCount,
  clearGroupDataIfGroupEmpty,
  clearPrivateHistoriesForUser,
};