<?php
// api/bookings_list.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // session_start + json_response(...)
require_once __DIR__ . '/db.php';   // db() -> PDO

function current_user_id(): ?int {
  if (isset($_SESSION['user_id']) && is_numeric($_SESSION['user_id'])) {
    return (int)$_SESSION['user_id'];
  }
  if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
    $u = $_SESSION['user'];
    if (isset($u['user_id']) && is_numeric($u['user_id'])) return (int)$u['user_id'];
    if (isset($u['id']) && is_numeric($u['id'])) return (int)$u['id'];
  }
  if (isset($_SESSION['uid']) && is_numeric($_SESSION['uid'])) {
    return (int)$_SESSION['uid'];
  }
  return null;
}

$status = strtolower(trim((string)($_GET['status'] ?? 'all')));
$allowed = ['all', 'reserved', 'cancelled', 'completed'];
if (!in_array($status, $allowed, true)) {
  json_response(400, ['ok' => false, 'error' => 'invalid_status']);
}

$page = (int)($_GET['page'] ?? 1);
$pageSize = (int)($_GET['page_size'] ?? 5);
if ($page < 1) $page = 1;
if ($pageSize < 1) $pageSize = 5;
if ($pageSize > 50) $pageSize = 50;

$uid = current_user_id();
if (!$uid) {
  json_response(401, ['ok' => false, 'error' => 'not_logged_in']);
}

$where = "b.user_id = :uid";
$params = [':uid' => $uid];

if ($status !== 'all') {
  $where .= " AND b.status = :status";
  $params[':status'] = $status;
}

try {
  $pdo = db();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // 1) total count
  $sqlCount = "SELECT COUNT(*) AS cnt FROM bookings b WHERE $where";
  $stmt = $pdo->prepare($sqlCount);
  foreach ($params as $k => $v) $stmt->bindValue($k, $v);
  $stmt->execute();
  $total = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);

  $totalPages = (int)ceil($total / $pageSize);
  if ($totalPages < 1) $totalPages = 1;
  if ($page > $totalPages) $page = $totalPages;

  $offset = ($page - 1) * $pageSize;

  // ✅ LIMIT/OFFSET 用安全整數直接插入（避免 PDO 綁定 LIMIT 在某些環境炸）
  $lim = (int)$pageSize;
  $ofs = (int)$offset;

  // 2) list with JOIN resources
  $sqlList = "
    SELECT
      b.booking_id,
      b.start_time,
      b.end_time,
      b.status,
      b.cancel_reason,
      r.resource_name,
      r.resource_type,
      r.location
    FROM bookings b
    JOIN resources r ON r.resource_id = b.resource_id
    WHERE $where
    ORDER BY b.start_time DESC
    LIMIT $lim OFFSET $ofs
  ";

  $stmt2 = $pdo->prepare($sqlList);
  foreach ($params as $k => $v) $stmt2->bindValue($k, $v);
  $stmt2->execute();
  $rows = $stmt2->fetchAll(PDO::FETCH_ASSOC) ?: [];

  $items = [];
  foreach ($rows as $r) {
    $startISO = str_replace(' ', 'T', (string)($r['start_time'] ?? ''));
    $endISO   = str_replace(' ', 'T', (string)($r['end_time'] ?? ''));

    $items[] = [
      'id' => (string)($r['booking_id'] ?? ''),
      'resourceName' => (string)($r['resource_name'] ?? ''),
      'resourceType' => (string)($r['resource_type'] ?? ''),
      'location' => (string)($r['location'] ?? ''),
      'startISO' => $startISO,
      'endISO' => $endISO,
      'status' => (string)($r['status'] ?? ''),
      'cancelReason' => $r['cancel_reason'], // null allowed
    ];
  }

  json_response(200, [
    'ok' => true,
    'items' => $items,
    'page' => $page,
    'pageSize' => $pageSize,
    'total' => $total,
    'totalPages' => $totalPages
  ]);

} catch (Throwable $e) {
  // 開發期：先把 detail 打開幫你抓錯（之後要上線再拿掉）
  json_response(500, [
    'ok' => false,
    'error' => 'server_error',
    'detail' => $e->getMessage()
  ]);
}
