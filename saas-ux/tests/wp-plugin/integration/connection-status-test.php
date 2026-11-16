<?php
// Runs inside WordPress via `wp eval-file`. Exits non-zero if any check fails.
// 1.13.1: the settings page asks GetSafe 360 whether its pairing is still valid.

$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

$opt = ['site_id' => '44a6c8b2-7cf1-4f97-8245-f3cffd3471cc', 'site_token' => 'old-token'];
$plugin = null;
foreach ($GLOBALS['wp_filter']['template_redirect']->callbacks as $callbacks) {
  foreach ($callbacks as $cb) if (is_array($cb['function']) && $cb['function'][0] instanceof GetSafe360_AI) $plugin = $cb['function'][0];
}
$status = new ReflectionMethod($plugin, 'platform_status');
$status->setAccessible(true);

$sent = null;
$answer = function ($known) use (&$sent) {
  return function ($pre, $args, $url) use ($known, &$sent) {
    if (strpos($url, '/api/connect/status') === false) return $pre;
    $sent = $args;
    return ['response' => ['code' => 200, 'message' => 'OK'], 'body' => wp_json_encode(['known' => $known]), 'headers' => [], 'cookies' => []];
  };
};

delete_transient('getsafe360_platform_status');
add_filter('pre_http_request', $unknown = $answer(false), 10, 3);
check($status->invoke($plugin, $opt) === 'unknown', 'an old pairing the platform does not know is "unknown"');
check($sent['headers']['X-Site-Key'] === hash('sha256', 'old-token') && json_decode($sent['body'], true) === ['siteId' => $opt['site_id']], 'only the site ID and the key hash are sent');
remove_filter('pre_http_request', $unknown, 10);

$sent = null;
add_filter('pre_http_request', $known = $answer(true), 10, 3);
check($status->invoke($plugin, $opt) === 'unknown' && $sent === null, 'the answer is cached for 10 minutes');
delete_transient('getsafe360_platform_status');
check($status->invoke($plugin, $opt) === 'known', 'a pairing the platform knows is "known"');
remove_filter('pre_http_request', $known, 10);

delete_transient('getsafe360_platform_status');
$down = function ($pre, $args, $url) { return strpos($url, '/api/connect/status') === false ? $pre : new WP_Error('http_request_failed', 'timeout'); };
add_filter('pre_http_request', $down, 10, 3);
check($status->invoke($plugin, $opt) === 'unreachable', 'a network error is "unreachable", not "unknown"');
check(get_transient('getsafe360_platform_status') === false, 'an unreachable answer is not cached');
remove_filter('pre_http_request', $down, 10);
delete_transient('getsafe360_platform_status');

exit($GLOBALS['fails'] ? 1 : 0);
