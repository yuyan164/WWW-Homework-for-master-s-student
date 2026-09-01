<?php
// api/bookings.php
// GET:  查詢與區間重疊的 bookings（供首頁判斷資源是否被預約）
// POST: 新增一筆 booking（方案A：直接寫入 DB）

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

/**
 * 允許輸入：
 * - "2026-02-11T13:00"
 * - "2026-02-11 13:00"
 * - "2026-02-11T13:00:00"
 */
function normalize_dt(?string $s): ?string {
  if ($s === null) return null;
  $s = trim($s);
  if ($s === '') return null;

  $s = str_replace('T', ' ', $s);

  // 補秒數
  if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $s)) {
    $s .= ':00';
  }
  // 簡單格式檢查
  if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $s)) {
    return null;
  }
  return $s;
}

function day_bitmask_from_datetime(string $dt): int {
  // $dt: "YYYY-MM-DD HH:MM:SS"
  // PHP: 0=Sun..6=Sat
  $w = (int)date('w', strtotime($dt));
  return 1 << $w;
}

function time_to_seconds(string $hms): int {
  // "HH:MM:SS"
  $parts = explode(':', $hms);
  $hh = (int)($parts[0] ?? 0);
  $mm = (int)($parts[1] ?? 0);
  $ss = (int)($parts[2] ?? 0);
  return $hh * 3600 + $mm * 60 + $ss;
}


function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

try {
  $pdo = db();

  // =========================================================
  // GET：查詢重疊 bookings
  // =========================================================
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $start = normalize_dt(is_string($_GET['start'] ?? null) ? $_GET['start'] : null);
    $end   = normalize_dt(is_string($_GET['end'] ?? null) ? $_GET['end'] : null);

    if ($start === null || $end === null) {
      json_response(400, ['ok' => false, 'error' => 'missing_start_end']);
    }

    $startTs = strtotime($start);
    $endTs   = strtotime($end);
    if ($startTs === false || $endTs === false || $endTs <= $startTs) {
      json_response(400, ['ok' => false, 'error' => 'invalid_time_range']);
    }

    // ✅ 重疊條件：NOT (end_time <= start OR start_time >= end)
    $sql = "
      SELECT booking_id, resource_id, start_time, end_time, status
      FROM bookings
      WHERE status IN ('reserved') -- 你也可以只留 'reserved'
        AND NOT (end_time <= :start OR start_time >= :end)
      ORDER BY start_time ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':start' => $start, ':end' => $end]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response(200, [
      'ok' => true,
      'bookings' => array_map(function($r){
        return [
          'booking_id'  => (int)$r['booking_id'],
          'resource_id' => (int)$r['resource_id'],
          'start'       => (string)$r['start_time'],
          'end'         => (string)$r['end_time'],
          'status'      => (string)$r['status'],
        ];
      }, $rows)
    ]);
  }

  // =========================================================
  // POST：新增 booking
  // =========================================================
  // =========================================================
  // POST：新增 booking（方案 A）
  // =========================================================
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_login();

    $body = read_json_body();
    $resourceId = isset($body['resource_id']) ? (int)$body['resource_id'] : 0;
    $start = normalize_dt(is_string($body['start'] ?? null) ? $body['start'] : null);
    $end   = normalize_dt(is_string($body['end'] ?? null) ? $body['end'] : null);

    if ($resourceId <= 0 || $start === null || $end === null) {
      json_response(400, ['ok' => false, 'error' => 'missing_fields']);
    }

    $startTs = strtotime($start);
    $endTs   = strtotime($end);
    if ($startTs === false || $endTs === false || $endTs <= $startTs) {
      json_response(400, ['ok' => false, 'error' => 'invalid_time_range']);
    }

    if ($startTs < time()) {
      json_response(400, ['ok' => false, 'error' => 'time_in_past']);
    }

    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
      json_response(401, ['ok' => false, 'error' => 'not_logged_in']);
    }

    // ✅ 讀 resource 狀態（必須 active）
    $stmt = $pdo->prepare("
        SELECT status, open_days, open_start, open_end
        FROM resources
        WHERE resource_id = :id
        LIMIT 1
        ");

    $stmt->execute([':id' => $resourceId]);
    $res = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$res) {
      json_response(404, ['ok' => false, 'error' => 'resource_not_found']);
    }
    if (($res['status'] ?? 'active') !== 'active') {
      json_response(400, ['ok' => false, 'error' => 'resource_not_active']);
    }

        // ✅ 檢查資源開放時段（open_days/open_start/open_end）
    // 預設：平日 Mon~Fri (62) + 08:00-18:00（若 DB 為 NULL）
    $openDays = (int)($res['open_days'] ?? 62);
    $openStart = (string)($res['open_start'] ?? '08:00:00');
    $openEnd   = (string)($res['open_end']   ?? '18:00:00');

    // 1) 必須同一天（你 UI 是同一天，但後端也防呆）
    $startDate = substr($start, 0, 10);
    $endDate   = substr($end, 0, 10);
    if ($startDate !== $endDate) {
      json_response(400, ['ok' => false, 'error' => 'cross_day_not_allowed']);
    }

    // 2) 星期是否開放
    $bit = day_bitmask_from_datetime($start); // 用開始時間判斷那一天
    if (($openDays & $bit) === 0) {
      json_response(409, ['ok' => false, 'error' => 'resource_closed']);
    }

    // 3) 時段是否落在開放時間內（整段都要落在內）
    $startTime = substr($start, 11, 8); // "HH:MM:SS"
    $endTime   = substr($end,   11, 8);

    $sSec = time_to_seconds($startTime);
    $eSec = time_to_seconds($endTime);
    $osSec = time_to_seconds($openStart);
    $oeSec = time_to_seconds($openEnd);

    if (!($sSec >= $osSec && $eSec <= $oeSec)) {
      json_response(409, ['ok' => false, 'error' => 'resource_closed']);
    }



    // ✅ 用 transaction + 鎖避免同時預約 race condition
    $pdo->beginTransaction();

    // ✅ 檢查是否重疊（只擋 reserved）
    $sqlOverlap = "
      SELECT COUNT(*) AS cnt
      FROM bookings
      WHERE resource_id = :rid
        AND status = 'reserved'
        AND NOT (end_time <= :start OR start_time >= :end)
      FOR UPDATE
    ";
    $stmt = $pdo->prepare($sqlOverlap);
    $stmt->execute([
      ':rid' => $resourceId,
      ':start' => $start,
      ':end' => $end
    ]);
    $cnt = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);

    if ($cnt > 0) {
      $pdo->rollBack();
      json_response(409, ['ok' => false, 'error' => 'time_conflict']);
    }

    // ✅ 寫入 booking
    $stmt = $pdo->prepare("
      INSERT INTO bookings (resource_id, user_id, start_time, end_time, status)
      VALUES (:rid, :uid, :start, :end, 'reserved')
    ");
    $stmt->execute([
      ':rid' => $resourceId,
      ':uid' => $userId,
      ':start' => $start,
      ':end' => $end
    ]);

    $bookingId = (int)$pdo->lastInsertId();
    $pdo->commit();

    json_response(201, [
      'ok' => true,
      'booking' => [
        'booking_id'  => $bookingId,
        'resource_id' => $resourceId,
        'user_id'     => $userId,
        'start'       => $start,
        'end'         => $end,
        'status'      => 'reserved'
      ]
    ]);
  }


  json_response(405, ['ok' => false, 'error' => 'method_not_allowed']);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(500, ['ok' => false, 'error' => 'server_error', 'detail' => $e->getMessage()]);
}
