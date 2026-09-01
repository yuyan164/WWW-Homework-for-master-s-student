<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

require_admin();

try {
  $pdo = db();

  $raw = file_get_contents('php://input');
  $in = json_decode($raw, true);
  if (!is_array($in)) $in = [];

  $id = (int)($in['resource_id'] ?? 0);
  $reason = trim((string)($in['reason'] ?? 'Resource deleted by admin'));

  if ($id <= 0) json_response(400, ['ok'=>false, 'error'=>'invalid_input', 'message'=>'resource_id required']);

  $pdo->beginTransaction();

  // 1) 軟刪除資源
  $stmt = $pdo->prepare("UPDATE resources SET is_deleted = 1 WHERE resource_id = :id");
  $stmt->execute([':id'=>$id]);

  // 2) 取消未開始預約
  $stmt2 = $pdo->prepare(
    "UPDATE bookings
     SET status='cancelled', cancel_reason=:reason, cancelled_at=CURRENT_TIMESTAMP
     WHERE resource_id=:rid AND status='reserved' AND start_time > NOW()"
  );
  $stmt2->execute([':reason'=>$reason, ':rid'=>$id]);
  $cancelledCount = $stmt2->rowCount();

  $pdo->commit();

  json_response(200, ['ok'=>true, 'cancelled_updated'=>$cancelledCount]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  json_response(500, ['ok'=>false, 'error'=>'server_error', 'message'=>$e->getMessage()]);
}
