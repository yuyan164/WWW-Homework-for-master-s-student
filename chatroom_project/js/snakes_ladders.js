/**
 * snakes_ladders.js
 * ------------------------------------------------------------
 * 檔案名稱：snakes_ladders.js
 * 檔案用途：本檔案負責蛇與梯子遊戲的前端畫面與動畫。
 *
 * 主要功能：
 * 1. 顯示蛇與梯子棋盤圖片。
 * 2. 顯示 2 到 4 位玩家的棋子。
 * 3. 提供玩家選擇棋子顏色。
 * 4. 顯示群組遊戲開始前的等待室。
 * 5. 顯示骰子動畫，不會直接跳出數字。
 * 6. 棋子一般移動時會一格一格滑過。
 * 7. 遇到蛇或梯子時，第二段會直接從起點直線滑到終點。
 * 8. 若超過 100 不能前進，畫面會出現哭泣表情動畫。
 *
 * 注意事項：
 * 1. 真正的擲骰結果、勝負判斷與回合順序會由 server.js 控制。
 * 2. 本檔案只負責畫面、按鈕與動畫。
 * 3. 圖片來源固定放在 /uploads/ 資料夾。
 * ------------------------------------------------------------
 */

(function setupSnakesLadders() {
  if (window.SnakesLadders) return;

  const BOARD_IMAGE = '/uploads/SnakeAndLadder.png';

  const PIECES = {
    green: {
      key: 'pieceGreen',
      labelZh: '綠色',
      labelEn: 'Green',
      image: '/uploads/green.png',
    },
    yellow: {
      key: 'pieceYellow',
      labelZh: '黃色',
      labelEn: 'Yellow',
      image: '/uploads/yellow.png',
    },
    blue: {
      key: 'pieceBlue',
      labelZh: '藍色',
      labelEn: 'Blue',
      image: '/uploads/blue.png',
    },
    red: {
      key: 'pieceRed',
      labelZh: '紅色',
      labelEn: 'Red',
      image: '/uploads/red.png',
    },
  };

  /*
   * 蛇與梯子規則：
   * 梯子：5→58、14→49、53→72、64→83
   * 蛇：97→61、91→73、76→54、51→10、38→20
   */
  const SPECIAL_MOVES = {
    5: 58,
    14: 49,
    53: 72,
    64: 83,
    97: 61,
    91: 73,
    76: 54,
    51: 10,
    38: 20,
  };

  let diceAnimationTimer = null;

  /* 記錄上一個已經播放過的移動動畫， * 避免每次 render 或切換語言時一直重播同一段移動。*/
  let lastAnimatedMoveKey = '';

  function t(key, params = {}) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function getCurrentLanguage() {
    if (window.i18n && typeof window.i18n.getLanguage === 'function') {
      return window.i18n.getLanguage();
    }

    return 'zh';
  }

  function getPieceLabel(color) {
    const piece = PIECES[color];

    if (!piece) return color;

    return getCurrentLanguage() === 'en'
      ? piece.labelEn
      : piece.labelZh;
  }

  function injectStyle() {
    if (document.getElementById('snakesLaddersStyle')) return;

    const style = document.createElement('style');
    style.id = 'snakesLaddersStyle';

    style.textContent = `
      .sl-panel {
        width: min(100%, 980px);
        margin: 0 auto;
        display: grid;
        gap: 16px;
        color: #4d4034;
      }

      .sl-status-card {
        display: grid;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 20px;
        background: rgba(255, 250, 241, 0.92);
        border: 1px solid rgba(117, 97, 79, 0.16);
        box-shadow: 0 10px 24px rgba(45, 42, 36, 0.10);
      }

      .sl-status-title {
        margin: 0;
        font-size: 18px;
        font-weight: 900;
      }

      .sl-status-text {
        margin: 0;
        color: rgba(63, 58, 52, 0.72);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.5;
      }

      .sl-lobby-grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
      }

      .sl-lobby-card {
        padding: 16px;
        border-radius: 22px;
        background: rgba(255, 250, 241, 0.92);
        border: 1px solid rgba(117, 97, 79, 0.16);
        box-shadow: 0 10px 24px rgba(45, 42, 36, 0.08);
      }

      .sl-lobby-card h3 {
        margin: 0 0 12px;
        font-size: 17px;
      }

      .sl-player-list {
        display: grid;
        gap: 10px;
      }

      .sl-player-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(232, 242, 220, 0.62);
        font-weight: 800;
      }

      .sl-player-color {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: rgba(63, 58, 52, 0.72);
        font-size: 13px;
      }

      .sl-player-piece-preview {
        width: 24px;
        height: 24px;
        object-fit: contain;
      }

      .sl-color-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .sl-color-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 54px;
        border: 0;
        border-radius: 16px;
        background: rgba(232, 242, 220, 0.78);
        color: #4d4034;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 8px 16px rgba(45, 42, 36, 0.08);
      }

      .sl-color-btn:disabled {
        opacity: 0.42;
        cursor: not-allowed;
        box-shadow: none;
      }

      .sl-color-btn img {
        width: 30px;
        height: 30px;
        object-fit: contain;
      }

      .sl-start-area {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }

      .sl-start-hint {
        margin: 0;
        color: rgba(63, 58, 52, 0.68);
        font-size: 13px;
        font-weight: 700;
      }

      .sl-game-layout {
        display: grid;
        grid-template-columns: minmax(320px, 680px) minmax(220px, 280px);
        gap: 16px;
        align-items: start;
      }

      .sl-board-wrap {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 22px;
        overflow: hidden;
        background: rgba(255, 250, 241, 0.8);
        box-shadow: 0 16px 34px rgba(45, 42, 36, 0.16);
        border: 1px solid rgba(117, 97, 79, 0.16);
      }

      .sl-board-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        user-select: none;
        pointer-events: none;
      }

      .sl-piece {
        position: absolute;
        width: 7.4%;
        height: 7.4%;
        transform: translate(-50%, -50%);
        object-fit: contain;
        filter: drop-shadow(0 7px 8px rgba(45, 42, 36, 0.34));
        transition: left 0.34s ease, top 0.34s ease, transform 0.2s ease;
        z-index: 4;
      }

      .sl-piece.active-turn {
        transform: translate(-50%, -50%) scale(1.12);
        filter: drop-shadow(0 8px 12px rgba(255, 193, 94, 0.74));
      }

      .sl-cry {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        font-size: clamp(52px, 9vw, 94px);
        z-index: 10;
        pointer-events: none;
        animation: slCryPop 2s ease-in-out forwards;
      }

      @keyframes slCryPop {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.2);
        }
        25% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.28);
        }
        65% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.92);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.86);
        }
      }

      .sl-side-panel {
        display: grid;
        gap: 14px;
      }

      .sl-dice-card,
      .sl-turn-card,
      .sl-rules-card {
        padding: 16px;
        border-radius: 22px;
        background: rgba(255, 250, 241, 0.92);
        border: 1px solid rgba(117, 97, 79, 0.16);
        box-shadow: 0 10px 24px rgba(45, 42, 36, 0.08);
      }

      .sl-dice-box {
        width: 86px;
        height: 86px;
        margin: 10px auto 14px;
        display: grid;
        place-items: center;
        border-radius: 24px;
        background: rgba(232, 242, 220, 0.86);
        color: #4d4034;
        font-size: 42px;
        font-weight: 950;
        box-shadow: inset 0 0 0 2px rgba(111, 125, 91, 0.16);
      }

      .sl-dice-box.rolling {
        animation: slDicePulse 0.18s ease-in-out infinite alternate;
      }

      @keyframes slDicePulse {
        from {
          transform: rotate(-3deg) scale(0.98);
        }

        to {
          transform: rotate(3deg) scale(1.04);
        }
      }

      .sl-roll-btn {
        width: 100%;
      }

      .sl-turn-list {
        display: grid;
        gap: 8px;
      }

      .sl-turn-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        border-radius: 14px;
        background: rgba(232, 242, 220, 0.5);
        font-weight: 800;
      }

      .sl-turn-row.current {
        background: rgba(255, 225, 153, 0.7);
      }

      .sl-turn-row img {
        width: 24px;
        height: 24px;
        object-fit: contain;
      }

      .sl-position {
        margin-left: auto;
        color: rgba(63, 58, 52, 0.62);
        font-size: 13px;
      }

      .sl-result-banner {
        padding: 14px 16px;
        border-radius: 20px;
        background: rgba(232, 242, 220, 0.88);
        font-size: 18px;
        font-weight: 950;
        text-align: center;
      }

      @media (max-width: 860px) {
        .sl-lobby-grid,
        .sl-game-layout {
          grid-template-columns: 1fr;
        }

        .sl-board-wrap {
          max-width: 620px;
          margin: 0 auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getCellPosition(number) {
    /*
     * 棋盤走法：
     * 1~10 左到右，11~20 右到左，依此類推往上。
     */
    const n = Math.max(1, Math.min(100, Number(number || 1)));
    const zero = n - 1;
    const rowFromBottom = Math.floor(zero / 10);
    const indexInRow = zero % 10;
    const col = rowFromBottom % 2 === 0
      ? indexInRow
      : 9 - indexInRow;
    const rowFromTop = 9 - rowFromBottom;

    return {
      left: `${(col + 0.5) * 10}%`,
      top: `${(rowFromTop + 0.5) * 10}%`,
    };
  }

  function getPlayerColor(gameState, nickname) {
    if (!gameState || !gameState.colorByPlayer) return '';
    return gameState.colorByPlayer[nickname] || '';
  }

  function getMoveKey(gameState) {
    if (!gameState || !gameState.lastMove) return '';

    const move = gameState.lastMove;

    return [
        gameState.sessionId || '',
        move.player || '',
        move.start || '',
        move.end || '',
        move.dice || '',
        move.specialMove ? `${move.specialMove.from}-${move.specialMove.to}` : '',
        move.bounced ? 'bounced' : 'moved',
    ].join('|');
  }

  function shouldAnimateCurrentMove(gameState) {
    const moveKey = getMoveKey(gameState);

    if (!moveKey) return false;

    return moveKey !== lastAnimatedMoveKey;
  }

  function getRenderPositionForPlayer(gameState, nickname) {
    /*
    * 修正重點：
    * 如果這次 render 是因為某位玩家剛移動，
    * 不要直接把該玩家棋子畫在最終位置。
    * 要先畫在 start，再由 animateLastMove 一格一格滑到終點。
    */
    if (
        shouldAnimateCurrentMove(gameState) &&
        gameState.lastMove &&
        gameState.lastMove.player === nickname
    ) {
        return gameState.lastMove.start || 1;
    }

    const positions = gameState.positions || {};
    return positions[nickname] || 1;
  }

  function getUsedColors(gameState) {
    if (!gameState || !gameState.colorByPlayer) return new Set();
    return new Set(Object.values(gameState.colorByPlayer).filter(Boolean));
  }

  function isJoined(gameState, currentUser) {
    return Array.isArray(gameState.playersOrder) && gameState.playersOrder.includes(currentUser);
  }

  function hasSelectedColor(gameState, currentUser) {
    return Boolean(getPlayerColor(gameState, currentUser));
  }

  function canRoll(gameState, currentUser) {
    if (!gameState || gameState.status !== 'active') return false;
    return gameState.currentPlayer === currentUser && !gameState.isMoving;
  }

  function canStartGame(gameState, currentUser) {
    if (!gameState || gameState.status !== 'lobby') return false;
    if (gameState.host !== currentUser) return false;

    const players = gameState.playersOrder || [];
    if (players.length < 2) return false;

    return players.every((player) => Boolean(getPlayerColor(gameState, player)));
  }

  function createPlayerList(gameState) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sl-player-list';

    const players = gameState.playersOrder || [];

    players.forEach((nickname, index) => {
      const color = getPlayerColor(gameState, nickname);
      const row = document.createElement('div');
      row.className = 'sl-player-row';

      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${nickname}`;

      const colorLabel = document.createElement('span');
      colorLabel.className = 'sl-player-color';

      if (color && PIECES[color]) {
        const img = document.createElement('img');
        img.className = 'sl-player-piece-preview';
        img.src = PIECES[color].image;
        img.alt = getPieceLabel(color);
        colorLabel.append(img, document.createTextNode(getPieceLabel(color)));
      } else {
        colorLabel.textContent = t('snakesLaddersNoColor');
      }

      row.append(name, colorLabel);
      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function createColorPicker(gameState, currentUser, callbacks) {
    const card = document.createElement('div');
    card.className = 'sl-lobby-card';

    const title = document.createElement('h3');
    title.textContent = t('snakesLaddersChoosePiece');

    const grid = document.createElement('div');
    grid.className = 'sl-color-grid';

    const usedColors = getUsedColors(gameState);
    const myColor = getPlayerColor(gameState, currentUser);
    const joined = isJoined(gameState, currentUser);

    Object.keys(PIECES).forEach((color) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sl-color-btn';

        const img = document.createElement('img');
        img.src = PIECES[color].image;
        img.alt = getPieceLabel(color);

        const label = document.createElement('span');
        label.textContent = getPieceLabel(color);

        button.append(img, label);

        const colorTakenByOther = usedColors.has(color) && myColor !== color;

        /*
        * 只有「不是本局玩家」或「顏色被別人選走」時才 disabled。
        * 這裡特別保留 console，方便確認按鈕是否真的有觸發。
        */
        button.disabled = !joined || colorTakenByOther;

        if (myColor === color) {
        button.classList.add('selected');
        label.textContent = `${getPieceLabel(color)} ✓`;
        }

        button.addEventListener('click', () => {
        console.log('[SnakesLadders] clicked color:', {
            color,
            currentUser,
            joined,
            sessionId: gameState.sessionId,
        });

        if (button.disabled) return;

        if (callbacks && typeof callbacks.onChooseColor === 'function') {
            callbacks.onChooseColor(color);
        }
        });

        grid.appendChild(button);
    });

    card.append(title, grid);
    return card;
    }

  function createLobby(container, gameState, currentUser, callbacks) {
    const panel = document.createElement('div');
    panel.className = 'sl-panel';

    const statusCard = document.createElement('div');
    statusCard.className = 'sl-status-card';

    const title = document.createElement('h3');
    title.className = 'sl-status-title';
    title.textContent = t('snakesLaddersLobbyTitle');

    const text = document.createElement('p');
    text.className = 'sl-status-text';

    const playerCount = Array.isArray(gameState.playersOrder)
      ? gameState.playersOrder.length
      : 0;

    text.textContent = t('snakesLaddersLobbyHint', {
      count: playerCount,
    });

    statusCard.append(title, text);

    const grid = document.createElement('div');
    grid.className = 'sl-lobby-grid';

    const playersCard = document.createElement('div');
    playersCard.className = 'sl-lobby-card';

    const playersTitle = document.createElement('h3');
    playersTitle.textContent = t('snakesLaddersPlayers');

    playersCard.append(playersTitle, createPlayerList(gameState));

    const colorCard = createColorPicker(gameState, currentUser, callbacks);

    grid.append(playersCard, colorCard);

    const startArea = document.createElement('div');
    startArea.className = 'sl-start-area';

    if (canStartGame(gameState, currentUser)) {
      const startButton = document.createElement('button');
      startButton.type = 'button';
      startButton.className = 'primary-btn full-width';
      startButton.textContent = t('startGame');

      startButton.addEventListener('click', () => {
        console.log('[snakes_ladders.js] Start game button clicked:', {
            sessionId: gameState.sessionId,
            currentUser,
            host: gameState.host,
            playersOrder: gameState.playersOrder,
            colorByPlayer: gameState.colorByPlayer,
        });

        if (callbacks && typeof callbacks.onStartGame === 'function') {
            callbacks.onStartGame();
        }
        });

      startArea.appendChild(startButton);
    } else {
      const hint = document.createElement('p');
      hint.className = 'sl-start-hint';

      if (gameState.host === currentUser) {
        hint.textContent = t('snakesLaddersStartHintHost');
      } else {
        hint.textContent = t('snakesLaddersStartHintGuest');
      }

      startArea.appendChild(hint);
    }

    panel.append(statusCard, grid, startArea);
    container.appendChild(panel);
  }

  function createBoard(gameState, currentUser, callbacks) {
    const layout = document.createElement('div');
    layout.className = 'sl-game-layout';

    const boardWrap = document.createElement('div');
    boardWrap.className = 'sl-board-wrap';

    const boardImg = document.createElement('img');
    boardImg.className = 'sl-board-image';
    boardImg.src = BOARD_IMAGE;
    boardImg.alt = t('snakesLaddersName');

    boardWrap.appendChild(boardImg);

    const players = gameState.playersOrder || [];

    players.forEach((nickname) => {
        const color = getPlayerColor(gameState, nickname);
        if (!color || !PIECES[color]) return;

        const piece = document.createElement('img');
        piece.className = 'sl-piece';
        piece.dataset.player = nickname;
        piece.src = PIECES[color].image;
        piece.alt = nickname;

        if (nickname === gameState.currentPlayer && gameState.status === 'active') {
        piece.classList.add('active-turn');
        }

        /*
        * 修正瞬移問題：
        * 如果這一回合要播放移動動畫，先把移動中的玩家畫在起點。
        * 其他玩家照目前位置顯示。
        */
        const number = getRenderPositionForPlayer(gameState, nickname);
        const position = getCellPosition(number);

        piece.style.left = position.left;
        piece.style.top = position.top;

        boardWrap.appendChild(piece);
    });

    const side = createSidePanel(gameState, currentUser, callbacks);

    layout.append(boardWrap, side);
    return layout;
  }

  function createSidePanel(gameState, currentUser, callbacks) {
    const side = document.createElement('aside');
    side.className = 'sl-side-panel';

    if (gameState.status === 'ended') {
      const result = document.createElement('div');
      result.className = 'sl-result-banner';

      if (gameState.winner === currentUser) {
        result.textContent = t('youWin');
      } else {
        result.textContent = t('snakesLaddersWinner', {
          winner: gameState.winner || '',
        });
      }

      side.appendChild(result);
    }

    const diceCard = document.createElement('div');
    diceCard.className = 'sl-dice-card';

    const diceTitle = document.createElement('h3');
    diceTitle.textContent = t('snakesLaddersDice');

    const diceBox = document.createElement('div');
    diceBox.className = 'sl-dice-box';
    diceBox.id = 'slDiceBox';
    
    /*如果這次 render 會播放移動動畫，
     * 先顯示 ?，等骰子動畫跑完才顯示真正點數。*/
    if (shouldAnimateCurrentMove(gameState) && gameState.lastDice) {
        diceBox.textContent = '?';
    } else {
        diceBox.textContent = gameState.lastDice || '?';
    }

    const rollButton = document.createElement('button');
    rollButton.type = 'button';
    rollButton.className = 'primary-btn sl-roll-btn';
    rollButton.textContent = t('rollDice');
    rollButton.disabled = !canRoll(gameState, currentUser);

    rollButton.addEventListener('click', () => {
    /* 這裡先播放等待動畫。
     * server 回傳 gameState 後，render 會再播放一次帶有真正結果的動畫。 */
    startDiceAnimation(diceBox);

    if (callbacks && typeof callbacks.onRollDice === 'function') {
        callbacks.onRollDice();
    }
    });

    diceCard.append(diceTitle, diceBox, rollButton);

    const turnCard = document.createElement('div');
    turnCard.className = 'sl-turn-card';

    const turnTitle = document.createElement('h3');
    turnTitle.textContent = t('snakesLaddersTurnOrder');

    const turnList = document.createElement('div');
    turnList.className = 'sl-turn-list';

    const players = gameState.playersOrder || [];
    const positions = gameState.positions || {};

    players.forEach((nickname) => {
      const color = getPlayerColor(gameState, nickname);
      const row = document.createElement('div');
      row.className = `sl-turn-row ${nickname === gameState.currentPlayer ? 'current' : ''}`;

      if (color && PIECES[color]) {
        const img = document.createElement('img');
        img.src = PIECES[color].image;
        img.alt = getPieceLabel(color);
        row.appendChild(img);
      }

      const name = document.createElement('span');
      name.textContent = nickname;

      const pos = document.createElement('span');
      pos.className = 'sl-position';
      pos.textContent = t('snakesLaddersPosition', {
        position: positions[nickname] || 1,
      });

      row.append(name, pos);
      turnList.appendChild(row);
    });

    turnCard.append(turnTitle, turnList);

    const rulesCard = document.createElement('div');
    rulesCard.className = 'sl-rules-card';
    rulesCard.innerHTML = `
      <h3>${t('snakesLaddersRulesTitle')}</h3>
      <p class="muted">${t('snakesLaddersRulesText')}</p>
    `;

    side.append(diceCard, turnCard, rulesCard);
    return side;
  }

  function startDiceAnimation(diceBox, finalNumber = null, onFinished = null) {
    if (!diceBox) {
        if (typeof onFinished === 'function') onFinished();
        return;
    }

    if (diceAnimationTimer) {
        clearInterval(diceAnimationTimer);
        diceAnimationTimer = null;
    }

    diceBox.classList.add('rolling');

    let counter = 0;

    diceAnimationTimer = setInterval(() => {
        counter += 1;

        /*
        * 動畫期間快速跳 1–6，
        * 讓使用者感覺正在擲骰子。
        */
        diceBox.textContent = String(Math.floor(Math.random() * 6) + 1);

        if (counter >= 16) {
        clearInterval(diceAnimationTimer);
        diceAnimationTimer = null;
        diceBox.classList.remove('rolling');

        /*
        * 動畫結束後才顯示 server 決定的真正骰子點數。
        */
        if (finalNumber !== null && finalNumber !== undefined) {
            diceBox.textContent = String(finalNumber);
        }

        /*
        * 重點：
        * 棋子移動、蛇梯滑行、哭臉動畫都要等骰子動畫結束後才開始。
        */
        if (typeof onFinished === 'function') {
            onFinished();
        }
        }
    }, 80);
  }

  function showCryAnimation(boardWrap) {
    /*
    * 超過 100 原地不動時，顯示哭臉動畫。
    * 這個函式會由 animateLastMove 在骰子動畫結束後呼叫，
    * 避免骰子還在轉時哭臉就先出現。
    */
    if (!boardWrap) return;

    const oldCry = boardWrap.querySelector('.sl-cry');
    if (oldCry) oldCry.remove();

    const cry = document.createElement('div');
    cry.className = 'sl-cry';
    cry.textContent = '😭';

    boardWrap.appendChild(cry);

    window.setTimeout(() => {
        cry.remove();
    }, 2100);
  }

  function animateLastMove(container, gameState) {
    /*
    * 這個函式會在 server 傳回 lastMove 時啟動。
    *
    * 修正重點：
    * 1. render 時棋子先放在 lastMove.start。
    * 2. 先完整播放骰子動畫。
    * 3. 骰子動畫結束後，才開始棋子移動或哭臉動畫。
    * 4. 一般移動是一格一格走。
    * 5. 蛇或梯子第二段是 from → to 直線滑行。
    */
    if (!gameState || !gameState.lastMove) return;

    const moveKey = getMoveKey(gameState);

    if (!moveKey || moveKey === lastAnimatedMoveKey) return;

    const lastMove = gameState.lastMove;
    if (!lastMove.player) return;

    const boardWrap = container.querySelector('.sl-board-wrap');
    if (!boardWrap) return;

    const piece = boardWrap.querySelector(`.sl-piece[data-player="${CSS.escape(lastMove.player)}"]`);
    const diceBox = container.querySelector('#slDiceBox');

    if (!piece) return;

    /*
    * 這裡先設定為已播放，避免 render 或語言切換時重複播放同一段動畫。
    */
    lastAnimatedMoveKey = moveKey;

    function startMoveAfterDice() {
        /*
        * 超過 100：
        * 不移動棋子，只在骰子動畫結束後顯示哭臉。
        */
        if (lastMove.bounced) {
        showCryAnimation(boardWrap);
        return;
        }

        let delay = 120;

        /*
        * 一般移動：
        * 等骰子動畫結束後，才開始一格一格滑過去。
        */
        if (Array.isArray(lastMove.path)) {
        lastMove.path.forEach((cellNumber) => {
            window.setTimeout(() => {
            const position = getCellPosition(cellNumber);
            piece.style.left = position.left;
            piece.style.top = position.top;
            }, delay);

            delay += 360;
        });
        }

        /*
        * 蛇或梯子：
        * 等一般步數走完後，再從蛇頭 / 梯子底部直線滑到終點。
        */
        if (lastMove.specialMove && lastMove.specialMove.from && lastMove.specialMove.to) {
        window.setTimeout(() => {
            const position = getCellPosition(lastMove.specialMove.to);
            piece.style.left = position.left;
            piece.style.top = position.top;
        }, delay + 220);
        }
    }

    /*
    * 重點：
    * 先播放骰子動畫，動畫結束後才呼叫 startMoveAfterDice。
    */
    if (gameState.lastDice) {
        startDiceAnimation(diceBox, gameState.lastDice, startMoveAfterDice);
    } else {
        startMoveAfterDice();
    }
  }

  function render(container, gameState, currentUser, callbacks = {}) {
    injectStyle();

    if (!container || !gameState) return;

    container.innerHTML = '';

    if (gameState.status === 'lobby') {
      createLobby(container, gameState, currentUser, callbacks);
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'sl-panel';

    const statusCard = document.createElement('div');
    statusCard.className = 'sl-status-card';

    const title = document.createElement('h3');
    title.className = 'sl-status-title';
    title.textContent = t('snakesLaddersName');

    const statusText = document.createElement('p');
    statusText.className = 'sl-status-text';

    if (gameState.status === 'ended') {
      statusText.textContent = t('gameEnded', {
        result: gameState.result || '',
        winner: gameState.winner || '',
      });
    } else if (gameState.currentPlayer === currentUser) {
      statusText.textContent = t('yourTurn');
    } else {
      statusText.textContent = t('snakesLaddersWaitingFor', {
        player: gameState.currentPlayer || '',
      });
    }

    statusCard.append(title, statusText);
    panel.append(statusCard, createBoard(gameState, currentUser, callbacks));

    container.appendChild(panel);

    animateLastMove(container, gameState);
  }

  window.SnakesLadders = {
    render,
    getCellPosition,
    specialMoves: SPECIAL_MOVES,
  };
})();