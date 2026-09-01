/**
 * tictactoe.js
 * ------------------------------------------------------------
 * This file renders the Tic-Tac-Toe game interface. It receives
 * game state from the server, displays the board, highlights turns
 * and winning cells, and sends move/quit actions back through
 * callbacks provided by index.js.
 * ------------------------------------------------------------
 */

(function setupTicTacToe() {
  function getMyMark(gameState, currentUser) {
    if (!gameState || !gameState.players) return '';
    if (gameState.players.X === currentUser) return 'X';
    if (gameState.players.O === currentUser) return 'O';
    return '';
  }

  function getOpponentName(gameState, currentUser) {
    if (!gameState || !gameState.players) return '';
    return gameState.players.X === currentUser ? gameState.players.O : gameState.players.X;
  }

  function getStatusText(gameState, currentUser) {
    const myMark = getMyMark(gameState, currentUser);

    if (!gameState || gameState.status !== 'ended') {
      return gameState.turn === myMark
        ? window.i18n.t('yourTurn')
        : window.i18n.t('opponentTurn');
    }

    if (gameState.result === 'draw') return window.i18n.t('gameDraw');
    if (gameState.winner === currentUser) return window.i18n.t('youWin');
    if (gameState.result === 'quit' && gameState.winner === currentUser) return window.i18n.t('opponentLeftWin');
    return window.i18n.t('youLose');
  }

  function render(container, gameState, currentUser, callbacks) {
    const myMark = getMyMark(gameState, currentUser);
    const opponent = getOpponentName(gameState, currentUser);
    const isMyTurn = gameState.status === 'active' && gameState.turn === myMark;
    const winLine = gameState.winLine || [];

    container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'tic-panel';

    const status = document.createElement('div');
    status.className = 'tic-status';
    status.textContent = getStatusText(gameState, currentUser);

    const players = document.createElement('div');
    players.className = 'tic-players';

    const meCard = document.createElement('div');
    meCard.className = `tic-player ${isMyTurn ? 'active' : ''}`;
    meCard.innerHTML = `<strong>${currentUser}</strong><br>${window.i18n.t('yourMark')}: ${myMark}`;

    const opponentCard = document.createElement('div');
    opponentCard.className = `tic-player ${!isMyTurn && gameState.status === 'active' ? 'active' : ''}`;
    opponentCard.innerHTML = `<strong>${opponent}</strong><br>${window.i18n.t('opponent')}: ${myMark === 'X' ? 'O' : 'X'}`;

    players.append(meCard, opponentCard);

    const board = document.createElement('div');
    board.className = 'tic-board';

    gameState.board.forEach((mark, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `tic-cell ${winLine.includes(index) ? 'win' : ''}`;
      cell.textContent = mark;
      cell.disabled = !isMyTurn || Boolean(mark) || gameState.status !== 'active';
      cell.addEventListener('click', () => callbacks.onMove(index));
      board.appendChild(cell);
    });

    panel.append(status, players, board);

    // 遊戲結束後顯示「重新一局」按鈕。
    // 這個按鈕會交給 index.js 發送新的遊戲邀請，
    // 對方仍需要點擊邀請加入，符合一對一遊戲邀請流程。
    if (gameState.status === 'ended') {
      const actions = document.createElement('div');
      actions.className = 'tic-actions';

      const rematchButton = document.createElement('button');
      rematchButton.type = 'button';
      rematchButton.className = 'primary-btn tic-rematch-btn';
      rematchButton.textContent = window.i18n.t('rematch');
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

  window.TicTacToe = {
    render,
  };
})();
