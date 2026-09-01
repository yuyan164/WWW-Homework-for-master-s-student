/**
 * 檔案名稱：db.js
 * 檔案用途：本檔案負責 SQLite 資料庫的建立、連線與資料操作。
 *
 * 主要功能：
 * 1. 啟動伺服器時自動建立 chatroom.db 資料庫檔案。
 * 2. 自動建立遊戲紀錄資料表，用來儲存玩家 nickname、遊戲類型、勝負結果、開始時間、結束時間與遊戲持續時間。
 * 3. 自動建立聊天紀錄資料表，用來儲存群組聊天室與一對一私人聊天室訊息。
 * 4. 提供新增遊戲紀錄的函式，讓 server.js 在遊戲結束後寫入資料。
 * 5. 提供排行榜查詢函式，讓前端透過 AJAX 取得最新排行榜資料。
 * 6. 提供 CSV 匯出所需的資料查詢功能。
 * 7. 提供新增聊天紀錄與查詢聊天紀錄的函式，讓 server.js 可以產生 HTML 聊天紀錄檔。
 * 8. 提供清除聊天紀錄的函式，讓 server.js 可以在聊天室沒人或私人聊天室失效時同步刪除資料庫紀錄。
 *
 * 注意事項：
 * SQLite 不需要 phpMyAdmin，也不需要另外啟動 MySQL 伺服器。
 * 本專案會自動產生 chatroom.db，該檔案就是本系統的資料庫。
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'chatroom.db');
const db = new sqlite3.Database(dbPath);

/**
 * 產生私人聊天室的共同 room key。
 * 例如 01 與 02 的私人聊天室，不論誰傳訊息，都會得到相同 key：01::02。
 */
function privateRoomKey(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join('::');
}

/**
 * 將 db.run 包成 Promise，方便 server.js 使用 async / await。
 */
function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

/**
 * 建立多人遊戲玩家紀錄資料表。
 *
 * 用途：
 * 蛇與梯子是 2–4 人遊戲，不能只用原本 game_records 的 player_x / player_o。
 * 所以這張表會讓每位玩家各存一筆紀錄，方便排行榜統計。
 */
function ensureMultiplayerGameTable() {
  return runSql(`
    CREATE TABLE IF NOT EXISTS game_player_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      nickname TEXT NOT NULL,
      result TEXT NOT NULL,
      rank INTEGER,
      winner TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, nickname)
    )
  `).then(() => runSql(`
    CREATE INDEX IF NOT EXISTS idx_game_player_records_nickname
    ON game_player_records (nickname, game_type, ended_at)
  `));
}

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

    /*
    * 多人遊戲玩家紀錄資料表：
    * 用於蛇與梯子這種 2–4 人遊戲。
    *
    * 每一場遊戲中，每位玩家各存一筆。
    * 例如 4 人遊戲會寫入 4 筆：
    * 贏家 result = win，其餘玩家 result = loss。
    */
    db.run(`
      CREATE TABLE IF NOT EXISTS game_player_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        nickname TEXT NOT NULL,
        result TEXT NOT NULL,
        rank INTEGER,
        winner TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, nickname)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_game_player_records_nickname
      ON game_player_records (nickname, game_type, ended_at)
    `);

    /*
     * 聊天紀錄資料表：
     * 1. message_id：Socket.io 訊息 ID，用來避免同一則訊息重複寫入。
     * 2. chat_type：private 或 group。
     * 3. room_key：私人聊天室為「兩人暱稱排序後組合」，群組聊天室固定為 group。
     * 4. sender：發送者 nickname。
     * 5. receiver：私人訊息接收者 nickname；群組訊息為 NULL。
     * 6. text：文字、emoji 內容。
     * 7. image_data：base64 圖片資料；若沒有圖片則為空字串。
     * 8. timestamp：訊息送出的時間。
     */
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL UNIQUE,
        chat_type TEXT NOT NULL,
        room_key TEXT NOT NULL,
        sender TEXT NOT NULL,
        receiver TEXT,
        text TEXT,
        image_data TEXT,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /*
     * 建立索引，加快查詢某一個聊天室紀錄的速度。
     */
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room
      ON chat_messages (chat_type, room_key, timestamp)
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
 * 儲存一則聊天訊息到 SQLite。
 *
 * record 格式：
 * {
 *   messageId: string,
 *   chatType: 'private' | 'group',
 *   sender: string,
 *   receiver: string | null,
 *   text: string,
 *   imageData: string,
 *   timestamp: string
 * }
 */
function recordChatMessage(record) {
  return new Promise((resolve, reject) => {
    const chatType = record.chatType === 'group' ? 'group' : 'private';

    const roomKey = chatType === 'group'
      ? 'group'
      : privateRoomKey(record.sender, record.receiver);

    const sql = `
      INSERT OR IGNORE INTO chat_messages
      (message_id, chat_type, room_key, sender, receiver, text, image_data, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        record.messageId,
        chatType,
        roomKey,
        record.sender,
        record.receiver || null,
        record.text || '',
        record.imageData || '',
        record.timestamp,
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
 * 儲存多人遊戲結果。
 *
 * 適用於蛇與梯子這種 2–4 人遊戲。
 * 每位玩家會各存一筆紀錄，方便排行榜統計。
 */
async function recordMultiplayerGame(record) {
  /*
   * 保險處理：
   * 若舊的 chatroom.db 尚未建立 game_player_records，
   * 這裡會先自動建立，避免 no such table 錯誤。
   */
  await ensureMultiplayerGameTable();

  const players = Array.isArray(record.players)
    ? record.players.filter(Boolean)
    : [];

  if (players.length === 0) return;

  const sessionId = record.sessionId || `multiplayer-${Date.now()}`;

  for (const nickname of players) {
    let result = 'loss';
    let rank = 2;

    if (!record.winner) {
      result = 'draw';
      rank = 1;
    } else if (nickname === record.winner) {
      result = 'win';
      rank = 1;
    }

    await runSql(`
      INSERT OR IGNORE INTO game_player_records
      (session_id, game_type, nickname, result, rank, winner, started_at, ended_at, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId,
      record.gameType || 'multiplayer',
      nickname,
      result,
      rank,
      record.winner || null,
      record.startedAt,
      record.endedAt,
      Number(record.durationSeconds || 0),
    ]);
  }
}

/**
 * 讀取多人遊戲玩家紀錄。
 */
async function getMultiplayerGameRecords() {
  /*
   * 保險處理：
   * 如果資料庫是舊版本，先建立 game_player_records，
   * 避免排行榜查詢時出現 no such table。
   */
  await ensureMultiplayerGameTable();

  return new Promise((resolve, reject) => {
    db.all(`
      SELECT
        id,
        session_id,
        game_type,
        nickname,
        result,
        rank,
        winner,
        started_at,
        ended_at,
        duration_seconds,
        created_at
      FROM game_player_records
      ORDER BY id DESC
    `, [], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

/**
 * 查詢目前聊天室的聊天紀錄。
 *
 * options 格式：
 * 私人聊天室：
 * {
 *   chatType: 'private',
 *   currentUser: '01',
 *   target: '02'
 * }
 *
 * 群組聊天室：
 * {
 *   chatType: 'group'
 * }
 */
function getChatMessages(options = {}) {
  return new Promise((resolve, reject) => {
    const chatType = options.chatType === 'group' ? 'group' : 'private';

    const roomKey = chatType === 'group'
      ? 'group'
      : privateRoomKey(options.currentUser, options.target);

    const sql = `
      SELECT
        id,
        message_id,
        chat_type,
        room_key,
        sender,
        receiver,
        text,
        image_data,
        timestamp,
        created_at
      FROM chat_messages
      WHERE chat_type = ?
        AND room_key = ?
      ORDER BY datetime(timestamp) ASC, id ASC
    `;

    db.all(sql, [chatType, roomKey], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

/**
 * 清除所有聊天紀錄。
 *
 * 用途：
 * 1. server.js 重新啟動時，可以清掉上一次測試留下的舊聊天紀錄。
 * 2. 避免下載群組聊天紀錄時，出現以前已經不存在聊天室畫面上的訊息。
 */
function clearAllChatMessages() {
  return runSql(`
    DELETE FROM chat_messages
  `);
}

/**
 * 清除群組聊天室紀錄。
 *
 * 用途：
 * 當群組聊天室已經沒有人時，server.js 可以呼叫此函式清除群組訊息。
 */
function deleteGroupChatMessages() {
  return runSql(`
    DELETE FROM chat_messages
    WHERE chat_type = ?
      AND room_key = ?
  `, ['group', 'group']);
}

/**
 * 清除兩個使用者之間的私人聊天紀錄。
 *
 * 用途：
 * 當其中一方離線，且前端畫面已經清除該私人聊天室時，
 * server.js 可以同步清除 SQLite 中的紀錄。
 */
function deletePrivateChatMessages(userA, userB) {
  const roomKey = privateRoomKey(userA, userB);

  return runSql(`
    DELETE FROM chat_messages
    WHERE chat_type = ?
      AND room_key = ?
  `, ['private', roomKey]);
}

/**
 * 依照聊天室類型與 room_key 清除聊天紀錄。
 *
 * 用途：
 * 如果 server.js 已經自己算好 roomKey，可以直接呼叫這個通用函式。
 */
function deleteChatMessagesByRoomKey(chatType, roomKey) {
  return runSql(`
    DELETE FROM chat_messages
    WHERE chat_type = ?
      AND room_key = ?
  `, [chatType, roomKey]);
}

/**
 * 刪除單一訊息。
 *
 * 用途：
 * 如果未來你想做「刪除某一則訊息」，可以依照 message_id 清除資料庫中的紀錄。
 */
function deleteChatMessageByMessageId(messageId) {
  return runSql(`
    DELETE FROM chat_messages
    WHERE message_id = ?
  `, [messageId]);
}

/**
 * 只保留目前仍存在於畫面上的訊息。
 *
 * 用途：
 * 如果 server.js 有一份目前仍存在的 messageIds，
 * 可以把資料庫中同聊天室但不在 messageIds 內的舊訊息刪掉。
 *
 * 注意：
 * 若 activeMessageIds 是空陣列，代表目前聊天室沒有任何訊息，
 * 因此會刪除該聊天室所有紀錄。
 */
function deleteChatMessagesNotInIds(options = {}) {
  const chatType = options.chatType === 'group' ? 'group' : 'private';

  const roomKey = chatType === 'group'
    ? 'group'
    : privateRoomKey(options.currentUser, options.target);

  const activeMessageIds = Array.isArray(options.activeMessageIds)
    ? options.activeMessageIds.filter(Boolean)
    : [];

  if (activeMessageIds.length === 0) {
    return deleteChatMessagesByRoomKey(chatType, roomKey);
  }

  const placeholders = activeMessageIds.map(() => '?').join(', ');

  return runSql(`
    DELETE FROM chat_messages
    WHERE chat_type = ?
      AND room_key = ?
      AND message_id NOT IN (${placeholders})
  `, [chatType, roomKey, ...activeMessageIds]);
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
 *
 * records：原本 1 對 1 遊戲紀錄，例如圈圈叉叉。
 * multiplayerRecords：多人遊戲紀錄，例如蛇與梯子。
 */
function buildLeaderboard(records, multiplayerRecords = []) {
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

  /*
   * 原本的 1 對 1 遊戲紀錄：
   * 例如圈圈叉叉。
   */
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

      const loserNickname = record.winner === record.player_x
        ? record.player_o
        : record.player_x;

      const loser = ensurePlayer(loserNickname);
      loser.losses += 1;
    }
  });

  /*
   * 多人遊戲紀錄：
   * 例如蛇與梯子。
   * 每位玩家一筆，所以直接依 result 累加。
   */
  multiplayerRecords.forEach((record) => {
    const player = ensurePlayer(record.nickname);

    player.games += 1;
    player.totalDurationSeconds += Number(record.duration_seconds || 0);

    if (record.result === 'win') {
      player.wins += 1;
    } else if (record.result === 'loss') {
      player.losses += 1;
    } else if (record.result === 'draw') {
      player.draws += 1;
    }

    if (!player.lastPlayedAt || new Date(record.ended_at) > new Date(player.lastPlayedAt)) {
      player.lastPlayedAt = record.ended_at;
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
  const multiplayerRecords = await getMultiplayerGameRecords();

  return buildLeaderboard(records, multiplayerRecords);
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

  // 多人遊戲紀錄功能
  ensureMultiplayerGameTable,
  recordMultiplayerGame,
  getMultiplayerGameRecords,

  // 聊天紀錄功能
  recordChatMessage,
  getChatMessages,
  privateRoomKey,

  // 聊天紀錄清除功能
  clearAllChatMessages,
  deleteGroupChatMessages,
  deletePrivateChatMessages,
  deleteChatMessagesByRoomKey,
  deleteChatMessageByMessageId,
  deleteChatMessagesNotInIds,
};