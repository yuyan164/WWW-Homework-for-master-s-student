/**
 * server/game/tictactoeServer.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責圈圈叉叉的後端遊戲邏輯。
 *
 * 主要功能：
 * 1. 建立圈圈叉叉遊戲狀態
 * 2. 處理玩家下棋 gameMove
 * 3. 判斷勝負與平手
 * 4. 處理玩家離開遊戲 quitGame
 * 5. 將遊戲結果寫入 SQLite 排行榜
 *
 * 注意：
 * 這是 Node.js 後端檔案。
 * 前端畫面仍然由 /js/tictactoe.js 負責。
 * ------------------------------------------------------------
 */

const {
  recordGame,
} = require('../../db');

const {
  activeGames,
  usersBySocketId,
} = require('../state');

const {
  nowIso,
  safeText,
  makeSystemMessage,
} = require('../utils');

const {
  emitToNickname,
  emitGameToPlayers,
  publicGameState,
} = require('./gameUtils');

const TICTACTOE_ID = 'tictactoe';

/**
 * 判斷圈圈叉叉勝利線。
 */
function winningLine(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],

    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],

    [0, 4, 8],
    [2, 4, 6],
  ];

  return lines.find(([a, b, c]) => (
    board[a] &&
    board[a] === board[b] &&
    board[a] === board[c]
  )) || null;
}

/**
 * 建立圈圈叉叉遊戲。
 *
 * invitation 格式預期：
 * {
 *   invitationId,
 *   gameId,
 *   from,
 *   to,
 *   chatType,
 *   createdAt
 * }
 */
function createTicTacToeGame(invitation) {
  const sessionId = `game-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    sessionId,
    invitationId: invitation.invitationId,
    gameId: TICTACTOE_ID,
    gameType: TICTACTOE_ID,
    chatType: invitation.chatType || 'private',

    players: {
      X: invitation.from,
      O: invitation.to,
    },

    board: Array(9).fill(''),
    turn: 'X',
    status: 'active',
    startedAt: nowIso(),
    endedAt: null,
    winner: null,
    result: null,
    durationSeconds: 0,
    winLine: null,
  };
}

/**
 * 結束圈圈叉叉遊戲。
 */
async function finishTicTacToeGame(io, game, result, winner, reason = '') {
  if (!game || game.status !== 'active') return;

  game.status = 'ended';
  game.result = result;
  game.winner = winner || null;
  game.endedAt = nowIso();
  game.durationSeconds = Math.max(
    1,
    Math.round((new Date(game.endedAt) - new Date(game.startedAt)) / 1000)
  );

  emitGameToPlayers(io, game, 'gameEnd', {
    ...publicGameState(game),
    reason,
  });

  /*
   * 送一則系統訊息到私人聊天室，讓遊戲結果保留在聊天紀錄中。
   */
  emitGameToPlayers(io, game, 'gameChatNotice', {
    opponentX: game.players.X,
    opponentO: game.players.O,
    message: makeSystemMessage('gameEnded', {
      winner: game.winner || '',
      result,
      reason,
    }),
  });

  activeGames.delete(game.sessionId);

  try {
    await recordGame({
      gameType: game.gameType,
      playerX: game.players.X,
      playerO: game.players.O,
      winner: game.winner,
      result,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      durationSeconds: game.durationSeconds,
    });
  } catch (error) {
    console.error('Failed to record Tic-Tac-Toe game:', error);
  }
}

/**
 * 玩家中途離開圈圈叉叉。
 */
function quitTicTacToeGame(io, game, leavingNickname) {
  if (!game || game.gameId !== TICTACTOE_ID) return;
  if (game.status !== 'active') return;

  const opponent = game.players.X === leavingNickname
    ? game.players.O
    : game.players.X;

  finishTicTacToeGame(io, game, 'quit', opponent, 'quit');
}

/**
 * 處理玩家斷線時的圈圈叉叉遊戲。
 */
function handleTicTacToeDisconnect(io, leavingNickname) {
  Array.from(activeGames.values()).forEach((game) => {
    if (game.gameId !== TICTACTOE_ID) return;
    if (game.status !== 'active') return;

    const isPlayer = game.players.X === leavingNickname || game.players.O === leavingNickname;

    if (!isPlayer) return;

    const opponent = game.players.X === leavingNickname
      ? game.players.O
      : game.players.X;

    finishTicTacToeGame(io, game, 'quit', opponent, 'opponent_left');
  });
}

/**
 * 註冊圈圈叉叉相關 Socket 事件。
 */
function registerTicTacToeSocketHandlers(io, socket) {
  socket.on('gameMove', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const index = Number(payload.index);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== TICTACTOE_ID) return;
    if (game.status !== 'active') return;
    if (!Number.isInteger(index) || index < 0 || index > 8) return;

    const playerMark = game.players.X === user.nickname
      ? 'X'
      : game.players.O === user.nickname
        ? 'O'
        : '';

    if (!playerMark) return;
    if (playerMark !== game.turn) return;
    if (game.board[index]) return;

    game.board[index] = playerMark;

    const line = winningLine(game.board);

    if (line) {
      game.winLine = line;
      finishTicTacToeGame(io, game, 'win', user.nickname, 'completed');
      return;
    }

    if (game.board.every(Boolean)) {
      finishTicTacToeGame(io, game, 'draw', null, 'draw');
      return;
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';

    emitGameToPlayers(io, game, 'gameState', publicGameState(game));
  });

  socket.on('quitGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== TICTACTOE_ID) return;

    quitTicTacToeGame(io, game, user.nickname);
  });
}

module.exports = {
  TICTACTOE_ID,

  winningLine,
  createTicTacToeGame,
  finishTicTacToeGame,
  quitTicTacToeGame,
  handleTicTacToeDisconnect,
  registerTicTacToeSocketHandlers,
};