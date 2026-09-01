<?php
// api/auth.php
// 所有「需要登入」的 API 一律先 require_once auth.php（提供 session + require_login / require_admin）
declare(strict_types=1);

/**
 * ✅ Session 安全性設定（必須在 session_start 前）
 * 如果你的站是全程 HTTPS，建議把 cookie_secure 打開。
 */
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');
// ini_set('session.cookie_secure', '1'); // ✅ 站點全 HTTPS 再開（否則本機 http 會收不到 cookie）

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

/**
 * 統一 JSON 回應：只有需要回 JSON 的 API 才會用到這個函式
 * （不要在檔案外層 header JSON，避免被 HTML 頁面 include 時污染 Content-Type）
 */
function json_response(int $status, array $data): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

// 你可以調整 idle timeout（秒）
const SESSION_IDLE_TIMEOUT = 30 * 60; // 30 分鐘

/**
 * 驗證是否登入 + idle timeout
 * - 未登入：401 not_logged_in
 * - 逾時：清 session 後回 401 session_expired
 * - 有登入：更新 last_activity
 */
function require_login(): void {
  if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'error' => 'not_logged_in']);
  }

  $last = (int)($_SESSION['last_activity'] ?? 0);
  $now  = time();

  // idle timeout
  if ($last > 0 && ($now - $last) > SESSION_IDLE_TIMEOUT) {
    session_unset();
    session_destroy();
    json_response(401, ['ok' => false, 'error' => 'session_expired']);
  }

  // 更新活動時間
  $_SESSION['last_activity'] = $now;
}

/**
 * 驗證 admin 權限
 */
function require_admin(): void {
  require_login();
  if (($_SESSION['role'] ?? 'user') !== 'admin') {
    json_response(403, ['ok' => false, 'error' => 'forbidden']);
  }
}
