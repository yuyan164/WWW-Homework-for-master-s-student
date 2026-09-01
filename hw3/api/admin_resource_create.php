<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

$raw = file_get_contents("php://input");
$in = json_decode($raw, true);
if (!is_array($in)) $in = [];

$resource_name = trim((string)($in["resource_name"] ?? ""));
$resource_type = (string)($in["resource_type"] ?? "equipment");
$category      = trim((string)($in["category"] ?? ""));
$location      = trim((string)($in["location"] ?? ""));
$description   = trim((string)($in["description"] ?? ""));
$status        = (string)($in["status"] ?? "active");
$open_days     = (int)($in["open_days"] ?? 62);
$open_start    = trim((string)($in["open_start"] ?? "08:00"));
$open_end      = trim((string)($in["open_end"] ?? "18:00"));

if ($resource_name === "") {
  json_response(400, ["ok"=>false, "error"=>"required_resource_name"]);
}

$validTypes = ["equipment","space"];
$validStatus = ["active","inactive","maintenance"];
if (!in_array($resource_type, $validTypes, true)) {
  json_response(400, ["ok"=>false, "error"=>"invalid_resource_type"]);
}
if (!in_array($status, $validStatus, true)) {
  json_response(400, ["ok"=>false, "error"=>"invalid_status"]);
}

if ($open_start === "" || $open_end === "" || $open_start >= $open_end) {
  json_response(400, ["ok"=>false, "error"=>"invalid_open_time"]);
}

try {
  $st = $pdo->prepare("
    INSERT INTO resources
      (resource_name, resource_type, category, location, description, status, is_deleted, open_days, open_start, open_end, created_at, updated_at)
    VALUES
      (:name, :type, :cat, :loc, :desc, :status, 0, :open_days, :open_start, :open_end, NOW(), NOW())
  ");
  $st->execute([
    ":name" => $resource_name,
    ":type" => $resource_type,
    ":cat"  => ($category === "" ? null : $category),
    ":loc"  => ($location === "" ? null : $location),
    ":desc" => ($description === "" ? null : $description),
    ":status" => $status,
    ":open_days" => $open_days,
    ":open_start" => $open_start,
    ":open_end" => $open_end,
  ]);

  $newId = (int)$pdo->lastInsertId();

  // 回傳 item（前端可直接插入）
  $st2 = $pdo->prepare("SELECT * FROM resources WHERE resource_id = :rid LIMIT 1");
  $st2->execute([":rid"=>$newId]);
  $row = $st2->fetch(PDO::FETCH_ASSOC);

  json_response(200, ["ok"=>true, "resource_id"=>$newId, "item"=>$row]);
} catch (Throwable $e) {
  json_response(500, ["ok"=>false, "error"=>"server_error", "message"=>$e->getMessage()]);
}