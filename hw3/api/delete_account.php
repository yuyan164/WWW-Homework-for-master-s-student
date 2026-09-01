<?php
// api/delete_account.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

try {
  // 必須登入
  if (empty($_SESSION['user_id'])) {
    json_response(401, ["ok" => false, "error" => "not_logged_in"]);
  }

  $userId = (int)$_SESSION['user_id'];
  if ($userId <= 0) {
    json_response(400, ["ok" => false, "error" => "invalid_user_id"]);
  }

  $pdo = db();
  $pdo->beginTransaction();

  // 1) 刪除該使用者所有 bookings（釋放資源）
  $stmt = $pdo->prepare("DELETE FROM bookings WHERE user_id = ?");
  $stmt->execute([$userId]);
  $deletedBookings = $stmt->rowCount();

  // 2) 刪除 user
  $stmt2 = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
  $stmt2->execute([$userId]);
  $deletedUsers = $stmt2->rowCount();

  if ($deletedUsers !== 1) {
    // user 不存在或刪除失敗 → rollback
    $pdo->rollBack();
    json_response(400, ["ok" => false, "error" => "user_not_found"]);
  }

  $pdo->commit();

  // 3) 清 session（真正登出）
  $_SESSION = [];
  if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
      $params["path"], $params["domain"], $params["secure"], $params["httponly"]
    );
  }
  session_destroy();

  json_response(200, [
    "ok" => true,
    "deletedBookings" => $deletedBookings
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  // production 可改成不回傳詳細訊息
  json_response(500, ["ok" => false, "error" => "server_error"]);
}
