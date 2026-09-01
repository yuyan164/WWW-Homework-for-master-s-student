/**
 * solo_games.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責備忘錄中的單人遊戲。
 *
 * 目前支援：
 * 1. 2048 單人版
 * 2. 踩地雷單人版
 *
 * 注意：
 * 私人聊天室與群組聊天室的多人 2048 / 踩地雷同步，
 * 會在 server.js 階段另外處理。
 * ------------------------------------------------------------
 */

(function setupSoloGamesModule() {
  if (window.SoloGamesModule) return;

  const MINE_ROWS = 10;
  const MINE_COLS = 10;
  const MINE_COUNT = 15;
  const SIZE_2048 = 4;

  let elements = {};
  let getCurrentUser = null;
  let translate = null;
  let soloState = null;

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function currentUserName() {
    return typeof getCurrentUser === 'function' ? getCurrentUser() : 'me';
  }

  function createEmpty2048Board() {
    return Array.from({ length: SIZE_2048 }, () => Array(SIZE_2048).fill(0));
  }

  function addRandomTile(board) {
    const empty = [];

    for (let r = 0; r < SIZE_2048; r += 1) {
      for (let c = 0; c < SIZE_2048; c += 1) {
        if (board[r][c] === 0) {
          empty.push([r, c]);
        }
      }
    }

    if (empty.length === 0) return;

    const [row, col] = empty[Math.floor(Math.random() * empty.length)];
    board[row][col] = Math.random() < 0.9 ? 2 : 4;
  }

  function canMove2048(board) {
    for (let r = 0; r < SIZE_2048; r += 1) {
      for (let c = 0; c < SIZE_2048; c += 1) {
        if (board[r][c] === 0) return true;
        if (r + 1 < SIZE_2048 && board[r][c] === board[r + 1][c]) return true;
        if (c + 1 < SIZE_2048 && board[r][c] === board[r][c + 1]) return true;
      }
    }

    return false;
  }

  function createSolo2048State() {
    const board = createEmpty2048Board();
    addRandomTile(board);
    addRandomTile(board);

    const user = currentUserName();
    const soloOpponent = t('soloOpponent');

    return {
      sessionId: `solo-2048-${Date.now()}`,
      gameId: 'game2048',
      gameType: 'game2048',
      players: {
        X: user,
        O: soloOpponent,
      },
      players2048: {
        X: {
          board,
          score: 0,
          ended: false,
        },
        O: {
          board: createEmpty2048Board(),
          score: 0,
          ended: true,
        },
      },
      status: 'active',
      winner: null,
      result: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
  }

  function getNeighbors(index) {
    const row = Math.floor(index / MINE_COLS);
    const col = index % MINE_COLS;
    const neighbors = [];

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;

        const nextRow = row + dr;
        const nextCol = col + dc;

        if (
          nextRow >= 0 &&
          nextRow < MINE_ROWS &&
          nextCol >= 0 &&
          nextCol < MINE_COLS
        ) {
          neighbors.push(nextRow * MINE_COLS + nextCol);
        }
      }
    }

    return neighbors;
  }

  function createSoloMinesweeperState() {
    const user = currentUserName();
    const soloOpponent = t('soloOpponent');
    const total = MINE_ROWS * MINE_COLS;

    const mineSet = new Set();

    while (mineSet.size < MINE_COUNT) {
      mineSet.add(Math.floor(Math.random() * total));
    }

    const cells = Array.from({ length: total }, (_, index) => {
      const isMine = mineSet.has(index);

      return {
        isMine,
        count: 0,
        revealed: false,
        flaggedBy: [],
      };
    });

    cells.forEach((cell, index) => {
      if (cell.isMine) return;

      cell.count = getNeighbors(index).filter((neighborIndex) => (
        cells[neighborIndex].isMine
      )).length;
    });

    return {
      sessionId: `solo-minesweeper-${Date.now()}`,
      gameId: 'minesweeper',
      gameType: 'minesweeper',
      players: {
        X: user,
        O: soloOpponent,
      },
      board: [],
      cells,
      rows: MINE_ROWS,
      cols: MINE_COLS,
      mineCount: MINE_COUNT,
      revealedCount: 0,
      turn: 'X',
      status: 'active',
      winner: null,
      result: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
  }

  function revealCell(index) {
    if (!soloState || soloState.gameId !== 'minesweeper') return;
    if (soloState.status !== 'active') return;

    const cell = soloState.cells[index];

    if (!cell || cell.revealed) return;
    if (Array.isArray(cell.flaggedBy) && cell.flaggedBy.includes(currentUserName())) return;

    if (cell.isMine) {
      cell.revealed = true;

      soloState.cells.forEach((item) => {
        if (item.isMine) item.revealed = true;
      });

      soloState.status = 'ended';
      soloState.result = 'loss';
      soloState.winner = null;
      soloState.endedAt = new Date().toISOString();

      renderCurrentSoloGame();
      return;
    }

    const queue = [index];
    const visited = new Set();

    while (queue.length > 0) {
      const currentIndex = queue.shift();

      if (visited.has(currentIndex)) continue;
      visited.add(currentIndex);

      const currentCell = soloState.cells[currentIndex];

      if (!currentCell || currentCell.revealed || currentCell.isMine) continue;

      currentCell.revealed = true;
      soloState.revealedCount += 1;

      if (currentCell.count === 0) {
        getNeighbors(currentIndex).forEach((neighborIndex) => {
          const neighbor = soloState.cells[neighborIndex];

          if (neighbor && !neighbor.revealed && !neighbor.isMine) {
            queue.push(neighborIndex);
          }
        });
      }
    }

    const totalSafeCells = MINE_ROWS * MINE_COLS - MINE_COUNT;

    if (soloState.revealedCount >= totalSafeCells) {
      soloState.status = 'ended';
      soloState.result = 'win';
      soloState.winner = currentUserName();
      soloState.endedAt = new Date().toISOString();
    }

    renderCurrentSoloGame();
  }

  function toggleFlag(index) {
    if (!soloState || soloState.gameId !== 'minesweeper') return;
    if (soloState.status !== 'active') return;

    const cell = soloState.cells[index];
    const user = currentUserName();

    if (!cell || cell.revealed) return;

    if (!Array.isArray(cell.flaggedBy)) {
      cell.flaggedBy = [];
    }

    if (cell.flaggedBy.includes(user)) {
      cell.flaggedBy = cell.flaggedBy.filter((name) => name !== user);
    } else {
      cell.flaggedBy.push(user);
    }

    renderCurrentSoloGame();
  }

  function renderCurrentSoloGame() {
    if (!soloState || !elements.gameContent) return;

    elements.gameOverlay.classList.remove('hidden');
    elements.gameTitle.textContent = window.GameRegistry.getGameName(soloState.gameId);
    elements.quitGameBtn.textContent = t('close');

    if (soloState.gameId === 'game2048' && window.Game2048) {
      window.Game2048.render(
        elements.gameContent,
        soloState,
        currentUserName(),
        {
          on2048Move(payload) {
            const playerData = soloState.players2048.X;

            playerData.board = payload.board;
            playerData.score = payload.score;
            playerData.ended = payload.ended || !canMove2048(payload.board);

            if (playerData.ended) {
              soloState.status = 'ended';
              soloState.result = 'completed';
              soloState.winner = currentUserName();
              soloState.endedAt = new Date().toISOString();
            }

            renderCurrentSoloGame();
          },
        }
      );

      return;
    }

    if (soloState.gameId === 'minesweeper' && window.Minesweeper) {
      window.Minesweeper.render(
        elements.gameContent,
        soloState,
        currentUserName(),
        {
          onMove(index) {
            revealCell(index);
          },
          onFlag(index) {
            toggleFlag(index);
          },
          onRematch() {
            open('minesweeper');
          },
        }
      );
    }
  }

  function open(gameId) {
    if (gameId === 'game2048') {
      soloState = createSolo2048State();
      renderCurrentSoloGame();
      return;
    }

    if (gameId === 'minesweeper') {
      soloState = createSoloMinesweeperState();
      renderCurrentSoloGame();
    }
  }

  function init(config = {}) {
    elements = {
      gameOverlay: config.gameOverlay,
      gameTitle: config.gameTitle,
      gameContent: config.gameContent,
      quitGameBtn: config.quitGameBtn,
    };

    getCurrentUser = config.getCurrentUser;
    translate = config.translate;
  }

  window.SoloGamesModule = {
    init,
    open,
  };
})();