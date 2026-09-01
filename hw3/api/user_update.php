<?php
// api/user_update.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

require_once __DIR__ . '/db.php'; // 你已有 db() -> PDO

function json_out(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

if (empty($_SESSION['user_id'])) {
  json_out(401, ['ok' => false, 'error' => 'not_logged_in']);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// multipart：文字在 $_POST、檔案在 $_FILES
$username = trim((string)($_POST['username'] ?? ''));
$email    = trim((string)($_POST['email'] ?? ''));

if ($username === '' || $email === '') {
  json_out(400, ['ok' => false, 'error' => 'missing_fields']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_out(400, ['ok' => false, 'error' => 'invalid_email']);
}

$pdo = db();
$userId = (int)$_SESSION['user_id'];
$pk = 'user_id';

// 檢查 email 是否被其他人使用
$st = $pdo->prepare("SELECT $pk FROM users WHERE email = ? AND $pk <> ? LIMIT 1");
$st->execute([$email, $userId]);
if ($st->fetch()) {
  json_out(400, ['ok' => false, 'error' => 'email_exists']);
}

// 先取舊頭貼 + role
$st = $pdo->prepare("SELECT profile_pic, role FROM users WHERE $pk = ? LIMIT 1");
$st->execute([$userId]);
$row = $st->fetch(PDO::FETCH_ASSOC);
if (!$row) json_out(404, ['ok' => false, 'error' => 'user_not_found']);

$oldPic = (string)($row['profile_pic'] ?? '');
$role   = (string)($row['role'] ?? 'user');

// ---------- 處理檔案（可選） ----------
$newPicPath = $oldPic; // 預設維持原本

if (isset($_FILES['profile_pic']) && is_array($_FILES['profile_pic'])) {
  $f = $_FILES['profile_pic'];
  $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;

  if ($err !== UPLOAD_ERR_NO_FILE) {
    if ($err !== UPLOAD_ERR_OK) {
      json_out(400, ['ok' => false, 'error' => 'upload_failed']);
    }

    $maxBytes = 2 * 1024 * 1024; // 2MB
    if (($f['size'] ?? 0) > $maxBytes) {
      json_out(400, ['ok' => false, 'error' => 'photo_too_large']);
    }

    $tmp = (string)$f['tmp_name'];
    $fi = new finfo(FILEINFO_MIME_TYPE);
    $mime = $fi->file($tmp);

    $allow = [
      'image/jpeg' => 'jpg',
      'image/png'  => 'png',
      'image/gif'  => 'gif',
      'image/webp' => 'webp',
    ];
    if (!isset($allow[$mime])) {
      json_out(400, ['ok' => false, 'error' => 'invalid_profile_pic']);
    }

    $ext = $allow[$mime];
    $safeName = 'u' . $userId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;

    // api/ 的上一層是專案根，pic/ 與 api/ 同層
    $picDir = __DIR__ . '/../pic';
    if (!is_dir($picDir)) {
      json_out(500, ['ok' => false, 'error' => 'pic_dir_missing']);
    }

    $destFs = $picDir . DIRECTORY_SEPARATOR . $safeName;
    if (!move_uploaded_file($tmp, $destFs)) {
      json_out(500, ['ok' => false, 'error' => 'upload_failed']);
    }

    $newPicPath = 'pic/' . $safeName;

    // （可選）刪舊檔，避免 pic 資料夾越堆越多
    // if ($oldPic && str_starts_with($oldPic, 'pic/')) {
    //   $oldFs = __DIR__ . '/../' . $oldPic;
    //   if (is_file($oldFs)) @unlink($oldFs);
    // }
  }
}

// 更新 DB
$st = $pdo->prepare("UPDATE users SET username = ?, email = ?, profile_pic = ? WHERE $pk = ?");
$st->execute([$username, $email, $newPicPath, $userId]);

// 同步 session（me.php 會立刻回最新）
$_SESSION['username'] = $username;
$_SESSION['email'] = $email;
$_SESSION['profile_pic'] = $newPicPath;
$_SESSION['role'] = $role;

json_out(200, [
  'ok' => true,
  'user' => [
    'user_id' => $userId,
    'username' => $username,
    'email' => $email,
    'role' => $role,
    'profile_pic' => $newPicPath,
  ]
]);
