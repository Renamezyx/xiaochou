<?php
/**
 * 访问埋点收集：追加写入 logs/visits.jsonl
 * 兼容 PHP 5.4+
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"method_not_allowed"}';
    exit;
}

function arr_get($arr, $key, $default)
{
    return isset($arr[$key]) ? $arr[$key] : $default;
}

function getClientIp()
{
    $keys = array('HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR');
    foreach ($keys as $key) {
        if (empty($_SERVER[$key])) {
            continue;
        }
        $raw = trim((string) $_SERVER[$key]);
        if ($raw === '') {
            continue;
        }
        $parts = array_map('trim', explode(',', $raw));
        foreach ($parts as $ip) {
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '';
}

function parseUa($ua)
{
    $tablet = (bool) preg_match('/iPad|Tablet|Android(?!.*Mobile)/i', $ua);
    $mobile = !$tablet && (bool) preg_match('/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i', $ua);
    $deviceType = $tablet ? 'tablet' : ($mobile ? 'mobile' : 'desktop');

    $os = 'unknown';
    if (preg_match('/iPhone|iPad|iPod/', $ua)) {
        $os = 'iOS';
    } elseif (preg_match('/Android/', $ua)) {
        $os = 'Android';
    } elseif (preg_match('/Windows NT/', $ua)) {
        $os = 'Windows';
    } elseif (preg_match('/Mac OS X/', $ua)) {
        $os = 'macOS';
    } elseif (preg_match('/Linux/', $ua)) {
        $os = 'Linux';
    } elseif (preg_match('/CrOS/', $ua)) {
        $os = 'ChromeOS';
    }

    $browser = 'unknown';
    if (preg_match('/MicroMessenger/i', $ua)) {
        $browser = 'WeChat';
    } elseif (preg_match('/QQ\//i', $ua)) {
        $browser = 'QQ';
    } elseif (preg_match('/Edg\//i', $ua)) {
        $browser = 'Edge';
    } elseif (preg_match('/OPR\//i', $ua) || preg_match('/Opera/i', $ua)) {
        $browser = 'Opera';
    } elseif (preg_match('/Chrome\//i', $ua) && !preg_match('/Edg\//i', $ua)) {
        $browser = 'Chrome';
    } elseif (preg_match('/Safari\//i', $ua) && !preg_match('/Chrome/i', $ua)) {
        $browser = 'Safari';
    } elseif (preg_match('/Firefox\//i', $ua)) {
        $browser = 'Firefox';
    }

    $model = '';
    if (preg_match('/iPhone/', $ua)) {
        $model = 'iPhone';
    } elseif (preg_match('/iPad/', $ua)) {
        $model = 'iPad';
    } elseif (preg_match('/;\s*([^;)]+)\s*Build\//i', $ua, $m)) {
        $model = trim($m[1]);
    }

    $parts = array_filter(array($model, $os, $browser, $deviceType));
    $summary = implode(' · ', $parts);

    return array(
        'device_type' => $deviceType,
        'os' => $os,
        'browser' => $browser,
        'model' => $model,
        'device' => $summary,
    );
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"invalid_json"}';
    exit;
}

$ua = (string) arr_get($data, 'ua', '');
$parsed = parseUa($ua);

$data['ip'] = getClientIp();
$data['server_ts'] = round(microtime(true) * 1000);

foreach (array('device_type', 'os', 'browser', 'model') as $field) {
    if (empty($data[$field]) && !empty($parsed[$field])) {
        $data[$field] = $parsed[$field];
    }
}

$model = (string) arr_get($data, 'model', arr_get($parsed, 'model', ''));
$os = (string) arr_get($data, 'os', arr_get($parsed, 'os', ''));
$browser = (string) arr_get($data, 'browser', arr_get($parsed, 'browser', ''));
$deviceType = (string) arr_get($data, 'device_type', arr_get($parsed, 'device_type', ''));
$data['device'] = implode(' · ', array_filter(array($model, $os, $browser, $deviceType)));

$logDir = dirname(__DIR__) . '/logs';
if (!is_dir($logDir) && !mkdir($logDir, 0750, true)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"mkdir_failed"}';
    exit;
}

$flags = 0;
if (defined('JSON_UNESCAPED_UNICODE')) {
    $flags |= JSON_UNESCAPED_UNICODE;
}
if (defined('JSON_UNESCAPED_SLASHES')) {
    $flags |= JSON_UNESCAPED_SLASHES;
}
$line = json_encode($data, $flags) . "\n";
if (file_put_contents($logDir . '/visits.jsonl', $line, FILE_APPEND | LOCK_EX) === false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"write_failed"}';
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo '{"ok":true}';
