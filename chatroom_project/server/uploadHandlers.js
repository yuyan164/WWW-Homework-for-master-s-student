/**
 * server/uploadHandlers.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責後端上傳相關功能。
 *
 * 主要功能：
 * 1. 建立一般檔案上傳 API：/api/upload-file
 * 2. 限制一般檔案副檔名與檔案大小
 * 3. 處理使用者大頭貼 base64 圖片上傳
 * 4. 提供 safeFileData()，讓聊天室訊息可以安全接收檔案資料
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const {
  nowIso,
  safeText,
} = require('./utils');

const {
  getUserBySocketId,
} = require('./state');

const DEFAULT_AVATAR_URL = '/uploads/default.png';

const MAX_GENERAL_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AVATAR_SIZE = 1 * 1024 * 1024;

const allowedFileExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.zip',
  '.rar',
  '.7z',
  '.mp3',
  '.mp4',
  '.mov',
]);

/**
 * 確保上傳資料夾存在。
 */
function ensureUploadFolders(rootDir) {
  const fileUploadDir = path.join(rootDir, 'uploads', 'files');
  const avatarUploadDir = path.join(rootDir, 'uploads', 'avatars');

  if (!fs.existsSync(fileUploadDir)) {
    fs.mkdirSync(fileUploadDir, {
      recursive: true,
    });
  }

  if (!fs.existsSync(avatarUploadDir)) {
    fs.mkdirSync(avatarUploadDir, {
      recursive: true,
    });
  }

  return {
    fileUploadDir,
    avatarUploadDir,
  };
}

/**
 * 清理上傳檔案名稱，避免出現 Windows 或 URL 不適合的字元。
 */
function sanitizeUploadFileName(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const base = path.basename(fileName || 'file', ext)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);

  return `${base || 'file'}${ext || ''}`;
}

/**
 * 驗證聊天室訊息中的 fileData。
 *
 * 這個函式之後會給 chatHandlers.js 使用。
 */
function safeFileData(fileData) {
  if (!fileData || typeof fileData !== 'object') return null;

  const fileName = safeText(fileData.fileName).slice(0, 120);
  const fileUrl = safeText(fileData.fileUrl);
  const mimeType = safeText(fileData.mimeType).slice(0, 120);
  const fileSize = Number(fileData.fileSize || 0);
  const uploadedAt = safeText(fileData.uploadedAt).slice(0, 60);

  if (!fileName || !fileUrl.startsWith('/uploads/files/')) return null;

  return {
    fileName,
    fileUrl,
    fileSize: Number.isFinite(fileSize) ? fileSize : 0,
    mimeType,
    uploadedAt: uploadedAt || nowIso(),
  };
}

/**
 * 解析前端傳來的大頭貼 base64 圖片。
 *
 * 只允許：
 * png / jpg / jpeg / gif / webp
 */
function parseAvatarImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') return null;

  const match = imageData.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/i);

  if (!match) return null;

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length > MAX_AVATAR_SIZE) return null;

  return {
    ext,
    buffer,
  };
}

/**
 * 建立 multer 一般檔案上傳 middleware。
 */
function createUploadFileMiddleware(fileUploadDir) {
  const fileStorage = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, fileUploadDir);
    },

    filename(req, file, callback) {
      const safeOriginalName = sanitizeUploadFileName(file.originalname);
      const ext = path.extname(safeOriginalName).toLowerCase();
      const base = path.basename(safeOriginalName, ext);
      const uniqueName = `${base}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      callback(null, uniqueName);
    },
  });

  return multer({
    storage: fileStorage,
    limits: {
      fileSize: MAX_GENERAL_FILE_SIZE,
    },
    fileFilter(req, file, callback) {
      const ext = path.extname(file.originalname || '').toLowerCase();

      if (!allowedFileExtensions.has(ext)) {
        callback(new Error('FILE_TYPE_NOT_ALLOWED'));
        return;
      }

      callback(null, true);
    },
  }).single('file');
}

/**
 * 註冊一般檔案上傳 HTTP API。
 *
 * @param {Express.Application} app
 * @param {object} options
 * @param {string} options.rootDir - 專案根目錄 __dirname
 */
function registerUploadRoutes(app, options = {}) {
  const rootDir = options.rootDir;

  if (!rootDir) {
    throw new Error('registerUploadRoutes requires { rootDir }.');
  }

  const {
    fileUploadDir,
  } = ensureUploadFolders(rootDir);

  const uploadFileMiddleware = createUploadFileMiddleware(fileUploadDir);

  app.post('/api/upload-file', (req, res) => {
    if (!req.session.nickname) {
      res.status(401).json({
        ok: false,
        messageKey: 'loginFailed',
      });
      return;
    }

    uploadFileMiddleware(req, res, (error) => {
      if (error) {
        console.error('General file upload error:', error);

        const messageKey = error.message === 'FILE_TYPE_NOT_ALLOWED'
          ? 'fileOnly'
          : 'fileUploadFailed';

        res.status(400).json({
          ok: false,
          messageKey,
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          ok: false,
          messageKey: 'fileUploadFailed',
        });
        return;
      }

      res.json({
        ok: true,
        file: {
          fileName: req.file.originalname,
          fileUrl: `/uploads/files/${req.file.filename}`,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: nowIso(),
        },
      });
    });
  });
}

/**
 * 將大頭貼寫入 uploads/avatars。
 */
function saveAvatarImage(rootDir, imageData) {
  return new Promise((resolve, reject) => {
    const {
      avatarUploadDir,
    } = ensureUploadFolders(rootDir);

    const parsed = parseAvatarImageData(imageData);

    if (!parsed) {
      resolve(null);
      return;
    }

    const fileName = `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.${parsed.ext}`;
    const filePath = path.join(avatarUploadDir, fileName);
    const avatarUrl = `/uploads/avatars/${fileName}`;

    fs.writeFile(filePath, parsed.buffer, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(avatarUrl);
    });
  });
}

/**
 * 註冊單一 socket 的大頭貼更新事件。
 *
 * @param {Socket} socket
 * @param {Server} io
 * @param {object} options
 * @param {string} options.rootDir
 * @param {Function} options.broadcastOnlineUsers
 */
function registerAvatarSocketHandlers(socket, io, options = {}) {
  const rootDir = options.rootDir;
  const broadcastOnlineUsers = options.broadcastOnlineUsers;

  if (!rootDir) {
    throw new Error('registerAvatarSocketHandlers requires { rootDir }.');
  }

  socket.on('updateAvatar', async (payload = {}, callback) => {
    const user = getUserBySocketId(socket.id);

    if (!user) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
        });
      }

      return;
    }

    try {
      const avatarUrl = await saveAvatarImage(rootDir, payload.imageData);

      if (!avatarUrl) {
        if (typeof callback === 'function') {
          callback({
            ok: false,
          });
        }

        return;
      }

      user.avatarUrl = avatarUrl;

      if (typeof callback === 'function') {
        callback({
          ok: true,
          avatarUrl,
        });
      }

      /*
       * 廣播線上使用者清單，讓其他人的左側列表同步更新大頭貼。
       */
      if (typeof broadcastOnlineUsers === 'function') {
        broadcastOnlineUsers();
      }

      io.emit('avatarUpdated', {
        nickname: user.nickname,
        avatarUrl,
      });
    } catch (error) {
      console.error('Avatar upload error:', error);

      if (typeof callback === 'function') {
        callback({
          ok: false,
        });
      }
    }
  });
}

module.exports = {
  DEFAULT_AVATAR_URL,
  MAX_GENERAL_FILE_SIZE,
  MAX_AVATAR_SIZE,
  allowedFileExtensions,

  ensureUploadFolders,
  sanitizeUploadFileName,
  safeFileData,
  parseAvatarImageData,

  registerUploadRoutes,
  registerAvatarSocketHandlers,
  saveAvatarImage,
};