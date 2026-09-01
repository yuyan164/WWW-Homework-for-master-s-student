<?php
// api/logout.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // ✅ 確保 session_start + json_response 可用

// ✅ 1) 清掉 session 變數
$_SESSION = [];
session_unset();

// ✅ 2) 刪掉 session cookie（很重要！）
if (ini_get("session.use_cookies")) {
  $params = session_get_cookie_params();
  setcookie(
    session_name(), // 通常是 PHPSESSID
    '',
    time() - 42000,
    $params["path"],
    $params["domain"],
    $params["secure"],
    $params["httponly"]
  );
}

// ✅ 3) 銷毀 session（伺服器端）
session_destroy();

// ✅ 4) 回 JSON
json_response(200, ['ok' => true]);
