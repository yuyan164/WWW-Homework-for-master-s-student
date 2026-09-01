<?php
// api/me.php  提供「目前登入者」的 me.php（前端用來判斷登入狀態）
// 前端只要呼叫它一次，就能知道「是否登入」，進而決定要不要鎖按鈕/導登入頁
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

if (empty($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'not_logged_in'], JSON_UNESCAPED_UNICODE);
  exit;
}

echo json_encode([
  'ok' => true,
  'user' => [
    'user_id' => (int)$_SESSION['user_id'],
    'username' => $_SESSION['username'] ?? '',
    'email' => $_SESSION['email'] ?? '',
    'role' => $_SESSION['role'] ?? 'user',
    'profile_pic' => $_SESSION['profile_pic'] ?? null,
  ]
], JSON_UNESCAPED_UNICODE);

exit; // ✅ 建議加上，避免後面又輸出東西