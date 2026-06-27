<?php
/**
 * 访问记录查看页（需密钥）
 * 访问：/xiaoqiu/api/visits.php?key=你设置的密钥
 */
define('VIEW_KEY', 'therzyx');

function arr_get($arr, $key, $default)
{
    return isset($arr[$key]) ? $arr[$key] : $default;
}

$key = isset($_GET['key']) ? $_GET['key'] : '';
if ($key === '' || $key !== VIEW_KEY) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    exit;
}

$logFile = dirname(__DIR__) . '/logs/visits.jsonl';
$rows = array();

if (is_file($logFile)) {
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines !== false) {
        foreach (array_reverse($lines) as $line) {
            $item = json_decode($line, true);
            if (is_array($item)) {
                $rows[] = $item;
            }
        }
    }
}

function fmtTime($row)
{
    $ts = arr_get($row, 'server_ts', arr_get($row, 'ts', 0));
    if (!$ts) {
        return '-';
    }
    if ($ts > 9999999999) {
        $ts = (int) round($ts / 1000);
    }
    $dt = new DateTime('@' . $ts);
    $dt->setTimezone(new DateTimeZone('Asia/Shanghai'));
    return $dt->format('Y-m-d H:i:s');
}

function h($v)
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>访问记录</title>
  <style>
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; color: #222; background: #faf7f2; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
    th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { background: #f3ece4; font-weight: 600; white-space: nowrap; }
    tr:hover td { background: #fffdf9; }
    .ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .event { color: #8b5a2b; }
    .ua { max-width: 280px; word-break: break-all; color: #888; font-size: 12px; }
    @media (max-width: 900px) {
      table, thead, tbody, th, td, tr { display: block; }
      thead { display: none; }
      tr { margin-bottom: 12px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; background: #fff; }
      td { border: 0; padding: 6px 12px; }
      td::before { content: attr(data-label); display: block; font-size: 12px; color: #999; margin-bottom: 2px; }
    }
  </style>
</head>
<body>
  <h1>访问记录</h1>
  <p class="meta">共 <?= count($rows) ?> 条 · 最新在前</p>
  <table>
    <thead>
      <tr>
        <th>时间 (UTC+8)</th>
        <th>IP</th>
        <th>设备</th>
        <th>屏幕</th>
        <th>事件</th>
        <th>详情</th>
        <th>UA</th>
      </tr>
    </thead>
    <tbody>
      <?php if (!$rows): ?>
      <tr><td colspan="7">暂无记录</td></tr>
      <?php else: ?>
      <?php foreach ($rows as $row): ?>
      <?php
        $screen = '';
        if (!empty($row['vw']) && !empty($row['vh'])) {
            $screen = $row['vw'] . '×' . $row['vh'];
            if (!empty($row['dpr'])) {
                $screen .= ' @' . $row['dpr'] . 'x';
            }
        }
        $detail = array();
        if (!empty($row['phase'])) {
            $detail[] = '阶段: ' . $row['phase'];
        }
        if (!empty($row['target'])) {
            $detail[] = '按钮: ' . $row['target'];
        }
        if (!empty($row['path'])) {
            $detail[] = $row['path'];
        }
        $detailStr = implode(' · ', $detail);
        if ($detailStr === '') {
            $detailStr = '-';
        }
      ?>
      <tr>
        <td data-label="时间"><?= h(fmtTime($row)) ?></td>
        <td data-label="IP" class="ip"><?= h(arr_get($row, 'ip', '-')) ?></td>
        <td data-label="设备"><?= h(arr_get($row, 'device', '-')) ?></td>
        <td data-label="屏幕"><?= h($screen !== '' ? $screen : '-') ?></td>
        <td data-label="事件" class="event"><?= h(arr_get($row, 'event', '-')) ?></td>
        <td data-label="详情"><?= h($detailStr) ?></td>
        <td data-label="UA" class="ua"><?= h(arr_get($row, 'ua', '')) ?></td>
      </tr>
      <?php endforeach; ?>
      <?php endif; ?>
    </tbody>
  </table>
</body>
</html>
