/**
 * db.js
 * ------------------------------------------------------------
 * This file manages the SQLite database for the chatroom project.
 * It creates the game_records table, stores finished game results,
 * calculates leaderboard data, and exports leaderboard data as CSV.
 * ------------------------------------------------------------
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'chatroom.db');
const db = new sqlite3.Database(dbPath);

/**
 * Initialize database tables when the server starts.
 * SQLite stores all data in chatroom.db, so no phpMyAdmin setup is needed.
 */
function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_type TEXT NOT NULL,
        player_x TEXT NOT NULL,
        player_o TEXT NOT NULL,
        winner TEXT,
        result TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

/**
 * Save one completed game into SQLite.
 * The result can be win, draw, quit, or cancelled.
 */
function recordGame(record) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO game_records
      (game_type, player_x, player_o, winner, result, started_at, ended_at, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        record.gameType,
        record.playerX,
        record.playerO,
        record.winner || null,
        record.result,
        record.startedAt,
        record.endedAt,
        record.durationSeconds,
      ],
      function onInsert(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Read all game records from newest to oldest.
 */
function getGameRecords() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM game_records ORDER BY id DESC', [], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

/**
 * Convert raw game records into per-player leaderboard statistics.
 */
function buildLeaderboard(records) {
  const stats = new Map();

  function ensurePlayer(nickname) {
    if (!stats.has(nickname)) {
      stats.set(nickname, {
        nickname,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalDurationSeconds: 0,
        averageDurationSeconds: 0,
        winRate: 0,
        lastPlayedAt: '',
      });
    }
    return stats.get(nickname);
  }

  records.forEach((record) => {
    const playerX = ensurePlayer(record.player_x);
    const playerO = ensurePlayer(record.player_o);
    const players = [playerX, playerO];

    players.forEach((player) => {
      player.games += 1;
      player.totalDurationSeconds += Number(record.duration_seconds || 0);
      if (!player.lastPlayedAt || new Date(record.ended_at) > new Date(player.lastPlayedAt)) {
        player.lastPlayedAt = record.ended_at;
      }
    });

    if (record.result === 'draw') {
      playerX.draws += 1;
      playerO.draws += 1;
    } else if (record.winner) {
      const winner = ensurePlayer(record.winner);
      winner.wins += 1;

      const loserNickname = record.winner === record.player_x ? record.player_o : record.player_x;
      const loser = ensurePlayer(loserNickname);
      loser.losses += 1;
    }
  });

  return Array.from(stats.values())
    .map((player) => {
      const winRate = player.games > 0 ? player.wins / player.games : 0;
      const averageDurationSeconds = player.games > 0
        ? Math.round(player.totalDurationSeconds / player.games)
        : 0;

      return {
        ...player,
        winRate: Number((winRate * 100).toFixed(1)),
        averageDurationSeconds,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.games - a.games;
    });
}

/**
 * Get leaderboard data calculated from all saved records.
 */
async function getLeaderboard() {
  const records = await getGameRecords();
  return buildLeaderboard(records);
}

/**
 * Escape one CSV cell safely.
 */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Export leaderboard statistics as a CSV string.
 */
function leaderboardToCsv(leaderboard) {
  const header = [
    'Rank',
    'Nickname',
    'Games',
    'Wins',
    'Losses',
    'Draws',
    'Win Rate (%)',
    'Total Duration Seconds',
    'Average Duration Seconds',
    'Last Played At',
  ];

  const rows = leaderboard.map((player, index) => [
    index + 1,
    player.nickname,
    player.games,
    player.wins,
    player.losses,
    player.draws,
    player.winRate,
    player.totalDurationSeconds,
    player.averageDurationSeconds,
    player.lastPlayedAt,
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

module.exports = {
  initDatabase,
  recordGame,
  getGameRecords,
  getLeaderboard,
  leaderboardToCsv,
};
