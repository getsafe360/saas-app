<?php
// Runs inside WordPress via `wp eval-file`, with the site served at
// $GS360_LOOPBACK. Official checksums and file copies are served from the
// pristine install, so this needs no access to wordpress.org.

// eval-file runs this file inside a function, so the counter must live in $GLOBALS.
$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

$loopback = getenv('GS360_LOOPBACK');
if (!$loopback) {
  echo "SKIP: GS360_LOOPBACK not set\n";
  exit(0);
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
$key = hash('sha256', 'integration-token');
$old_home = get_option('home');
$old_siteurl = get_option('siteurl');
update_option('home', $loopback);
update_option('siteurl', $loopback);
global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%getsafe360_core_sums_%'");

// Pristine checksums and contents, captured before anything is changed.
$sums = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ABSPATH, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
  $rel = str_replace('\\', '/', substr($f->getPathname(), strlen(ABSPATH)));
  if (preg_match('#^(wp-admin|wp-includes)/#', $rel) || preg_match('#^wp-[a-z-]+\.php$#', $rel) && $rel !== 'wp-config.php') {
    $sums[$rel] = md5_file($f->getPathname());
  }
}
$tampered = 'wp-includes/version.php';
$planted = 'wp-includes/wp-cache-handler.php';
$pristine = [$tampered => file_get_contents(ABSPATH . $tampered)];
$serve_wrong = [];
$downloads = 0;

add_filter('pre_http_request', function ($pre, $args, $url) use ($sums, &$pristine, &$serve_wrong, &$downloads) {
  $reply = function ($body) {
    return ['headers' => [], 'body' => $body, 'response' => ['code' => 200, 'message' => 'OK'], 'cookies' => [], 'filename' => null];
  };
  if (strpos($url, 'api.wordpress.org/core/checksums') !== false) {
    return $reply(json_encode(['checksums' => $sums]));
  }
  if (preg_match('#^https://core\.svn\.wordpress\.org/tags/[^/]+/(.+)$#', $url, $m)) {
    $downloads++;
    $path = rawurldecode($m[1]);
    if (isset($serve_wrong[$path])) return $reply('tampered official copy');
    return $reply($pristine[$path] ?? file_get_contents(ABSPATH . $path));
  }
  return $pre;
}, 10, 3);

function core_get($key, $route, $params = []) {
  $req = new WP_REST_Request('GET', '/getsafe360/v1' . $route);
  $req->set_header('X-API-Key', $key);
  foreach ($params as $k => $v) $req->set_param($k, $v);
  $res = rest_do_request($req);
  return [$res->get_status(), $res->get_data()];
}
function run_action($key, $type, $payload, $id = 'core-action') {
  $req = new WP_REST_Request('POST', '/getsafe360/v1/actions');
  $req->set_header('X-API-Key', $key);
  $req->set_header('Content-Type', 'application/json');
  $req->set_body(wp_json_encode(['actions' => [['id' => $id, 'type' => $type, 'payload' => $payload]]]));
  return rest_do_request($req)->get_data()['results'][0];
}
function replay($key, $result) {
  $rb = json_decode(wp_json_encode($result['rollback']), true);
  return run_action($key, $rb['type'], $rb['payload'], $rb['id']);
}

try {
  list($status, $clean) = core_get($key, '/core-files');
  check($status === 200 && $clean['modified'] === [] && $clean['unexpected'] === [] && $clean['complete'] === true, 'a clean install has no modified or unexpected core files');

  file_put_contents(ABSPATH . $tampered, $pristine[$tampered] . "\nif (isset(\$_GET['gs360_probe'])) { echo 'injected'; }\n");
  file_put_contents(ABSPATH . $planted, "<?php\n// planted by the integration test\n");

  list(, $found) = core_get($key, '/core-files');
  check($found['modified'] === [$tampered], 'lists the modified core file');
  check($found['unexpected'] === [$planted], 'lists the unexpected PHP file in wp-includes');

  list($status, $diff) = core_get($key, '/core-files/diff', ['path' => $tampered]);
  check($status === 200 && $diff['kind'] === 'modified', 'diff of a modified file');
  check(strpos($diff['diff'], "+if (isset(\$_GET['gs360_probe']))") !== false && strpos($diff['diff'], '@@ -') === 0, 'diff shows the injected line in unified format');
  check(substr_count($diff['diff'], "\n") < 12, 'diff carries only the change and its context, not the whole file');

  list(, $added) = core_get($key, '/core-files/diff', ['path' => $planted]);
  check($added['kind'] === 'unexpected' && strpos($added['diff'], '+// planted by the integration test') !== false, 'an unexpected file is shown as added lines');

  foreach (['wp-config.php', '../wp-config.php', 'wp-content/plugins/hello.php', 'wp-includes/../wp-config.php'] as $bad) {
    list($status) = core_get($key, '/core-files/diff', ['path' => $bad]);
    check($status === 400, "refuses to read $bad");
  }

  $req = new WP_REST_Request('GET', '/getsafe360/v1/audit');
  $req->set_header('X-API-Key', $key);
  $req->set_param('refresh', 1);
  $flags = rest_do_request($req)->get_data()['redFlags'];
  check($flags['coreModifiedFiles'] === 1 && $flags['unexpectedCoreFiles'] === 1, 'audit counts the modified and the unexpected file');

  // A download that does not match the official checksum changes nothing.
  $serve_wrong[$tampered] = true;
  $bad = run_action($key, 'restore_core_files', ['paths' => 'modified']);
  check($bad['status'] === 'failed' && strpos(file_get_contents(ABSPATH . $tampered), 'gs360_probe') !== false, 'a copy that fails the checksum is refused and nothing is written');
  unset($serve_wrong[$tampered]);

  $res = run_action($key, 'restore_core_files', ['paths' => 'modified']);
  check($res['status'] === 'applied', 'restores the official file: ' . $res['message']);
  check(md5_file(ABSPATH . $tampered) === $sums[$tampered], 'the file matches the official checksum again');
  check($res['rollback']['type'] === 'restore_core_backup', 'returns an undo');
  $undo = replay($key, $res);
  check($undo['status'] === 'applied' && strpos(file_get_contents(ABSPATH . $tampered), 'gs360_probe') !== false, 'undo puts the previous file back exactly');
  run_action($key, 'restore_core_files', ['paths' => [$tampered]]);
  check(md5_file(ABSPATH . $tampered) === $sums[$tampered], 'an explicit path list works too');

  $q = run_action($key, 'quarantine_core_files', ['paths' => 'unexpected']);
  check($q['status'] === 'applied' && !file_exists(ABSPATH . $planted), 'quarantines the unexpected file: ' . $q['message']);
  replay($key, $q);
  check(file_get_contents(ABSPATH . $planted) === "<?php\n// planted by the integration test\n", 'undo brings the quarantined file back');
  run_action($key, 'quarantine_core_files', ['paths' => 'unexpected']);
  check(!file_exists(ABSPATH . $planted), 'quarantined again');

  check(run_action($key, 'quarantine_core_files', ['paths' => ['wp-includes/functions.php']])['status'] === 'skipped', 'never quarantines a real core file');
  foreach (['wp-includes/./functions.php', 'wp-includes//functions.php'] as $alias) {
    check(run_action($key, 'quarantine_core_files', ['paths' => [$alias]])['status'] === 'skipped' && file_exists(ABSPATH . 'wp-includes/functions.php'), "never quarantines a core file spelled $alias");
    list($status) = core_get($key, '/core-files/diff', ['path' => $alias]);
    check($status === 400, "refuses the diff for $alias");
  }
  check(run_action($key, 'restore_core_files', ['paths' => ['wp-config.php']])['status'] === 'skipped', 'never touches wp-config.php');
  check(run_action($key, 'restore_core_backup', ['restorePoint' => '../../x'])['status'] === 'failed', 'rejects malformed restore points');
  $plugin_points = array_filter(get_option('getsafe360_restore_points', []), function ($p) { return ($p['kind'] ?? '') === 'core'; });
  $core_id = array_key_first($plugin_points);
  check(run_action($key, 'restore_plugins', ['restorePoints' => [$core_id]])['status'] === 'failed', 'a core restore point cannot be used as a plugin restore point');

  list(, $after) = core_get($key, '/core-files');
  check($after['modified'] === [] && $after['unexpected'] === [], 'the install is clean again');

  $cap = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
  $cap->set_header('X-API-Key', $key);
  check(!empty(rest_do_request($cap)->get_data()['capabilities']['coreIntegrity']), 'advertises coreIntegrity');
} finally {
  file_put_contents(ABSPATH . $tampered, $pristine[$tampered]);
  @unlink(ABSPATH . $planted);
  update_option('home', $old_home);
  update_option('siteurl', $old_siteurl);
  $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%getsafe360_core_sums_%'");
}

exit($GLOBALS['fails'] ? 1 : 0);
