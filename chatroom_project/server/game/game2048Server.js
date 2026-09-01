/**
 * server/game/game2048Server.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責 2048 多人版的後端遊戲邏輯。
 *
 * 主要功能：
 * 1. 建立 2048 等待室。
 * 2. 線上模式必須至少 2 人才能開始。
 * 3. 2048 線上模式最多 2 人。
 * 4. 兩人加入後自動開始遊戲。
 * 5. 接收前端傳來的 2048 棋盤、分數與結束狀態。
 * 6. 當兩位玩家都結束時，依分數判斷勝負。
 * 7. 玩家中途離開時，另一位玩家獲勝。
 * 8. 遊戲結果寫入排行榜。
 *
 * 注意：
 * 這是 Node.js 後端檔案。
 * 前端畫面仍然由 /js/game2048.js 負責。
 * ------------------------------------------------------------
 */

const {
  recordGame,
} = require('../../db');

const {
  activeGames,
  gameInvitations,
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
  getGameParticipantNicknames,
  publicGameState,
} = require('./gameUtils');

const GAME_2048_ID = 'game2048';
const GAME_2048_MIN_PLAYERS = 2;
const GAME_2048_MAX_PLAYERS = 2;
const GAME_2048_SIZE = 4;

/**
 * 建立空 2048 棋盤。
 */
function createEmpty2048Board() {
  return Array.from({ length: GAME_2048_SIZE }, () => Array(GAME_2048_SIZE).fill(0));
}

function addRandom2048Tile(board) {
  const emptyCells = [];

  for (let row = 0; row < GAME_2048_SIZE; row += 1) {
    for (let col = 0; col < GAME_2048_SIZE; col += 1) {
      if (board[row][col] === 0) {
        emptyCells.push([row, col]);
      }
    }
  }

  if (emptyCells.length === 0) return;

  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[row][col] = Math.random() < 0.9 ? 2 : 4;
}

/**
 * 建立 2048 玩家資料。
 * 每位玩家一開始會有兩個初始數字。
 */
function create2048PlayerData() {
  const board = createEmpty2048Board();

  addRandom2048Tile(board);
  addRandom2048Tile(board);

  return {
    board,
    score: 0,
    ended: false,
  };
}

/**
 * 建立 2048 等待室。
 */
function create2048LobbyGame(invitation) {
  const sessionId = `game2048-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const playersOrder = [invitation.from];

  return {
    sessionId,
    invitationId: invitation.invitationId,
    gameId: GAME_2048_ID,
    gameType: GAME_2048_ID,
    chatType: invitation.chatType || 'private',
    host: invitation.from,

    playersOrder,

    /*
     * 為了相容前端 game2048.js，
     * 開始遊戲後會設定：
     * players.X = 第一位玩家
     * players.O = 第二位玩家
     */
    players: {},

    players2048: {},

    status: 'lobby',
    startedAt: null,
    endedAt: null,
    winner: null,
    result: null,
    durationSeconds: 0,
  };
}

/**
 * 是否可以開始 2048。
 */
function canStart2048Game(game) {
  if (!game || game.gameId !== GAME_2048_ID) return false;
  if (game.status !== 'lobby') return false;

  const playerCount = game.playersOrder.length;

  return (
    playerCount >= GAME_2048_MIN_PLAYERS &&
    playerCount <= GAME_2048_MAX_PLAYERS
  );
}

/**
 * 廣播 2048 等待室。
 */
function emit2048Lobby(io, game) {
  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}

/**
 * 開始 2048 遊戲。
 */
function start2048Game(io, game) {
  if (!canStart2048Game(game)) return false;

  const [playerX, playerO] = game.playersOrder;

  game.status = 'active';
  game.startedAt = nowIso();
  game.endedAt = null;
  game.winner = null;
  game.result = null;
  game.durationSeconds = 0;

  game.players = {
    X: playerX,
    O: playerO,
  };

  game.players2048 = {
    X: create2048PlayerData(),
    O: create2048PlayerData(),
  };

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));
  return true;
}

/**
 * 加入 2048 等待室。
 */
function join2048Game(io, game, nickname) {
  if (!game || game.gameId !== GAME_2048_ID) return false;
  if (game.status !== 'lobby') return false;

  if (!game.playersOrder.includes(nickname)) {
    if (game.playersOrder.length >= GAME_2048_MAX_PLAYERS) return false;

    game.playersOrder.push(nickname);
  }

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));

  /*
   * 2048 線上模式必須 2 人，且滿 2 人自動開始。
   */
  if (canStart2048Game(game)) {
    gameInvitations.delete(game.invitationId);
    start2048Game(io, game);
  }

  return true;
}

/**
 * 取得玩家符號 X / O。
 */
function get2048PlayerSymbol(game, nickname) {
  if (!game || !game.players) return '';

  if (game.players.X === nickname) return 'X';
  if (game.players.O === nickname) return 'O';

  return '';
}

/**
 * 判斷 2048 是否兩位玩家都結束。
 */
function areAll2048PlayersEnded(game) {
  if (!game || !game.players2048) return false;

  return ['X', 'O'].every((symbol) => (
    game.players2048[symbol] &&
    game.players2048[symbol].ended
  ));
}

/**
 * 依分數判斷 2048 勝負。
 */
function get2048Winner(game) {
  const scoreX = Number(game.players2048.X ? game.players2048.X.score : 0);
  const scoreO = Number(game.players2048.O ? game.players2048.O.score : 0);

  if (scoreX > scoreO) return game.players.X;
  if (scoreO > scoreX) return game.players.O;

  return null;
}

/**
 * 發送邀請結束通知。
 */
function emit2048InviteEnded(io, game, reason = 'ended', endedBy = '') {
  if (!game) return;

  const payload = {
    invitationId: game.invitationId || '',
    sessionId: game.sessionId || '',
    gameId: GAME_2048_ID,
    chatType: game.chatType || 'private',
    reason,
    endedBy,
  };

  if (game.chatType === 'group') {
    io.to('group').emit('gameInviteEnded', payload);
    return;
  }

  const notifyUsers = new Set(getGameParticipantNicknames(game));

  notifyUsers.forEach((nickname) => {
    emitToNickname(io, nickname, 'gameInviteEnded', payload);
  });
}

/**
 * 結束 2048 遊戲。
 */
async function finish2048Game(io, game, winner, reason = 'completed', notifyPlayersOverride = null) {
  if (!game || game.status === 'ended') return;

  const notifyPlayers = Array.isArray(notifyPlayersOverride) && notifyPlayersOverride.length > 0
    ? notifyPlayersOverride.filter(Boolean)
    : getGameParticipantNicknames(game);

  game.status = 'ended';
  game.winner = winner || null;
  game.result = winner ? 'win' : 'draw';
  game.endedAt = nowIso();
  game.durationSeconds = game.startedAt
    ? Math.max(1, Math.round((new Date(game.endedAt) - new Date(game.startedAt)) / 1000))
    : 0;

  const gameState = {
    ...publicGameState(game),
    reason,
  };

  notifyPlayers.forEach((nickname) => {
    emitToNickname(io, nickname, 'gameEnd', gameState);
  });

  const resultMessage = makeSystemMessage('game2048GameEnded', {
    winner: winner || '',
    result: game.result,
  });

  if (game.chatType === 'group') {
    io.to('group').emit('gameChatNotice', {
      chatType: 'group',
      message: resultMessage,
    });
  } else {
    notifyPlayers.forEach((nickname) => {
      const otherPlayers = notifyPlayers.filter((player) => player !== nickname);

      emitToNickname(io, nickname, 'gameChatNotice', {
        chatType: 'private',
        target: otherPlayers[0] || '',
        message: resultMessage,
      });
    });
  }

  try {
    if (notifyPlayers.length === 2) {
      await recordGame({
        gameType: game.gameType || GAME_2048_ID,
        playerX: notifyPlayers[0],
        playerO: notifyPlayers[1],
        winner: game.winner,
        result: game.winner ? 'win' : 'draw',
        startedAt: game.startedAt || game.endedAt,
        endedAt: game.endedAt,
        durationSeconds: game.durationSeconds,
      });
    }
  } catch (error) {
    console.error('[game2048Server] failed to record result:', error);
  }

  emit2048InviteEnded(io, game, reason, winner || '');
  activeGames.delete(game.sessionId);
}

/**
 * 取消 2048 等待室。
 */
function cancel2048LobbyGame(io, game, cancelledBy = '') {
  if (!game || game.gameId !== GAME_2048_ID) return;
  if (game.status !== 'lobby') return;

  game.status = 'ended';
  game.result = 'cancelled';
  game.winner = null;
  game.endedAt = nowIso();

  emit2048InviteEnded(io, game, 'cancel_lobby', cancelledBy);

  const cancelMessage = makeSystemMessage('game2048GameCancelled', {});

  if (game.chatType === 'group') {
    io.to('group').emit('gameChatNotice', {
      chatType: 'group',
      message: cancelMessage,
    });
  } else {
    const players = new Set(getGameParticipantNicknames(game));

    players.forEach((nickname) => {
      const otherPlayers = Array.from(players).filter((player) => player !== nickname);

      emitToNickname(io, nickname, 'gameChatNotice', {
        chatType: 'private',
        target: otherPlayers[0] || '',
        message: cancelMessage,
      });
    });
  }

  gameInvitations.delete(game.invitationId);
  activeGames.delete(game.sessionId);
}

/**
 * 玩家更新 2048 狀態。
 */
function update2048PlayerState(io, game, nickname, payload = {}) {
  if (!game || game.gameId !== GAME_2048_ID) return;
  if (game.status !== 'active') return;

  const symbol = get2048PlayerSymbol(game, nickname);

  if (!symbol) return;

  const board = Array.isArray(payload.board) ? payload.board : null;
  const score = Number(payload.score || 0);
  const ended = Boolean(payload.ended);

  if (!board) return;

  game.players2048[symbol] = {
    board,
    score: Number.isFinite(score) ? score : 0,
    ended,
  };

  emitGameToPlayers(io, game, 'gameState', publicGameState(game));

  if (areAll2048PlayersEnded(game)) {
    const winner = get2048Winner(game);
    finish2048Game(io, game, winner, 'completed');
  }
}

/**
 * 處理 2048 玩家離開。
 */
function handle2048PlayerLeave(io, leavingNickname) {
  Array.from(activeGames.values()).forEach((game) => {
    if (game.gameId !== GAME_2048_ID) return;
    if (!game.playersOrder.includes(leavingNickname)) return;

    const originalPlayers = game.playersOrder.slice();

    if (game.status === 'lobby') {
      cancel2048LobbyGame(io, game, leavingNickname);
      return;
    }

    if (game.status === 'active') {
      const remainingPlayers = game.playersOrder.filter((nickname) => (
        nickname !== leavingNickname
      ));

      const winner = remainingPlayers[0] || null;

      finish2048Game(io, game, winner, 'opponent_left', originalPlayers);
    }
  });
}

/**
 * 註冊 2048 Socket 事件。
 */
function register2048SocketHandlers(io, socket) {
  socket.on('game2048Move', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== GAME_2048_ID) return;

    update2048PlayerState(io, game, user.nickname, payload);
  });

  socket.on('quitGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== GAME_2048_ID) return;

    handle2048PlayerLeave(io, user.nickname);
  });
}

module.exports = {
  GAME_2048_ID,
  GAME_2048_MIN_PLAYERS,
  GAME_2048_MAX_PLAYERS,

  createEmpty2048Board,
  addRandom2048Tile,
  create2048PlayerData,
  create2048LobbyGame,
  canStart2048Game,
  emit2048Lobby,
  start2048Game,
  join2048Game,

  get2048PlayerSymbol,
  areAll2048PlayersEnded,
  get2048Winner,

  emit2048InviteEnded,
  finish2048Game,
  cancel2048LobbyGame,
  update2048PlayerState,
  handle2048PlayerLeave,

  register2048SocketHandlers,
};