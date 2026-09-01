<?php
// api/require_admin.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // auth.php 內已有 require_login / require_admin / json_response
require_admin(); // 直接檢查 admin，非 admin 會 json_response(403,...)
