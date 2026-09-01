<?php
// api/login.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // 這裡負責 session_start + json_response
require_once __DIR__ . '/db.php';   // 這裡提供 db() 取得 PDO

try {
  // 1) 取得 PDO（你 db.php 是用 db()，不是 $pdo 變數）
  $pdo = db();

  // 2) 讀 JSON body（前端 fetch 用 application/json）
  $raw = file_get_contents('php://input');
  $input = json_decode($raw, true);
  if (!is_array($input)) $input = [];

  $email = trim((string)($input['email'] ?? ''));
  $password = (string)($input['password'] ?? '');

  if ($email === '' || $password === '') {
    json_response(400, ['ok' => false, 'error' => 'missing_fields']);
  }

  // 3) 查使用者
  $stmt = $pdo->prepare('SELECT user_id, username, email, hash_password, role, profile_pic FROM users WHERE email=? LIMIT 1');
  $stmt->execute([$email]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  // 4) 驗證密碼
  if (!$user || !password_verify($password, $user['hash_password'])) {
    json_response(401, ['ok' => false, 'error' => 'invalid_credentials']);
  }

  // 5) ✅ 登入成功：把會員資訊寫入 session（這就是你要的「登入當下存 session」）
  session_regenerate_id(true);
  $_SESSION['user_id'] = (int)$user['user_id'];
  $_SESSION['username'] = $user['username'];
  $_SESSION['email'] = $user['email'];
  $_SESSION['role'] = $user['role'];
  $_SESSION['last_activity'] = time();
  $_SESSION['profile_pic'] = $user['profile_pic'] ?? null; // 可能是 NULL

  // 6) 保險：立刻寫入 session
  session_write_close();

  // 7) 回傳 JSON 給前端
  json_response(200, [
    'ok' => true,
    'user' => [
      'user_id' => (int)$user['user_id'],
      'username' => $user['username'],
      'email' => $user['email'],
      'role' => $user['role'],
      'profile_pic' => $user['profile_pic'],
    ]
  ]);

} catch (Throwable $e) {
  //json_response(500, ['ok'=>false, 'error'=>'server_error']);
  json_response(500, ['ok'=>false, 'error'=>'server_error', 'detail'=>$e->getMessage(),'file' => basename($e->getFile()),'line' => $e->getLine(),]);  //debug
}
