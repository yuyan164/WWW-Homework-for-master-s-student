/**
 * leaderboard.js
 * ------------------------------------------------------------
 * 檔案用途：
 * 本檔案負責排行榜功能。
 *
 * 主要功能：
 * 1. 開啟排行榜彈出視窗。
 * 2. 透過 AJAX 讀取排行榜資料。
 * 3. 渲染排行榜表格。
 * 4. 支援中英雙語欄位文字。
 * ------------------------------------------------------------
 */

(function setupLeaderboardModule() {
  if (window.LeaderboardModule) return;

  async function load(config) {
    const leaderboardContent = config.leaderboardContent;
    const translate = config.translate;
    const formatDateTime = config.formatDateTime;

    leaderboardContent.innerHTML = `<p class="muted">${translate('connecting')}</p>`;

    try {
      const response = await fetch('/api/leaderboard');
      const result = await response.json();
      const leaderboard = result.leaderboard || [];

      if (leaderboard.length === 0) {
        leaderboardContent.innerHTML = `<p class="muted">${translate('noRecords')}</p>`;
        return;
      }

      const table = document.createElement('table');
      table.className = 'leaderboard-table';

      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>${translate('rank')}</th>
          <th>${translate('nickname')}</th>
          <th>${translate('games')}</th>
          <th>${translate('wins')}</th>
          <th>${translate('losses')}</th>
          <th>${translate('draws')}</th>
          <th>${translate('winRate')}</th>
          <th>${translate('avgDuration')}</th>
          <th>${translate('lastPlayed')}</th>
        </tr>
      `;

      const tbody = document.createElement('tbody');

      leaderboard.forEach((player, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${player.nickname}</td>
          <td>${player.games}</td>
          <td>${player.wins}</td>
          <td>${player.losses}</td>
          <td>${player.draws}</td>
          <td>${player.winRate}%</td>
          <td>${translate('seconds', { seconds: player.averageDurationSeconds })}</td>
          <td>${formatDateTime(player.lastPlayedAt)}</td>
        `;

        tbody.appendChild(row);
      });

      table.append(thead, tbody);
      leaderboardContent.innerHTML = '';
      leaderboardContent.appendChild(table);
    } catch (error) {
      console.error('Leaderboard load error:', error);
      leaderboardContent.innerHTML = `<p class="form-error">${translate('loginFailed')}</p>`;
    }
  }

  function init(config) {
    const leaderboardBtn = config.leaderboardBtn;
    const leaderboardModal = config.leaderboardModal;
    const closeLeaderboardBtn = config.closeLeaderboardBtn;

    leaderboardBtn.addEventListener('click', () => {
      leaderboardModal.classList.remove('hidden');
      load(config);
    });

    closeLeaderboardBtn.addEventListener('click', () => {
      leaderboardModal.classList.add('hidden');
    });
  }

  window.LeaderboardModule = {
    init,
    load,
  };
})();