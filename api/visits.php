<?php
/**
 * 访问记录查看页（需密钥）
 * 访问：/xiaochou/api/visits.php?key=你设置的密钥
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

$filterFrom = isset($_GET['from']) ? trim($_GET['from']) : '';
$filterTo = isset($_GET['to']) ? trim($_GET['to']) : '';
$filterDevice = isset($_GET['device']) ? trim($_GET['device']) : '';
$filterIp = isset($_GET['ip']) ? trim($_GET['ip']) : '';
$filterEvent = isset($_GET['event']) ? trim($_GET['event']) : '';

$logFile = dirname(__DIR__) . '/logs/visits.jsonl';
$allRows = array();

if (is_file($logFile)) {
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines !== false) {
        foreach (array_reverse($lines) as $line) {
            $item = json_decode($line, true);
            if (is_array($item)) {
                $allRows[] = $item;
            }
        }
    }
}

/**
 * 从 UA 解析「设备 · 系统版本」（不含浏览器）
 */
function parseDeviceOsFromUa($ua)
{
    $ua = (string) $ua;
    if ($ua === '') {
        return '未知设备';
    }

    $device = '';
    $osVer = '';

    if (preg_match('/iPhone/', $ua)) {
        $device = 'iPhone';
        if (preg_match('/CPU iPhone OS ([0-9_]+)/i', $ua, $m)) {
            $osVer = 'iOS ' . str_replace('_', '.', $m[1]);
        } elseif (preg_match('/iPhone OS ([0-9_]+)/i', $ua, $m)) {
            $osVer = 'iOS ' . str_replace('_', '.', $m[1]);
        }
    } elseif (preg_match('/iPad/', $ua)) {
        $device = 'iPad';
        if (preg_match('/CPU OS ([0-9_]+)/i', $ua, $m)) {
            $osVer = 'iOS ' . str_replace('_', '.', $m[1]);
        }
    } elseif (preg_match('/iPod/', $ua)) {
        $device = 'iPod';
        if (preg_match('/CPU iPhone OS ([0-9_]+)/i', $ua, $m)) {
            $osVer = 'iOS ' . str_replace('_', '.', $m[1]);
        }
    } elseif (preg_match('/Android/i', $ua)) {
        if (preg_match('/;\s*([^;)]+)\s*Build\//i', $ua, $m)) {
            $device = trim($m[1]);
        } else {
            $device = 'Android 设备';
        }
        if (preg_match('/Android ([0-9.]+)/i', $ua, $m)) {
            $osVer = 'Android ' . $m[1];
        }
    } elseif (preg_match('/Windows NT ([0-9.]+)/i', $ua, $m)) {
        $device = 'Windows';
        $nt = $m[1];
        $winMap = array(
            '10.0' => 'Windows 10/11',
            '6.3' => 'Windows 8.1',
            '6.2' => 'Windows 8',
            '6.1' => 'Windows 7',
            '6.0' => 'Windows Vista',
            '5.1' => 'Windows XP',
        );
        $osVer = isset($winMap[$nt]) ? $winMap[$nt] : ('Windows NT ' . $nt);
    } elseif (preg_match('/Mac OS X ([0-9_]+)/i', $ua, $m)) {
        $device = 'Mac';
        $osVer = 'macOS ' . str_replace('_', '.', $m[1]);
    } elseif (preg_match('/CrOS/i', $ua)) {
        $device = 'Chromebook';
        $osVer = 'Chrome OS';
    } elseif (preg_match('/Linux/i', $ua)) {
        $device = 'Linux';
        $osVer = 'Linux';
    } else {
        $device = '未知设备';
    }

    if ($osVer === '') {
        return $device;
    }
    return $device . ' · ' . $osVer;
}

foreach ($allRows as $i => $row) {
    $allRows[$i]['_device_os'] = parseDeviceOsFromUa(arr_get($row, 'ua', ''));
}

function rowTs($row)
{
    $ts = arr_get($row, 'server_ts', arr_get($row, 'ts', 0));
    if (!$ts) {
        return 0;
    }
    if ($ts > 9999999999) {
        $ts = (int) round($ts / 1000);
    }
    return (int) $ts;
}

function fmtTime($row)
{
    $ts = rowTs($row);
    if (!$ts) {
        return '-';
    }
    return date('Y-m-d H:i:s', $ts);
}

function parseFilterTs($input, $endOfDay)
{
    if ($input === '') {
        return null;
    }
    $input = str_replace('T', ' ', $input);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $input)) {
        $input .= $endOfDay ? ' 23:59:59' : ' 00:00:00';
    }
    $ts = strtotime($input);
    return $ts ? (int) $ts : null;
}

function eventLabel($event)
{
    $map = array(
        'page_view' => '页面访问',
        'phase' => '阶段切换',
        'click' => '按钮点击',
        'wish_modal_open' => '打开许愿',
        's2_enter' => '进入第二幕',
        'quiz_complete' => '问答完成',
        'gift_open' => '打开礼物',
        'letter_block_open' => '进入信件',
        'letter_open' => '拆开信封',
        'finale' => '幕落',
        'test' => '测试',
    );
    return isset($map[$event]) ? $map[$event] : $event;
}

function collectUnique($rows, $field)
{
    $set = array();
    foreach ($rows as $row) {
        $val = trim((string) arr_get($row, $field, ''));
        if ($val !== '') {
            $set[$val] = true;
        }
    }
    $keys = array_keys($set);
    sort($keys);
    return $keys;
}

$eventOptions = collectUnique($allRows, 'event');
$deviceOptions = collectUnique($allRows, '_device_os');
$ipOptions = collectUnique($allRows, 'ip');

$tsFrom = parseFilterTs($filterFrom, false);
$tsTo = parseFilterTs($filterTo, true);

$rows = array();
foreach ($allRows as $row) {
    $ts = rowTs($row);

    if ($tsFrom !== null && ($ts === 0 || $ts < $tsFrom)) {
        continue;
    }
    if ($tsTo !== null && ($ts === 0 || $ts > $tsTo)) {
        continue;
    }
    if ($filterDevice !== '' && arr_get($row, '_device_os', '') !== $filterDevice) {
        continue;
    }
    if ($filterIp !== '' && arr_get($row, 'ip', '') !== $filterIp) {
        continue;
    }
    if ($filterEvent !== '' && arr_get($row, 'event', '') !== $filterEvent) {
        continue;
    }
    $rows[] = $row;
}

function h($v)
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

function filterInputValue($from)
{
    if ($from === '') {
        return '';
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
        return $from;
    }
    return str_replace(' ', 'T', substr($from, 0, 16));
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
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { color: #666; margin-bottom: 16px; }
    .filters {
      background: #fff;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: flex-end;
    }
    .filters label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #666;
    }
    .filters input,
    .filters select {
      font: inherit;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #fff;
      min-width: 150px;
    }
    .filters .combo { min-width: 200px; }
    .filters__actions {
      display: flex;
      gap: 8px;
    }
    .btn {
      font: inherit;
      padding: 7px 14px;
      border-radius: 6px;
      border: 1px solid #c9b8a8;
      background: #f3ece4;
      color: #5c4a3a;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn--primary { background: #8b5a2b; border-color: #8b5a2b; color: #fff; }
    .btn--ghost { background: #fff; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.06); border-radius: 10px; overflow: hidden; }
    th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { background: #f3ece4; font-weight: 600; white-space: nowrap; }
    tr:hover td { background: #fffdf9; }
    tr:last-child td { border-bottom: 0; }
    .ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .event { color: #8b5a2b; }
    .ua { max-width: 280px; word-break: break-all; color: #888; font-size: 12px; }
    .empty { text-align: center; color: #999; padding: 24px; }
    @media (max-width: 900px) {
      .filters label { width: 100%; }
      .filters input, .filters select { width: 100%; }
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
  <p class="meta">
    显示 <?= count($rows) ?> 条
    <?php if (count($rows) !== count($allRows)): ?>
      （共 <?= count($allRows) ?> 条，已筛选）
    <?php else: ?>
      · 最新在前
    <?php endif; ?>
  </p>

  <form class="filters" method="get" action="">
    <input type="hidden" name="key" value="<?= h($key) ?>" />
    <label>
      开始时间
      <input type="datetime-local" name="from" value="<?= h(filterInputValue($filterFrom)) ?>" />
    </label>
    <label>
      结束时间
      <input type="datetime-local" name="to" value="<?= h(filterInputValue($filterTo)) ?>" />
    </label>
    <label>
      设备
      <input
        class="combo"
        type="text"
        name="device"
        list="device-list"
        value="<?= h($filterDevice) ?>"
        placeholder="输入或选择设备"
        autocomplete="off"
      />
      <datalist id="device-list">
        <?php foreach ($deviceOptions as $opt): ?>
        <option value="<?= h($opt) ?>"></option>
        <?php endforeach; ?>
      </datalist>
    </label>
    <label>
      IP
      <input
        class="combo"
        type="text"
        name="ip"
        list="ip-list"
        value="<?= h($filterIp) ?>"
        placeholder="输入或选择 IP"
        autocomplete="off"
      />
      <datalist id="ip-list">
        <?php foreach ($ipOptions as $opt): ?>
        <option value="<?= h($opt) ?>"></option>
        <?php endforeach; ?>
      </datalist>
    </label>
    <label>
      事件类型
      <select name="event">
        <option value="">全部</option>
        <?php foreach ($eventOptions as $opt): ?>
        <option value="<?= h($opt) ?>"<?= $filterEvent === $opt ? ' selected' : '' ?>><?= h(eventLabel($opt)) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <div class="filters__actions">
      <button type="submit" class="btn btn--primary">筛选</button>
      <a class="btn btn--ghost" href="?key=<?= urlencode($key) ?>">重置</a>
    </div>
  </form>

  <table>
    <thead>
      <tr>
        <th>时间</th>
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
      <tr><td colspan="7" class="empty">暂无符合条件的记录</td></tr>
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
        $eventName = arr_get($row, 'event', '-');
      ?>
      <tr>
        <td data-label="时间"><?= h(fmtTime($row)) ?></td>
        <td data-label="IP" class="ip"><?= h(arr_get($row, 'ip', '-')) ?></td>
        <td data-label="设备"><?= h(arr_get($row, '_device_os', '-')) ?></td>
        <td data-label="屏幕"><?= h($screen !== '' ? $screen : '-') ?></td>
        <td data-label="事件" class="event"><?= h(eventLabel($eventName)) ?></td>
        <td data-label="详情"><?= h($detailStr) ?></td>
        <td data-label="UA" class="ua"><?= h(arr_get($row, 'ua', '')) ?></td>
      </tr>
      <?php endforeach; ?>
      <?php endif; ?>
    </tbody>
  </table>
</body>
</html>
