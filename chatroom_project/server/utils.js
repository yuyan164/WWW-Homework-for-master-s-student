/**
 * server/utils.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案放置後端共用工具函式。
 *
 * 主要功能：
 * 1. 產生目前時間 ISO 字串。
 * 2. 清理使用者輸入文字。
 * 3. 驗證圖片 base64 data URL。
 * 4. 建立私人聊天室 room key。
 * 5. 建立系統訊息物件。
 *
 * 注意：
 * 這是 Node.js 後端檔案，不是瀏覽器前端 JS。
 * ------------------------------------------------------------
 */

/**
 * 回傳目前時間的 ISO 格式字串。
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * 清理文字輸入。
 *
 * @param {unknown} text - 使用者輸入內容
 * @param {number} maxLength - 最大長度
 * @returns {string}
 */
function safeText(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';

  return text.trim().slice(0, maxLength);
}

/**
 * 驗證圖片資料。
 *
 * @param {unknown} imageData - base64 圖片字串
 * @returns {string}
 */
function safeImageData(imageData) {
  if (!imageData) return '';
  if (typeof imageData !== 'string') return '';
  if (!imageData.startsWith('data:image/')) return '';

  return imageData;
}

/**
 * 建立私人聊天室 key。
 * 兩位使用者不論順序如何，都會得到相同 key。
 *
 * 例如：
 * privateRoomKey('A', 'B') === privateRoomKey('B', 'A')
 */
function privateRoomKey(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join('::');
}

/**
 * 建立系統訊息。
 *
 * @param {string} textKey - i18n key
 * @param {object} params - i18n 參數
 * @returns {object}
 */
function makeSystemMessage(textKey, params = {}) {
  return {
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'system',
    textKey,
    params,
    timestamp: nowIso(),
  };
}

/**
 * 建立一般訊息 ID。
 *
 * @param {string} prefix - 訊息類型前綴
 * @returns {string}
 */
function makeId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

module.exports = {
  nowIso,
  safeText,
  safeImageData,
  privateRoomKey,
  makeSystemMessage,
  makeId,
};