/**
 * memo.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室左側的個人備忘錄功能。
 *
 * 主要功能：
 * 1. 在左側欄位建立「備忘錄」按鈕。
 * 2. 點擊後可切換到個人備忘錄模式。
 * 3. 備忘錄可以儲存文字與圖片。
 * 4. 備忘錄目前不寫入 SQLite，先儲存在使用者自己的瀏覽器 localStorage。
 * 5. 每個 nickname 會有自己的備忘錄內容。
 * 6. 備忘錄模式預留單人遊戲入口，之後可加入踩地雷、2048、蛇與梯子等遊戲。
 * 7. 支援 i18n.js 中英文字切換。
 * ------------------------------------------------------------
 */

(function setupMemoModule() {
  if (window.MemoModule) return;

  const STORAGE_PREFIX = 'chatroom_memo_messages_';

  let memoButton = null;
  let messages = [];
  let getCurrentUser = null;
  let translate = null;
  let onOpenMemo = null;

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function getStorageKey() {
    const nickname = typeof getCurrentUser === 'function' ? getCurrentUser() : 'guest';
    return `${STORAGE_PREFIX}${nickname || 'guest'}`;
  }

  function loadMessages() {
    const raw = localStorage.getItem(getStorageKey());

    if (!raw) {
      messages = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      messages = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('備忘錄讀取失敗，已重設。', error);
      messages = [];
      localStorage.removeItem(getStorageKey());
    }
  }

  function saveMessages() {
    localStorage.setItem(getStorageKey(), JSON.stringify(messages));
  }

  function getMessages() {
    return messages;
  }

  function addMessage(payload = {}) {
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : 'me';

    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    const imageData = typeof payload.imageData === 'string' ? payload.imageData : '';
    const fileData = payload.fileData || null;

    if (!text && !imageData && !fileData) return null;

    const message = {
      id: `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'memo',
      from: currentUser,
      text,
      imageData,
      fileData,
      timestamp: new Date().toISOString(),
      replyTo: payload.replyTo || null,
    };

    messages.push(message);
    saveMessages();

    return message;
  }

  function injectStyle() {
    if (document.getElementById('memoStyle')) return;

    const style = document.createElement('style');
    style.id = 'memoStyle';

    style.textContent = `
      .memo-sidebar-area {
        margin-top: auto;
        padding: 18px;
      }

      .memo-sidebar-btn {
        width: 100%;
        border: 0;
        border-radius: 999px;
        padding: 18px 22px;
        background: #9b8065;
        color: #1f1a14;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0.08em;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(35, 30, 24, 0.18);
        transition: transform 0.18s ease, background 0.18s ease;
      }

      .memo-sidebar-btn:hover {
        transform: translateY(-1px);
        background: #ad9276;
      }

      .memo-sidebar-btn.active {
        background: #ead6ba;
        color: #3f352c;
      }

      .memo-local-note {
        display: inline-flex;
        margin-top: 8px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(232, 242, 220, 0.72);
        color: #6f7d5b;
        font-size: 12px;
        font-weight: 800;
      }

      .memo-game-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9600;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(45, 42, 36, 0.58);
        backdrop-filter: blur(6px);
      }

      .memo-game-modal-backdrop.hidden {
        display: none !important;
      }

      .memo-game-modal-card {
        width: min(92vw, 560px);
        border-radius: 28px;
        padding: 24px;
        background: rgba(255, 250, 241, 0.98);
        color: #514538;
        box-shadow: 0 26px 60px rgba(35, 30, 24, 0.28);
      }

      .memo-game-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .memo-game-modal-title {
        margin: 0;
        font-size: 22px;
        font-weight: 900;
      }

      .memo-game-close-btn {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: #75614f;
        color: white;
        font-size: 22px;
        font-weight: 900;
        cursor: pointer;
      }

      .memo-game-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-top: 12px;
        }

        .memo-game-card {
        width: 100%;
        display: grid;
        grid-template-columns: 46px 1fr;
        align-items: center;
        gap: 14px;
        border: 1px solid rgba(117, 97, 79, 0.18);
        border-radius: 20px;
        padding: 15px 18px;
        background: rgba(232, 242, 220, 0.62);
        text-align: left;
        font-weight: 900;
        color: #5b4b3d;
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.08);
        }

        .memo-game-card span {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(255, 250, 241, 0.86);
        font-size: 24px;
        }

        .memo-game-name {
        font-size: 16px;
        font-weight: 900;
        }

      @media (max-width: 720px) {
        .memo-game-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createMemoButton(sidebarContainer) {
    if (document.getElementById('memoSidebarBtn')) {
      memoButton = document.getElementById('memoSidebarBtn');
      return;
    }

    const area = document.createElement('div');
    area.id = 'memoSidebarArea';
    area.className = 'memo-sidebar-area';

    memoButton = document.createElement('button');
    memoButton.id = 'memoSidebarBtn';
    memoButton.type = 'button';
    memoButton.className = 'memo-sidebar-btn';
    memoButton.textContent = t('memo');

    memoButton.addEventListener('click', () => {
      openMemo();
    });

    area.appendChild(memoButton);

    if (sidebarContainer) {
      sidebarContainer.appendChild(area);
    } else {
      document.body.appendChild(area);
    }
  }

  function setActive(isActive) {
    if (!memoButton) return;
    memoButton.classList.toggle('active', Boolean(isActive));
  }

  function updateText() {
    if (memoButton) {
        memoButton.textContent = t('memo');
    }

    const title = document.getElementById('memoGameModalTitle');
    if (title) title.textContent = t('singlePlayerGames');

    const minesweeper = document.getElementById('memoGameMinesweeper');
    if (minesweeper) minesweeper.textContent = t('minesweeperName');

    const game2048 = document.getElementById('memoGame2048');
    if (game2048) game2048.textContent = t('game2048Name');
    }

  function openMemo() {
    loadMessages();

    if (typeof onOpenMemo === 'function') {
      onOpenMemo();
    }
  }

  function createLocalNoteElement() {
    const note = document.createElement('span');
    note.className = 'memo-local-note';
    note.textContent = t('memoSavedOnlyLocal');
    return note;
  }

  function createGameModal() {
    let modal = document.getElementById('memoGameModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'memoGameModal';
    modal.className = 'memo-game-modal-backdrop hidden';

    modal.innerHTML = `
        <section class="memo-game-modal-card">
        <header class="memo-game-modal-header">
            <h2 id="memoGameModalTitle" class="memo-game-modal-title"></h2>
            <button id="memoGameCloseBtn" type="button" class="memo-game-close-btn">×</button>
        </header>

        <div class="memo-game-grid">
            <div class="memo-game-card">
            <span>💣</span>
            <div id="memoGameMinesweeper" class="memo-game-name"></div>
            </div>

            <div class="memo-game-card">
            <span>🔢</span>
            <div id="memoGame2048" class="memo-game-name"></div>
            </div>
        </div>
        </section>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#memoGameCloseBtn');

    closeBtn.addEventListener('click', closeSoloGamePlaceholder);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
        closeSoloGamePlaceholder();
        }
    });

    updateText();
    return modal;
    }

  function openSoloGamePlaceholder() {
    const modal = createGameModal();
    updateText();
    modal.classList.remove('hidden');
  }

  function closeSoloGamePlaceholder() {
    const modal = document.getElementById('memoGameModal');
    if (modal) modal.classList.add('hidden');
  }

  function init(config = {}) {
    getCurrentUser = config.getCurrentUser;
    translate = config.translate;
    onOpenMemo = config.onOpenMemo;

    injectStyle();
    createMemoButton(config.sidebarContainer);
    createGameModal();
    loadMessages();
    updateText();

    window.addEventListener('languageChanged', updateText);
  }

  window.MemoModule = {
    init,
    openMemo,
    getMessages,
    addMessage,
    setActive,
    createLocalNoteElement,
    openSoloGamePlaceholder,
    loadMessages,
  };
})();