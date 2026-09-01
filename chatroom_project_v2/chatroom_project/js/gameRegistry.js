/**
 * gameRegistry.js
 * ------------------------------------------------------------
 * This file defines the expandable game library. The chatroom
 * currently registers Tic-Tac-Toe as the first game. In the future,
 * more games can be added here without rewriting the main chat logic.
 * ------------------------------------------------------------
 */

(function setupGameRegistry() {
  const games = [
    {
      id: 'tictactoe',
      nameKey: 'tictactoeName',
      descriptionKey: 'tictactoeDesc',
      icon: '⭕',
    },
  ];

  function getGames() {
    return games.slice();
  }

  function getGameById(gameId) {
    return games.find((game) => game.id === gameId) || games[0];
  }

  function getGameName(gameId) {
    const game = getGameById(gameId);
    return window.i18n.t(game.nameKey);
  }

  window.GameRegistry = {
    getGames,
    getGameById,
    getGameName,
  };
})();
