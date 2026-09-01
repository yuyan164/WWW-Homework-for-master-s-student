/**
 * server/game/minesweeperServer.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責踩地雷多人版的後端遊戲邏輯。
 *
 * 主要功能：
 * 1. 建立踩地雷等待室。
 * 2. 線上模式必須至少 2 人才能開始。
 * 3. 踩地雷線上模式最多 4 人。
 * 4. 群組聊天室 2–3 人時由發起人按開始，4 人自動開始。
 * 5. 共享一張地雷棋盤。
 * 6. 玩家輪流打開格子。
 * 7. 打開安全格加分，踩到地雷則淘汰。
 * 8. 若只剩一位玩家，該玩家獲勝。
 * 9. 若安全格全開，分數最高者獲勝。
 *
 * 注意：
 * 這是 Node.js 後端檔案。
 * 前端畫面仍然由 /js/minesweeper.js 負責。
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

const MINESWEEPER_ID = 'minesweeper';

const MINESWEEPER_MIN_PLAYERS = 2;
const MINESWEEPER_MAX_PLAYERS = 4;

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const DEFAULT_MINE_COUNT = 15;

/**
 * 建立踩地雷等待室。
 */
function createMinesweeperLobbyGame(invitation) {
  const sessionId = `minesweeper-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const playersOrder = [invitation.from];

  return {
    sessionId,
    invitationId: invitation.invitationId,
    gameId: MINESWEEPER_ID,
    gameType: MINESWEEPER_ID,
    chatType: invitation.chatType || 'private',
    host: invitation.from,

    playersOrder,
    players: {},

    cells: [],
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    mineCount: DEFAULT_MINE_COUNT,
    revealedCount: 0,

    scores: {},
    eliminatedPlayers: [],
    currentPlayer: '',

    status: 'lobby',
    startedAt: null,
    endedAt: null,
    winner: null,
    result: null,
    durationSeconds: 0,
  };
}

/**
 * 建立玩家代號。
 *
 * 為了相容舊版前端，可保留 X / O，
 * 第三、第四位使用 P3 / P4。
 */
function buildMinesweeperPlayers(playersOrder) {
  return {
    X: playersOrder[0] || '',
    O: playersOrder[1] || '',
    P3: playersOrder[2] || '',
    P4: playersOrder[3] || '',
  };
}

/**
 * 取得格子鄰居。
 */
function getMineNeighbors(index, rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const neighbors = [];

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;

      const nextRow = row + dr;
      const nextCol = col + dc;

      if (
        nextRow >= 0 &&
        nextRow < rows &&
        nextCol >= 0 &&
        nextCol < cols
      ) {
        neighbors.push(nextRow * cols + nextCol);
      }
    }
  }

  return neighbors;
}

/**
 * 建立踩地雷棋盤。
 */
function createMineCells(rows = DEFAULT_ROWS, cols = DEFAULT_COLS, mineCount = DEFAULT_MINE_COUNT) {
  const total = rows * cols;
  const mineSet = new Set();

  while (mineSet.size < mineCount) {
    mineSet.add(Math.floor(Math.random() * total));
  }

  const cells = Array.from({ length: total }, (_, index) => ({
    index,
    isMine: mineSet.has(index),
    count: 0,
    revealed: false,
    revealedBy: '',
    flaggedBy: [],
  }));

  cells.forEach((cell, index) => {
    if (cell.isMine) return;

    cell.count = getMineNeighbors(index, rows, cols).filter((neighborIndex) => (
      cells[neighborIndex].isMine
    )).length;
  });

  return cells;
}

/**
 * 是否可以開始踩地雷。
 */
function canStartMinesweeperGame(game) {
  if (!game || game.gameId !== MINESWEEPER_ID) return false;
  if (game.status !== 'lobby') return false;

  const playerCount = game.playersOrder.length;

  return (
    playerCount >= MINESWEEPER_MIN_PLAYERS &&
    playerCount <= MINESWEEPER_MAX_PLAYERS
  );
}

/**
 * 是否應自動開始踩地雷。
 *
 * private：2 人加入自動開始。
 * group：4 人加入自動開始；2–3 人由發起人按開始。
 */
function shouldAutoStartMinesweeperGame(game) {
  if (!canStartMinesweeperGame(game)) return false;

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
 * 取得下一位尚未淘汰的玩家。
 */
/**
 * 判斷某位玩家是否已被淘汰。
 */
function isMinesweeperPlayerEliminated(game, nickname) {
  return (
    Array.isArray(game.eliminatedPlayers) &&
    game.eliminatedPlayers.includes(nickname)
  );
}

/**
 * 取得目前仍可行動的玩家。
 * 被淘汰的玩家仍然可以觀看遊戲，但不會再被排入回合。
 */
function getActiveMinesweeperPlayers(game) {
  return (game.playersOrder || []).filter((nickname) => (
    !isMinesweeperPlayerEliminated(game, nickname)
  ));
}

/**
 * 取得下一位尚未淘汰的玩家。
 *
 * 規則：
 * 1. 依照原本加入遊戲的順序輪流。
 * 2. 如果下一位已被淘汰，就跳過他。
 * 3. 被淘汰者只能觀看遊戲，不會再輪到他點擊。
 */
function getNextMinesweeperPlayer(game, currentNickname) {
  const players = Array.isArray(game.playersOrder)
    ? game.playersOrder
    : [];

  if (players.length === 0) return '';

  const activePlayers = getActiveMinesweeperPlayers(game);

  if (activePlayers.length === 0) return '';
  if (activePlayers.length === 1) return activePlayers[0];

  const currentIndex = players.indexOf(currentNickname);
  const startIndex = currentIndex >= 0 ? currentIndex : -1;

  for (let step = 1; step <= players.length; step += 1) {
    const nextIndex = (startIndex + step) % players.length;
    const nextPlayer = players[nextIndex];

    if (activePlayers.includes(nextPlayer)) {
      return nextPlayer;
    }
  }

  return activePlayers[0] || '';
}

/**
 * 確保目前回合玩家不是淘汰者。
 * 如果目前玩家已淘汰，就自動切換到下一位尚未淘汰的玩家。
 */
function ensureCurrentMinesweeperPlayerIsActive(game) {
  const activePlayers = getActiveMinesweeperPlayers(game);

  if (activePlayers.length === 0) {
    game.currentPlayer = '';
    return '';
  }

  if (!activePlayers.includes(game.currentPlayer)) {
    game.currentPlayer = activePlayers[0];
  }

  return game.currentPlayer;
}

/**
 * 廣播踩地雷等待室。
 */
function emitMinesweeperLobby(io, game) {
  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}

/**
 * 開始踩地雷。
 */
function startMinesweeperGame(io, game) {
  if (!canStartMinesweeperGame(game)) return false;

  game.status = 'active';
  game.startedAt = nowIso();
  game.endedAt = null;
  game.winner = null;
  game.result = null;
  game.durationSeconds = 0;

  game.players = buildMinesweeperPlayers(game.playersOrder);
  game.cells = createMineCells(game.rows, game.cols, game.mineCount);
  game.revealedCount = 0;
  game.scores = {};
  game.eliminatedPlayers = [];
  game.currentPlayer = game.playersOrder[0];

  game.playersOrder.forEach((nickname) => {
    game.scores[nickname] = 0;
  });

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));
  return true;
}

/**
 * 加入踩地雷等待室。
 */
function joinMinesweeperGame(io, game, nickname) {
  if (!game || game.gameId !== MINESWEEPER_ID) return false;
  if (game.status !== 'lobby') return false;

  if (!game.playersOrder.includes(nickname)) {
    if (game.playersOrder.length >= MINESWEEPER_MAX_PLAYERS) return false;

    game.playersOrder.push(nickname);
  }

  emitGameToPlayers(io, game, 'gameStart', publicGameState(game));

  if (shouldAutoStartMinesweeperGame(game)) {
    gameInvitations.delete(game.invitationId);
    startMinesweeperGame(io, game);
  }

  return true;
}

/**
 * 取得分數最高者。
 */
function getMinesweeperWinnerByScore(game) {
  let winner = null;
  let bestScore = -1;
  let hasTie = false;

  game.playersOrder.forEach((nickname) => {
    const score = Number(game.scores[nickname] || 0);

    if (score > bestScore) {
      bestScore = score;
      winner = nickname;
      hasTie = false;
    } else if (score === bestScore) {
      hasTie = true;
    }
  });

  return hasTie ? null : winner;
}

/**
 * 發送邀請結束通知。
 */
function emitMinesweeperInviteEnded(io, game, reason = 'ended', endedBy = '') {
  if (!game) return;

  const payload = {
    invitationId: game.invitationId || '',
    sessionId: game.sessionId || '',
    gameId: MINESWEEPER_ID,
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
 * 結束踩地雷。
 */
async function finishMinesweeperGame(io, game, winner, reason = 'completed', notifyPlayersOverride = null) {
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

  const resultMessage = makeSystemMessage('minesweeperGameEnded', {
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
    await recordMultiplayerGame({
      sessionId: game.sessionId,
      gameType: game.gameType || MINESWEEPER_ID,
      players: notifyPlayers,
      winner: game.winner,
      startedAt: game.startedAt || game.endedAt,
      endedAt: game.endedAt,
      durationSeconds: game.durationSeconds,
    });
  } catch (error) {
    console.error('[minesweeperServer] failed to record result:', error);
  }

  emitMinesweeperInviteEnded(io, game, reason, winner || '');
  activeGames.delete(game.sessionId);
}

/**
 * 取消踩地雷等待室。
 */
function cancelMinesweeperLobbyGame(io, game, cancelledBy = '') {
  if (!game || game.gameId !== MINESWEEPER_ID) return;
  if (game.status !== 'lobby') return;

  game.status = 'ended';
  game.result = 'cancelled';
  game.winner = null;
  game.endedAt = nowIso();

  emitMinesweeperInviteEnded(io, game, 'cancel_lobby', cancelledBy);

  const cancelMessage = makeSystemMessage('minesweeperGameCancelled', {});

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
 * 將安全格打開。
 */
function revealSafeCells(game, startIndex, nickname) {
  const queue = [startIndex];
  const visited = new Set();
  let opened = 0;

  while (queue.length > 0) {
    const index = queue.shift();

    if (visited.has(index)) continue;
    visited.add(index);

    const cell = game.cells[index];

    if (!cell || cell.revealed || cell.isMine) continue;

    cell.revealed = true;
    cell.revealedBy = nickname;
    opened += 1;
    game.revealedCount += 1;

    if (cell.count === 0) {
      getMineNeighbors(index, game.rows, game.cols).forEach((neighborIndex) => {
        const neighbor = game.cells[neighborIndex];

        if (neighbor && !neighbor.revealed && !neighbor.isMine) {
          queue.push(neighborIndex);
        }
      });
    }
  }

  game.scores[nickname] = Number(game.scores[nickname] || 0) + opened;

  return opened;
}

/**
 * 玩家打開格子。
 *
 * 新增規則：
 * 已淘汰玩家只能觀看，不能再打開格子，也不會再輪到他。
 */
function revealMinesweeperCell(io, game, nickname, index) {
  if (!game || game.gameId !== MINESWEEPER_ID) return;
  if (game.status !== 'active') return;

  /*
   * 如果目前回合玩家已經被淘汰，先自動修正到下一位有效玩家。
   */
  ensureCurrentMinesweeperPlayerIsActive(game);

  /*
   * 不是目前回合玩家，不能操作。
   */
  if (game.currentPlayer !== nickname) return;

  /*
   * 已淘汰者只能觀看遊戲，不能再點擊。
   */
  if (isMinesweeperPlayerEliminated(game, nickname)) return;

  const cell = game.cells[index];

  if (!cell || cell.revealed) return;
  if (Array.isArray(cell.flaggedBy) && cell.flaggedBy.length > 0) return;

  /*
   * 踩到地雷：該玩家淘汰。
   */
  if (cell.isMine) {
    cell.revealed = true;
    cell.revealedBy = nickname;

    if (!isMinesweeperPlayerEliminated(game, nickname)) {
      game.eliminatedPlayers.push(nickname);
    }

    const activePlayers = getActiveMinesweeperPlayers(game);

    /*
     * 如果只剩 1 位未淘汰玩家，該玩家獲勝。
     */
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0] || getMinesweeperWinnerByScore(game);
      finishMinesweeperGame(io, game, winner, 'mine_hit');
      return;
    }

    /*
     * 從踩雷者的位置往後找下一位未淘汰玩家。
     * 淘汰者之後不會再被排入回合。
     */
    game.currentPlayer = getNextMinesweeperPlayer(game, nickname);
    ensureCurrentMinesweeperPlayerIsActive(game);

    emitGameToPlayers(io, game, 'gameState', publicGameState(game));
    return;
  }

  /*
   * 打開安全格，加分。
   */
  revealSafeCells(game, index, nickname);

  const safeCellCount = game.rows * game.cols - game.mineCount;

  /*
   * 如果所有安全格都打開，遊戲結束，以分數最高者獲勝。
   */
  if (game.revealedCount >= safeCellCount) {
    const winner = getMinesweeperWinnerByScore(game);
    finishMinesweeperGame(io, game, winner, 'completed');
    return;
  }

  /*
   * 正常換下一位未淘汰玩家。
   */
  game.currentPlayer = getNextMinesweeperPlayer(game, nickname);
  ensureCurrentMinesweeperPlayerIsActive(game);

  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}

/**
 * 插旗。
 * 已淘汰玩家只能觀看，不能插旗或取消插旗。
 */
function toggleMinesweeperFlag(io, game, nickname, index) {
  if (!game || game.gameId !== MINESWEEPER_ID) return;
  if (game.status !== 'active') return;

  /*
   * 已淘汰者不能再操作棋盤。
   */
  if (isMinesweeperPlayerEliminated(game, nickname)) return;

  const cell = game.cells[index];

  if (!cell || cell.revealed) return;

  if (!Array.isArray(cell.flaggedBy)) {
    cell.flaggedBy = [];
  }

  if (cell.flaggedBy.includes(nickname)) {
    cell.flaggedBy = cell.flaggedBy.filter((player) => player !== nickname);
  } else {
    cell.flaggedBy.push(nickname);
  }

  emitGameToPlayers(io, game, 'gameState', publicGameState(game));
}
/**
 * 玩家離開踩地雷。
 */
function handleMinesweeperPlayerLeave(io, leavingNickname) {
  Array.from(activeGames.values()).forEach((game) => {
    if (game.gameId !== MINESWEEPER_ID) return;
    if (!game.playersOrder.includes(leavingNickname)) return;

    const originalPlayers = game.playersOrder.slice();

    /*
     * 等待室階段：
     * 只要有人離開，就取消整場遊戲。
     */
    if (game.status === 'lobby') {
      cancelMinesweeperLobbyGame(io, game, leavingNickname);
      return;
    }

    if (game.status === 'active') {
      game.playersOrder = game.playersOrder.filter((nickname) => (
        nickname !== leavingNickname
      ));

      delete game.scores[leavingNickname];

      /*
       * 如果離開者原本也在淘汰名單中，也一起移除。
       */
      if (Array.isArray(game.eliminatedPlayers)) {
        game.eliminatedPlayers = game.eliminatedPlayers.filter((nickname) => (
          nickname !== leavingNickname
        ));
      }

      const activePlayers = getActiveMinesweeperPlayers(game);

      /*
       * 如果只剩 1 位未淘汰且仍在遊戲中的玩家，該玩家獲勝。
       */
      if (activePlayers.length <= 1) {
        const winner = activePlayers[0] || null;
        finishMinesweeperGame(io, game, winner, 'opponent_left', originalPlayers);
        return;
      }

      /*
       * 若目前回合是離開者或淘汰者，就切到下一位有效玩家。
       */
      if (
        game.currentPlayer === leavingNickname ||
        isMinesweeperPlayerEliminated(game, game.currentPlayer)
      ) {
        game.currentPlayer = getNextMinesweeperPlayer(game, leavingNickname);
      }

      ensureCurrentMinesweeperPlayerIsActive(game);

      emitGameToPlayers(io, game, 'gameState', publicGameState(game));
    }
  });
}

/**
 * 註冊踩地雷 Socket 事件。
 */
function registerMinesweeperSocketHandlers(io, socket) {
  socket.on('mineMove', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const index = Number(payload.index);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== MINESWEEPER_ID) return;
    if (!Number.isInteger(index) || index < 0 || index >= game.cells.length) return;

    revealMinesweeperCell(io, game, user.nickname, index);
  });

  socket.on('toggleMineFlag', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const index = Number(payload.index);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== MINESWEEPER_ID) return;
    if (!Number.isInteger(index) || index < 0 || index >= game.cells.length) return;

    toggleMinesweeperFlag(io, game, user.nickname, index);
  });

  socket.on('startMinesweeperGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== MINESWEEPER_ID) return;
    if (game.status !== 'lobby') return;
    if (game.host !== user.nickname) return;

    if (!canStartMinesweeperGame(game)) {
      emitMinesweeperLobby(io, game);
      return;
    }

    gameInvitations.delete(game.invitationId);
    startMinesweeperGame(io, game);
  });

  socket.on('quitGame', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const sessionId = safeText(payload.sessionId);
    const game = activeGames.get(sessionId);

    if (!game || game.gameId !== MINESWEEPER_ID) return;

    handleMinesweeperPlayerLeave(io, user.nickname);
  });
}

module.exports = {
  MINESWEEPER_ID,
  MINESWEEPER_MIN_PLAYERS,
  MINESWEEPER_MAX_PLAYERS,
  DEFAULT_ROWS,
  DEFAULT_COLS,
  DEFAULT_MINE_COUNT,

  createMinesweeperLobbyGame,
  buildMinesweeperPlayers,
  getMineNeighbors,
  createMineCells,

  canStartMinesweeperGame,
  shouldAutoStartMinesweeperGame,
  isMinesweeperPlayerEliminated,
  getActiveMinesweeperPlayers,
  getNextMinesweeperPlayer,
  ensureCurrentMinesweeperPlayerIsActive,

  emitMinesweeperLobby,
  startMinesweeperGame,
  joinMinesweeperGame,

  getMinesweeperWinnerByScore,
  emitMinesweeperInviteEnded,
  finishMinesweeperGame,
  cancelMinesweeperLobbyGame,

  revealSafeCells,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  handleMinesweeperPlayerLeave,

  registerMinesweeperSocketHandlers,
};