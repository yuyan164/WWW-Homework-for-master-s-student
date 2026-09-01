<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

function bad_request(string $code, string $msg = ''): void {
  json_response(400, ['ok' => false, 'error' => $code, 'message' => $msg]);
}

try {
  $raw = file_get_contents('php://input');
  $in = json_decode($raw, true);
  if (!is_array($in)) $in = [];

  $rid = (int)($in['resource_id'] ?? 0);
  if ($rid <= 0) bad_request('invalid_resource_id');

  // 接你前端送的 key
  $resource_name = trim((string)($in['resource_name'] ?? ''));
  $resource_type = (string)($in['resource_type'] ?? '');
  $category      = trim((string)($in['category'] ?? ''));
  $location      = trim((string)($in['location'] ?? ''));
  $description   = trim((string)($in['description'] ?? ''));
  $status        = (string)($in['status'] ?? '');
  $open_days     = (int)($in['open_days'] ?? 0);

  // time: accept HH:MM or HH:MM:SS, normalize to HH:MM:SS
  $open_start_in = trim((string)($in['open_start'] ?? ''));
  $open_end_in   = trim((string)($in['open_end'] ?? ''));

  $toTime = function(string $t): string {
    if ($t === '') return '';
    if (preg_match('/^\d{2}:\d{2}$/', $t)) return $t . ':00';
    if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $t)) return $t;
    return '';
  };

  $open_start = $toTime($open_start_in);
  $open_end   = $toTime($open_end_in);

  // 基本驗證（避免寫入壞資料）
  if ($resource_name === '') bad_request('invalid_resource_name');
  if ($resource_type !== 'equipment' && $resource_type !== 'space') bad_request('invalid_resource_type');
  if ($status !== 'active' && $status !== 'inactive' && $status !== 'maintenance') bad_request('invalid_status');
  if ($open_days < 0 || $open_days > 127) bad_request('invalid_open_days');
  if ($open_start === '' || $open_end === '') bad_request('invalid_time_format', 'open_start/open_end must be HH:MM or HH:MM:SS');
  if ($open_start >= $open_end) bad_request('invalid_time_range', 'open_start must be earlier than open_end');

  // 讀現值：只用來判斷「是否需要取消預約」(看 status 有沒有從 active 變成非 active)
  $st = $pdo->prepare("SELECT resource_id, status FROM resources WHERE resource_id=:rid AND is_deleted=0 LIMIT 1");
  $st->execute([':rid' => $rid]);
  $cur = $st->fetch(PDO::FETCH_ASSOC);
  if (!$cur) json_response(404, ['ok' => false, 'error' => 'not_found']);

  $oldStatus = (string)($cur['status'] ?? 'active');
  $cancelled = 0;

  $pdo->beginTransaction();

  // ✅ 不管 status 是什麼：一律更新 resources
  $stu = $pdo->prepare("
    UPDATE resources
       SET resource_name=:resource_name,
           resource_type=:resource_type,
           category=:category,
           location=:location,
           description=:description,
           status=:status,
           open_days=:open_days,
           open_start=:open_start,
           open_end=:open_end,
           updated_at=NOW()
     WHERE resource_id=:rid
       AND is_deleted=0
  ");

  $stu->execute([
    ':resource_name' => $resource_name,
    ':resource_type' => $resource_type,
    ':category'      => ($category === '' ? null : $category),
    ':location'      => ($location === '' ? null : $location),
    ':description'   => ($description === '' ? null : $description),
    ':status'        => $status,
    ':open_days'     => $open_days,
    ':open_start'    => $open_start,
    ':open_end'      => $open_end,
    ':rid'           => $rid,
  ]);

  // ✅ 只有「狀態變成 inactive/maintenance」才取消未開始預約（避免每次更新都重複 cancel）
  if (($status === 'inactive' || $status === 'maintenance') && $oldStatus !== $status) {
    $reason = ($status === 'inactive')
      ? "Resource set to inactive by admin"
      : "Resource under maintenance";

    $stc = $pdo->prepare("
      UPDATE bookings
         SET status='cancelled',
             cancel_reason=:reason,
             cancelled_at=NOW()
       WHERE resource_id=:rid
         AND status='reserved'
         AND start_time > NOW()
    ");
    $stc->execute([':reason' => $reason, ':rid' => $rid]);
    $cancelled = $stc->rowCount();
  }

  $pdo->commit();

  // 回傳更新後資料
  $st2 = $pdo->prepare("SELECT * FROM resources WHERE resource_id=:rid AND is_deleted=0 LIMIT 1");
  $st2->execute([':rid' => $rid]);
  $item = $st2->fetch(PDO::FETCH_ASSOC);

  json_response(200, [
    'ok' => true,
    'updated' => true,
    'cancelled_bookings' => $cancelled,
    'item' => $item,
  ]);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(500, ['ok' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}
