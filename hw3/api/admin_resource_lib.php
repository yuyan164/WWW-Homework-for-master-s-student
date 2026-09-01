<?php
// api/admin_resource_lib.php
declare(strict_types=1);

/**
 * 取消「未開始」的預約（保留歷史）
 * - bookings.status: reserved/completed/cancelled
 * - 只取消 start_time > NOW() 的 reserved
 */
function cancel_future_bookings_for_resource(PDO $pdo, int $resourceId, string $reason): int
{
  $st = $pdo->prepare("
    UPDATE bookings
       SET status='cancelled',
           cancel_reason=:reason,
           cancelled_at=NOW()
     WHERE resource_id=:rid
       AND status='reserved'
       AND start_time > NOW()
  ");
  $st->execute([
    ':rid' => $resourceId,
    ':reason' => $reason,
  ]);
  return (int)$st->rowCount();
}

/** 將 time 正規化成 HH:MM:SS（接受 HH:MM 或 HH:MM:SS） */
function norm_time(string $t): string
{
  $t = trim($t);
  if ($t === '') return '';
  // 若是 HH:MM -> 補 :00
  if (preg_match('/^\d{2}:\d{2}$/', $t)) return $t . ':00';
  // 若是 HH:MM:SS
  if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $t)) return $t;
  // 其他格式（保守處理）
  $ts = strtotime($t);
  if ($ts === false) return '';
  return date('H:i:s', $ts);
}
