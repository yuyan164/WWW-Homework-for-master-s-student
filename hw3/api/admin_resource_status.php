<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';


function j($ok, $arr = []) {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array_merge(['ok' => $ok], $arr), JSON_UNESCAPED_UNICODE);
  exit;
}

$role = $_SESSION['user']['role'] ?? '';
if (strtolower((string)$role) !== 'admin') j(false, ['error' => 'forbidden']);

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) $in = [];

$resource_id = (int)($in['resource_id'] ?? 0);
$status = (string)($in['status'] ?? '');

if ($resource_id <= 0) j(false, ['error' => 'invalid_resource_id']);
if (!in_array($status, ['active','inactive','maintenance'], true)) j(false, ['error' => 'invalid_status']);

$pdo = db();
$stmt = $pdo->prepare("UPDATE resources SET status = :s WHERE resource_id = :id");
$stmt->execute([':s' => $status, ':id' => $resource_id]);

j(true);
