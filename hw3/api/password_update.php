<?php
// api/password_update.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
if (empty($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'error' => 'not_logged_in'], JSON_UNESCAPED_UNICODE);
  exit;
}

require_once __DIR__ . '/db.php'; // 你原本的 PDO 取得方式：db()

function json_in(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function json_out(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

$input = json_in();
$old = (string)($input['old_password'] ?? '');
$new = (string)($input['new_password'] ?? '');

if ($old === '' || $new === '') {
  json_out(400, ['ok' => false, 'error' => 'missing_fields']);
}

// ✅ 你也可以改成你原本規則（至少8碼+英數）
if (strlen($new) < 8) {
  json_out(400, ['ok' => false, 'error' => 'weak_password']);
}
if (!preg_match('/[A-Za-z]/', $new) || !preg_match('/\d/', $new)) {
  json_out(400, ['ok' => false, 'error' => 'weak_password']);
}

$userId = (int)$_SESSION['user_id'];

try {
  $pdo = db();

  // 1) 取出目前 hash
  $stmt = $pdo->prepare("SELECT hash_password FROM users WHERE user_id = :uid LIMIT 1");
  $stmt->execute([':uid' => $userId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    json_out(404, ['ok' => false, 'error' => 'user_not_found']);
  }

  $hash = (string)($row['hash_password'] ?? '');
  if ($hash === '' || !password_verify($old, $hash)) {
    json_out(400, ['ok' => false, 'error' => 'incorrect_old_password']);
  }

  // 2) 新密碼 hash 寫回 DB
  $newHash = password_hash($new, PASSWORD_DEFAULT);

  $stmt2 = $pdo->prepare("UPDATE users SET hash_password = :hp WHERE user_id = :uid");
  $stmt2->execute([
    ':hp' => $newHash,
    ':uid' => $userId
  ]);

  json_out(200, ['ok' => true]);

} catch (Throwable $e) {
  json_out(500, ['ok' => false, 'error' => 'server_error']);
}
