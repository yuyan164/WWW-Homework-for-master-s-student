/**
 * minesweeper.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責踩地雷遊戲前端畫面。
 *
 * 支援模式：
 * 1. memo 單人模式。
 * 2. private / group 線上 2–4 人模式。
 *
 * 注意：
 * 這是前端畫面檔案。
 * 線上多人狀態由 /server/game/minesweeperServer.js 管理。
 * ------------------------------------------------------------
 */

(function setupMinesweeper() {
  function t(key, params = {}) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function getMineNumberClass(count) {
    if (!count) return '';
    return `mine-number-${Math.min(count, 8)}`;
  }

  function getPlayers(gameState) {
    return Array.isArray(gameState.playersOrder)
      ? gameState.playersOrder
      : Object.values(gameState.players || {}).filter(Boolean);
  }

  function isEliminated(gameState, nickname) {
    return Array.isArray(gameState.eliminatedPlayers) &&
      gameState.eliminatedPlayers.includes(nickname);
  }

  function getStatusText(gameState, currentUser) {
    if (!gameState) return '';

    if (gameState.status === 'lobby') {
      return t('minesweeperLobbyHint');
    }

    if (gameState.status === 'ended') {
      if (!gameState.winner) return t('gameDraw');
      if (gameState.winner === currentUser) return t('youWin');
      return t('youLose');
    }

    if (isEliminated(gameState, currentUser)) {
      return t('youAreEliminated');
    }

    if (gameState.currentPlayer === currentUser) {
      return t('yourTurn');
    }

    return t('waitingTurn', {
      nickname: gameState.currentPlayer || '',
    });
  }

  function renderLobby(container, gameState, currentUser, callbacks = {}) {
    container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'mine-panel';

    const status = document.createElement('div');
    status.className = 'tic-status mine-status';
    status.textContent = t('minesweeperLobbyHint');

    const players = document.createElement('div');
    players.className = 'game-lobby-card';

    const playerNames = getPlayers(gameState);
    players.innerHTML = `
      <h4>${t('playersList')}</h4>
      <p class="muted">${t('waitingForPlayers')}</p>
      <div class="game-lobby-list">
        ${playerNames.map((player, index) => `
          <div class="game-lobby-player ${player === currentUser ? 'active' : ''}">
            ${index + 1}. ${player}
          </div>
        `).join('')}
      </div>
    `;

    panel.append(status, players);

    const canHostStart =
      gameState.chatType === 'group' &&
      gameState.host === currentUser &&
      playerNames.length >= 2;

    if (canHostStart) {
      const actions = document.createElement('div');
      actions.className = 'tic-actions';

      const startButton = document.createElement('button');
      startButton.type = 'button';
      startButton.className = 'primary-btn tic-rematch-btn';
      startButton.textContent = t('startGame');

      startButton.addEventListener('click', () => {
        if (callbacks && typeof callbacks.onStartGame === 'function') {
          callbacks.onStartGame();
        }
      });

      actions.appendChild(startButton);
      panel.appendChild(actions);
    }

    container.appendChild(panel);
  }

  function createPlayerCards(gameState, currentUser) {
    const playersWrap = document.createElement('div');
    playersWrap.className = 'mine-players-grid';

    getPlayers(gameState).forEach((nickname) => {
      const card = document.createElement('div');
      const isCurrentTurn = gameState.status === 'active' && gameState.currentPlayer === nickname;
      const isMe = nickname === currentUser;
      const eliminated = isEliminated(gameState, nickname);

      card.className = [
        'tic-player',
        'mine-player-card',
        isCurrentTurn ? 'active' : '',
        isMe ? 'me' : '',
        eliminated ? 'eliminated' : '',
      ].filter(Boolean).join(' ');

      const score = gameState.scores && gameState.scores[nickname]
        ? gameState.scores[nickname]
        : 0;

      card.innerHTML = `
        <strong>${nickname}</strong>
        <span>${isMe ? t('you') : t('player')}</span>
        <span>${t('score')}: ${score}</span>
        ${eliminated ? `<span class="mine-eliminated-text">${t('eliminated')}</span>` : ''}
      `;

      playersWrap.appendChild(card);
    });

    return playersWrap;
  }

  function render(container, gameState, currentUser, callbacks = {}) {
    if (!gameState || gameState.gameId !== 'minesweeper') {
      container.innerHTML = '<p>Minesweeper is loading.</p>';
      return;
    }

    if (gameState.status === 'lobby') {
      renderLobby(container, gameState, currentUser, callbacks);
      return;
    }

    const rows = gameState.rows || 10;
    const cols = gameState.cols || 10;
    const revealedCount = gameState.revealedCount || 0;
    const mineCount = gameState.mineCount || 15;
    const totalSafeCells = rows * cols - mineCount;
    const isMyTurn = gameState.status === 'active' && gameState.currentPlayer === currentUser;
    const eliminated = isEliminated(gameState, currentUser);

    container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'mine-panel';

    const status = document.createElement('div');
    status.className = 'tic-status mine-status';
    status.textContent = getStatusText(gameState, currentUser);

    const players = createPlayerCards(gameState, currentUser);

    const info = document.createElement('div');
    info.className = 'mine-info-row';
    info.innerHTML = `
      <span>💣 ${t('mines')}: ${mineCount}</span>
      <span>✅ ${t('openedSafeCells')}: ${revealedCount}/${totalSafeCells}</span>
      <span>👤 ${t('currentTurn')}: ${gameState.currentPlayer || '-'}</span>
    `;

    const board = document.createElement('div');
    board.className = 'mine-board';
    board.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

    (gameState.cells || []).forEach((cellData, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mine-cell';

      if (cellData.revealed) {
        cell.classList.add('revealed');

        if (cellData.isMine) {
          cell.classList.add('mine-hit');
          cell.textContent = '💣';
        } else if (cellData.count > 0) {
          cell.classList.add(getMineNumberClass(cellData.count));
          cell.textContent = cellData.count;
        } else {
          cell.textContent = '';
        }

        if (cellData.revealedBy) {
          cell.title = `${t('revealedBy')}: ${cellData.revealedBy}`;
        }
      } else {
        cell.textContent = '';
      }

      const flaggedByMe =
        Array.isArray(cellData.flaggedBy) &&
        cellData.flaggedBy.includes(currentUser) &&
        !cellData.revealed;

      if (flaggedByMe) {
        cell.textContent = '🚩';
        cell.classList.add('flagged');
      }

      cell.disabled =
        !isMyTurn ||
        eliminated ||
        cellData.revealed ||
        gameState.status !== 'active';

      cell.addEventListener('click', () => {
        if (flaggedByMe) return;

        if (callbacks && typeof callbacks.onMove === 'function') {
          callbacks.onMove(index);
        }
      });

      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();

        if (cellData.revealed || gameState.status !== 'active' || eliminated) return;

        if (callbacks && typeof callbacks.onFlag === 'function') {
          callbacks.onFlag(index);
        }
      });

      board.appendChild(cell);
    });

    panel.append(status, players, info, board);

    if (gameState.status === 'ended') {
      const actions = document.createElement('div');
      actions.className = 'tic-actions';

      const rematchButton = document.createElement('button');
      rematchButton.type = 'button';
      rematchButton.className = 'primary-btn tic-rematch-btn';
      rematchButton.textContent = t('rematch');

      rematchButton.addEventListener('click', () => {
        if (callbacks && typeof callbacks.onRematch === 'function') {
          callbacks.onRematch();
        }
      });

      actions.appendChild(rematchButton);
      panel.appendChild(actions);
    }

    container.appendChild(panel);
  }

  window.Minesweeper = {
    render,
  };
})();