/**
 * server/game/snakesLaddersServer.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責蛇與梯子的後端遊戲邏輯。
 *
 * 主要功能：
 * 1. 建立蛇與梯子等待室
 * 2. 處理玩家加入與選擇棋子顏色
 * 3. 群組聊天室由發起人按開始，私人聊天室兩人準備好自動開始
 * 4. 擲骰子與棋子移動邏輯
 * 5. 處理蛇、梯子、超過 100 原地不動
 * 6. 遊戲結束後寫入排行榜
 * 7. 等待室離開與遊戲中離開處理
 *
 * 注意：
 * 這是 Node.js 後端檔案。
 * 前端畫面仍然由 /js/snakes_ladders.js 負責。
 * ------------------------------------------------------------
 */

const {
  recordMultiplayerGame,
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

const SNAKES_LADDERS_ID = 'snakes_ladders';

const SNAKES_LADDERS_COLORS = [
  'green',
  'yellow',
  'blue',
  'red',
];

/*
 * 蛇與梯子的特殊格。
 *
 * 注意：
 * 使用者已確認：
 * 64 -> 83
 * 97 -> 61
 * 38 -> 20
 * 梯子或蛇的第二段動畫由前端做直線滑行。
 */
const SNAKES_LADDERS_SPECIAL_MOVES = {
  // Ladders
  5: 58,
  14: 49,
  53: 72,
  64: 83,

  // Snakes
  38: 20,
  51: 10,
  76: 54,
  92: 73,
  97: 61,
};

/**
 * 建立蛇與梯子等待室。
 */
function createSnakesLaddersLobbyGame(invitation) {
  const sessionId = `snakes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const chatType = invitation.chatType || 'private';

  const playersOrder = [invitation.from];

  /*
   * 私人聊天室中，如果有明確邀請對象，先不自動加入對方。
   * 對方仍需點擊加入遊戲。
   */
  return {
    sessionId,
    invitationId: invitation.invitationId,
    gameId: SNAKES_LADDERS_ID,
    gameType: SNAKES_LADDERS_ID,
    chatType,
    host: invitation.from,

    playersOrder,
    colorByPlayer: {},
    positions: {},

    currentPlayer: '',
    status: 'lobby',
    startedAt: null,
    endedAt: null,
    winner: null,
    result: null,
    durationSeconds: 0,

    lastDice: null,
    lastMove: null,
    isMoving: false,
  };
}

/**
 * 取得下一位玩家。
 */
function getNextSnakesLaddersPlayer(game, currentNickname) {
  const players = game.playersOrder || [];

  if (players.length === 0) return '';

  const currentIndex = players.indexOf(currentNickname);

  if (currentIndex < 0) return players[0];

  return players[(currentIndex + 1) % players.length];
}

/**
 * 建立一般步數路徑。
 *
 * 例如從 10 骰到 4：
 * path = [11, 12, 13, 14]
 */
function buildSnakesLaddersNormalPath(start, end) {
  const path = [];

  for (let number = start + 1; number <= end; number += 1) {
    path.push(number);
  }

  return path;
}

/**
 * 取得已被使用的棋子顏色。
 */
function getUsedSnakesLaddersColors(game) {
  return new Set(Object.values(game.colorByPlayer || {}).filter(Boolean));
}

/**
 * 檢查所有玩家是否都已選色。
 */
function allSnakesLaddersPlayersHaveColors(game) {
  const players = game.playersOrder || [];

  if (players.length === 0) return false;

  return players.every((nickname) => Boolean(game.colorByPlayer[nickname]));
}

/**
 * 是否可以開始蛇與梯子。
 */
function canStartSnakesLaddersGame(game) {
  if (!game || game.gameId !== SNAKES_LADDERS_ID) return false;
  if (game.status !== 'lobby') return false;

  const playerCount = (game.playersOrder || []).length;

  return (
    playerCount >= 2 &&
    playerCount <= 4 &&
    allSnakesLaddersPlayersHaveColors(game)
  );
}

/**
 * 是否應該自動開始。
 *
 * 私人聊天室：
 * 兩人加入且都選色後自動開始。
 *
 * 群組聊天室：
 * 四人加入且都選色後自動開始。
 * 兩到三人時由發起人按開始。
 */
function shouldAutoStartSnakesLaddersGame(game) {
  if (!canStartSnakesLaddersGame(game)) return false;

  const playerCount = game.playersOrder.length;

  if (game.chatType === 'private') {
    return playerCount === 2;
  }

  if (game.chatType === 'group') {
    return playerCount === 4;
  }

  return false;
}

/**
 * 廣播等待室狀態。
 */
function emitSnakesLaddersLobby(io, game) {
  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}

/**
 * 發送邀請已結束通知。
 *
 * 用途：
 * 讓聊天泡泡中的「加入遊戲 / 已加入等待中」按鈕改成「遊戲已結束」。
 */
function emitSnakesLaddersInviteEnded(io, game, reason = 'ended', endedBy = '') {
  if (!game) return;

  const payload = {
    invitationId: game.invitationId || '',
    sessionId: game.sessionId || '',
    gameId: game.gameId || SNAKES_LADDERS_ID,
    chatType: game.chatType || 'private',
    reason,
    endedBy,
  };

  if (game.chatType === 'group') {
    io.to('group').emit('gameInviteEnded', payload);
    return;
  }

  const invitation = gameInvitations.get(game.invitationId);
  const notifyUsers = new Set();

  if (invitation) {
    notifyUsers.add(invitation.from);
    notifyUsers.add(invitation.to);
  }

  getGameParticipantNicknames(game).forEach((nickname) => {
    notifyUsers.add(nickname);
  });

  notifyUsers.forEach((nickname) => {
    if (nickname) {
      emitToNickname(io, nickname, 'gameInviteEnded', payload);
    }
  });
}

/**
 * 開始蛇與梯子。
 */
function startSnakesLaddersGame(io, game) {
  if (!canStartSnakesLaddersGame(game)) return false;

  game.status = 'active';
  game.startedAt = nowIso();
  game.currentPlayer = game.playersOrder[0];
  game.lastDice = null;
  game.lastMove = null;
  game.isMoving = false;

  game.playersOrder.forEach((nickname) => {
    game.positions[nickname] = 1;
  });

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));
  return true;
}

/**
 * 加入蛇與梯子等待室。
 */
function joinSnakesLaddersGame(io, game, nickname) {
  if (!game || game.gameId !== SNAKES_LADDERS_ID) return false;
  if (game.status !== 'lobby') return false;

  if (!game.playersOrder.includes(nickname)) {
    if (game.playersOrder.length >= 4) return false;

    game.playersOrder.push(nickname);
  }

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));

  if (shouldAutoStartSnakesLaddersGame(game)) {
    gameInvitations.delete(game.invitationId);
    startSnakesLaddersGame(io, game);
  }

  return true;
}

/**
 * 取消蛇與梯子等待室。
 */
function cancelSnakesLaddersLobbyGame(io, game, cancelledBy = '') {
  if (!game || game.gameId !== SNAKES_LADDERS_ID) return;
  if (game.status !== 'lobby') return;

  game.status = 'ended';
  game.result = 'cancelled';
  game.winner = null;
  game.endedAt = nowIso();

  emitSnakesLaddersInviteEnded(io, game, 'cancel_lobby', cancelledBy);

  const cancelMessage = makeSystemMessage('snakesLaddersGameCancelled', {});

  if (game.chatType === 'group') {
    io.to('group').emit('gameChatNotice', {
      chatType: 'group',
      message: cancelMessage,
    });
  } else {
    const invitation = gameInvitations.get(game.invitationId);
    const players = new Set();

    if (invitation) {
      players.add(invitation.from);
      players.add(invitation.to);
    }

    getGameParticipantNicknames(game).forEach((nickname) => {
      players.add(nickname);
    });

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
 * 結束蛇與梯子。
 *
 * notifyPlayersOverride：
 * 若有人中途離開，離開者可能已經被移出 playersOrder。
 * 但結果仍要通知離開者，排行榜也要記錄離開者為敗方。
 */
async function finishSnakesLaddersGame(
  io,
  game,
  winner,
  reason = 'completed',
  notifyPlayersOverride = null
) {
  if (!game || game.status === 'ended') return;

  const notifyPlayers = Array.isArray(notifyPlayersOverride) && notifyPlayersOverride.length > 0
    ? notifyPlayersOverride.filter(Boolean)
    : getGameParticipantNicknames(game);

  game.status = 'ended';
  game.winner = winner || null;
  game.result = winner ? 'win' : 'ended';
  game.endedAt = nowIso();
  game.durationSeconds = game.startedAt
    ? Math.max(1, Math.round((new Date(game.endedAt) - new Date(game.startedAt)) / 1000))
    : 0;
  game.isMoving = false;

  const gameState = {
    ...publicGameState(game),
    reason,
  };

  /*
   * 通知所有玩家遊戲結束。
   */
  notifyPlayers.forEach((nickname) => {
    emitToNickname(io, nickname, 'gameEnd', gameState);
  });

  /*
   * 在聊天室中顯示結果。
   */
  const resultMessage = makeSystemMessage('snakesLaddersGameEnded', {
    winner: winner || '',
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
    await recordMultiplayerGame({
      sessionId: game.sessionId,
      gameType: game.gameType || SNAKES_LADDERS_ID,
      players: notifyPlayers,
      winner: game.winner,
      startedAt: game.startedAt || game.endedAt,
      endedAt: game.endedAt,
      durationSeconds: game.durationSeconds,
    });

    console.log('[snakesLaddersServer] result recorded:', {
      sessionId: game.sessionId,
      players: notifyPlayers,
      winner: game.winner,
      reason,
    });
  } catch (error) {
    console.error('[snakesLaddersServer] failed to record result:', error);
  }

  emitSnakesLaddersInviteEnded(io, game, reason, winner || '');

  activeGames.delete(game.sessionId);
}

/**
 * 擲骰子。
 */
function rollSnakesLaddersDice(io, game, nickname) {
  if (!game || game.gameId !== SNAKES_LADDERS_ID) return;
  if (game.status !== 'active') return;
  if (game.currentPlayer !== nickname) return;
  if (game.isMoving) return;

  const dice = Math.floor(Math.random() * 6) + 1;
  const startPosition = Number(game.positions[nickname] || 1);
  const rawTarget = startPosition + dice;

  game.lastDice = dice;
  game.isMoving = true;

  /*
   * 必須剛好到 100。
   * 如果超過 100，原地不動。
   */
  if (rawTarget > 100) {
    game.lastMove = {
      player: nickname,
      dice,
      start: startPosition,
      end: startPosition,
      path: [],
      bounced: true,
      specialMove: null,
    };

    game.currentPlayer = getNextSnakesLaddersPlayer(game, nickname);
    game.isMoving = false;

    emitGameToPlayers(io, game, 'gameState', publicGameState(game));
    return;
  }

  const normalPath = buildSnakesLaddersNormalPath(startPosition, rawTarget);
  const specialTarget = SNAKES_LADDERS_SPECIAL_MOVES[rawTarget];
  const finalPosition = specialTarget || rawTarget;

  game.positions[nickname] = finalPosition;

  game.lastMove = {
    player: nickname,
    dice,
    start: startPosition,
    end: finalPosition,
    path: normalPath,
    bounced: false,
    specialMove: specialTarget
      ? {
          from: rawTarget,
          to: specialTarget,
        }
      : null,
  };

  /*
   * 剛好到 100，遊戲結束。
   */
  if (finalPosition === 100) {
    game.isMoving = false;
    finishSnakesLaddersGame(io, game, nickname, 'completed');
    return;
  }

  game.currentPlayer = getNextSnakesLaddersPlayer(game, nickname);
  game.isMoving = false;

  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}

/**
 * 處理蛇與梯子玩家離開。
 */
function handleSnakesLaddersPlayerLeave(io, leavingNickname) {
  Array.from(activeGames.values()).forEach((game) => {
    if (game.gameId !== SNAKES_LADDERS_ID) return;
    if (!game.playersOrder.includes(leavingNickname)) return;

    const originalPlayers = game.playersOrder.slice();

    /*
     * 等待室階段：
     * 只要有人離開，取消整場遊戲。
     */
    if (game.status === 'lobby') {
      cancelSnakesLaddersLobbyGame(io, game, leavingNickname);
      return;
    }

    const remainingPlayers = game.playersOrder.filter((nickname) => (
      nickname !== leavingNickname
    ));

    delete game.colorByPlayer[leavingNickname];
    delete game.positions[leavingNickname];

    if (game.status === 'active') {
      /*
       * 如果只剩一位玩家，該玩家直接獲勝。
       */
      if (remainingPlayers.length <= 1) {
        game.playersOrder = remainingPlayers;

        const winner = remainingPlayers[0] || null;

        finishSnakesLaddersGame(io, game, winner, 'opponent_left', originalPlayers);
        return;
      }

      /*
       * 如果還有兩位以上，遊戲繼續。
       */
      game.playersOrder = remainingPlayers;

      if (game.currentPlayer === leavingNickname) {
        game.currentPlayer = game.playersOrder[0];
      }

      emitGameToPlayers(io, game, 'gameState', publicGameState(game));
    }
  });
}

/**
 * 註冊蛇與梯子 Socket 事件。
 */
function registerSnakesLaddersSocketHandlers(io, socket) {
  socket.on('chooseSnakesLaddersColor', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const color = safeText(payload.color);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== SNAKES_LADDERS_ID) return;
    if (game.status !== 'lobby') return;
    if (!game.playersOrder.includes(user.nickname)) return;
    if (!SNAKES_LADDERS_COLORS.includes(color)) return;

    const colorUsedByOther = Object.entries(game.colorByPlayer).some(([nickname, usedColor]) => (
      nickname !== user.nickname && usedColor === color
    ));

    if (colorUsedByOther) return;

    game.colorByPlayer[user.nickname] = color;

    emitSnakesLaddersLobby(io, game);

    if (shouldAutoStartSnakesLaddersGame(game)) {
      gameInvitations.delete(game.invitationId);
      startSnakesLaddersGame(io, game);
    }
  });

  socket.on('startSnakesLaddersGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== SNAKES_LADDERS_ID) return;
    if (game.status !== 'lobby') return;

    /*
     * 群組聊天室只有發起人可以按開始。
     */
    if (game.host !== user.nickname) return;

    if (!canStartSnakesLaddersGame(game)) {
      emitSnakesLaddersLobby(io, game);
      return;
    }

    gameInvitations.delete(game.invitationId);
    startSnakesLaddersGame(io, game);
  });

  socket.on('rollSnakesLaddersDice', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== SNAKES_LADDERS_ID) return;

    rollSnakesLaddersDice(io, game, user.nickname);
  });

  socket.on('quitGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== SNAKES_LADDERS_ID) return;

    handleSnakesLaddersPlayerLeave(io, user.nickname);
  });
}

module.exports = {
  SNAKES_LADDERS_ID,
  SNAKES_LADDERS_COLORS,
  SNAKES_LADDERS_SPECIAL_MOVES,

  createSnakesLaddersLobbyGame,
  getNextSnakesLaddersPlayer,
  buildSnakesLaddersNormalPath,
  getUsedSnakesLaddersColors,
  allSnakesLaddersPlayersHaveColors,
  canStartSnakesLaddersGame,
  shouldAutoStartSnakesLaddersGame,

  emitSnakesLaddersLobby,
  emitSnakesLaddersInviteEnded,

  joinSnakesLaddersGame,
  startSnakesLaddersGame,
  cancelSnakesLaddersLobbyGame,
  finishSnakesLaddersGame,
  rollSnakesLaddersDice,
  handleSnakesLaddersPlayerLeave,

  registerSnakesLaddersSocketHandlers,
};