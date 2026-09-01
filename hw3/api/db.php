<?php
// api/db.php - 共用資料庫連線（PDO）與工具函式
declare(strict_types=1);

/**
 * ⚠️ 建議：session 管理統一放在 auth.php（避免不同檔案各自 session_start 造成混亂）
 * 如果你確定每個 API 都會 require auth.php，那這個函式可不用再呼叫。
 */

/**
 * 取得 PDO 連線（單例）
 */
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    // dmplus環境
    //$DB_HOST = '140.123.102.94';
    //$DB_PORT = 3306;
    //$DB_NAME = 'wwwhw3';
    //$DB_USER = 'dmplus';
    //$DB_PASS = 'climb2top'; 
    //$DB_CHARSET = 'utf8mb4';

    // 校內電腦
    $DB_HOST = 'localhost';
    $DB_NAME = 'wwwhw3';
    $DB_USER = 'root';
    $DB_PASS = ''; 
    $DB_CHARSET = 'utf8mb4';

    //$dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset={$DB_CHARSET}";
    $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false, // ✅ 使用真正 prepared statements
    ];

    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);

    // ✅ 自動取消超過預約結束時間但尚未完成的預約
    try {
        $pdo->exec("UPDATE bookings SET status = 'cancelled', cancel_reason = 'Not completed within the reserved time' WHERE status = 'reserved' AND end_time < NOW()");
    } catch (Throwable $e) {
        // 忽略錯誤，避免影響主要流程
    }

    return $pdo;
}

/**
 * 讀取 request body
 * - 支援 JSON (fetch) 與 form-urlencoded
 */
function read_request_data(): array {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    return $_POST ?? [];
}

/**
 * 防止 open redirect 的 next 參數
 */
function safe_next(string $next, string $fallback = 'index.html'): string {
    $next = trim($next);
    if ($next === '') return $fallback;
    if (strpos($next, '://') !== false) return $fallback;
    if (strpos($next, '//') === 0) return $fallback;
    if (stripos($next, 'javascript:') === 0) return $fallback;
    return $next;
}
