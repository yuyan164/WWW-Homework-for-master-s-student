<?php
// api/ai_chat.php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // handles session_start
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/env.php';   // defines GEMINI_API_KEY

function require_login_for_ai() {
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'error' => 'not_logged_in',
            'reply' => 'Please log in before using the AI Booking Assistant.'
        ]);
        exit;
    }
}

require_login_for_ai();

$pdo = db();
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
$message = trim((string)($input['message'] ?? ''));
$history = $input['history'] ?? []; // Array of {role: 'user'|'assistant', content: '...'}

if ($message === '') {
    json_response(400, ['ok' => false, 'reply' => 'I did not receive any message.']);
}

// 1. Fetch active resources to provide as context to Gemini
$stmt = $pdo->query("SELECT resource_id, resource_name, resource_type, location, open_days, open_start, open_end FROM resources WHERE status = 'active'");
$resources = $stmt->fetchAll(PDO::FETCH_ASSOC);

$resourceListStr = "";
foreach ($resources as $r) {
    $resourceListStr .= "- ID: {$r['resource_id']}, Name: {$r['resource_name']} ({$r['resource_type']}), Location: {$r['location']}, Opening Hours: {$r['open_start']}~{$r['open_end']}, Open Days Bitmask (1=Sun,2=Mon...64=Sat): {$r['open_days']}\n";
}

$current_time = date('Y-m-d H:i:s');
$current_day_of_week = date('w'); // 0 (Sun) to 6 (Sat)

$system_instruction = <<<EOT
You are a professional AI assistant named "Campus Booking Assistant".
Your job is to help users query or book campus resources.
The current system time is: $current_time (weekday $current_day_of_week)

All currently available resources in the system are listed below:
$resourceListStr

Your response MUST be strict and valid JSON only.
Do not include Markdown such as ```json.
Output only a JSON string in the following format:

{
  "action": "chat" | "book" | "query",
  "reply": "A friendly English reply to the user",
  "book_params": { "resource_id": 123, "start_time": "2026-02-25 10:00:00", "end_time": "2026-02-25 12:00:00" },
  "query_params": { "type": "equipment" | "space" | "all", "keyword": "badminton" }
}

Processing rules:
1. If the user is only chatting or greeting, set action to "chat" and write a friendly English reply.
2. If the user wants to book a resource, for example: "Book the badminton court for me tomorrow at 10 AM",
   set action to "book" and fill in book_params.
   IMPORTANT: In reply, only say:
   "Sure, I’ll submit your booking request."
   Do NOT decide whether the time slot is already booked.
   Do NOT say things like "it has already been booked" or "someone already reserved it".
   The backend system will check availability later.
3. If the user wants to query resources or available items, set action to "query", extract keyword and type into query_params,
   and write something like:
   "Sure, I’ll help you check that."

Very important:
- All user-facing replies must be in English.
- Output valid JSON only.
- Never make up booking availability on your own.
EOT;

// 2. Prepare Gemini Messages
$gemini_messages = [];
foreach ($history as $h) {
    $gemini_messages[] = [
        "role" => ($h['role'] === 'user' ? 'user' : 'model'),
        "parts" => [["text" => $h['content']]]
    ];
}
$gemini_messages[] = [
    "role" => "user",
    "parts" => [["text" => $message]]
];

$payload = [
    "systemInstruction" => [
        "parts" => [["text" => $system_instruction]]
    ],
    "contents" => $gemini_messages,
    "generationConfig" => [
        "temperature" => 0.1,
        "responseMimeType" => "application/json"
    ]
];

// 3. Call Gemini API
$api_key = GEMINI_API_KEY;
if ($api_key === 'YOUR-API-KEY-HERE' || empty($api_key)) {
    json_response(200, [
        'ok' => true,
        'action' => 'chat',
        'reply' => 'System error: the AI model API key has not been configured yet.'
    ]);
}

$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $api_key);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Fix for XAMPP local env missing cacert.pem
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$response_json = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err = curl_error($ch);
curl_close($ch);

if ($http_code !== 200) {
    $err_msg = "An error occurred while the AI was processing your request (HTTP $http_code)";
    if ($http_code === 429) {
        $err_msg = "The service is currently busy or rate-limited. Please try again in about a minute. (HTTP 429)";
    }
    json_response(500, [
        'ok' => false,
        'error' => 'gemini_error',
        'reply' => $err_msg,
        'body' => $response_json
    ]);
}

$action = 'chat';
$reply = 'Received.';

try {
    $res_data = json_decode($response_json, true);
    $ai_text = '';

    if (isset($res_data['candidates'][0]['content']['parts'][0]['text'])) {
        $ai_text = $res_data['candidates'][0]['content']['parts'][0]['text'];
    } elseif (isset($res_data['error'])) {
        $msg = $res_data['error']['message'] ?? 'Unknown Google API Error';
        json_response(500, ['ok' => false, 'reply' => "Google API error: {$msg}"]);
    } else {
        json_response(500, ['ok' => false, 'reply' => 'The AI response format was rejected or blocked by a safety filter. Please try rephrasing your request.']);
    }

    // Strip markdown code blocks if the AI stubbornly included them
    $ai_text = trim($ai_text);
    if (str_starts_with($ai_text, '```json')) {
        $ai_text = preg_replace('/^```json\s*/', '', $ai_text);
        $ai_text = preg_replace('/\s*```$/', '', $ai_text);
    } elseif (str_starts_with($ai_text, '```')) {
        $ai_text = preg_replace('/^```\s*/', '', $ai_text);
        $ai_text = preg_replace('/\s*```$/', '', $ai_text);
    }

    $parsed = json_decode($ai_text, true);

    if (!is_array($parsed)) {
        json_response(200, ['ok' => true, 'action' => 'chat', 'reply' => 'Sorry, I am not sure what you mean. Could you say it in another way?']);
    }

    $action = $parsed['action'] ?? 'chat';
    $reply = $parsed['reply'] ?? 'Received.';
    $user_id = (int)$_SESSION['user_id'];

    // 4. Handle Actions (Book, Query, Chat)
    if ($action === 'book' && isset($parsed['book_params'])) {
        $bp = $parsed['book_params'];
        $res_id = (int)($bp['resource_id'] ?? 0);
        $start = $bp['start_time'] ?? '';
        $end = $bp['end_time'] ?? '';

        // Check availability logic
        $stCheck = $pdo->prepare("SELECT COUNT(*) as cnt FROM bookings WHERE resource_id = ? AND status IN ('reserved', 'completed') AND (start_time < ? AND end_time > ?)");
        $stCheck->execute([$res_id, $end, $start]);
        $overlap = (int)$stCheck->fetch()['cnt'];

        if ($overlap > 0) {
            $reply = "Sorry, the selected time slot ($start to $end) has already been booked. Please choose another time or resource.";
            json_response(200, ['ok' => true, 'action' => 'chat', 'reply' => $reply]);
        } else {
            // Check if resource actually exists
            $stRes = $pdo->prepare("SELECT resource_name FROM resources WHERE resource_id = ? AND status = 'active'");
            $stRes->execute([$res_id]);
            $resRow = $stRes->fetch();
            if (!$resRow) {
                json_response(200, ['ok' => true, 'action' => 'chat', 'reply' => "Sorry, I could not find the resource with ID ($res_id)."]);
            }

            $stmt = $pdo->prepare("INSERT INTO bookings (resource_id, user_id, start_time, end_time, status) VALUES (?, ?, ?, ?, 'reserved')");
            $stmt->execute([$res_id, $user_id, $start, $end]);

            $reply = "Done! Your booking for \"{$resRow['resource_name']}\" has been successfully created.\nTime: {$start} to {$end}";
            json_response(200, ['ok' => true, 'action' => 'book', 'success' => true, 'reply' => $reply]);
        }
    } elseif ($action === 'query' && isset($parsed['query_params'])) {
        $qp = $parsed['query_params'];
        $kw = $qp['keyword'] ?? '';
        $type = $qp['type'] ?? 'all';

        $sql = "SELECT resource_name, location FROM resources WHERE status = 'active'";
        $params = [];
        if ($type !== 'all') {
            $sql .= " AND resource_type = ?";
            $params[] = $type;
        }
        if ($kw !== '') {
            $sql .= " AND (resource_name LIKE ? OR location LIKE ?)";
            $params[] = "%$kw%";
            $params[] = "%$kw%";
        }

        $stQ = $pdo->prepare($sql);
        $stQ->execute($params);
        $found = $stQ->fetchAll(PDO::FETCH_ASSOC);

        if (count($found) > 0) {
            $items = array_map(function($i){ return "{$i['resource_name']} (at {$i['location']})"; }, $found);
            $reply = "I found the following resources for you: " . implode(", ", $items);
        } else {
            $reply = "Sorry, I could not find any resources that match your request.";
        }

        json_response(200, ['ok' => true, 'action' => 'query', 'reply' => $reply]);
    } else {
        json_response(200, ['ok' => true, 'action' => 'chat', 'reply' => $reply]);
    }

} catch (Throwable $e) {
    json_response(500, ['ok' => false, 'reply' => "An unexpected system error occurred: " . $e->getMessage()]);
}