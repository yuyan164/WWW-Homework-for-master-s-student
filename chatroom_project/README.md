# 大地色系線上聊天室與遊戲專案

本專案是一個使用 Node.js / Express / Socket.io 製作的線上聊天室系統，並結合一對一遊戲、多人遊戲、備忘錄、聊天紀錄下載與排行榜功能。

系統前端使用 HTML、CSS、JavaScript 製作，後端使用 Node.js / Express / Socket.io 處理即時聊天、遊戲同步、檔案上傳、登入驗證與資料庫操作，資料庫使用 SQLite。

本專案採用模組化設計，前端主要流程集中於 `js/index.js`，其他功能拆分為獨立前端模組；後端主要流程集中於 `server.js`，其他 HTTP API、Socket 事件、聊天處理、遊戲邏輯與上傳功能皆拆分至 `/server/` 資料夾中，方便日後維護與擴充。

---

## 主要功能

* 不可重複暱稱登入
* 群組聊天室
* 一對一私人聊天室
* 文字訊息傳送
* 每則訊息顯示發送者暱稱
* 圖片預覽與圖片傳送
* Emoji 表情符號選擇器
* 動態打字中提示
* 未讀訊息紅點提醒
* 第一個遊戲為圈圈叉叉
* SQLite 資料庫排行榜
* 低飽和大地色系介面設計

---

## 進階功能

* 改背景
* 圖片放大
* 遊戲庫設計
* 已讀功能
* 未讀訊息按鈕緩慢閃爍效果
* 每則訊息顯示傳送時間
* 聊天紀錄存於資料庫，並且離開前可以下載聊天記錄檔(html檔)
* 排行榜 CSV 下載功能
* 中文 / 英文雙語介面
* 其他遊戲 : 踩地雷 2048
* 多人遊戲 : 蛇與梯子
* 預設大頭貼
* 搜尋聊天紀錄
* 上傳表情包功能
* 快捷表情
* LLM機器人   XXXXXXXXXXXXXXXXXX
* 備忘錄
* 公告
* 傳送檔案
* 回復功能

---

## 專案資料夾結構

```text
CHATROOM_PROJECT/
├── server.js
│   └── 後端主流程入口：
│       建立 Express、Socket.io、Session，
│       註冊 HTTP routes、Socket handlers、Upload routes、Game hub。
│
├── db.js
│   └── SQLite 資料庫操作：
│       初始化資料表、聊天紀錄、排行榜、遊戲紀錄、CSV 匯出。
│
├── chatroom.db
│   └── SQLite 資料庫檔案。
│
├── package.json
│   └── Node.js 專案設定與 npm 指令。
│
├── package-lock.json
│   └── npm 套件版本鎖定檔。
│
├── README.md
│   └── 專案說明文件。
│
├── login.html
│   └── 登入頁面。
│
├── index.html
│   └── 聊天室主頁面。
│
├── server_old.js
│   └── 舊版 server.js 備份檔，主要作為開發過程備份。
│
├── css/
│   └── index.css
│       └── 聊天室主畫面、訊息泡泡、按鈕、彈窗、遊戲畫面、
│           大頭貼、公告、搜尋框、排行榜、響應式版面樣式。
│
├── js/
│   ├── index.js
│   │   └── 前端主流程：
│   │       初始化聊天室、管理目前使用者、聊天室切換、
│   │       訊息渲染、Socket 事件、遊戲事件與前端模組串接。
│   │
│   ├── login.js
│   │   └── 登入頁邏輯：
│   │       暱稱輸入、登入請求、登入錯誤提示、分頁登入狀態控制。
│   │
│   ├── i18n.js
│   │   └── 中文 / 英文雙語文字管理：
│   │       data-i18n 翻譯、placeholder 翻譯、動態文字 t()。
│   │
│   ├── gameRegistry.js
│   │   └── 遊戲庫登錄：
│   │       管理遊戲 ID、遊戲名稱、說明、icon、可用聊天室類型。
│   │
│   ├── tictactoe.js
│   │   └── 圈圈叉叉前端畫面與互動邏輯。
│   │
│   ├── snakes_ladders.js
│   │   └── 蛇與梯子前端畫面：
│   │       棋盤顯示、棋子顯示、骰子動畫、棋子移動動畫、
│   │       選色等待室與遊戲狀態畫面。
│   │
│   ├── game2048.js
│   │   └── 2048 前端畫面：
│   │       單人 / 多人棋盤渲染、方向鍵操作、分數顯示。
│   │
│   ├── minesweeper.js
│   │   └── 踩地雷前端畫面：
│   │       棋盤格子、玩家列表、分數、淘汰狀態、插旗與回合顯示。
│   │
│   ├── solo_games.js
│   │   └── 備忘錄中的單人遊戲入口：
│   │       控制備忘錄模式下的 2048 與踩地雷單人遊戲。
│   │
│   ├── memo.js
│   │   └── 備忘錄功能：
│   │       本機文字、圖片、檔案訊息與單人遊戲入口。
│   │
│   ├── read_receipt.js
│   │   └── 已讀功能：
│   │       私人訊息已讀、群組訊息已讀、已讀標籤顯示。
│   │
│   ├── typing_indicator.js
│   │   └── 動態「正在輸入中」提示功能。
│   │
│   ├── emoji_panel.js
│   │   └── Emoji 面板與表情插入功能。
│   │
│   ├── quick_emoji.js
│   │   └── 快捷表情功能：
│   │       記錄使用者常用 emoji，最多顯示 8 個快捷表情。
│   │
│   ├── sticker.js
│   │   └── 上傳表情包功能：
│   │       使用者可上傳個人表情包，僅本人目前瀏覽器可使用。
│   │
│   ├── image_upload.js
│   │   └── 圖片選取、大小檢查、預覽與清除功能。
│   │
│   ├── image_viewer.js
│   │   └── 圖片放大檢視功能：
│   │       支援聊天圖片與大頭貼圖片點擊放大。
│   │
│   ├── file_upload.js
│   │   └── 傳送檔案功能：
│   │       檔案選擇、上傳、清除與聊天泡泡附件顯示。
│   │
│   ├── avatar.js
│   │   └── 大頭貼功能：
│   │       預設大頭貼、上傳大頭貼、目前使用者大頭貼、
│   │       左側使用者列表大頭貼。
│   │
│   ├── leaderboard.js
│   │   └── 排行榜功能：
│   │       讀取排行榜、顯示排行榜、下載 CSV。
│   │
│   ├── background_change.js
│   │   └── 個人背景更換功能。
│   │
│   ├── chat_history.js
│   │   └── 聊天紀錄下載功能：
│   │       建立下載按鈕並向後端請求 HTML 聊天紀錄。
│   │
│   ├── chat_search.js
│   │   └── 搜尋聊天紀錄功能：
│   │       關鍵字搜尋、搜尋結果標亮、上一筆 / 下一筆跳轉。
│   │
│   ├── announcement.js
│   │   └── 公告功能：
│   │       將訊息設為公告、公告列顯示、點擊公告跳至原訊息。
│   │
│   └── reply_message.js
│       └── 回復功能：
│           點擊訊息後引用該訊息，並在送出時顯示回復內容。
│
├── server/
│   ├── state.js
│   │   └── 後端記憶體狀態：
│   │       線上使用者、nickname 與 socket 對應、
│   │       私人訊息、遊戲邀請、進行中遊戲、公告狀態。
│   │
│   ├── utils.js
│   │   └── 後端共用工具函式：
│   │       產生時間、清理文字、建立私人聊天室 key、
│   │       建立系統訊息、建立隨機 ID。
│   │
│   ├── httpRoutes.js
│   │   └── HTTP API：
│   │       登入、登出、取得目前使用者、排行榜、CSV 下載、
│   │       聊天紀錄 HTML 下載。
│   │
│   ├── socketHandlers.js
│   │   └── Socket.io 主流程：
│   │       連線驗證、登入狀態、線上使用者廣播、
│   │       大頭貼事件、聊天室事件、遊戲事件、斷線處理。
│   │
│   ├── chatHandlers.js
│   │   └── 聊天 Socket 事件：
│   │       群組聊天室、私人聊天室、typing、已讀、
│   │       公告、聊天訊息寫入資料庫、聊天紀錄清理。
│   │
│   ├── uploadHandlers.js
│   │   └── 上傳處理：
│   │       一般檔案上傳、大頭貼上傳、上傳資料夾建立、
│   │       檔案資料安全檢查。
│   │
│   └── game/
│       ├── gameHub.js
│       │   └── 遊戲總入口：
│       │       遊戲邀請、加入遊戲、遊戲類型分流、
│       │       斷線時遊戲處理。
│       │
│       ├── gameUtils.js
│       │   └── 遊戲共用工具：
│       │       傳送事件給指定玩家、取得玩家清單、
│       │       將內部遊戲狀態轉為前端可用狀態。
│       │
│       ├── tictactoeServer.js
│       │   └── 圈圈叉叉後端邏輯：
│       │       棋盤狀態、輪流下棋、勝負判斷、排行榜紀錄。
│       │
│       ├── snakesLaddersServer.js
│       │   └── 蛇與梯子後端邏輯：
│       │       等待室、加入遊戲、選色、開始遊戲、
│       │       擲骰、位置計算、蛇梯特殊格、勝負判斷、排行榜紀錄。
│       │
│       ├── game2048Server.js
│       │   └── 2048 後端邏輯：
│       │       多人等待室、玩家加入、棋盤同步、
│       │       分數同步、遊戲結束與勝負判斷。
│       │
│       └── minesweeperServer.js
│           └── 踩地雷後端邏輯：
│               多人等待室、玩家加入、共享棋盤、
│               回合控制、踩雷淘汰、淘汰者只能觀看、
│               勝負判斷與排行榜紀錄。
│
├── uploads/
│   ├── default.png
│   │   └── 預設大頭貼圖片。
│   │
│   ├── avatars/
│   │   └── 使用者上傳的大頭貼圖片。
│   │
│   └── files/
│       └── 使用者上傳的一般檔案。
│
└── node_modules/
    └── npm 安裝的後端套件。
```

---

## 功能與檔案對照表

| 功能                          | 前端相關檔案                                                                          | 後端相關檔案                                                                                        | 說明                                                         |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 不可重複暱稱登入                    | `login.html`, `js/login.js`, `js/index.js`                                      | `server/httpRoutes.js`, `server/socketHandlers.js`, `server/state.js`, `server.js`            | 使用者輸入暱稱後送到 `/api/login`，後端檢查暱稱是否已在線上。                      |
| 分頁登入控制                      | `js/login.js`, `js/index.js`                                                    | `server/httpRoutes.js`, `server/socketHandlers.js`                                            | 使用 `sessionStorage` 控制使用者必須從登入頁進入聊天室。                      |
| Node.js 重啟後自動回登入頁           | `js/index.js`                                                                   | `server/socketHandlers.js`                                                                    | 若 server 重啟造成 session 失效，前端收到 `authError` 後會自動回登入頁，不再跳提示框。 |
| 群組聊天室                       | `js/index.js`, `js/read_receipt.js`, `js/typing_indicator.js`                   | `server/chatHandlers.js`, `server/socketHandlers.js`, `server/state.js`, `db.js`              | 使用 Socket.io 即時同步群組訊息。                                     |
| 一對一私人聊天室                    | `js/index.js`, `js/read_receipt.js`, `js/typing_indicator.js`                   | `server/chatHandlers.js`, `server/state.js`, `db.js`                                          | 私人訊息會依照兩位使用者產生固定聊天室 key。                                   |
| 文字訊息傳送                      | `js/index.js`                                                                   | `server/chatHandlers.js`, `db.js`                                                             | 前端送出文字後，後端廣播給對應聊天室並寫入資料庫。                                  |
| 每則訊息顯示發送者暱稱                 | `js/index.js`, `css/index.css`                                                  | `server/chatHandlers.js`                                                                      | 訊息物件包含 `from` 欄位，前端顯示於訊息泡泡上方。                              |
| 每則訊息顯示傳送時間                  | `js/index.js`                                                                   | `server/utils.js`, `server/chatHandlers.js`                                                   | 後端建立 `timestamp`，前端格式化後顯示。                                 |
| 圖片預覽與圖片傳送                   | `js/image_upload.js`, `js/image_viewer.js`, `js/index.js`                       | `server/chatHandlers.js`, `db.js`                                                             | 圖片先在前端預覽，再以圖片資料送出並顯示。                                      |
| 圖片放大                        | `js/image_viewer.js`, `css/index.css`                                           | 無                                                                                             | 點擊聊天圖片或大頭貼可放大檢視。                                           |
| Emoji 表情符號選擇器               | `js/emoji_panel.js`, `js/index.js`                                              | 無                                                                                             | 點擊 emoji 按鈕後插入表情到輸入框。                                      |
| 快捷表情                        | `js/quick_emoji.js`, `js/emoji_panel.js`                                        | 無                                                                                             | 使用者常用 emoji 會顯示在快捷列中，最多 8 個。                               |
| 上傳表情包                       | `js/sticker.js`, `js/index.js`                                                  | 無                                                                                             | 表情包以本機使用者為主，不會同步給其他使用者。                                    |
| 動態打字中提示                     | `js/typing_indicator.js`, `js/index.js`                                         | `server/chatHandlers.js`                                                                      | 使用者輸入時透過 Socket.io 通知對方或群組。                                |
| 未讀訊息紅點提醒                    | `js/index.js`, `css/index.css`                                                  | `server/chatHandlers.js`                                                                      | 非目前聊天室收到訊息時，側邊欄顯示紅點。                                       |
| 未讀訊息按鈕緩慢閃爍效果                | `css/index.css`, `js/index.js`                                                  | 無                                                                                             | CSS 控制未讀按鈕閃爍動畫。                                            |
| 已讀功能                        | `js/read_receipt.js`, `js/index.js`                                             | `server/chatHandlers.js`, `server/state.js`                                                   | 私人訊息與群組訊息都支援已讀狀態。                                          |
| 聊天紀錄存於資料庫                   | `js/index.js`                                                                   | `server/chatHandlers.js`, `db.js`                                                             | 訊息送出時同步寫入 SQLite。                                          |
| 下載聊天紀錄 HTML                 | `js/chat_history.js`                                                            | `server/httpRoutes.js`, `server/chatHandlers.js`, `db.js`                                     | 使用者可下載目前聊天室聊天紀錄，格式為美編過的 HTML。                              |
| 搜尋聊天紀錄                      | `js/chat_search.js`, `js/index.js`, `css/index.css`                             | 無                                                                                             | 可在目前聊天室中搜尋關鍵字，並使用上一筆 / 下一筆跳轉。                              |
| 公告                          | `js/announcement.js`, `js/index.js`, `css/index.css`                            | `server/chatHandlers.js`, `server/state.js`                                                   | 可將訊息設為公告，公告列點擊後跳至原訊息位置。                                    |
| 回復功能                        | `js/reply_message.js`, `js/index.js`, `css/index.css`                           | `server/chatHandlers.js`                                                                      | 點擊某則訊息後，可引用該訊息並回覆。                                         |
| 傳送檔案                        | `js/file_upload.js`, `js/index.js`, `css/index.css`                             | `server/uploadHandlers.js`, `server/chatHandlers.js`, `db.js`                                 | 使用 multer 上傳檔案，並在聊天泡泡中顯示下載連結。                              |
| 預設大頭貼                       | `js/avatar.js`, `css/index.css`, `uploads/default.png`                          | `server/uploadHandlers.js`, `server/socketHandlers.js`, `server/state.js`                     | 使用者進入時使用預設大頭貼，也可自行更換。                                      |
| 改背景                         | `js/background_change.js`, `css/index.css`                                      | 無                                                                                             | 使用者可在本機更換聊天室背景。                                            |
| 中文 / 英文雙語介面                 | `js/i18n.js`, `index.html`, `login.html`, 各前端模組                                 | 無                                                                                             | 使用 `data-i18n` 與 `window.i18n.t()` 管理雙語文字。                 |
| SQLite 資料庫排行榜               | `js/leaderboard.js`, `js/index.js`                                              | `db.js`, `server/httpRoutes.js`, 各遊戲後端檔案                                                      | 遊戲結束後寫入排行榜資料。                                              |
| 排行榜 CSV 下載                  | `js/leaderboard.js`                                                             | `server/httpRoutes.js`, `db.js`                                                               | 透過 `/api/leaderboard.csv` 下載 CSV。                          |
| 遊戲庫設計                       | `js/gameRegistry.js`, `js/index.js`                                             | `server/game/gameHub.js`                                                                      | 統一管理遊戲選單與遊戲邀請流程。                                           |
| 第一個遊戲為圈圈叉叉                  | `js/tictactoe.js`, `js/gameRegistry.js`, `js/index.js`                          | `server/game/tictactoeServer.js`, `server/game/gameHub.js`, `db.js`                           | 一對一私人聊天室遊戲。                                                |
| 其他遊戲 : 踩地雷 2048             | `js/minesweeper.js`, `js/game2048.js`, `js/solo_games.js`, `js/gameRegistry.js` | `server/game/minesweeperServer.js`, `server/game/game2048Server.js`, `server/game/gameHub.js` | 支援備忘錄單人模式與線上多人模式。                                          |
| 多人遊戲 : 蛇與梯子                 | `js/snakes_ladders.js`, `js/gameRegistry.js`, `js/index.js`                     | `server/game/snakesLaddersServer.js`, `server/game/gameHub.js`, `db.js`                       | 可在私人聊天室與群組聊天室進行多人遊戲。                                       |
| 備忘錄                         | `js/memo.js`, `js/solo_games.js`, `js/index.js`, `css/index.css`                | 無                                                                                             | 本機備忘錄，不需存入 SQLite。                                         |
| LLM機器人   XXXXXXXXXXXXXXXXXX | 依實際整合檔案為準                                                                       | 依實際整合檔案為準                                                                                     | 若後續整合 LLM，可新增獨立前端與後端模組。                                    |

---

## 系統流程說明

### 1. 使用者登入流程

```text
login.html
   ↓
js/login.js 讀取 nickname
   ↓
POST /api/login
   ↓
server/httpRoutes.js 檢查暱稱是否重複
   ↓
Express session 儲存 nickname
   ↓
登入成功後導向 index.html
   ↓
js/index.js 呼叫 /api/me 確認登入狀態
   ↓
建立 Socket.io 連線
   ↓
server/socketHandlers.js 驗證 session
   ↓
後端發送 loginReady
   ↓
前端顯示目前使用者與聊天室畫面
```

本專案另外使用 `sessionStorage` 控制分頁登入狀態，因此使用者必須從登入頁正常登入才可進入聊天室。若直接複製聊天室網址到新分頁，或重新整理聊天室頁面，系統會視為需要重新登入。

若 Node.js server 重新啟動，原本聊天室頁面的 session 會失效。此時前端收到 Socket `authError` 或連線錯誤後，會自動清除目前分頁登入狀態，並導回 `login.html`，不會跳出額外提示框。

---

### 2. 登出流程

```text
使用者點擊登出
   ↓
js/index.js 清除目前分頁的 sessionStorage 登入狀態
   ↓
目前分頁 Socket 斷線
   ↓
目前分頁導回 login.html
```

目前登出只會登出目前分頁的使用者，不會影響同一個瀏覽器中其他分頁的使用者。

---

### 3. 群組聊天室流程

```text
使用者點擊「群組聊天室」
   ↓
js/index.js 送出 joinGroup
   ↓
server/chatHandlers.js 將使用者加入 group room
   ↓
後端廣播 groupSystem 系統訊息
   ↓
使用者輸入文字 / 圖片 / 檔案 / emoji
   ↓
js/index.js 送出 groupMessage
   ↓
server/chatHandlers.js 建立群組訊息物件
   ↓
寫入 SQLite 聊天紀錄
   ↓
Socket.io 廣播給群組所有使用者
   ↓
各使用者前端重新渲染訊息
```

群組聊天室支援文字、圖片、檔案、emoji、已讀、公告、搜尋聊天紀錄與下載聊天紀錄。

---

### 4. 一對一私人聊天室流程

```text
使用者點擊左側線上使用者
   ↓
js/index.js 切換 currentChat 為 private
   ↓
使用者送出訊息
   ↓
js/index.js 送出 privateMessage
   ↓
server/chatHandlers.js 依照兩位使用者建立 privateRoomKey
   ↓
訊息存入 privateMessages Map
   ↓
訊息寫入 SQLite
   ↓
Socket.io 分別送給發送者與接收者
   ↓
前端顯示私人訊息
```

私人聊天室支援訊息已讀、typing indicator、圖片、檔案、回復、公告、搜尋聊天紀錄與下載聊天紀錄。

---

### 5. 已讀功能流程

```text
使用者打開私人聊天室或群組聊天室
   ↓
js/read_receipt.js 通知 server 目前正在閱讀哪個聊天室
   ↓
server/chatHandlers.js 更新訊息 readAt 或 readBy
   ↓
後端通知原訊息發送者
   ↓
前端 read_receipt.js 更新已讀標籤
```

私人聊天室顯示對方是否已讀，群組聊天室則可顯示群組已讀數。

---

### 6. 聊天紀錄下載流程

```text
使用者點擊「下載聊天紀錄」
   ↓
js/chat_history.js 組合目前聊天室 type / target / owner
   ↓
GET /api/chat-history/download
   ↓
server/httpRoutes.js 先同步目前記憶體中的訊息 ID
   ↓
db.js 從 SQLite 取得目前聊天室紀錄
   ↓
server/httpRoutes.js 產生美編 HTML
   ↓
瀏覽器下載 HTML 聊天紀錄檔
```

下載前會先清理已不存在於目前聊天室畫面中的舊訊息，避免下載到過去測試留下的聊天紀錄。

---

### 7. 搜尋聊天紀錄流程

```text
使用者在聊天室上方輸入關鍵字
   ↓
js/chat_search.js 搜尋目前畫面上的訊息
   ↓
符合結果的文字被標亮
   ↓
搜尋框顯示搜尋結果數量
   ↓
使用者可按上一筆 / 下一筆
   ↓
畫面跳至對應訊息位置
```

搜尋功能只針對目前聊天室畫面中的訊息，不直接查詢 SQLite。

---

### 8. 公告流程

```text
使用者點擊某則訊息
   ↓
js/announcement.js 將該訊息設為公告
   ↓
Socket 傳送 setChatAnnouncement
   ↓
server/chatHandlers.js 儲存公告狀態
   ↓
後端廣播 chatAnnouncementUpdated
   ↓
前端在聊天室上方顯示公告列
   ↓
使用者點擊公告列
   ↓
畫面跳至原始訊息位置
```

公告會顯示為一行格式，例如：

```text
暱稱 | 訊息內容...
```

如果訊息過長，前端會以省略號顯示，避免破壞響應式版面。

---

### 9. 回復訊息流程

```text
使用者點擊某則訊息泡泡
   ↓
js/reply_message.js 在輸入框上方顯示引用訊息
   ↓
使用者輸入回覆內容
   ↓
送出訊息時附帶 replyTo 資料
   ↓
server/chatHandlers.js 將 replyTo 一起保存於訊息物件
   ↓
前端顯示「回覆某則訊息」的引用區塊
```

回復功能支援文字、圖片、檔案與 emoji 訊息。

---

### 10. 檔案上傳流程

```text
使用者點擊檔案按鈕
   ↓
js/file_upload.js 選擇檔案
   ↓
POST /api/upload-file
   ↓
server/uploadHandlers.js 使用 multer 儲存檔案
   ↓
回傳檔案 URL
   ↓
js/index.js 將檔案資料作為聊天訊息送出
   ↓
接收者可在聊天泡泡中下載檔案
```

上傳檔案會存放於 `uploads/files/` 中。

---

### 11. 大頭貼流程

```text
使用者進入聊天室
   ↓
預設使用 uploads/default.png
   ↓
使用者點擊更換大頭貼
   ↓
js/avatar.js 讀取圖片
   ↓
Socket updateAvatar 傳送給後端
   ↓
server/uploadHandlers.js 儲存至 uploads/avatars/
   ↓
server/socketHandlers.js 廣播線上使用者資料
   ↓
所有使用者列表同步更新大頭貼
```

大頭貼可在上方目前使用者旁邊顯示，也會顯示在線上使用者列表中。點擊大頭貼可放大檢視。

---

### 12. 遊戲邀請流程

```text
使用者點擊遊戲按鈕
   ↓
js/gameRegistry.js 提供目前聊天室可用遊戲
   ↓
js/index.js 送出 sendGameInvite
   ↓
server/game/gameHub.js 建立遊戲邀請
   ↓
後端依照遊戲類型建立遊戲狀態
   ↓
聊天泡泡中出現遊戲邀請
   ↓
玩家點擊加入遊戲
   ↓
server/game/gameHub.js 分流到對應遊戲後端模組
   ↓
遊戲開始後前端開啟遊戲視窗
```

遊戲主入口為 `server/game/gameHub.js`，各遊戲的實際邏輯則拆分至不同後端模組中。

---

### 13. 圈圈叉叉流程

```text
私人聊天室發起圈圈叉叉
   ↓
兩位玩家加入
   ↓
server/game/tictactoeServer.js 建立棋盤
   ↓
前端 js/tictactoe.js 渲染棋盤
   ↓
玩家輪流下棋
   ↓
後端判斷勝利、失敗或平手
   ↓
結果寫入 SQLite 排行榜
```

圈圈叉叉為一對一遊戲，只會出現在私人聊天室中。

---

### 14. 蛇與梯子流程

```text
私人或群組聊天室發起蛇與梯子
   ↓
玩家加入等待室
   ↓
玩家選擇棋子顏色
   ↓
私人聊天室：兩人選色後自動開始
群組聊天室：兩人以上可由發起人開始，四人加入後可自動開始
   ↓
玩家依序擲骰
   ↓
前端顯示骰子動畫與棋子移動動畫
   ↓
後端計算位置、蛇與梯子特殊格、是否剛好抵達 100
   ↓
先剛好到達 100 的玩家獲勝
   ↓
結果寫入 SQLite 排行榜
```

蛇與梯子的圖片與棋子圖片放在 `uploads/` 中，前端由 `js/snakes_ladders.js` 控制動畫。

蛇與梯子規則包含：

```text
1. 至少 2 人，最多 4 人。
2. 玩家加入遊戲後需要先選擇棋子顏色。
3. 棋子顏色不可重複選擇。
4. 玩家順序依照加入遊戲的順序。
5. 必須剛好走到 100 才能獲勝。
6. 若骰出的步數會超過 100，棋子原地不動。
7. 遇到梯子會上升，遇到蛇會下降。
8. 蛇或梯子的移動由前端以直線滑行動畫顯示。
```

---

### 15. 2048 流程

```text
備忘錄模式：
memo → solo_games.js → game2048.js 單人遊戲

線上模式：
private / group 發起 2048
   ↓
至少兩位玩家加入
   ↓
server/game/game2048Server.js 建立多人遊戲狀態
   ↓
前端 js/game2048.js 顯示雙方棋盤
   ↓
玩家使用方向鍵操作自己的棋盤
   ↓
前端將棋盤與分數同步給後端
   ↓
兩位玩家都結束後，後端比較分數
   ↓
分數高者獲勝，分數相同則平手
```

2048 在備忘錄中可單人遊玩，在私人與群組聊天室中必須至少兩人才開始。

2048 規則包含：

```text
1. 單人模式可在備忘錄中直接開啟。
2. 多人模式最少 2 人，最多 2 人。
3. 玩家各自操作自己的 2048 棋盤。
4. 前端將棋盤與分數同步至後端。
5. 雙方都無法繼續移動時，遊戲結束。
6. 分數高者獲勝。
7. 分數相同則平手。
```

---

### 16. 踩地雷流程

```text
備忘錄模式：
memo → solo_games.js → minesweeper.js 單人遊戲

線上模式：
private / group 發起踩地雷
   ↓
至少兩位玩家加入，最多四位玩家
   ↓
server/game/minesweeperServer.js 建立共享地雷棋盤
   ↓
玩家依序打開格子
   ↓
打開安全格可得分
   ↓
踩到地雷者被淘汰
   ↓
淘汰者只能觀看，不會再輪到他操作
   ↓
若只剩一位未淘汰玩家，該玩家獲勝
   ↓
若所有安全格都被打開，分數最高者獲勝
```

踩地雷線上多人模式支援 2 至 4 人，並由後端控制回合、淘汰與勝負判斷。

踩地雷規則包含：

```text
1. 備忘錄模式可單人遊玩。
2. 線上模式最少 2 人，最多 4 人。
3. 玩家共用同一張地雷棋盤。
4. 玩家依照加入遊戲的順序輪流打開格子。
5. 打開安全格可以加分。
6. 如果打開空白格並連帶展開多格，會依展開的安全格數量加分。
7. 踩到地雷的玩家會被淘汰。
8. 被淘汰者只能觀看遊戲。
9. 被淘汰者不能再打開格子。
10. 被淘汰者不能插旗。
11. 被淘汰者不會再被排入回合。
12. 若未淘汰玩家只剩 1 人，該玩家獲勝。
13. 若所有安全格都被打開，分數最高者獲勝。
14. 若最高分相同，則為平手。
```

---

### 17. 備忘錄流程

```text
使用者點擊左側備忘錄
   ↓
js/memo.js 開啟本機備忘錄聊天室
   ↓
使用者可輸入文字、圖片、檔案
   ↓
資料保留於本機瀏覽器
   ↓
備忘錄可開啟單人遊戲
```

備忘錄不寫入 SQLite，也不會同步給其他使用者。備忘錄中的遊戲為單人遊戲，目前支援 2048 與踩地雷。

---

## 遊戲可用範圍

| 遊戲   | 備忘錄 | 私人聊天室 | 群組聊天室 |
| ---- | --: | ----: | ----: |
| 圈圈叉叉 | 不支援 |    支援 |   不支援 |
| 蛇與梯子 | 不支援 |    支援 |    支援 |
| 2048 |  支援 |    支援 |    支援 |
| 踩地雷  |  支援 |    支援 |    支援 |

---

## 後端模組化設計

本專案後端採用模組化架構，`server.js` 只保留主流程，主要功能拆分至 `/server/` 資料夾中。

```text
server.js
   ↓
server/httpRoutes.js        HTTP API
server/uploadHandlers.js    檔案與大頭貼上傳
server/socketHandlers.js    Socket.io 主流程
server/chatHandlers.js      聊天室事件
server/game/gameHub.js      遊戲事件總入口
server/game/*.js            各遊戲後端邏輯
server/state.js             後端記憶體狀態
server/utils.js             共用工具
```

此設計可避免 `server.js` 過長，並方便日後新增遊戲、調整聊天室功能或擴充後端 API。

---

## 前端模組化設計

前端主流程放在 `js/index.js`，其他功能拆成獨立模組。

```text
js/index.js
   ↓
聊天室主流程、Socket 事件、訊息渲染、前端模組初始化

其他功能模組：
- js/login.js
- js/i18n.js
- js/gameRegistry.js
- js/tictactoe.js
- js/snakes_ladders.js
- js/game2048.js
- js/minesweeper.js
- js/solo_games.js
- js/memo.js
- js/read_receipt.js
- js/typing_indicator.js
- js/emoji_panel.js
- js/quick_emoji.js
- js/sticker.js
- js/image_upload.js
- js/image_viewer.js
- js/file_upload.js
- js/avatar.js
- js/leaderboard.js
- js/background_change.js
- js/chat_history.js
- js/chat_search.js
- js/announcement.js
- js/reply_message.js
```

新增前端功能時，原則上應優先建立獨立 JS 檔案，只把必要的初始化或事件串接加入 `index.js`。

---

## 資料庫設計概念

本專案使用 SQLite，主要儲存：

```text
1. 聊天訊息紀錄
2. 遊戲排行榜資料
3. 遊戲玩家紀錄
```

相關檔案：

```text
db.js
chatroom.db
server/httpRoutes.js
server/chatHandlers.js
server/game/*.js
```

聊天訊息會在送出時寫入資料庫。下載聊天紀錄時，後端會依照目前仍存在於聊天室中的訊息同步清理舊資料，避免下載到不存在於目前聊天室畫面中的歷史訊息。

---

## 安裝與執行方式

### 1. 安裝套件

```bash
npm install
```

### 2. 啟動伺服器

```bash
npm.cmd start
```

或：

```bash
node server.js
```

### 3. 開啟網站

```text
http://localhost:3000
```

---

## 使用方式

### 登入

1. 開啟 `http://localhost:3000`
2. 輸入暱稱
3. 若暱稱沒有被其他線上使用者使用，即可進入聊天室

### 群組聊天

1. 點擊左側「群組聊天室」
2. 輸入文字、選擇圖片、選擇檔案或 emoji
3. 點擊送出

### 私人聊天

1. 點擊左側線上使用者
2. 開始一對一聊天

### 備忘錄

1. 點擊左側「備忘錄」
2. 可輸入文字、圖片、檔案
3. 可開啟單人遊戲

### 下載聊天紀錄

1. 進入群組聊天室或私人聊天室
2. 點擊「下載聊天紀錄」
3. 系統會下載美編過的 HTML 聊天紀錄檔

### 搜尋聊天紀錄

1. 在聊天室上方搜尋框輸入關鍵字
2. 符合的訊息會被標亮
3. 可使用上一筆 / 下一筆按鈕跳轉搜尋結果

### 設為公告

1. 點擊某一則訊息泡泡
2. 選擇設為公告
3. 公告會顯示在聊天室上方
4. 點擊公告可跳回原始訊息

### 回復訊息

1. 點擊想回復的訊息泡泡
2. 輸入回覆內容
3. 送出後會顯示引用訊息與回覆內容

### 遊戲

1. 進入私人聊天室、群組聊天室或備忘錄
2. 點擊遊戲按鈕
3. 選擇可用遊戲
4. 依照遊戲規則進行遊戲

---

## 注意事項

1. 同一時間不可使用重複暱稱登入。
2. 聊天室主頁若重新整理，會視為重新登入。
3. 直接複製聊天室網址到新分頁，系統會導回登入頁。
4. Node.js server 重新啟動後，原本聊天室頁面會自動導回登入頁。
5. 目前登出只會登出目前分頁，不會影響同瀏覽器其他分頁。
6. 備忘錄資料主要保留於本機瀏覽器，不會同步給其他使用者。
7. 上傳表情包與快捷表情只屬於目前使用者，不會同步給其他使用者。
8. 後端主流程保留於 `server.js`，新增後端功能應優先放入 `/server/`。
9. 前端主流程保留於 `js/index.js`，新增前端功能應優先獨立成新的 JS 模組。
10. 若交作業時不需要舊版備份，可移除 `server_old.js`，避免助教混淆。

```
```
