/**
 * server/state.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案集中管理後端執行期間的記憶體狀態。
 *
 * 主要內容：
 * 1. 線上使用者 Map
 * 2. nickname 對 socket.id 的 Map
 * 3. 私人訊息暫存 Map
 * 4. 遊戲邀請 Map
 * 5. 進行中遊戲 Map
 * 6. 聊天室公告 Map
 *
 * 注意：
 * 這些資料存在伺服器記憶體中。
 * 如果 server 重啟，這裡的資料會清空。
 * ------------------------------------------------------------
 */

const usersBySocketId = new Map();
const socketIdByNickname = new Map();
const privateMessages = new Map();
const gameInvitations = new Map();
const activeGames = new Map();
const chatAnnouncements = new Map();

/**
 * 取得線上使用者清單。
 */
function getOnlineUsers() {
  return Array.from(usersBySocketId.values()).map((user) => ({
    nickname: user.nickname,
    joinedGroup: Boolean(user.joinedGroup),
    avatarUrl: user.avatarUrl || '/uploads/default.png',
  }));
}

/**
 * 透過暱稱取得 socket.id。
 */
function getSocketIdByNickname(nickname) {
  return socketIdByNickname.get(nickname);
}

/**
 * 清除某位使用者的線上狀態。
 */
function removeOnlineUser(socketId) {
  const user = usersBySocketId.get(socketId);

  if (!user) return null;

  usersBySocketId.delete(socketId);
  socketIdByNickname.delete(user.nickname);

  return user;
}

/**
 * 加入線上使用者。
 */
function addOnlineUser(socketId, nickname) {
  const user = {
    socketId,
    nickname,
    joinedGroup: false,
    avatarUrl: '/uploads/default.png',
  };

  usersBySocketId.set(socketId, user);
  socketIdByNickname.set(nickname, socketId);

  return user;
}

/**
 * 檢查暱稱是否在線上。
 */
function isNicknameOnline(nickname) {
  return socketIdByNickname.has(nickname);
}

/**
 * 取得使用者物件。
 */
function getUserBySocketId(socketId) {
  return usersBySocketId.get(socketId);
}

module.exports = {
  usersBySocketId,
  socketIdByNickname,
  privateMessages,
  gameInvitations,
  activeGames,
  chatAnnouncements,

  getOnlineUsers,
  getSocketIdByNickname,
  removeOnlineUser,
  addOnlineUser,
  isNicknameOnline,
  getUserBySocketId,
};