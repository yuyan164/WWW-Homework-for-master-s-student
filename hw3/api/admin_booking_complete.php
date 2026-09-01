<?php
declare(strict_types=1);

require_once __DIR__ . '/require_admin.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

try {
  // 1) 讀 JSON body
  $raw = file_get_contents('php://input');
  $in = json_decode($raw, true);
  if (!is_array($in)) $in = [];

  $booking_id = (int)($in['booking_id'] ?? 0);
  if ($booking_id <= 0) {
    json_response(400, ['ok' => false, 'error' => 'invalid_booking_id']);
  }

  // 2) 更新
  $st = $pdo->prepare("
    UPDATE bookings
       SET status='completed',
           cancel_reason=NULL,
           cancelled_at=NULL
     WHERE booking_id = :id
  ");
  $st->execute([':id' => $booking_id]);

  if ($st->rowCount() === 0) {
    // 找不到或已是同值（MySQL 有時 rowCount 會是 0）
    // 所以再確認一下是否存在
    $chk = $pdo->prepare("SELECT booking_id FROM bookings WHERE booking_id=:id");
    $chk->execute([':id' => $booking_id]);
    $exists = $chk->fetchColumn();

    if (!$exists) {
      json_response(404, ['ok' => false, 'error' => 'not_found']);
    }

    // 存在但 rowCount=0 → 代表本來就是 completed（或同值）
    json_response(200, ['ok' => true, 'changed' => false, 'no_change' => true]);
  }

  json_response(200, ['ok' => true, 'changed' => true]);

} catch (Throwable $e) {
  // ✅ 一定回 JSON，不要讓 PHP Fatal HTML 直接噴到前端
  json_response(500, [
    'ok' => false,
    'error' => 'server_error',
    'message' => $e->getMessage()
  ]);
}