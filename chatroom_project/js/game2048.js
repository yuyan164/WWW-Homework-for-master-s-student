/**
 * game2048.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責 2048 遊戲前端畫面。
 *
 * 支援模式：
 * 1. memo 單人模式。
 * 2. private / group 線上 2 人模式。
 *
 * 注意：
 * 這是前端畫面檔案。
 * 線上多人狀態由 /server/game/game2048Server.js 管理。
 * ------------------------------------------------------------
 */

(function setupGame2048() {
  const SIZE = 4;

  let battleState = null;

  function t(key, params = {}) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function createEmptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function normalizeBoard(board) {
    if (!Array.isArray(board) || board.length !== SIZE) {
      return createEmptyBoard();
    }

    return board.map((row) => {
      if (!Array.isArray(row) || row.length !== SIZE) {
        return Array(SIZE).fill(0);
      }

      return row.map((value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
      });
    });
  }

  function cloneBoard(board) {
    return normalizeBoard(board).map((row) => row.slice());
  }

  function addRandomTile(board) {
    const emptyCells = [];

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] === 0) {
          emptyCells.push([row, col]);
        }
      }
    }

    if (emptyCells.length === 0) return;

    const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    board[row][col] = Math.random() < 0.9 ? 2 : 4;
  }

  function isEmptyBoard(board) {
    const normalizedBoard = normalizeBoard(board);

    return normalizedBoard.every((row) => row.every((value) => value === 0));
  }

  function createInitialBoard() {
    const board = createEmptyBoard();
    addRandomTile(board);
    addRandomTile(board);
    return board;
  }

  function boardsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function mergeLine(line) {
    const numbers = line.filter((value) => value !== 0);
    const merged = [];
    let scoreGain = 0;

    for (let index = 0; index < numbers.length; index += 1) {
      if (numbers[index] === numbers[index + 1]) {
        const nextValue = numbers[index] * 2;
        merged.push(nextValue);
        scoreGain += nextValue;
        index += 1;
      } else {
        merged.push(numbers[index]);
      }
    }

    while (merged.length < SIZE) {
      merged.push(0);
    }

    return {
      line: merged,
      scoreGain,
    };
  }

  function moveBoard(board, direction) {
    const nextBoard = cloneBoard(board);
    let totalScoreGain = 0;

    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < SIZE; row += 1) {
        const originalLine = direction === 'left'
          ? nextBoard[row]
          : nextBoard[row].slice().reverse();

        const result = mergeLine(originalLine);

        nextBoard[row] = direction === 'left'
          ? result.line
          : result.line.slice().reverse();

        totalScoreGain += result.scoreGain;
      }
    }

    if (direction === 'up' || direction === 'down') {
      for (let col = 0; col < SIZE; col += 1) {
        const originalLine = [];

        for (let row = 0; row < SIZE; row += 1) {
          originalLine.push(nextBoard[row][col]);
        }

        const workingLine = direction === 'up'
          ? originalLine
          : originalLine.reverse();

        const result = mergeLine(workingLine);

        const nextLine = direction === 'up'
          ? result.line
          : result.line.slice().reverse();

        for (let row = 0; row < SIZE; row += 1) {
          nextBoard[row][col] = nextLine[row];
        }

        totalScoreGain += result.scoreGain;
      }
    }

    return {
      board: nextBoard,
      scoreGain: totalScoreGain,
    };
  }

  function canMove(board) {
    const currentBoard = normalizeBoard(board);

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (currentBoard[row][col] === 0) return true;
        if (row + 1 < SIZE && currentBoard[row][col] === currentBoard[row + 1][col]) return true;
        if (col + 1 < SIZE && currentBoard[row][col] === currentBoard[row][col + 1]) return true;
      }
    }

    return false;
  }

  function getTileClass(value) {
    if (value === 0) return 'tile-empty';
    if (value <= 2048) return `tile-${value}`;
    return 'tile-super';
  }

  function getMySymbol(gameState, currentUser) {
    if (!gameState || !gameState.players) return '';

    if (gameState.players.X === currentUser) return 'X';
    if (gameState.players.O === currentUser) return 'O';

    return '';
  }

  function getOpponentSymbol(mySymbol) {
    return mySymbol === 'X' ? 'O' : 'X';
  }

  function normalizePlayerData(data) {
    return {
      board: normalizeBoard(data && data.board),
      score: Number(data && data.score) || 0,
      ended: Boolean(data && data.ended),
    };
  }

  function createBoardView(title, board, score, isOpponent = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'game2048-battle-side';

    const titleEl = document.createElement('div');
    titleEl.className = 'game2048-side-title';

    const titleText = document.createElement('strong');
    titleText.textContent = title;

    const scoreText = document.createElement('span');
    scoreText.textContent = `${t('game2048Score')}: ${score}`;

    titleEl.append(titleText, scoreText);

    const boardEl = document.createElement('div');
    boardEl.className = 'game2048-board board-4';
    boardEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;

    normalizeBoard(board).forEach((row) => {
      row.forEach((value) => {
        const tile = document.createElement('div');
        tile.className = `game2048-tile ${getTileClass(value)}`;

        if (isOpponent) {
          tile.classList.add('opponent-tile');
        }

        tile.textContent = value === 0 ? '' : String(value);
        boardEl.appendChild(tile);
      });
    });

    wrapper.append(titleEl, boardEl);
    return wrapper;
  }

  function renderLobby(container, gameState, currentUser) {
    container.innerHTML = '';

    const players = Array.isArray(gameState.playersOrder)
      ? gameState.playersOrder
      : [];

    const panel = document.createElement('div');
    panel.className = 'game2048-panel';

    const header = document.createElement('div');
    header.className = 'game2048-header';

    const titleWrap = document.createElement('div');

    const title = document.createElement('h3');
    title.textContent = t('game2048Title');

    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = t('game2048LobbyHint');

    titleWrap.append(title, hint);
    header.appendChild(titleWrap);

    const lobby = document.createElement('div');
    lobby.className = 'game-lobby-card';

    const lobbyTitle = document.createElement('h4');
    lobbyTitle.textContent = t('playersList');

    const waiting = document.createElement('p');
    waiting.className = 'muted';
    waiting.textContent = t('waitingForPlayers');

    const list = document.createElement('div');
    list.className = 'game-lobby-list';

    players.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = `game-lobby-player ${player === currentUser ? 'active' : ''}`;
      item.textContent = `${index + 1}. ${player}`;
      list.appendChild(item);
    });

    lobby.append(lobbyTitle, waiting, list);
    panel.append(header, lobby);
    container.appendChild(panel);
  }

  function renderBattle(container, gameState, currentUser, callbacks = {}) {
    container.innerHTML = '';

    const mySymbol = getMySymbol(gameState, currentUser);

    if (!mySymbol) {
      container.innerHTML = `<p class="muted">${t('notPlayerInGame')}</p>`;
      return;
    }

    const opponentSymbol = getOpponentSymbol(mySymbol);

    const myData = normalizePlayerData(
      gameState.players2048 && gameState.players2048[mySymbol]
    );

    const opponentData = normalizePlayerData(
      gameState.players2048 && gameState.players2048[opponentSymbol]
    );

    /*
     * 如果 server 傳來空棋盤，就前端補一個初始棋盤並回傳 server。
     */
    if (
      gameState.status === 'active' &&
      isEmptyBoard(myData.board) &&
      callbacks &&
      typeof callbacks.on2048Move === 'function'
    ) {
      const initialBoard = createInitialBoard();

      callbacks.on2048Move({
        board: initialBoard,
        score: 0,
        ended: false,
      });

      myData.board = initialBoard;
    }

    const panel = document.createElement('div');
    panel.className = 'game2048-panel';

    const header = document.createElement('div');
    header.className = 'game2048-header';

    const titleWrap = document.createElement('div');

    const title = document.createElement('h3');
    title.textContent = t('game2048Title');

    const instruction = document.createElement('p');
    instruction.className = 'muted';
    instruction.textContent = t('game2048Instruction');

    titleWrap.append(title, instruction);

    const score = document.createElement('div');
    score.className = 'game2048-score';
    score.textContent = `${myData.score} : ${opponentData.score}`;

    header.append(titleWrap, score);

    const battle = document.createElement('div');
    battle.className = 'game2048-battle';

    battle.append(
      createBoardView(t('game2048MyBoard'), myData.board, myData.score, false),
      createBoardView(t('game2048OpponentBoard'), opponentData.board, opponentData.score, true)
    );

    const hint = document.createElement('p');
    hint.className = 'muted game2048-hint';

    if (gameState.status === 'ended') {
      if (!gameState.winner) {
        hint.textContent = t('game2048Draw');
      } else if (gameState.winner === currentUser) {
        hint.textContent = t('game2048Win');
      } else {
        hint.textContent = t('game2048Lose');
      }
    } else if (myData.ended) {
      hint.textContent = t('game2048Waiting');
    } else {
      hint.textContent = t('game2048Keyboard');
    }

    panel.append(header, battle, hint);
    container.appendChild(panel);

    battleState = {
      gameState,
      currentUser,
      callbacks,
    };
  }

  function render(container, gameState = null, currentUser = '', callbacks = {}) {
    try {
      battleState = null;

      if (!container) return;

      if (!gameState || gameState.gameId !== 'game2048') {
        container.innerHTML = '<p class="muted">2048 gameState is missing.</p>';
        return;
      }

      if (gameState.status === 'lobby') {
        renderLobby(container, gameState, currentUser);
        return;
      }

      renderBattle(container, gameState, currentUser, callbacks);
    } catch (error) {
      console.error('[game2048.js] render failed:', error, gameState);

      container.innerHTML = `
        <div class="game-lobby-card">
          <h4>2048 render error</h4>
          <p class="muted">${error.message}</p>
        </div>
      `;
    }
  }

  function handleMove(direction) {
    if (!battleState) return;

    const { gameState, currentUser, callbacks } = battleState;

    if (gameState.status !== 'active') return;

    const mySymbol = getMySymbol(gameState, currentUser);

    if (!mySymbol) return;

    const myData = normalizePlayerData(
      gameState.players2048 && gameState.players2048[mySymbol]
    );

    if (myData.ended) return;

    const oldBoard = cloneBoard(myData.board);
    const result = moveBoard(oldBoard, direction);
    const nextBoard = result.board;

    if (boardsEqual(oldBoard, nextBoard)) {
      if (!canMove(nextBoard) && callbacks && typeof callbacks.on2048Move === 'function') {
        callbacks.on2048Move({
          board: nextBoard,
          score: myData.score,
          ended: true,
        });
      }

      return;
    }

    addRandomTile(nextBoard);

    const nextScore = myData.score + result.scoreGain;
    const ended = !canMove(nextBoard);

    if (callbacks && typeof callbacks.on2048Move === 'function') {
      callbacks.on2048Move({
        board: nextBoard,
        score: nextScore,
        ended,
      });
    }
  }

  window.addEventListener('keydown', (event) => {
    if (!battleState) return;

    const keyMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const direction = keyMap[event.key];

    if (!direction) return;

    event.preventDefault();
    handleMove(direction);
  });

  window.Game2048 = {
    render,
  };
})();