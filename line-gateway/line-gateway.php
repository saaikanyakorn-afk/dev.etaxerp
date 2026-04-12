<?php
/**
 * LINE Gateway — Transferable PHP Proxy (v2.0 with MySQL Queue)
 * 
 * Drop this single file on any PHP 8.2+ hosting with HTTPS + MySQL.
 * Configure the settings below, then point LINE webhook URL here.
 * 
 * Handles:
 *   POST /line-gateway.php              → forwards LINE webhook to APP_SERVER
 *   POST /line-gateway.php?action=push  → forwards push request to LINE API
 *   POST /line-gateway.php?action=reply → forwards reply message to LINE API
 *   POST /line-gateway.php?action=api   → proxies any LINE API call
 *   GET  /line-gateway.php?action=ping  → health check
 *   GET  /line-gateway.php?action=info  → gateway status + config (no secrets)
 *   GET  /line-gateway.php?action=stats → daily usage stats (3-month history)
 *   POST /line-gateway.php?action=drain → app server pulls pending webhooks
 *   POST /line-gateway.php?action=ack   → app server confirms processed webhooks
 *   GET  /line-gateway.php?action=queue → view queue status
 */

// ============================================================
// CONFIGURATION — change these values when moving servers
// ============================================================
$CONFIG = [
    'LINE_CHANNEL_ACCESS_TOKEN' => 'YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE',
    'LINE_CHANNEL_SECRET'       => 'YOUR_LINE_CHANNEL_SECRET_HERE',
    'APP_SERVER_WEBHOOK_URL'    => 'https://etaxerp.com/api/line/webhook',

    'AUTH_KEY'                  => 'CHANGE_THIS_TO_A_RANDOM_SECRET_KEY',
    'LOG_ENABLED'              => true,
    'LOG_FILE'                 => __DIR__ . '/line-gateway.log',
    'LOG_MAX_SIZE_MB'          => 10,
    'STATS_FILE'               => __DIR__ . '/line-gateway-stats.json',
    'STATS_RETENTION_DAYS'     => 90,

    'MYSQL_HOST'               => 'localhost',
    'MYSQL_PORT'               => 3306,
    'MYSQL_DATABASE'           => 'line_gateway',
    'MYSQL_USER'               => 'YOUR_MYSQL_USER',
    'MYSQL_PASSWORD'           => 'YOUR_MYSQL_PASSWORD',
    'QUEUE_MAX_RETRIES'        => 20,
    'QUEUE_RETENTION_DAYS'     => 30,
];

// ============================================================
// DAILY STATS TRACKER
// ============================================================

function load_stats() {
    global $CONFIG;
    $file = $CONFIG['STATS_FILE'];
    if (!file_exists($file)) return ['days' => []];
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : ['days' => []];
}

function save_stats($stats) {
    global $CONFIG;
    file_put_contents($CONFIG['STATS_FILE'], json_encode($stats, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function purge_old_stats(&$stats) {
    global $CONFIG;
    $cutoff = date('Y-m-d', strtotime('-' . $CONFIG['STATS_RETENTION_DAYS'] . ' days'));
    $days = $stats['days'] ?? [];
    foreach (array_keys($days) as $date) {
        if ($date < $cutoff) {
            unset($stats['days'][$date]);
        }
    }
}

function record_request($type, $bytesIn, $bytesOut, $responseTimeMs, $success) {
    $stats = load_stats();
    $today = date('Y-m-d');

    if (!isset($stats['days'][$today])) {
        $stats['days'][$today] = [
            'requests'       => 0,
            'webhook_count'  => 0,
            'push_count'     => 0,
            'reply_count'    => 0,
            'api_count'      => 0,
            'errors'         => 0,
            'bytes_in'       => 0,
            'bytes_out'      => 0,
            'response_ms_min' => PHP_INT_MAX,
            'response_ms_max' => 0,
            'response_ms_sum' => 0,
            'first_request'  => date('H:i:s'),
            'last_request'   => date('H:i:s'),
        ];
    }

    $day = &$stats['days'][$today];
    $day['requests']++;
    $day[$type . '_count'] = ($day[$type . '_count'] ?? 0) + 1;
    if (!$success) $day['errors']++;
    $day['bytes_in']  += $bytesIn;
    $day['bytes_out'] += $bytesOut;
    $day['response_ms_min'] = min($day['response_ms_min'], $responseTimeMs);
    $day['response_ms_max'] = max($day['response_ms_max'], $responseTimeMs);
    $day['response_ms_sum'] += $responseTimeMs;
    $day['last_request'] = date('H:i:s');

    purge_old_stats($stats);
    save_stats($stats);
}

function get_disk_usage() {
    if (!function_exists('disk_total_space') || !function_exists('disk_free_space')) {
        return ['total_gb' => null, 'used_gb' => null, 'free_gb' => null, 'used_pct' => null, 'note' => 'disk functions disabled'];
    }
    try {
        $dir = __DIR__;
        $total = @disk_total_space($dir);
        $free  = @disk_free_space($dir);
        if ($total === false || $free === false) {
            return ['total_gb' => null, 'used_gb' => null, 'free_gb' => null, 'used_pct' => null];
        }
        $used = $total - $free;
        return [
            'total_gb' => round($total / 1073741824, 2),
            'used_gb'  => round($used  / 1073741824, 2),
            'free_gb'  => round($free  / 1073741824, 2),
            'used_pct' => round(($used / $total) * 100, 1),
        ];
    } catch (\Throwable $e) {
        return ['total_gb' => null, 'used_gb' => null, 'free_gb' => null, 'used_pct' => null, 'error' => $e->getMessage()];
    }
}

function format_bytes($bytes) {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
    return round($bytes / 1048576, 2) . ' MB';
}

// ============================================================
// MYSQL QUEUE
// ============================================================

function get_db() {
    global $CONFIG;
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        $dsn = "mysql:host={$CONFIG['MYSQL_HOST']};port={$CONFIG['MYSQL_PORT']};dbname={$CONFIG['MYSQL_DATABASE']};charset=utf8mb4";
        $pdo = new PDO($dsn, $CONFIG['MYSQL_USER'], $CONFIG['MYSQL_PASSWORD'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        ensure_queue_table($pdo);
        return $pdo;
    } catch (\Throwable $e) {
        gateway_log("MYSQL ERROR — " . $e->getMessage());
        return null;
    }
}

function ensure_queue_table($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS webhook_queue (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        payload MEDIUMTEXT NOT NULL,
        signature VARCHAR(255) NOT NULL,
        source_ip VARCHAR(45) DEFAULT NULL,
        status ENUM('pending','processing','delivered','failed') DEFAULT 'pending',
        retries INT UNSIGNED DEFAULT 0,
        last_error TEXT DEFAULT NULL,
        last_http_code INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME DEFAULT NULL,
        INDEX idx_status_retry (status, next_retry_at),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function queue_webhook($body, $signature, $sourceIp, $error, $httpCode) {
    $db = get_db();
    if (!$db) {
        gateway_log("QUEUE FAILED — MySQL unavailable, webhook LOST");
        return false;
    }
    try {
        $stmt = $db->prepare("INSERT INTO webhook_queue (payload, signature, source_ip, last_error, last_http_code, next_retry_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 MINUTE))");
        $stmt->execute([$body, $signature, $sourceIp, $error, $httpCode]);
        gateway_log("QUEUED webhook id=" . $db->lastInsertId() . " for retry");
        return true;
    } catch (\Throwable $e) {
        gateway_log("QUEUE INSERT FAILED — " . $e->getMessage());
        return false;
    }
}

function get_queue_stats() {
    $db = get_db();
    if (!$db) return null;
    try {
        $stmt = $db->query("SELECT status, COUNT(*) as cnt FROM webhook_queue GROUP BY status");
        $counts = [];
        foreach ($stmt->fetchAll() as $row) $counts[$row['status']] = (int)$row['cnt'];
        $oldest = $db->query("SELECT MIN(created_at) as oldest FROM webhook_queue WHERE status='pending'")->fetch();
        return [
            'pending'    => $counts['pending'] ?? 0,
            'processing' => $counts['processing'] ?? 0,
            'delivered'  => $counts['delivered'] ?? 0,
            'failed'     => $counts['failed'] ?? 0,
            'oldest_pending' => $oldest['oldest'] ?? null,
        ];
    } catch (\Throwable $e) {
        return ['error' => $e->getMessage()];
    }
}

// ============================================================
// HELPERS
// ============================================================

function gateway_log($msg) {
    global $CONFIG;
    if (!$CONFIG['LOG_ENABLED']) return;

    $logFile = $CONFIG['LOG_FILE'];
    if (file_exists($logFile) && filesize($logFile) > $CONFIG['LOG_MAX_SIZE_MB'] * 1024 * 1024) {
        $backup = $logFile . '.' . date('Ymd-His') . '.bak';
        rename($logFile, $backup);
    }

    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
}

function http_post($url, $body, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);
    return ['code' => $httpCode, 'body' => $response, 'error' => $error];
}

function verify_line_signature($body, $channelSecret) {
    $signature = $_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '';
    if (empty($signature)) return false;
    $hash = base64_encode(hash_hmac('sha256', $body, $channelSecret, true));
    return hash_equals($hash, $signature);
}

function verify_auth_key($key) {
    global $CONFIG;
    return hash_equals($CONFIG['AUTH_KEY'], $key);
}

function json_response($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// ROUTING
// ============================================================

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$requestStart = microtime(true);

// --- Health check ---
if ($method === 'GET' && $action === 'ping') {
    json_response(['status' => 'ok', 'gateway' => 'LINE Gateway', 'timestamp' => time()]);
}

// --- Gateway info (no secrets) ---
if ($method === 'GET' && $action === 'info') {
    $disk = get_disk_usage();
    $stats = load_stats();
    $today = $stats['days'][date('Y-m-d')] ?? null;

    $phpEolDates = [
        '8.1' => '2025-12-31',
        '8.2' => '2026-12-31',
        '8.3' => '2027-12-31',
        '8.4' => '2028-12-31',
    ];
    $phpMajorMinor = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
    $phpEol = $phpEolDates[$phpMajorMinor] ?? null;
    $phpEolWarning = null;
    if ($phpEol) {
        $daysUntilEol = (int)((strtotime($phpEol) - time()) / 86400);
        if ($daysUntilEol < 0) {
            $phpEolWarning = "⛔ PHP {$phpMajorMinor} หมดอายุแล้ว! กรุณาอัปเกรดทันที";
        } elseif ($daysUntilEol < 180) {
            $phpEolWarning = "⚠ PHP {$phpMajorMinor} จะหมดอายุใน {$daysUntilEol} วัน (EOL: {$phpEol}) — ควรวางแผนอัปเกรด";
        }
    } elseif (version_compare(PHP_VERSION, '8.2.0', '<')) {
        $phpEolWarning = "⛔ PHP " . PHP_VERSION . " ไม่รองรับแล้ว — กรุณาอัปเกรดเป็น 8.4+";
    }

    json_response([
        'gateway'      => 'LINE Gateway',
        'php_version'  => PHP_VERSION,
        'php_eol'      => $phpEol,
        'php_eol_warning' => $phpEolWarning,
        'server'       => $_SERVER['SERVER_NAME'] ?? 'unknown',
        'app_target'   => preg_replace('/\/\/([^:]+):([^@]+)@/', '//***:***@', $CONFIG['APP_SERVER_WEBHOOK_URL']),
        'log_enabled'  => $CONFIG['LOG_ENABLED'],
        'log_size_kb'  => file_exists($CONFIG['LOG_FILE']) ? round(filesize($CONFIG['LOG_FILE']) / 1024, 1) : 0,
        'stats_file_kb' => file_exists($CONFIG['STATS_FILE']) ? round(filesize($CONFIG['STATS_FILE']) / 1024, 1) : 0,
        'disk'         => $disk,
        'queue'        => get_queue_stats(),
        'today'        => $today ? [
            'requests'  => $today['requests'],
            'errors'    => $today['errors'],
            'bandwidth' => format_bytes($today['bytes_in'] + $today['bytes_out']),
        ] : null,
        'timestamp'    => time(),
    ]);
}

// --- Drain: app server pulls pending webhooks ---
if ($method === 'POST' && $action === 'drain') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        json_response(['error' => 'Unauthorized'], 401);
    }

    $db = get_db();
    if (!$db) json_response(['error' => 'MySQL unavailable'], 500);

    $limit = min((int)($_GET['limit'] ?? 50), 200);

    $stmt = $db->prepare("SELECT id, payload, signature, source_ip, retries, created_at FROM webhook_queue WHERE status='pending' ORDER BY created_at ASC LIMIT ?");
    $stmt->execute([$limit]);
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        json_response(['count' => 0, 'webhooks' => []]);
    }

    $ids = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $db->prepare("UPDATE webhook_queue SET status='processing' WHERE id IN ({$placeholders})")->execute($ids);

    gateway_log("DRAIN — {$limit} requested, " . count($rows) . " delivered to app server");
    json_response(['count' => count($rows), 'webhooks' => $rows]);
}

// --- Ack: app server confirms processed webhooks ---
if ($method === 'POST' && $action === 'ack') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        json_response(['error' => 'Unauthorized'], 401);
    }

    $db = get_db();
    if (!$db) json_response(['error' => 'MySQL unavailable'], 500);

    $input = json_decode(file_get_contents('php://input'), true);
    $delivered = $input['delivered'] ?? [];
    $failed    = $input['failed'] ?? [];

    $deliveredCount = 0;
    $failedCount    = 0;

    if (!empty($delivered)) {
        $placeholders = implode(',', array_fill(0, count($delivered), '?'));
        $db->prepare("UPDATE webhook_queue SET status='delivered', delivered_at=NOW() WHERE id IN ({$placeholders})")->execute($delivered);
        $deliveredCount = count($delivered);
    }

    if (!empty($failed)) {
        foreach ($failed as $item) {
            $id    = $item['id'] ?? 0;
            $error = $item['error'] ?? 'unknown';
            $db->prepare("UPDATE webhook_queue SET status='pending', retries=retries+1, last_error=?, next_retry_at=DATE_ADD(NOW(), INTERVAL LEAST(POW(2, retries), 60) MINUTE) WHERE id=?")->execute([$error, $id]);
        }
        $failedCount = count($failed);
    }

    $maxRetries = $CONFIG['QUEUE_MAX_RETRIES'];
    $retentionDays = $CONFIG['QUEUE_RETENTION_DAYS'];
    $db->exec("UPDATE webhook_queue SET status='failed' WHERE status='pending' AND retries >= {$maxRetries}");
    $db->exec("DELETE FROM webhook_queue WHERE status='delivered' AND delivered_at < DATE_SUB(NOW(), INTERVAL {$retentionDays} DAY)");
    $db->exec("DELETE FROM webhook_queue WHERE status='failed' AND created_at < DATE_SUB(NOW(), INTERVAL {$retentionDays} DAY)");

    gateway_log("ACK — delivered={$deliveredCount} failed={$failedCount}");
    json_response(['delivered' => $deliveredCount, 'failed' => $failedCount]);
}

// --- Queue status ---
if ($method === 'GET' && $action === 'queue') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $queueStats = get_queue_stats();
    $db = get_db();
    $recent = [];
    if ($db) {
        try {
            $stmt = $db->query("SELECT id, status, retries, last_error, last_http_code, created_at, next_retry_at, delivered_at FROM webhook_queue ORDER BY created_at DESC LIMIT 20");
            $recent = $stmt->fetchAll();
        } catch (\Throwable $e) {}
    }
    json_response(['queue' => $queueStats, 'recent' => $recent]);
}

// --- Daily stats (3-month history) ---
if ($method === 'GET' && $action === 'stats') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        json_response(['error' => 'Unauthorized — ใส่ auth key'], 401);
    }

    $stats = load_stats();
    $disk  = get_disk_usage();
    $days  = $stats['days'] ?? [];
    ksort($days);

    $summary = [];
    $totalRequests = 0;
    $totalBytesIn  = 0;
    $totalBytesOut = 0;
    $totalErrors   = 0;

    foreach ($days as $date => $day) {
        $avgMs = $day['requests'] > 0 ? round($day['response_ms_sum'] / $day['requests']) : 0;
        $totalBw = $day['bytes_in'] + $day['bytes_out'];

        $summary[] = [
            'date'          => $date,
            'requests'      => $day['requests'],
            'webhook'       => $day['webhook_count'],
            'push'          => $day['push_count'],
            'reply'         => $day['reply_count'],
            'api'           => $day['api_count'],
            'errors'        => $day['errors'],
            'bytes_in'      => format_bytes($day['bytes_in']),
            'bytes_out'     => format_bytes($day['bytes_out']),
            'bandwidth'     => format_bytes($totalBw),
            'response_ms'   => [
                'min' => $day['response_ms_min'] === PHP_INT_MAX ? 0 : $day['response_ms_min'],
                'max' => $day['response_ms_max'],
                'avg' => $avgMs,
            ],
            'active_hours'  => $day['first_request'] . ' — ' . $day['last_request'],
        ];

        $totalRequests += $day['requests'];
        $totalBytesIn  += $day['bytes_in'];
        $totalBytesOut += $day['bytes_out'];
        $totalErrors   += $day['errors'];
    }

    $dayCount = count($days);
    $avgDailyRequests = $dayCount > 0 ? round($totalRequests / $dayCount) : 0;
    $avgDailyBw       = $dayCount > 0 ? format_bytes(($totalBytesIn + $totalBytesOut) / $dayCount) : '0 B';

    json_response([
        'gateway'     => $_SERVER['SERVER_NAME'] ?? 'unknown',
        'period'      => $dayCount . ' days',
        'retention'   => $CONFIG['STATS_RETENTION_DAYS'] . ' days',
        'disk'        => $disk,
        'totals'      => [
            'requests'  => $totalRequests,
            'errors'    => $totalErrors,
            'bytes_in'  => format_bytes($totalBytesIn),
            'bytes_out' => format_bytes($totalBytesOut),
            'bandwidth' => format_bytes($totalBytesIn + $totalBytesOut),
        ],
        'averages'    => [
            'daily_requests'  => $avgDailyRequests,
            'daily_bandwidth' => $avgDailyBw,
        ],
        'alert'       => ($disk['used_pct'] !== null && $disk['used_pct'] > 80)
            ? '⚠ Disk usage above 80% — consider switching gateway server'
            : null,
        'days'        => $summary,
    ]);
}

// --- Forward LINE webhook to app server ---
if ($method === 'POST' && $action === '') {
    $body = file_get_contents('php://input');
    $bytesIn = strlen($body);
    $signature = $_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '';
    $sourceIp  = $_SERVER['REMOTE_ADDR'] ?? '?';

    if (!verify_line_signature($body, $CONFIG['LINE_CHANNEL_SECRET'])) {
        gateway_log("WEBHOOK REJECTED — invalid signature, IP: {$sourceIp}");
        record_request('webhook', $bytesIn, 0, 0, false);
        json_response(['error' => 'Invalid signature'], 403);
    }

    gateway_log("WEBHOOK received ({$bytesIn} bytes) from {$sourceIp}");

    $result = http_post(
        $CONFIG['APP_SERVER_WEBHOOK_URL'],
        $body,
        [
            'Content-Type: application/json',
            'X-Line-Signature: ' . $signature,
            'X-Forwarded-By: LINE-Gateway',
            'X-Gateway-Server: ' . ($_SERVER['SERVER_NAME'] ?? 'unknown'),
        ]
    );

    $elapsed = round((microtime(true) - $requestStart) * 1000);
    $bytesOut = strlen($result['body'] ?? '');
    $forwardOk = !$result['error'] && $result['code'] >= 200 && $result['code'] < 300;

    if (!$forwardOk) {
        $errMsg = $result['error'] ?: "HTTP {$result['code']}";
        gateway_log("WEBHOOK FORWARD FAILED — {$errMsg}");
        record_request('webhook', $bytesIn, $bytesOut, $elapsed, false);

        $queued = queue_webhook($body, $signature, $sourceIp, $errMsg, $result['code'] ?: 0);
        gateway_log($queued ? "WEBHOOK QUEUED for retry" : "WEBHOOK LOST — queue also failed");

        json_response([
            'error'  => 'App server unavailable',
            'queued' => $queued,
        ], 503);
    }

    gateway_log("WEBHOOK FORWARDED — app responded " . $result['code'] . " ({$elapsed}ms)");
    record_request('webhook', $bytesIn, $bytesOut, $elapsed, true);
    json_response(['status' => 'ok']);
}

// --- Forward push message from app server to LINE API ---
if ($method === 'POST' && $action === 'push') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        gateway_log("PUSH REJECTED — invalid auth key, IP: " . ($_SERVER['REMOTE_ADDR'] ?? '?'));
        record_request('push', 0, 0, 0, false);
        json_response(['error' => 'Unauthorized'], 401);
    }

    $body = file_get_contents('php://input');
    $bytesIn = strlen($body);
    gateway_log("PUSH request ({$bytesIn} bytes)");

    $result = http_post(
        'https://api.line.me/v2/bot/message/push',
        $body,
        [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $CONFIG['LINE_CHANNEL_ACCESS_TOKEN'],
        ]
    );

    $elapsed = round((microtime(true) - $requestStart) * 1000);
    $bytesOut = strlen($result['body'] ?? '');
    $success = ($result['code'] >= 200 && $result['code'] < 300);

    gateway_log("PUSH result — LINE responded " . $result['code'] . " ({$elapsed}ms)");
    record_request('push', $bytesIn, $bytesOut, $elapsed, $success);

    http_response_code($result['code'] ?: 502);
    header('Content-Type: application/json');
    echo $result['body'] ?: json_encode(['error' => $result['error']]);
    exit;
}

// --- Forward reply message from app server to LINE API ---
if ($method === 'POST' && $action === 'reply') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        gateway_log("REPLY REJECTED — invalid auth key");
        record_request('reply', 0, 0, 0, false);
        json_response(['error' => 'Unauthorized'], 401);
    }

    $body = file_get_contents('php://input');
    $bytesIn = strlen($body);
    gateway_log("REPLY request ({$bytesIn} bytes)");

    $result = http_post(
        'https://api.line.me/v2/bot/message/reply',
        $body,
        [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $CONFIG['LINE_CHANNEL_ACCESS_TOKEN'],
        ]
    );

    $elapsed = round((microtime(true) - $requestStart) * 1000);
    $bytesOut = strlen($result['body'] ?? '');
    $success = ($result['code'] >= 200 && $result['code'] < 300);

    gateway_log("REPLY result — LINE responded " . $result['code'] . " ({$elapsed}ms)");
    record_request('reply', $bytesIn, $bytesOut, $elapsed, $success);

    http_response_code($result['code'] ?: 502);
    header('Content-Type: application/json');
    echo $result['body'] ?: json_encode(['error' => $result['error']]);
    exit;
}

// --- Forward profile/followers/bot-info requests ---
if ($method === 'POST' && $action === 'api') {
    $authKey = $_SERVER['HTTP_X_GATEWAY_AUTH'] ?? ($_GET['auth'] ?? '');
    if (!verify_auth_key($authKey)) {
        record_request('api', 0, 0, 0, false);
        json_response(['error' => 'Unauthorized'], 401);
    }

    $rawInput = file_get_contents('php://input');
    $bytesIn = strlen($rawInput);
    $input = json_decode($rawInput, true);
    $endpoint = $input['endpoint'] ?? '';
    $apiMethod = strtoupper($input['method'] ?? 'GET');

    if (empty($endpoint) || strpos($endpoint, 'https://api.line.me/') !== 0) {
        record_request('api', $bytesIn, 0, 0, false);
        json_response(['error' => 'Invalid endpoint — must start with https://api.line.me/'], 400);
    }

    gateway_log("API PROXY — {$apiMethod} {$endpoint}");

    $headers = [
        'Authorization: Bearer ' . $CONFIG['LINE_CHANNEL_ACCESS_TOKEN'],
    ];

    if ($apiMethod === 'GET') {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $elapsed = round((microtime(true) - $requestStart) * 1000);
        $bytesOut = strlen($response ?? '');
        record_request('api', $bytesIn, $bytesOut, $elapsed, $httpCode >= 200 && $httpCode < 300);

        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
        exit;
    }

    $postBody = isset($input['body']) ? json_encode($input['body']) : '';
    $headers[] = 'Content-Type: application/json';
    $result = http_post($endpoint, $postBody, $headers);

    $elapsed = round((microtime(true) - $requestStart) * 1000);
    $bytesOut = strlen($result['body'] ?? '');
    record_request('api', $bytesIn, $bytesOut, $elapsed, $result['code'] >= 200 && $result['code'] < 300);

    http_response_code($result['code'] ?: 502);
    header('Content-Type: application/json');
    echo $result['body'] ?: json_encode(['error' => $result['error']]);
    exit;
}

// --- Unknown request ---
json_response([
    'error' => 'LINE Gateway — unknown request',
    'usage' => [
        'webhook'  => 'POST /line-gateway.php (LINE sends here)',
        'push'     => 'POST /line-gateway.php?action=push (app sends push messages)',
        'reply'    => 'POST /line-gateway.php?action=reply (app sends reply messages)',
        'api'      => 'POST /line-gateway.php?action=api (app proxies LINE API calls)',
        'ping'     => 'GET  /line-gateway.php?action=ping (health check)',
        'info'     => 'GET  /line-gateway.php?action=info (gateway status)',
        'stats'    => 'GET  /line-gateway.php?action=stats&auth=KEY (usage stats)',
    ],
], 400);
