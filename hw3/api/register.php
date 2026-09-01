<?php
// api/register.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // 提供 json_response() + session_start
require_once __DIR__ . '/db.php';

try {
    $pdo = db();

    // 1) 讀取 form-data
    $username = trim((string)($_POST['username'] ?? ''));
    $email    = trim((string)($_POST['email'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $confirm  = (string)($_POST['confirm_password'] ?? '');

    // 2) 必填欄位檢查
    if ($username === '' || $email === '' || $password === '' || $confirm === '') {
        json_response(400, ['ok' => false, 'error' => 'missing_fields']);
    }

    // ✅ Email 統一格式（避免大小寫造成重複註冊）
    $email = strtolower($email);

    // ✅ Email 格式檢查（後端一定要有）
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(400, ['ok' => false, 'error' => 'email_format']);
    }

    // 3) 密碼一致
    if ($password !== $confirm) {
        json_response(400, ['ok' => false, 'error' => 'password_mismatch']);
    }

    // 4) 密碼格式限制（例：至少 8 碼，至少 1 英文字母 + 1 數字）
    if (!preg_match('/^(?=.*[A-Za-z])(?=.*\d).{8,}$/', $password)) {
        json_response(400, ['ok' => false, 'error' => 'password_format']);
    }

    // 5) 檢查 email 是否已存在（Prepared Statements ✅ 防 SQL Injection）
    $stmt = $pdo->prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetchColumn()) {
        json_response(409, ['ok' => false, 'error' => 'email_exists']);
    }

    // 6) 圖片（可選）上傳：存到 /pic，DB 存 "pic/xxx.ext"
    $profilePicPath = null;

    // 注意：如果你想「可選擇上傳圖片」，register.html 的 file input 建議不要 required
    if (isset($_FILES['photo']) && is_array($_FILES['photo'])) {

        $err = (int)($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE);

        // 使用者沒選檔案：直接略過（可選）
        if ($err !== UPLOAD_ERR_NO_FILE) {

            if ($err !== UPLOAD_ERR_OK) {
                json_response(400, ['ok' => false, 'error' => 'upload_failed']);
            }

            // 大小限制：2MB（可改）
            $maxBytes = 2 * 1024 * 1024;
            if ((int)($_FILES['photo']['size'] ?? 0) > $maxBytes) {
                json_response(400, ['ok' => false, 'error' => 'photo_too_large']);
            }

            $tmpName = (string)($_FILES['photo']['tmp_name']);
            if ($tmpName === '' || !is_uploaded_file($tmpName)) {
                json_response(400, ['ok' => false, 'error' => 'upload_failed']);
            }

            // ✅ 用 finfo 驗證真實 MIME（避免假圖）
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime  = $finfo->file($tmpName);

            $allowed = [
                'image/jpeg' => 'jpg',
                'image/png'  => 'png',
                'image/gif'  => 'gif',
            ];

            if (!isset($allowed[$mime])) {
                json_response(400, ['ok' => false, 'error' => 'invalid_photo_type']);
            }

            $ext = $allowed[$mime];

            // 建立儲存資料夾：../pic（跟 html 同層）
            $root = realpath(__DIR__ . '/..');
            if ($root === false) {
                json_response(500, ['ok' => false, 'error' => 'server_error']);
            }

            $picDir = $root . DIRECTORY_SEPARATOR . 'pic';

            if (!is_dir($picDir)) {
                if (!mkdir($picDir, 0775, true)) {
                    json_response(500, ['ok' => false, 'error' => 'server_error']);
                }
            }

            // ✅ 確保可寫
            if (!is_writable($picDir)) {
                json_response(500, ['ok' => false, 'error' => 'server_error']);
            }

            // 產生安全檔名（不可用原始檔名）
            $safeName = 'u_' . bin2hex(random_bytes(8)) . '.' . $ext;
            $destAbs  = $picDir . DIRECTORY_SEPARATOR . $safeName;

            if (!move_uploaded_file($tmpName, $destAbs)) {
                json_response(400, ['ok' => false, 'error' => 'upload_failed']);
            }

            // DB 存相對路徑（讓前端可以直接 <img src="...">）
            $profilePicPath = 'pic/' . $safeName;
        }
    }

    // 7) 寫入資料庫
    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('
        INSERT INTO users (username, email, hash_password, role, profile_pic, created_at)
        VALUES (?, ?, ?, "user", ?, NOW())
    ');
    $stmt->execute([$username, $email, $hash, $profilePicPath]);

    json_response(201, ['ok' => true]);

} catch (Throwable $e) {
    // 作業可保留 detail，正式環境不要回傳 detail
    json_response(500, ['ok' => false, 'error' => 'server_error', 'detail' => $e->getMessage()]);
}
