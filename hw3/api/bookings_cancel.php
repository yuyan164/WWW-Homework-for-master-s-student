<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // session_start + json_response
require_once __DIR__ . '/db.php';   // db() -> PDO

// 只允許 POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(405, ["ok" => false, "error" => "method_not_allowed"]);
}

// 必須登入（依你 auth.php 的寫法可能不同，這裡用 session 判斷）
$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
  json_response(401, ["ok" => false, "error" => "not_logged_in"]);
}

// 讀 JSON body
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) $input = [];

// 同時相容 booking_id / id
$bookingId = (int)($input['booking_id'] ?? $input['id'] ?? 0);
$reason = trim((string)($input['cancel_reason'] ?? ''));

if ($bookingId <= 0) {
  json_response(400, ["ok" => false, "error" => "invalid_booking_id"]);
}

if ($reason === '') {
  json_response(400, ["ok" => false, "error" => "missing_cancel_reason"]);
}

try {
  $pdo = db();

  // 1) 找出這筆 booking（必須是自己的）
  $stmt = $pdo->prepare("
    SELECT booking_id, user_id, start_time, status
    FROM bookings
    WHERE booking_id = ?
    LIMIT 1
  ");
  $stmt->execute([$bookingId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    json_response(404, ["ok" => false, "error" => "booking_not_found"]);
  }

  if ((int)$row['user_id'] !== (int)$userId) {
    json_response(403, ["ok" => false, "error" => "forbidden"]);
  }

  if ($row['status'] !== 'reserved') {
    json_response(400, ["ok" => false, "error" => "not_reservable_status"]);
  }

  // 只能取消「尚未開始」的預約
  $startTime = strtotime((string)$row['start_time']);
  if ($startTime !== false && $startTime <= time()) {
    json_response(400, ["ok" => false, "error" => "already_started"]);
  }

  // 2) 更新狀態
  $upd = $pdo->prepare("
    UPDATE bookings
    SET status = 'cancelled',
        cancel_reason = ?
    WHERE booking_id = ?
      AND user_id = ?
      AND status = 'reserved'
  ");
  $upd->execute([$reason, $bookingId, $userId]);

  if ($upd->rowCount() !== 1) {
    // 可能同時被改狀態或不存在
    json_response(400, ["ok" => false, "error" => "cancel_failed"]);
  }

  json_response(200, ["ok" => true]);

} catch (Throwable $e) {
  // 你要 debug 可以暫時回傳 $e->getMessage()
  json_response(500, ["ok" => false, "error" => "server_error"]);
}
