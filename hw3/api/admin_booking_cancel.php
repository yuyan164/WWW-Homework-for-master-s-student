<?php
declare(strict_types=1);

require_once __DIR__ . '/require_admin.php';
require_once __DIR__ . '/db.php';

require_admin();
$pdo = db();

$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) $in = [];

$booking_id = (int)($in['booking_id'] ?? 0);
$reason = trim((string)($in['cancel_reason'] ?? ''));

if ($booking_id <= 0) json_response(400, ['ok' => false, 'error' => 'invalid_booking_id']);
if ($reason === '') $reason = 'Cancelled by admin';

try {
  $st = $pdo->prepare("
    UPDATE bookings
       SET status='cancelled',
           cancel_reason=:reason,
           cancelled_at=NOW()
     WHERE booking_id=:id
  ");
  $st->execute([':id' => $booking_id, ':reason' => $reason]);

  if ($st->rowCount() === 0) {
    json_response(404, ['ok' => false, 'error' => 'not_found']);
  }

  json_response(200, ['ok' => true]);
} catch (Throwable $e) {
  json_response(500, ['ok' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}