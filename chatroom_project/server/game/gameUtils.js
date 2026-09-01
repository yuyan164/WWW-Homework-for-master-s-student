/**
 * server/game/gameUtils.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案放置後端遊戲共用工具函式。
 *
 * 主要功能：
 * 1. 依暱稱發送 Socket.io 事件
 * 2. 取得遊戲參與者
 * 3. 對所有遊戲參與者廣播事件
 * 4. 轉換遊戲公開狀態 publicGameState
 * 5. 查詢某位使用者正在參與的遊戲
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

const {
  usersBySocketId,
  activeGames,
  getSocketIdByNickname,
} = require('../state');

/**
 * 傳送事件給指定 nickname。
 */
function emitToNickname(io, nickname, eventName, payload) {
  const socketId = getSocketIdByNickname(nickname);

  if (!socketId) return false;

  io.to(socketId).emit(eventName, payload);
  return true;
}

/**
 * 透過 nickname 取得線上使用者物件。
 */
function getUserByNickname(nickname) {
  const socketId = getSocketIdByNickname(nickname);

  if (!socketId) return null;

  return usersBySocketId.get(socketId) || null;
}

/**
 * 取得遊戲參與者 nickname 清單。
 *
 * 支援：
 * 1. 圈圈叉叉：game.players.X / game.players.O
 * 2. 蛇與梯子：game.playersOrder
 * 3. 未來 2048 / 踩地雷：game.playersOrder
 */
function getGameParticipantNicknames(game) {
  if (!game) return [];

  if (Array.isArray(game.playersOrder)) {
    return game.playersOrder.filter(Boolean);
  }

  if (Array.isArray(game.players)) {
    return game.players.filter(Boolean);
  }

  if (game.players && typeof game.players === 'object') {
    return [
      game.players.X,
      game.players.O,
    ].filter(Boolean);
  }

  return [];
}

/**
 * 對所有遊戲玩家廣播事件。
 */
function emitGameToPlayers(io, game, eventName, payload) {
  getGameParticipantNicknames(game).forEach((nickname) => {
    emitToNickname(io, nickname, eventName, payload);
  });
}

/**
 * 判斷遊戲是否包含某位玩家。
 */
function gameHasPlayer(game, nickname) {
  return getGameParticipantNicknames(game).includes(nickname);
}

/**
 * 建立圈圈叉叉公開狀態。
 */
function buildTicTacToeState(game) {
  return {
    sessionId: game.sessionId,
    invitationId: game.invitationId || '',
    gameId: game.gameId,
    gameType: game.gameType,
    chatType: game.chatType || 'private',
    players: game.players,
    board: game.board,
    turn: game.turn,
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt || null,
    winner: game.winner || null,
    result: game.result || null,
    durationSeconds: game.durationSeconds || 0,
    winLine: game.winLine || null,
  };
}

/**
 * 建立蛇與梯子公開狀態。
 */
function buildSnakesLaddersState(game) {
  return {
    sessionId: game.sessionId,
    invitationId: game.invitationId || '',
    gameId: game.gameId,
    gameType: game.gameType,
    chatType: game.chatType,
    host: game.host,
    playersOrder: game.playersOrder || [],
    colorByPlayer: game.colorByPlayer || {},
    positions: game.positions || {},
    currentPlayer: game.currentPlayer || '',
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt || null,
    winner: game.winner || null,
    result: game.result || null,
    durationSeconds: game.durationSeconds || 0,
    lastDice: game.lastDice || null,
    lastMove: game.lastMove || null,
    isMoving: Boolean(game.isMoving),
  };
}

/**
 * 建立 2048 公開狀態。
 *
 * 這是下一階段多人 2048 會使用的格式。
 */
function buildGame2048State(game) {
  return {
    sessionId: game.sessionId,
    invitationId: game.invitationId || '',
    gameId: game.gameId,
    gameType: game.gameType,
    chatType: game.chatType,
    host: game.host,
    playersOrder: game.playersOrder || [],
    players: game.players || {},
    players2048: game.players2048 || {},
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt || null,
    winner: game.winner || null,
    result: game.result || null,
    durationSeconds: game.durationSeconds || 0,
  };
}

/**
 * 建立踩地雷公開狀態。
 *
 * 這是下一階段多人踩地雷會使用的格式。
 */
function buildMinesweeperState(game) {
  return {
    sessionId: game.sessionId,
    invitationId: game.invitationId || '',
    gameId: game.gameId,
    gameType: game.gameType,
    chatType: game.chatType,
    host: game.host,
    playersOrder: game.playersOrder || [],
    players: game.players || {},
    cells: game.cells || [],
    rows: game.rows || 10,
    cols: game.cols || 10,
    mineCount: game.mineCount || 15,
    revealedCount: game.revealedCount || 0,
    scores: game.scores || {},
    currentPlayer: game.currentPlayer || '',
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt || null,
    winner: game.winner || null,
    result: game.result || null,
    durationSeconds: game.durationSeconds || 0,
  };
}

/**
 * 將內部遊戲狀態轉成可以送給前端的公開狀態。
 */
function publicGameState(game) {
  if (!game) return null;

  if (game.gameId === 'snakes_ladders') {
    return buildSnakesLaddersState(game);
  }

  if (game.gameId === 'game2048') {
    return buildGame2048State(game);
  }

  if (game.gameId === 'minesweeper') {
    return buildMinesweeperState(game);
  }

  return buildTicTacToeState(game);
}

/**
 * 查詢某位使用者目前正在參與的 active 遊戲。
 */
function findActiveGamesByNickname(nickname) {
  return Array.from(activeGames.values()).filter((game) => (
    game.status === 'active' &&
    gameHasPlayer(game, nickname)
  ));
}

/**
 * 查詢某位使用者目前參與的所有遊戲。
 *
 * 包含 lobby / active。
 */
function findGamesByNickname(nickname) {
  return Array.from(activeGames.values()).filter((game) => (
    gameHasPlayer(game, nickname)
  ));
}

/**
 * 從 activeGames 中透過 invitationId 找遊戲。
 */
function getGameByInvitationId(invitationId) {
  return Array.from(activeGames.values()).find((game) => (
    game.invitationId === invitationId
  )) || null;
}

module.exports = {
  emitToNickname,
  getUserByNickname,
  getGameParticipantNicknames,
  emitGameToPlayers,
  gameHasPlayer,

  buildTicTacToeState,
  buildSnakesLaddersState,
  buildGame2048State,
  buildMinesweeperState,
  publicGameState,

  findActiveGamesByNickname,
  findGamesByNickname,
  getGameByInvitationId,
};