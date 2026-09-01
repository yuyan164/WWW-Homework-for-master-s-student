<?php
// api/resources.php
// 功能：回傳所有資源（由新到舊），不需登入也可查看
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // 提供 json_response()
require_once __DIR__ . '/db.php';

try {
  $pdo = db();

  $sql = 'SELECT
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
        ORDER BY created_at DESC';

  $stmt = $pdo->query($sql);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response(200, [
    'ok' => true,
    'resources' => array_map(function($r){
      return [
        'id' => (int)$r['resource_id'],
        'name' => (string)$r['resource_name'],
        'type' => (string)$r['resource_type'], // 'space' | 'equipment'
        'category' => $r['category'] === null ? null : (string)$r['category'],
        'location' => $r['location'] === null ? null : (string)$r['location'],
        'description' => $r['description'] === null ? null : (string)$r['description'],
        'status' => $r['status'] === null ? 'active' : (string)$r['status'], // active|inactive|maintenance

        // ✅ 新增：可預約時段規則
        // availableWeekdays: "mon,tue,wed" 這種字串（MySQL SET 會回逗號分隔）
        // availableStart / availableEnd: "13:00:00" (或 null)
        // 'availableWeekdays' => (string)$r['available_weekdays'],
        // 'availableStart' => $r['available_start'] === null ? null : (string)$r['available_start'],
        // 'availableEnd'   => $r['available_end'] === null ? null : (string)$r['available_end'],

        'openDays'  => isset($r['open_days']) ? (int)$r['open_days'] : 62,
        'openStart' => isset($r['open_start']) ? (string)$r['open_start'] : '08:00:00',
        'openEnd'   => isset($r['open_end']) ? (string)$r['open_end'] : '18:00:00',


        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
      ];
    }, $rows)
  ]);

} catch (Throwable $e) {
  json_response(500, ['ok' => false, 'error' => 'server_error', 'detail' => $e->getMessage()]);
}
