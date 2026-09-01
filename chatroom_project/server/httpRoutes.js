/**
 * server/httpRoutes.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責註冊 Express HTTP API 路由。
 *
 * 主要功能：
 * 1. 登入 /api/login
 * 2. 取得目前登入使用者 /api/me
 * 3. 登出 /api/logout
 * 4. 取得排行榜 /api/leaderboard
 * 5. 下載排行榜 CSV /api/leaderboard.csv
 * 6. 下載聊天紀錄 HTML /api/chat-history/download
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

const {
  getLeaderboard,
  leaderboardToCsv,
  getChatMessages,
  deleteChatMessagesNotInIds,
} = require('../db');

const {
  safeText,
  nowIso,
  privateRoomKey,
} = require('./utils');

const {
  isNicknameOnline,
  privateMessages,
} = require('./state');

const {
  groupMessages,
} = require('./chatHandlers');

/**
 * HTML escape，避免聊天紀錄 HTML 產生不安全內容。
 */
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 將 ISO 時間轉成適合 HTML 聊天紀錄顯示的時間。
 */
function formatHtmlDateTime(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(isoString);
  }

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 清理檔名片段，避免 Windows 或瀏覽器無法下載。
 */
function sanitizeFileNamePart(value) {
  return String(value || 'chat')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

/**
 * 建立安全的 Content-Disposition header。
 *
 * filename 不能直接放中文，否則 Node.js 可能出現 ERR_INVALID_CHAR。
 * 因此同時提供：
 * 1. filename：ASCII 安全檔名
 * 2. filename*：UTF-8 編碼檔名
 */
function buildDownloadHeaderFileName(fileName) {
  const safeAsciiFileName = String(fileName || 'chat-history.html')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');

  const encodedFileName = encodeURIComponent(fileName || 'chat-history.html');

  return `attachment; filename="${safeAsciiFileName}"; filename*=UTF-8''${encodedFileName}`;
}

/**
 * 將聊天訊息轉成美編過的 HTML。
 */
function buildChatHistoryHtml({ title, subtitle, currentUser, messages }) {
  const generatedAt = formatHtmlDateTime(nowIso());

  const messageItems = messages.map((message) => {
    const isMine = message.sender === currentUser;
    const sideClass = isMine ? 'mine' : 'other';
    const senderLabel = isMine
      ? `${escapeHtml(message.sender)}（我）`
      : escapeHtml(message.sender);

    const timeText = formatHtmlDateTime(message.timestamp);

    const textHtml = message.text
      ? `<div class="message-text">${escapeHtml(message.text).replace(/\n/g, '<br>')}</div>`
      : '';

    const imageHtml = message.image_data
      ? `<img class="message-image" src="${message.image_data}" alt="聊天圖片">`
      : '';

    const fileHtml = message.file_url
      ? `
        <a class="message-file" href="${escapeHtml(message.file_url)}" download>
          📎 ${escapeHtml(message.file_name || '下載檔案')}
        </a>
      `
      : '';

    return `
      <div class="message-row ${sideClass}">
        <article class="message-bubble">
          <div class="message-meta">
            <span class="sender">${senderLabel}</span>
            <span class="time">${escapeHtml(timeText)}</span>
          </div>
          ${imageHtml}
          ${fileHtml}
          ${textHtml}
        </article>
      </div>
    `;
  }).join('\n');

  const emptyHtml = messages.length === 0
    ? '<div class="empty-state">目前沒有聊天紀錄。</div>'
    : '';

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f6efe4;
      --panel: #fffaf1;
      --brown: #5b4b3d;
      --brown-soft: #8b735f;
      --green: #6f7d5b;
      --line: rgba(117, 97, 79, 0.18);
      --mine: #dfe8d2;
      --other: #ffffff;
      --shadow: rgba(45, 42, 36, 0.12);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 36px 18px;
      font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
      color: var(--brown);
      background:
        radial-gradient(circle at top left, rgba(214, 165, 116, 0.28), transparent 34%),
        linear-gradient(135deg, #f8f0e3, #e8dcc9);
    }

    .page {
      width: min(920px, 100%);
      margin: 0 auto;
      border-radius: 30px;
      background: rgba(255, 250, 241, 0.92);
      box-shadow: 0 24px 60px var(--shadow);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.72);
    }

    .header {
      padding: 28px 32px;
      background: linear-gradient(135deg, rgba(111, 125, 91, 0.16), rgba(214, 165, 116, 0.18));
      border-bottom: 1px solid var(--line);
    }

    .header h1 {
      margin: 0 0 10px;
      font-size: 28px;
      letter-spacing: 0.04em;
    }

    .header p {
      margin: 4px 0;
      color: var(--brown-soft);
      font-size: 14px;
      font-weight: 700;
    }

    .content {
      padding: 28px 24px 34px;
    }

    .message-row {
      display: flex;
      margin: 14px 0;
    }

    .message-row.mine {
      justify-content: flex-end;
    }

    .message-row.other {
      justify-content: flex-start;
    }

    .message-bubble {
      max-width: min(620px, 82%);
      border-radius: 22px;
      padding: 13px 15px;
      border: 1px solid var(--line);
      box-shadow: 0 10px 22px rgba(45, 42, 36, 0.08);
      word-break: break-word;
    }

    .message-row.mine .message-bubble {
      background: var(--mine);
      border-bottom-right-radius: 8px;
    }

    .message-row.other .message-bubble {
      background: var(--other);
      border-bottom-left-radius: 8px;
    }

    .message-meta {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--brown-soft);
      font-weight: 800;
    }

    .sender {
      color: var(--green);
    }

    .message-text {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 15px;
      line-height: 1.65;
    }

    .message-image {
      display: block;
      max-width: 100%;
      max-height: 360px;
      margin: 6px 0 10px;
      border-radius: 16px;
      object-fit: contain;
      background: rgba(255, 255, 255, 0.56);
      border: 1px solid rgba(117, 97, 79, 0.12);
    }

    .message-file {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      padding: 10px 12px;
      border-radius: 14px;
      color: #4e5b3f;
      background: rgba(255, 250, 241, 0.75);
      text-decoration: none;
      font-weight: 900;
      border: 1px solid rgba(117, 97, 79, 0.14);
    }

    .empty-state {
      padding: 38px;
      text-align: center;
      color: var(--brown-soft);
      font-weight: 800;
      border: 1px dashed var(--line);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.36);
    }

    .footer {
      padding: 18px 28px;
      border-top: 1px solid var(--line);
      color: var(--brown-soft);
      font-size: 12px;
      text-align: center;
      background: rgba(255, 255, 255, 0.34);
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .page {
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
      <p>下載時間：${escapeHtml(generatedAt)}</p>
    </header>

    <section class="content">
      ${emptyHtml}
      ${messageItems}
    </section>

    <footer class="footer">
      Chatroom Project · SQLite Chat History Export
    </footer>
  </main>
</body>
</html>`;
}

/**
 * 註冊 HTTP routes。
 *
 * @param {Express.Application} app
 * @param {object} options
 * @param {object} options.path - Node.js path module
 * @param {string} options.rootDir - 專案根目錄 __dirname
 */
function registerHttpRoutes(app, options = {}) {
  const path = options.path;
  const rootDir = options.rootDir;

  if (!path || !rootDir) {
    throw new Error('registerHttpRoutes requires { path, rootDir }.');
  }

  app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'login.html'));
  });

  app.get('/login.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'login.html'));
  });

  app.get('/index.html', (req, res) => {
    if (!req.session.nickname) {
      res.redirect('/login.html');
      return;
    }

    res.sendFile(path.join(rootDir, 'index.html'));
  });

  app.post('/api/login', (req, res) => {
    const nickname = safeText(req.body.nickname, 20);

    if (!nickname) {
      res.status(400).json({
        ok: false,
        message: 'Nickname is required.',
      });
      return;
    }

    if (nickname.length > 20) {
      res.status(400).json({
        ok: false,
        message: 'Nickname must be within 20 characters.',
      });
      return;
    }

    if (isNicknameOnline(nickname)) {
      res.status(409).json({
        ok: false,
        message: 'This nickname is already online.',
      });
      return;
    }

    req.session.nickname = nickname;

    /*
     * 重要：
     * 一定要等 session 寫入完成後才回傳登入成功。
     * 否則前端太快跳到 index.html 時，/api/me 可能讀不到 session，
     * 就會被 index.js 導回 login.html，看起來像「閃退」。
     */
    req.session.save((error) => {
      if (error) {
        console.error('Session save error:', error);

        res.status(500).json({
          ok: false,
          message: 'Failed to save login session.',
        });

        return;
      }

      res.json({
        ok: true,
        nickname,
      });
    });
  });

  app.get('/api/me', (req, res) => {
    /*
     * 不讓瀏覽器快取 /api/me。
     * 這樣 Network 裡會比較清楚看到真正登入狀態，
     * 也比較不會出現 304 造成混淆。
     */
    res.setHeader('Cache-Control', 'no-store');

    if (!req.session.nickname) {
      res.status(401).json({
        ok: false,
      });
      return;
    }

    res.json({
      ok: true,
      nickname: req.session.nickname,
    });
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({
        ok: true,
      });
    });
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaderboard = await getLeaderboard();

      res.json({
        ok: true,
        leaderboard,
      });
    } catch (error) {
      console.error('Leaderboard error:', error);

      res.status(500).json({
        ok: false,
        message: 'Failed to load leaderboard.',
      });
    }
  });

  app.get('/api/leaderboard.csv', async (req, res) => {
    try {
      const leaderboard = await getLeaderboard();
      const csv = leaderboardToCsv(leaderboard);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.csv"');
      res.send(`\uFEFF${csv}`);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).send('Failed to export CSV.');
    }
  });

  app.get('/api/chat-history/download', async (req, res) => {
    try {
      const sessionUser = req.session.nickname;
      const ownerFromQuery = safeText(req.query.owner, 20);

      /*
       * 修正同一個瀏覽器開兩個使用者時 session cookie 被覆蓋的問題。
       * 如果前端有傳 owner，且該 owner 目前在線上，就優先使用 owner。
       * 否則才退回 req.session.nickname。
       */
      const currentUser = ownerFromQuery && isNicknameOnline(ownerFromQuery)
        ? ownerFromQuery
        : sessionUser;

      if (!currentUser) {
        res.status(401).send('Please login first.');
        return;
      }

      const chatType = safeText(req.query.type, 20);
      const target = safeText(req.query.target, 60);

      let messages = [];
      let title = '';
      let subtitle = '';
      let fileName = '';

      if (chatType === 'group') {
        /*
         * 下載前先同步資料庫：
         * 只保留目前 server 記憶體中還存在的群組訊息。
         * 如果目前群組沒有訊息，資料庫中的群組紀錄也會被清空。
         */
        await deleteChatMessagesNotInIds({
          chatType: 'group',
          activeMessageIds: groupMessages.map((message) => message.id),
        });

        messages = await getChatMessages({
          chatType: 'group',
        });

        title = '群組聊天室紀錄';
        subtitle = `下載者：${currentUser}`;
        fileName = `chat-history-group-${Date.now()}.html`;
      } else if (chatType === 'private' && target) {
        /*
         * 下載前先同步資料庫：
         * 只保留目前 server 記憶體中還存在的私人訊息。
         * 若其中一方離線導致 privateMessages 已清空，
         * 這裡也會把 SQLite 中的舊私聊紀錄清掉。
         */
        const roomKey = privateRoomKey(currentUser, target);
        const activePrivateMessages = privateMessages.get(roomKey) || [];

        await deleteChatMessagesNotInIds({
          chatType: 'private',
          currentUser,
          target,
          activeMessageIds: activePrivateMessages.map((message) => message.id),
        });

        messages = await getChatMessages({
          chatType: 'private',
          currentUser,
          target,
        });

        title = `私人聊天室紀錄：${currentUser} 與 ${target}`;
        subtitle = `下載者：${currentUser}`;
        fileName = `chat-history-${sanitizeFileNamePart(currentUser)}-${sanitizeFileNamePart(target)}-${Date.now()}.html`;
      } else {
        res.status(400).send('Invalid chat history request.');
        return;
      }

      const html = buildChatHistoryHtml({
        title,
        subtitle,
        currentUser,
        messages,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', buildDownloadHeaderFileName(fileName));
      res.send(html);
    } catch (error) {
      console.error('Chat history download error:', error);
      res.status(500).send('Failed to download chat history.');
    }
  });
}

module.exports = {
  registerHttpRoutes,
  buildChatHistoryHtml,
  buildDownloadHeaderFileName,
  sanitizeFileNamePart,
};