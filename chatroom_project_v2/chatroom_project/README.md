# Earth Tone Chatroom + Game Project

This is a Node.js / Express / Socket.io chatroom project with:

- unique nickname login
- group chatroom
- one-to-one private chat
- text messages with sender nickname and send time
- image preview and image sending
- emoji picker
- dynamic typing indicator
- unread red dot plus slow flashing button effect
- expandable game library
- Tic-Tac-Toe as the first 1-to-1 game
- SQLite database leaderboard
- CSV leaderboard download
- Chinese / English bilingual UI

## Folder structure

```text
project/
├── server.js
├── db.js
├── package.json
├── login.html
├── index.html
├── css/
│   └── index.css
├── js/
│   ├── login.js
│   ├── index.js
│   ├── i18n.js
│   ├── gameRegistry.js
│   └── tictactoe.js
└── uploads/
```

## How to run

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## SQLite notes

The database file `chatroom.db` is created automatically when the server starts. You do not need phpMyAdmin. To inspect the database manually, you can install DB Browser for SQLite and open `chatroom.db`.

## Group typing indicator switch

Both `server.js` and `js/index.js` contain this setting:

```js
const SHOW_GROUP_TYPING = true;
```

If you worry the assignment spec will be interpreted strictly as private-chat-only typing indicators, change it to:

```js
const SHOW_GROUP_TYPING = false;
```
