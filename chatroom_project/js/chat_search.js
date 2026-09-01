/**
 * chat_search.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室「關鍵字搜尋對話紀錄」功能。
 *
 * 主要功能：
 * 1. 將原本右上角「已連線」位置改成搜尋框。
 * 2. 可搜尋目前畫面中的聊天訊息。
 * 3. 支援私人聊天室、群組聊天室與備忘錄畫面。
 * 4. 搜尋時會高亮符合關鍵字的文字。
 * 5. 不符合搜尋條件的訊息會淡化顯示。
 * 6. 若搜尋結果不只一筆，可用「上一筆 / 下一筆」按鈕跳到對應訊息位置。
 * 7. 支援 i18n.js 中英文字切換。
 *
 * 注意事項：
 * 本功能目前搜尋的是「目前畫面已載入的訊息」。
 * 若未來要搜尋 SQLite 中所有歷史紀錄，才需要再擴充 server.js 與 db.js。
 * ------------------------------------------------------------
 */

(function setupChatSearchModule() {
  if (window.ChatSearchModule) return;

  let mounted = false;
  let keyword = '';
  let searchHostElement = null;
  let messageArea = null;
  let translate = null;
  let onSearchChanged = null;

  let searchInput = null;
  let previousButton = null;
  let nextButton = null;
  let clearButton = null;
  let resultText = null;

  /*
   * matchedRows：目前搜尋到的訊息列。
   * activeMatchIndex：目前正在定位的搜尋結果索引。
   */
  let matchedRows = [];
  let activeMatchIndex = -1;

  function t(key, params = {}) {
    if (typeof translate === 'function') {
      return translate(key, params);
    }

    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, params);
    }

    return key;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function injectStyle() {
    if (document.getElementById('chatSearchStyle')) return;

    const style = document.createElement('style');
    style.id = 'chatSearchStyle';

    style.textContent = `
      /*
       * 聊天搜尋框樣式
       * 放置於原本右上角 connectionStatus 的位置。
       */
      .chat-search-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 300px;
        max-width: 430px;
        padding: 6px 8px;
        border-radius: 999px;
        background: rgba(255, 250, 241, 0.92);
        border: 1px solid rgba(111, 125, 91, 0.16);
        box-shadow: 0 8px 18px rgba(45, 42, 36, 0.08);
      }

      .chat-search-input {
        flex: 1;
        min-width: 80px;
        border: 0;
        outline: 0;
        background: transparent;
        color: #5b4b3d;
        font-size: 13px;
        font-weight: 700;
      }

      .chat-search-input::placeholder {
        color: rgba(91, 75, 61, 0.52);
      }

      .chat-search-nav-btn,
      .chat-search-clear {
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 50%;
        background: rgba(117, 97, 79, 0.14);
        color: #5b4b3d;
        font-size: 13px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        transition: transform 0.16s ease, background 0.16s ease, opacity 0.16s ease;
      }

      .chat-search-nav-btn:hover,
      .chat-search-clear:hover {
        transform: translateY(-1px);
        background: rgba(117, 97, 79, 0.22);
      }

      .chat-search-nav-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        transform: none;
      }

      .chat-search-clear.hidden {
        display: none !important;
      }

      .chat-search-result {
        white-space: nowrap;
        font-size: 11px;
        font-weight: 800;
        color: #6f7d5b;
      }

      .search-highlight {
        padding: 0 2px;
        border-radius: 4px;
        background: rgba(255, 209, 102, 0.72);
        color: #3f352c;
        font-weight: 900;
      }

      .message-row.search-dimmed {
        opacity: 0.25;
        filter: grayscale(0.25);
      }

      .message-row.search-matched {
        opacity: 1;
      }

      /*
       * 目前定位到的搜尋結果。
       * 按上一筆 / 下一筆時，會在該訊息框外加一圈提示。
       */
      .message-row.search-current .message-bubble {
        outline: 3px solid rgba(255, 193, 94, 0.86);
        box-shadow: 0 0 0 6px rgba(255, 193, 94, 0.18), 0 12px 26px rgba(45, 42, 36, 0.14);
      }

      @media (max-width: 900px) {
        .chat-search-wrap {
          min-width: 240px;
          max-width: 310px;
        }

        .chat-search-result {
          display: none;
        }
      }

      @media (max-width: 720px) {
        .chat-search-wrap {
          min-width: 190px;
          max-width: 240px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildSearchBox() {
    if (!searchHostElement) return;

    /*
    * 搜尋框現在使用 index.html 裡的 #chatSearchHost，
    * 不再使用 #connectionStatus。
    * 這樣切換中英文時，就不會被 i18n 改成「連線中...」。
    */
    searchHostElement.classList.add('chat-search-wrap');
    searchHostElement.innerHTML = '';

    searchInput = document.createElement('input');
    searchInput.id = 'chatSearchInput';
    searchInput.type = 'search';
    searchInput.className = 'chat-search-input';
    searchInput.placeholder = t('searchMessages');
    searchInput.autocomplete = 'off';

    previousButton = document.createElement('button');
    previousButton.id = 'previousChatSearchBtn';
    previousButton.type = 'button';
    previousButton.className = 'chat-search-nav-btn';
    previousButton.textContent = '↑';
    previousButton.title = t('searchPreviousResult');
    previousButton.setAttribute('aria-label', t('searchPreviousResult'));
    previousButton.disabled = true;

    nextButton = document.createElement('button');
    nextButton.id = 'nextChatSearchBtn';
    nextButton.type = 'button';
    nextButton.className = 'chat-search-nav-btn';
    nextButton.textContent = '↓';
    nextButton.title = t('searchNextResult');
    nextButton.setAttribute('aria-label', t('searchNextResult'));
    nextButton.disabled = true;

    clearButton = document.createElement('button');
    clearButton.id = 'clearChatSearchBtn';
    clearButton.type = 'button';
    clearButton.className = 'chat-search-clear hidden';
    clearButton.textContent = '×';
    clearButton.title = t('clearSearch');
    clearButton.setAttribute('aria-label', t('clearSearch'));

    resultText = document.createElement('span');
    resultText.id = 'chatSearchResultText';
    resultText.className = 'chat-search-result';

    searchInput.addEventListener('input', () => {
        keyword = searchInput.value.trim();
        activeMatchIndex = -1;
        updateClearButton();

        if (typeof onSearchChanged === 'function') {
        onSearchChanged();
        } else {
        applySearch(messageArea);
        }
    });

    previousButton.addEventListener('click', () => {
        goToPreviousMatch();
    });

    nextButton.addEventListener('click', () => {
        goToNextMatch();
    });

    clearButton.addEventListener('click', () => {
        keyword = '';
        activeMatchIndex = -1;
        matchedRows = [];
        searchInput.value = '';
        updateClearButton();

        if (typeof onSearchChanged === 'function') {
        onSearchChanged();
        } else {
        applySearch(messageArea);
        }

        searchInput.focus();
    });

    searchHostElement.append(
        searchInput,
        previousButton,
        nextButton,
        clearButton,
        resultText
    );

    mounted = true;
    }

  function updateClearButton() {
    if (!clearButton) return;
    clearButton.classList.toggle('hidden', keyword.length === 0);
  }

  function updateNavigationButtons() {
    const canNavigate = matchedRows.length > 1;

    if (previousButton) {
      previousButton.disabled = !canNavigate;
    }

    if (nextButton) {
      nextButton.disabled = !canNavigate;
    }
  }

  function updateText() {
    if (searchInput) {
      searchInput.placeholder = t('searchMessages');
    }

    if (clearButton) {
      clearButton.title = t('clearSearch');
      clearButton.setAttribute('aria-label', t('clearSearch'));
    }

    if (previousButton) {
      previousButton.title = t('searchPreviousResult');
      previousButton.setAttribute('aria-label', t('searchPreviousResult'));
    }

    if (nextButton) {
      nextButton.title = t('searchNextResult');
      nextButton.setAttribute('aria-label', t('searchNextResult'));
    }

    updateResultText(matchedRows.length, keyword.length > 0);
  }

  function updateResultText(count, hasKeyword) {
    if (!resultText) return;

    if (!hasKeyword) {
      resultText.textContent = '';
      return;
    }

    if (count > 0 && activeMatchIndex >= 0) {
      resultText.textContent = `${activeMatchIndex + 1} / ${count}`;
      return;
    }

    resultText.textContent = t('searchResultCount', { count });
  }

  function resetMessageText(messageTextElement) {
    if (!messageTextElement) return;

    const originalText = messageTextElement.dataset.originalText;

    if (originalText !== undefined) {
      messageTextElement.textContent = originalText;
    }
  }

  function highlightMessageText(messageTextElement, searchKeyword) {
    if (!messageTextElement) return false;

    if (messageTextElement.dataset.originalText === undefined) {
      messageTextElement.dataset.originalText = messageTextElement.textContent || '';
    }

    const originalText = messageTextElement.dataset.originalText;
    const lowerText = originalText.toLowerCase();
    const lowerKeyword = searchKeyword.toLowerCase();

    if (!lowerText.includes(lowerKeyword)) {
      messageTextElement.textContent = originalText;
      return false;
    }

    const regex = new RegExp(`(${escapeRegExp(searchKeyword)})`, 'gi');
    const highlighted = escapeHtml(originalText).replace(
      regex,
      '<mark class="search-highlight">$1</mark>'
    );

    messageTextElement.innerHTML = highlighted;
    return true;
  }

  function clearCurrentMatchStyle() {
    matchedRows.forEach((row) => {
      row.classList.remove('search-current');
    });
  }

  function setCurrentMatch(index, shouldScroll = false) {
    if (matchedRows.length === 0) {
      activeMatchIndex = -1;
      updateResultText(0, keyword.length > 0);
      updateNavigationButtons();
      return;
    }

    activeMatchIndex = index;

    if (activeMatchIndex < 0) {
      activeMatchIndex = matchedRows.length - 1;
    }

    if (activeMatchIndex >= matchedRows.length) {
      activeMatchIndex = 0;
    }

    clearCurrentMatchStyle();

    const currentRow = matchedRows[activeMatchIndex];

    if (currentRow) {
      currentRow.classList.add('search-current');

      if (shouldScroll) {
        currentRow.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }

    updateResultText(matchedRows.length, true);
    updateNavigationButtons();
  }

  function goToPreviousMatch() {
    if (matchedRows.length === 0) return;

    if (activeMatchIndex < 0) {
      setCurrentMatch(matchedRows.length - 1, true);
      return;
    }

    setCurrentMatch(activeMatchIndex - 1, true);
  }

  function goToNextMatch() {
    if (matchedRows.length === 0) return;

    if (activeMatchIndex < 0) {
      setCurrentMatch(0, true);
      return;
    }

    setCurrentMatch(activeMatchIndex + 1, true);
  }

  function applySearch(rootElement) {
    const root = rootElement || messageArea;
    if (!root) return;

    const rows = Array.from(root.querySelectorAll('.message-row'));
    const hasKeyword = keyword.length > 0;

    matchedRows = [];

    rows.forEach((row) => {
      const textElement = row.querySelector('.message-text');

      row.classList.remove('search-matched', 'search-dimmed', 'search-current');

      if (!hasKeyword) {
        resetMessageText(textElement);
        return;
      }

      const matched = highlightMessageText(textElement, keyword);

      if (matched) {
        matchedRows.push(row);
        row.classList.add('search-matched');
      } else {
        row.classList.add('search-dimmed');
      }
    });

    if (!hasKeyword) {
      activeMatchIndex = -1;
      updateResultText(0, false);
      updateNavigationButtons();
      return;
    }

    if (matchedRows.length === 0) {
      activeMatchIndex = -1;
      updateResultText(0, true);
      updateNavigationButtons();
      return;
    }

    /*
     * 搜尋後如果有結果，先把第一筆設為目前定位項目，
     * 但不自動捲動，避免使用者每打一個字畫面一直跳。
     * 使用者按 ↑ / ↓ 時才會捲動到對應訊息。
     */
    if (activeMatchIndex < 0 || activeMatchIndex >= matchedRows.length) {
      setCurrentMatch(0, false);
    } else {
      setCurrentMatch(activeMatchIndex, false);
    }
  }


  function isMounted() {
    return mounted;
  }

  function init(config = {}) {
    searchHostElement = config.searchHostElement;
    messageArea = config.messageArea;
    translate = config.translate;
    onSearchChanged = config.onSearchChanged;

    injectStyle();
    buildSearchBox();
    updateText();

    window.addEventListener('languageChanged', () => {
      updateText();
    });
  }

  window.ChatSearchModule = {
    init,
    isMounted,
    applySearch,
  };
})();