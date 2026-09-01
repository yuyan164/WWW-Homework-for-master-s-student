/**
 * server/socketHandlers.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責 Socket.io 連線主流程。
 *
 * 主要功能：
 * 1. 驗證使用者是否已登入
 * 2. 同 nickname 新 socket 接管舊 socket
 * 3. 建立線上使用者狀態
 * 4. 發送 loginReady
 * 5. 廣播線上使用者清單
 * 6. 註冊聊天室事件
 * 7. 註冊大頭貼事件
 * 8. 註冊遊戲事件
 * 9. 處理 disconnect
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

const {
  usersBySocketId,
  socketIdByNickname,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
} = require('./state');

const {
  nowIso,
  makeSystemMessage,
} = require('./utils');

const {
  registerChatSocketHandlers,
  clearGroupDataIfGroupEmpty,
  clearPrivateHistoriesForUser,
} = require('./chatHandlers');

const {
  registerAvatarSocketHandlers,
  DEFAULT_AVATAR_URL,
} = require('./uploadHandlers');

/**
 * 廣播目前線上使用者清單。
 */
function broadcastOnlineUsers(io) {
  io.emit('onlineUsers', {
    count: usersBySocketId.size,
    users: getOnlineUsers(),
  });
}

/**
 * 讓新 socket 接管舊 socket。
 *
 * 用途：
 * 使用者重新整理頁面、登入跳轉太快、或舊 socket 尚未完全斷線時，
 * 不要直接把新連線踢回 login.html。
 */
function replaceOldSocketIfNeeded(io, socket, nickname) {
  const existingSocketId = socketIdByNickname.get(nickname);

  if (!existingSocketId || existingSocketId === socket.id) return;

  const existingSocket = io.sockets.sockets.get(existingSocketId);

  if (existingSocket) {
    existingSocket.data.replacedByNewSocket = true;
    existingSocket.disconnect(true);
  }

  usersBySocketId.delete(existingSocketId);
  socketIdByNickname.delete(nickname);
}

/**
 * 處理使用者斷線。
 */
async function handleSocketDisconnect(io, socket, options = {}) {
  /*
   * 如果這個 socket 是被新 socket 接管而斷線，
   * 通常 usersBySocketId 已經先被移除。
   * 這裡直接 return，避免誤清聊天紀錄與遊戲狀態。
   */
  if (socket.data && socket.data.replacedByNewSocket) {
    return;
  }

  const user = usersBySocketId.get(socket.id);

  if (!user) return;

  const leavingNickname = user.nickname;

  /*
   * 遊戲斷線處理。
   */
  if (typeof options.handleGameDisconnect === 'function') {
    try {
      await options.handleGameDisconnect(io, leavingNickname, socket);
    } catch (error) {
      console.error('Game disconnect handler failed:', error);
    }
  }

  /*
   * 群組聊天室：
   * 若使用者在群組中，通知其他人離開。
   * 如果群組已經沒人，清空群組公告與群組訊息。
   */
  if (user.joinedGroup) {
    socket.to('group').emit('groupSystem', makeSystemMessage('leftGroup', {
      nickname: leavingNickname,
    }));

    await clearGroupDataIfGroupEmpty(io, socket.id);
  }

  /*
   * 清除與離線者相關的私人聊天紀錄。
   */
  await clearPrivateHistoriesForUser(io, leavingNickname);

  removeOnlineUser(socket.id);

  /*
   * 只有當目前 nickname 對應的 socket 還是這個 socket，
   * 才刪除 nickname 對應。
   * 避免舊 socket 斷線時，把新 socket 的登入狀態誤刪。
   */
  if (socketIdByNickname.get(leavingNickname) === socket.id) {
    socketIdByNickname.delete(leavingNickname);
  }

  broadcastOnlineUsers(io);

  /*
   * 後續如果有其他模組要知道某使用者離線，
   * 可以監聽這個事件。
   */
  io.emit('userDisconnected', {
    nickname: leavingNickname,
    timestamp: nowIso(),
  });
}

/**
 * 註冊 Socket.io 主流程。
 *
 * @param {Server} io - Socket.io server instance
 * @param {object} options
 * @param {string} options.rootDir - 專案根目錄 __dirname
 * @param {boolean} options.showGroupTyping - 是否允許群組 typing indicator
 * @param {Function} options.registerGameSocketHandlers - 遊戲模組註冊入口
 * @param {Function} options.handleGameDisconnect - 遊戲斷線處理入口
 */
function registerSocketHandlers(io, options = {}) {
  const rootDir = options.rootDir;
  const showGroupTyping = options.showGroupTyping !== false;

  if (!rootDir) {
    throw new Error('registerSocketHandlers requires { rootDir }.');
  }

  io.on('connection', (socket) => {
    const socketSession = socket.request.session;
    const nickname = socketSession && socketSession.nickname;

    if (!nickname) {
      socket.emit('authError', {
        message: 'Please login first.',
      });

      socket.disconnect(true);
      return;
    }

    /*
     * 同 nickname 新 socket 接管舊 socket。
     * 這是你目前 server.js 已經有的保護邏輯，拆檔後也要保留。
     */
    replaceOldSocketIfNeeded(io, socket, nickname);

    const user = addOnlineUser(socket.id, nickname);

    /*
     * 補上聊天室目前需要的使用者狀態。
     */
    user.activePrivateTarget = null;
    user.activeGroupChat = false;
    user.avatarUrl = DEFAULT_AVATAR_URL;

    socket.emit('loginReady', {
      nickname,
      showGroupTyping,
      avatarUrl: user.avatarUrl,
    });

    broadcastOnlineUsers(io);

    /*
     * 註冊大頭貼事件。
     */
    registerAvatarSocketHandlers(socket, io, {
      rootDir,
      broadcastOnlineUsers: () => broadcastOnlineUsers(io),
    });

    /*
     * 註冊聊天室事件。
     */
    registerChatSocketHandlers(io, socket, {
      showGroupTyping,
      broadcastOnlineUsers: () => broadcastOnlineUsers(io),
    });

    /*
     * 註冊遊戲事件。
     */
    if (typeof options.registerGameSocketHandlers === 'function') {
      options.registerGameSocketHandlers(io, socket, {
        broadcastOnlineUsers: () => broadcastOnlineUsers(io),
      });
    }

    socket.on('disconnect', async () => {
      await handleSocketDisconnect(io, socket, options);
    });
  });
}

module.exports = {
  registerSocketHandlers,
  broadcastOnlineUsers,
  replaceOldSocketIfNeeded,
  handleSocketDisconnect,
};