/**
 * typing_indicator.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責聊天室的「正在輸入中」提示功能。
 *
 * 主要功能：
 * 1. 處理私人聊天室 typing indicator。
 * 2. 處理群組聊天室 typing indicator。
 * 3. 支援多位使用者同時輸入。
 * 4. 支援點點動畫循環：
 *    正在輸入中 → 正在輸入中. → 正在輸入中.. → ... → 正在輸入中.....
 * 5. 切換聊天室時可清除舊的 typing 狀態。
 * ------------------------------------------------------------
 */

(function setupTypingIndicatorModule() {
  if (window.TypingIndicator) return;

  const TYPING_AUTO_CLEAR = 2500;

  const privateTypingUsers = new Set();
  const groupTypingUsers = new Set();
  const privateTypingTimers = new Map();
  const groupTypingTimers = new Map();

  let dotCount = 0;
  let typingAnimationTimer = null;
  let typingIndicatorElement = null;
  let getCurrentChat = null;
  let getShowGroupTyping = null;
  let getServerAllowsGroupTyping = null;
  let translate = null;

  function init(config) {
    typingIndicatorElement = config.typingIndicatorElement;
    getCurrentChat = config.getCurrentChat;
    getShowGroupTyping = config.getShowGroupTyping;
    getServerAllowsGroupTyping = config.getServerAllowsGroupTyping;
    translate = config.translate;
  }

  function getTypingDisplayData() {
    const currentChat = getCurrentChat();
    let names = [];
    let key = 'privateTyping';

    if (currentChat.type === 'private') {
      names = Array.from(privateTypingUsers).filter((name) => name === currentChat.target);
      key = 'privateTyping';
    } else if (currentChat.type === 'none') {
      names = Array.from(privateTypingUsers);
      key = 'privateTyping';
    } else if (
      currentChat.type === 'group' &&
      getShowGroupTyping() &&
      getServerAllowsGroupTyping()
    ) {
      names = Array.from(groupTypingUsers);
      key = 'groupTyping';
    }

    return { names, key };
  }

  function renderText() {
    if (!typingIndicatorElement) return;

    const { names, key } = getTypingDisplayData();

    if (names.length === 0) {
      typingIndicatorElement.textContent = '';
      typingIndicatorElement.classList.add('hidden');
      return;
    }

    const dots = '.'.repeat(dotCount);
    const separator = window.i18n.getLanguage() === 'zh' ? '、' : ', ';

    typingIndicatorElement.textContent = translate(key, {
      names: names.join(separator),
      dots,
    });

    typingIndicatorElement.classList.remove('hidden');
  }

  function stopAnimation() {
    if (typingAnimationTimer) {
      clearInterval(typingAnimationTimer);
      typingAnimationTimer = null;
    }

    dotCount = 0;
  }

  function startAnimation() {
    if (typingAnimationTimer) return;

    typingAnimationTimer = setInterval(() => {
      const { names } = getTypingDisplayData();

      if (names.length === 0) {
        stopAnimation();
        renderText();
        return;
      }

      dotCount = (dotCount + 1) % 6;
      renderText();
    }, 450);
  }

  function update() {
    const { names } = getTypingDisplayData();

    if (names.length === 0) {
      stopAnimation();

      if (typingIndicatorElement) {
        typingIndicatorElement.textContent = '';
        typingIndicatorElement.classList.add('hidden');
      }

      return;
    }

    renderText();
    startAnimation();
  }

  function setTypingUser(collection, timers, nickname, isTyping) {
    clearTimeout(timers.get(nickname));

    if (!isTyping) {
      collection.delete(nickname);
      timers.delete(nickname);
      update();
      return;
    }

    collection.add(nickname);

    timers.set(nickname, setTimeout(() => {
      collection.delete(nickname);
      timers.delete(nickname);
      update();
    }, TYPING_AUTO_CLEAR));

    update();
  }

  function setPrivateTyping(nickname, isTyping) {
    setTypingUser(privateTypingUsers, privateTypingTimers, nickname, isTyping);
  }

  function setGroupTyping(nickname, isTyping) {
    setTypingUser(groupTypingUsers, groupTypingTimers, nickname, isTyping);
  }

  function clear() {
    privateTypingUsers.clear();
    groupTypingUsers.clear();

    privateTypingTimers.forEach((timer) => clearTimeout(timer));
    groupTypingTimers.forEach((timer) => clearTimeout(timer));

    privateTypingTimers.clear();
    groupTypingTimers.clear();

    update();
  }

  function removePrivateUser(nickname) {
    privateTypingUsers.delete(nickname);
    update();
  }

  window.TypingIndicator = {
    init,
    update,
    clear,
    setPrivateTyping,
    setGroupTyping,
    removePrivateUser,
  };
})();