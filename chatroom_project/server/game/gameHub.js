/**
 * server/game/gameHub.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案是所有後端遊戲邏輯的總入口。
 *
 * 主要功能：
 * 1. 處理 sendGameInvite
 * 2. 處理 joinGameInvite
 * 3. 分流圈圈叉叉、蛇與梯子、2048、踩地雷
 * 4. 註冊各遊戲自己的 Socket 事件
 * 5. 處理玩家斷線時的遊戲離開邏輯
 *
 * 注意：
 * 這是 Node.js 後端檔案。
 * 前端畫面仍然由 /js/ 裡的遊戲檔案負責。
 * ------------------------------------------------------------
 */

const {
  usersBySocketId,
  socketIdByNickname,
  gameInvitations,
  activeGames,
} = require('../state');

const {
  nowIso,
  safeText,
  makeId,
} = require('../utils');

const {
  emitToNickname,
  emitGameToPlayers,
  publicGameState,
  getGameByInvitationId,
} = require('./gameUtils');

const {
  TICTACTOE_ID,
  createTicTacToeGame,
  registerTicTacToeSocketHandlers,
  handleTicTacToeDisconnect,
} = require('./tictactoeServer');

const {
  SNAKES_LADDERS_ID,
  createSnakesLaddersLobbyGame,
  joinSnakesLaddersGame,
  registerSnakesLaddersSocketHandlers,
  handleSnakesLaddersPlayerLeave,
} = require('./snakesLaddersServer');

const {
  GAME_2048_ID,
  create2048LobbyGame,
  join2048Game,
  register2048SocketHandlers,
  handle2048PlayerLeave,
} = require('./game2048Server');

const {
  MINESWEEPER_ID,
  createMinesweeperLobbyGame,
  joinMinesweeperGame,
  registerMinesweeperSocketHandlers,
  handleMinesweeperPlayerLeave,
} = require('./minesweeperServer');

const SUPPORTED_GAME_IDS = new Set([
  TICTACTOE_ID,
  SNAKES_LADDERS_ID,
  GAME_2048_ID,
  MINESWEEPER_ID,
]);

const GROUP_ALLOWED_GAME_IDS = new Set([
  SNAKES_LADDERS_ID,
  GAME_2048_ID,
  MINESWEEPER_ID,
]);

const PRIVATE_ALLOWED_GAME_IDS = new Set([
  TICTACTOE_ID,
  SNAKES_LADDERS_ID,
  GAME_2048_ID,
  MINESWEEPER_ID,
]);

/**
 * 判斷遊戲是否可在指定聊天室類型使用。
 */
function canUseGameInChat(gameId, chatType) {
  if (chatType === 'private') {
    return PRIVATE_ALLOWED_GAME_IDS.has(gameId);
  }

  if (chatType === 'group') {
    return GROUP_ALLOWED_GAME_IDS.has(gameId);
  }

  /*
   * memo 是前端本機單人遊戲，不會經過 server。
   */
  return false;
}

/**
 * 建立遊戲邀請 payload。
 */
function buildGameInvitationPayload(invitation) {
  return {
    id: invitation.invitationId,
    type: 'gameInvitation',
    invitationId: invitation.invitationId,
    sessionId: invitation.sessionId || '',
    gameId: invitation.gameId,
    chatType: invitation.chatType,
    from: invitation.from,
    to: invitation.chatType === 'private' ? invitation.to : '',
    timestamp: invitation.createdAt,
  };
}

/**
 * 發送邀請狀態。
 */
function emitGameInviteStatus(io, invitation) {
  const payload = {
    invitationId: invitation.invitationId,
    accepted: Array.from(invitation.accepted || []),
  };

  if (invitation.chatType === 'group') {
    io.to('group').emit('gameInviteStatus', payload);
    return;
  }

  emitToNickname(io, invitation.from, 'gameInviteStatus', payload);

  if (invitation.to) {
    emitToNickname(io, invitation.to, 'gameInviteStatus', payload);
  }
}

/**
 * 建立 lobby 型遊戲。
 *
 * lobby 型遊戲：
 * 1. 蛇與梯子
 * 2. 2048
 * 3. 踩地雷
 *
 * 圈圈叉叉不是 lobby 型，維持兩人都加入後直接開始。
 */
function createLobbyGameForInvitation(invitation) {
  if (invitation.gameId === SNAKES_LADDERS_ID) {
    return createSnakesLaddersLobbyGame(invitation);
  }

  if (invitation.gameId === GAME_2048_ID) {
    return create2048LobbyGame(invitation);
  }

  if (invitation.gameId === MINESWEEPER_ID) {
    return createMinesweeperLobbyGame(invitation);
  }

  return null;
}

/**
 * 加入 lobby 型遊戲。
 */
function joinLobbyGame(io, invitation, nickname) {
  const game = getGameByInvitationId(invitation.invitationId);

  if (!game || game.status !== 'lobby') {
    return false;
  }

  if (invitation.gameId === SNAKES_LADDERS_ID) {
    return joinSnakesLaddersGame(io, game, nickname);
  }

  if (invitation.gameId === GAME_2048_ID) {
    return join2048Game(io, game, nickname);
  }

  if (invitation.gameId === MINESWEEPER_ID) {
    return joinMinesweeperGame(io, game, nickname);
  }

  return false;
}

/**
 * 註冊 sendGameInvite。
 */
function registerSendGameInviteHandler(io, socket) {
  socket.on('sendGameInvite', (payload = {}) => {
    const sender = usersBySocketId.get(socket.id);

    if (!sender) return;

    const chatType = safeText(payload.chatType) || 'private';
    const to = safeText(payload.to);
    const gameId = safeText(payload.gameId) || TICTACTOE_ID;

    if (!SUPPORTED_GAME_IDS.has(gameId)) {
      socket.emit('messageError', {
        messageKey: 'inviteExpired',
      });
      return;
    }

    if (!canUseGameInChat(gameId, chatType)) {
      socket.emit('messageError', {
        messageKey: 'selectChatFirst',
      });
      return;
    }

    if (chatType === 'private') {
      if (!to || !socketIdByNickname.has(to)) {
        socket.emit('messageError', {
          messageKey: 'userOffline',
        });
        return;
      }

      if (to === sender.nickname) return;
    }

    if (chatType === 'group') {
      if (!sender.joinedGroup) {
        socket.emit('messageError', {
          messageKey: 'groupJoinFirst',
        });
        return;
      }
    }

    const invitation = {
      invitationId: makeId('invite'),
      sessionId: '',
      gameId,
      chatType,
      from: sender.nickname,
      to: chatType === 'private' ? to : '',
      accepted: new Set(),
      createdAt: nowIso(),
    };

    /*
     * lobby 型遊戲在邀請建立時就建立 activeGames 狀態。
     * 這樣後面加入、選色、開始遊戲都能依 sessionId 管理。
     */
    const lobbyGame = createLobbyGameForInvitation(invitation);

    if (lobbyGame) {
      invitation.sessionId = lobbyGame.sessionId;
      activeGames.set(lobbyGame.sessionId, lobbyGame);
    }

    gameInvitations.set(invitation.invitationId, invitation);

    const invitationPayload = buildGameInvitationPayload(invitation);

    if (chatType === 'group') {
      io.to('group').emit('gameInvitation', invitationPayload);
      return;
    }

    emitToNickname(io, sender.nickname, 'gameInvitation', invitationPayload);
    emitToNickname(io, to, 'gameInvitation', invitationPayload);
  });
}

/**
 * 註冊 joinGameInvite。
 */
function registerJoinGameInviteHandler(io, socket) {
  socket.on('joinGameInvite', (payload = {}) => {
    const user = usersBySocketId.get(socket.id);

    if (!user) return;

    const invitationId = safeText(payload.invitationId);
    const invitation = gameInvitations.get(invitationId);

    if (!invitation) {
      socket.emit('messageError', {
        messageKey: 'inviteExpired',
      });
      return;
    }

    /*
     * private 遊戲只有發起人與受邀者可以加入。
     */
    if (invitation.chatType === 'private') {
      if (![invitation.from, invitation.to].includes(user.nickname)) {
        return;
      }
    }

    /*
     * group 遊戲只有群組成員可以加入。
     */
    if (invitation.chatType === 'group') {
      if (!user.joinedGroup) return;
    }

    /*
     * lobby 型遊戲：
     * 蛇與梯子、2048、踩地雷。
     */
    if (
      invitation.gameId === SNAKES_LADDERS_ID ||
      invitation.gameId === GAME_2048_ID ||
      invitation.gameId === MINESWEEPER_ID
    ) {
      const joined = joinLobbyGame(io, invitation, user.nickname);

      if (!joined) {
        socket.emit('messageError', {
          messageKey: 'inviteExpired',
        });
        return;
      }

      invitation.accepted.add(user.nickname);

      /*
       * 如果遊戲尚未因自動開始而刪除 invitation，就更新邀請狀態。
       */
      if (gameInvitations.has(invitationId)) {
        emitGameInviteStatus(io, invitation);
      }

      return;
    }

    /*
     * 圈圈叉叉：
     * 兩人都加入後直接開始。
     */
    if (invitation.gameId === TICTACTOE_ID) {
      if (![invitation.from, invitation.to].includes(user.nickname)) return;

      invitation.accepted.add(user.nickname);
      emitGameInviteStatus(io, invitation);

      if (invitation.accepted.size < 2) return;

      const game = createTicTacToeGame(invitation);

      activeGames.set(game.sessionId, game);
      gameInvitations.delete(invitation.invitationId);

      emitGameToPlayers(io, game, 'gameStart', publicGameState(game));
    }
  });
}

/**
 * 註冊全部遊戲 Socket 事件。
 */
function registerGameSocketHandlers(io, socket) {
  registerSendGameInviteHandler(io, socket);
  registerJoinGameInviteHandler(io, socket);

  /*
   * 各遊戲自己的事件：
   * - gameMove
   * - rollSnakesLaddersDice
   * - chooseSnakesLaddersColor
   * - startSnakesLaddersGame
   * - game2048Move
   * - mineMove
   * - toggleMineFlag
   * - startMinesweeperGame
   * - quitGame 分流
   */
  registerTicTacToeSocketHandlers(io, socket);
  registerSnakesLaddersSocketHandlers(io, socket);
  register2048SocketHandlers(io, socket);
  registerMinesweeperSocketHandlers(io, socket);
}

/**
 * 使用者斷線時，通知各遊戲模組處理。
 */
async function handleGameDisconnect(io, leavingNickname) {
  handleTicTacToeDisconnect(io, leavingNickname);
  handleSnakesLaddersPlayerLeave(io, leavingNickname);
  handle2048PlayerLeave(io, leavingNickname);
  handleMinesweeperPlayerLeave(io, leavingNickname);
}

module.exports = {
  SUPPORTED_GAME_IDS,
  GROUP_ALLOWED_GAME_IDS,
  PRIVATE_ALLOWED_GAME_IDS,

  canUseGameInChat,
  buildGameInvitationPayload,
  emitGameInviteStatus,

  createLobbyGameForInvitation,
  joinLobbyGame,

  registerSendGameInviteHandler,
  registerJoinGameInviteHandler,
  registerGameSocketHandlers,
  handleGameDisconnect,
};