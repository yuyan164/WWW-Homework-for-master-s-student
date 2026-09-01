<?php
// api/admin_resources_list.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

$page = max(1, (int)($_GET['page'] ?? 1));
$pageSize = (int)($_GET['pageSize'] ?? 200);
$pageSize = max(1, min(500, $pageSize));
$offset = ($page - 1) * $pageSize;

try {
  // ✅ 重要：is_deleted 可能是 NULL，NULL 也當作未刪除
  $st = $pdo->prepare("
    SELECT
      resource_id,
      resource_name,
      resource_type,
      category,
      location,
      description,
      status,
      open_days,
      open_start,
      open_end,
      created_at,
      updated_at
    FROM resources
    WHERE (is_deleted = 0 OR is_deleted IS NULL)
    ORDER BY resource_id DESC
    LIMIT :lim OFFSET :off
  ");
  $st->bindValue(':lim', $pageSize, PDO::PARAM_INT);
  $st->bindValue(':off', $offset, PDO::PARAM_INT);
  $st->execute();

  $items = $st->fetchAll(PDO::FETCH_ASSOC);

  // count
  $st2 = $pdo->query("SELECT COUNT(*) FROM resources WHERE (is_deleted = 0 OR is_deleted IS NULL)");
  $total = (int)$st2->fetchColumn();

  json_response(200, [
    "ok" => true,
    "page" => $page,
    "pageSize" => $pageSize,
    "total" => $total,
    "items" => $items
  ]);

} catch (Throwable $e) {
  json_response(500, ["ok"=>false, "error"=>"server_error", "message"=>$e->getMessage()]);
}
