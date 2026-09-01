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
  $newStatus = trim((string)($in['status'] ?? ''));
  $reason = trim((string)($in['reason'] ?? ''));

  if ($id <= 0) json_response(400, ['ok'=>false, 'error'=>'invalid_input', 'message'=>'resource_id required']);
  if (!in_array($newStatus, ['active','inactive','maintenance'], true)) {
    json_response(400, ['ok'=>false, 'error'=>'invalid_input', 'message'=>'invalid status']);
  }

  // 預設取消理由（可被前端傳入 reason 覆蓋）
  if ($reason === '') {
    if ($newStatus === 'inactive') $reason = 'Resource disabled by admin';
    if ($newStatus === 'maintenance') $reason = 'Resource set to maintenance by admin';
  }

  $pdo->beginTransaction();

  // 1) 更新資源狀態
  $stmt = $pdo->prepare("UPDATE resources SET status = :st WHERE resource_id = :id AND is_deleted = 0");
  $stmt->execute([':st'=>$newStatus, ':id'=>$id]);

  // 2) 如果變成 inactive/maintenance → 取消「未開始」的 reserved 預約
  $cancelledCount = 0;
  if ($newStatus === 'inactive' || $newStatus === 'maintenance') {
    $sqlCancel = "UPDATE bookings
                 SET status = 'cancelled',
                     cancel_reason = :reason,
                     cancelled_at = CURRENT_TIMESTAMP
                 WHERE resource_id = :rid
                   AND status = 'reserved'
                   AND start_time > NOW()";
    $stmt2 = $pdo->prepare($sqlCancel);
    $stmt2->execute([':reason'=>$reason, ':rid'=>$id]);
    $cancelledCount = $stmt2->rowCount();
  }

  $pdo->commit();

  json_response(200, [
    'ok'=>true,
    'cancelled_updated'=> $cancelledCount
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  json_response(500, ['ok'=>false, 'error'=>'server_error', 'message'=>$e->getMessage()]);
}
