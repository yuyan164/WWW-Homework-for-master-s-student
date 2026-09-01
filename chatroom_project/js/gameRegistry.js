/*
 * 檔案名稱：gameRegistry.js
 * 檔案用途：本檔案負責管理可擴充的遊戲庫。
 *
 * 主要功能：
 * 1. 建立遊戲註冊表，集中管理目前可玩的遊戲。
 * 2. 設定每個遊戲可使用的聊天室類型。
 * 3. 設定 memo 單人模式與線上多人模式的人數限制。
 * 4. 讓 index.js 可以依照 memo / private / group 顯示不同遊戲。
 *
 * 注意事項：
 * 本檔案是前端遊戲選單註冊表。
 * 後端遊戲邏輯放在 /server/game/。
 */

(function setupGameRegistry() {
  const games = [
    {
      id: 'tictactoe',
      nameKey: 'tictactoeName',
      descriptionKey: 'tictactoeDesc',
      icon: '⭕',
      modes: ['private'],
      minPlayers: 2,
      maxPlayers: 2,
      onlineMinPlayers: 2,
      onlineMaxPlayers: 2,
    },
    {
      id: 'snakes_ladders',
      nameKey: 'snakesLaddersName',
      descriptionKey: 'snakesLaddersDesc',
      icon: '🐍',
      modes: ['private', 'group'],
      minPlayers: 2,
      maxPlayers: 4,
      onlineMinPlayers: 2,
      onlineMaxPlayers: 4,
    },
    {
      id: 'game2048',
      nameKey: 'game2048Name',
      descriptionKey: 'game2048Desc',
      icon: '🔢',
      modes: ['memo', 'private', 'group'],

      /*
       * memo 可以單人玩。
       * private / group 必須至少 2 人才開始，最多 2 人。
       */
      minPlayers: 1,
      maxPlayers: 2,
      onlineMinPlayers: 2,
      onlineMaxPlayers: 2,
    },
    {
      id: 'minesweeper',
      nameKey: 'minesweeperName',
      descriptionKey: 'minesweeperDesc',
      icon: '💣',
      modes: ['memo', 'private', 'group'],

      /*
       * memo 可以單人玩。
       * private / group 必須至少 2 人才開始，最多 4 人。
       */
      minPlayers: 1,
      maxPlayers: 4,
      onlineMinPlayers: 2,
      onlineMaxPlayers: 4,
    },
  ];

  function getGames(chatType = '') {
    if (!chatType) return games.slice();

    return games.filter((game) => (
      !Array.isArray(game.modes) ||
      game.modes.length === 0 ||
      game.modes.includes(chatType)
    ));
  }

  function getGameById(gameId) {
    return games.find((game) => game.id === gameId) || games[0];
  }

  function getGameName(gameId) {
    const game = getGameById(gameId);
    return window.i18n.t(game.nameKey);
  }

  function canUseInChat(gameId, chatType) {
    const game = getGameById(gameId);

    if (!game || !Array.isArray(game.modes)) return true;

    return game.modes.includes(chatType);
  }

  window.GameRegistry = {
    getGames,
    getGameById,
    getGameName,
    canUseInChat,
  };
})();