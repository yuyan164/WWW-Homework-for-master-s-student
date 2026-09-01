<?php
declare(strict_types=1);

require_once __DIR__ . '/require_admin.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = (int)($_GET['pageSize'] ?? 5);
if ($pageSize <= 0 || $pageSize > 50) $pageSize = 5;

$status = trim((string)($_GET['status'] ?? 'all')); // all|reserved|completed|cancelled
$keyword = trim((string)($_GET['keyword'] ?? ''));

$offset = ($page - 1) * $pageSize;

try {
  $where = [];
  $params = [];

  if ($status !== '' && $status !== 'all') {
    $where[] = "b.status = :status";
    $params[':status'] = $status;
  }

  if ($keyword !== '') {
    // 可搜：booking_id / user email / username / resource name / location
    $where[] = "("
      . "CAST(b.booking_id AS CHAR) LIKE :kw OR "
      . "u.email LIKE :kw OR "
      . "u.username LIKE :kw OR "
      . "r.resource_name LIKE :kw OR "
      . "r.location LIKE :kw"
      . ")";
    $params[':kw'] = '%' . $keyword . '%';
  }

  $whereSql = $where ? ("WHERE " . implode(" AND ", $where)) : "";

  // total count
  $stCnt = $pdo->prepare("
    SELECT COUNT(*) AS cnt
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    LEFT JOIN resources r ON r.resource_id = b.resource_id
    $whereSql
  ");
  $stCnt->execute($params);
  $totalItems = (int)($stCnt->fetch()['cnt'] ?? 0);
  $totalPages = max(1, (int)ceil($totalItems / $pageSize));
  if ($page > $totalPages) $page = $totalPages;

  $offset = ($page - 1) * $pageSize;

  // list
  $sql = "
    SELECT
      b.booking_id,
      b.resource_id,
      b.user_id,
      b.start_time,
      b.end_time,
      b.status,
      b.cancel_reason,
      b.cancelled_at,
      u.email AS user_email,
      u.username AS username,
      r.resource_name,
      r.resource_type,
      r.location
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    LEFT JOIN resources r ON r.resource_id = b.resource_id
    $whereSql
    ORDER BY
      (b.start_time < NOW()) ASC,
      ABS(TIMESTAMPDIFF(SECOND, b.start_time, NOW())) ASC,
      b.start_time ASC
    LIMIT :limit OFFSET :offset
  ";
  $st = $pdo->prepare($sql);

  // bind normal params
  foreach ($params as $k => $v) {
    $st->bindValue($k, $v, PDO::PARAM_STR);
  }
  $st->bindValue(':limit', $pageSize, PDO::PARAM_INT);
  $st->bindValue(':offset', $offset, PDO::PARAM_INT);

  $st->execute();
  $rows = $st->fetchAll();

  $items = [];
  foreach ($rows as $r) {
    $start = (string)($r['start_time'] ?? '');
    $end   = (string)($r['end_time'] ?? '');

    // "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
    $startISO = $start ? str_replace(' ', 'T', $start) : '';
    $endISO   = $end ? str_replace(' ', 'T', $end) : '';

    $items[] = [
      'booking_id'    => (int)$r['booking_id'],
      'resource_id'   => (int)$r['resource_id'],
      'user_id'       => (int)$r['user_id'],
      'startISO'      => $startISO,
      'endISO'        => $endISO,
      'status'        => (string)($r['status'] ?? ''),
      'cancelReason'  => $r['cancel_reason'],
      'cancelledAt'   => $r['cancelled_at'],
      'whoEmail'      => (string)($r['user_email'] ?? ''),
      'whoName'       => (string)($r['username'] ?? ''),
      'resourceName'  => (string)($r['resource_name'] ?? '(deleted resource)'),
      'resourceType'  => (string)($r['resource_type'] ?? ''),
      'location'      => (string)($r['location'] ?? ''),
    ];
  }

  json_response(200, [
    'ok' => true,
    'items' => $items,
    'page' => $page,
    'pageSize' => $pageSize,
    'totalItems' => $totalItems,
    'totalPages' => $totalPages
  ]);
} catch (Throwable $e) {
  json_response(500, ['ok' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}