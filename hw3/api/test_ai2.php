<?php
require 'env.php';

$system_instruction = "You are a helpful assistant.";
$message = "I want to book a room.";

$gemini_messages = [];
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

$api_key = GEMINI_API_KEY;
$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $api_key);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($code !== 200) {
    echo "HTTP $code\n$res\n";
} else {
    echo "OK!\n$res\n";
}
