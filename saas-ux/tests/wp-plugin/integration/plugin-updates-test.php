<?php
// Runs inside WordPress via `wp eval-file`, with the site served by `php -S`
// at $GS360_LOOPBACK so the connector's health check makes a real request.
// Updates a demo plugin from local packages: a good update, an update that
// crashes the site (restored automatically), and undo via the rollback.

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

function run_action($key, $type, $payload, $id = 'wordpress-update-plugins') {
  $req = new WP_REST_Request('POST', '/getsafe360/v1/actions');
  $req->set_header('X-API-Key', $key);
  $req->set_header('Content-Type', 'application/json');
  $req->set_body(wp_json_encode(['actions' => [['id' => $id, 'type' => $type, 'payload' => $payload]]]));
  return rest_do_request($req)->get_data()['results'][0];
}

function audit_plugins($key) {
  $req = new WP_REST_Request('GET', '/getsafe360/v1/audit');
  $req->set_header('X-API-Key', $key);
  return rest_do_request($req)->get_data()['plugins'];
}

// ---------- demo plugin and its packages ----------
$slug = 'gs360-demo';
$file = "$slug/$slug.php";
$work = sys_get_temp_dir() . '/gs360-packages-' . getmypid();
@mkdir($work);

function demo_source($version, $body = '') {
  return "<?php\n/**\n * Plugin Name: GS360 Demo\n * Version: $version\n */\nfunction gs360_demo_version() { return '$version'; }\n$body\n";
}
function build_package($work, $slug, $version, $body = '') {
  $zip = new ZipArchive();
  $path = "$work/$slug-$version.zip";
  $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
  $zip->addFromString("$slug/$slug.php", demo_source($version, $body));
  $zip->addFromString("$slug/readme.txt", "v$version");
  $zip->close();
  return $path;
}
function offer($slug, $file, $version, $package) {
  $t = get_site_transient('update_plugins');
  if (!is_object($t)) $t = new stdClass();
  $t->last_checked = time();
  $t->response = [$file => (object) ['slug' => $slug, 'plugin' => $file, 'new_version' => $version, 'package' => $package]];
  set_site_transient('update_plugins', $t);
}
function installed_version($file) {
  wp_clean_plugins_cache(false);
  $plugins = get_plugins();
  return $plugins[$file]['Version'] ?? null;
}

wp_mkdir_p(WP_PLUGIN_DIR . "/$slug");
file_put_contents(WP_PLUGIN_DIR . "/$file", demo_source('1.0'));
activate_plugin($file);
check(is_plugin_active($file), 'demo plugin 1.0 is active');

$good = build_package($work, $slug, '1.1');
// 1.2 crashes every page load.
$broken = build_package($work, $slug, '1.2', "add_action('init', function () { gs360_this_function_does_not_exist(); });");

try {
  // ---------- nothing to do ----------
  delete_site_transient('update_plugins');
  set_site_transient('update_plugins', (object) ['last_checked' => time(), 'response' => []]);
  check(run_action($key, 'update_plugins', ['plugins' => 'outdated'])['status'] === 'skipped', 'reports when no updates are available');

  // ---------- a good update ----------
  offer($slug, $file, '1.1', $good);
  $before = audit_plugins($key);
  $item = array_values(array_filter($before['items'], function ($i) use ($slug) { return $i['slug'] === $slug; }))[0];
  check($item['updateAvailable'] === true && $item['newVersion'] === '1.1', 'audit shows the pending update and its version');
  check($before['updatesPossible'] === true, 'audit reports that updates are possible');

  $res = run_action($key, 'update_plugins', ['plugins' => 'outdated']);
  check($res['status'] === 'applied', 'update applies: ' . $res['message']);
  check(installed_version($file) === '1.1', 'plugin is now 1.1');
  check(in_array($file, (array) get_option('active_plugins'), true), 'plugin is still active after the update');
  $entry = $res['state']['plugins'][0];
  check($entry['status'] === 'updated' && $entry['from'] === '1.0' && $entry['to'] === '1.1' && $entry['healthChecked'] === true, 'records from/to and a passed health check');
  check(audit_plugins($key)['updatesAvailable'] === 0, 'audit no longer lists the update');

  // Restore point: a randomly named zip in a guarded folder.
  $points = get_option('getsafe360_restore_points');
  $id = $res['rollback']['payload']['restorePoints'][0];
  check(preg_match('/^[a-f0-9]{32}$/', $id) && isset($points[$id]) && $points[$id]['version'] === '1.0', 'restore point recorded for 1.0');
  $dir = WP_CONTENT_DIR . '/getsafe360-backups';
  check(file_exists("$dir/$id.zip") && file_exists("$dir/.htaccess") && file_exists("$dir/index.php"), 'restore point zip is stored in a guarded folder');

  // ---------- undo ----------
  $rb = json_decode(wp_json_encode($res['rollback']), true);
  $undo = run_action($key, $rb['type'], $rb['payload'], $rb['id']);
  check($undo['status'] === 'applied', 'undo applies: ' . $undo['message']);
  check(installed_version($file) === '1.0', 'undo puts 1.0 back');
  check(in_array($file, (array) get_option('active_plugins'), true), 'plugin stays active after undo');
  check(audit_plugins($key)['updatesAvailable'] === 1, 'after undo the update is listed again');

  // ---------- an update that crashes the site ----------
  offer($slug, $file, '1.2', $broken);
  $res = run_action($key, 'update_plugins', ['plugins' => 'outdated']);
  $entry = $res['state']['plugins'][0];
  check($res['status'] === 'failed' && $entry['status'] === 'restored' && $entry['restored'] === true, 'a crashing update is detected and restored: ' . $res['message']);
  check(installed_version($file) === '1.0', 'plugin is back on 1.0');
  $response = wp_remote_get(add_query_arg('check', '1', home_url('/')), ['timeout' => 10]);
  check(!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200, 'the site loads again');
  check($res['rollback'] === null, 'nothing left to undo after an automatic restore');

  // ---------- a damaged restore point never costs the installed version ----------
  offer($slug, $file, '1.1', $good);
  $res = run_action($key, 'update_plugins', ['plugins' => 'outdated']);
  check($res['status'] === 'applied' && installed_version($file) === '1.1', 'updated to 1.1 again');
  $id = $res['rollback']['payload']['restorePoints'][0];
  file_put_contents(WP_CONTENT_DIR . "/getsafe360-backups/$id.zip", 'not a zip');
  $undo = run_action($key, 'restore_plugins', $res['rollback']['payload'], 'r');
  check($undo['status'] === 'failed', 'undo from a damaged restore point fails: ' . $undo['message']);
  check(installed_version($file) === '1.1' && file_exists(WP_PLUGIN_DIR . "/$slug/readme.txt"), 'the installed 1.1 is left complete');
  check(glob(WP_CONTENT_DIR . '/getsafe360-backups/restore-*') === [], 'no staging folders are left behind');

  // A partial undo (one restore works, one is missing) reports failure so the run stays undoable.
  run_action($key, 'restore_plugins', ['restorePoints' => []], 'r');
  delete_plugins([$file]);
  wp_mkdir_p(WP_PLUGIN_DIR . "/$slug");
  file_put_contents(WP_PLUGIN_DIR . "/$file", demo_source('1.0'));
  offer($slug, $file, '1.1', $good);
  $fresh = run_action($key, 'update_plugins', ['plugins' => 'outdated']);
  $valid = $fresh['rollback']['payload']['restorePoints'][0];
  $mixed = run_action($key, 'restore_plugins', ['restorePoints' => [$valid, str_repeat('b', 32)]], 'r');
  check($mixed['status'] === 'failed' && count($mixed['state']['restored']) === 1, 'an undo that misses any plugin reports failure, after restoring the rest');
  check(installed_version($file) === '1.0', 'the valid restore point was still applied');

  // ---------- guards ----------
  $self = run_action($key, 'update_plugins', ['plugins' => ['getsafe-360-ai/getsafe-360-ai.php']]);
  check($self['status'] === 'skipped', 'never updates the connector itself');
  check(run_action($key, 'restore_plugins', ['restorePoints' => ['../../wp-config']], 'x')['status'] === 'failed', 'rejects malformed restore point ids');
  check(run_action($key, 'restore_plugins', ['restorePoints' => [str_repeat('a', 32)]], 'x')['status'] === 'failed', 'rejects unknown restore points');

  offer($slug, $file, '9.9', '');
  $premium = run_action($key, 'update_plugins', ['plugins' => 'outdated']);
  check($premium['status'] === 'skipped' && $premium['state']['skipped'][0]['reason'] === 'no_package', 'skips updates without a download package');
  check(audit_plugins($key)['updatesWithoutPackage'] === 1, 'audit counts updates that need a licence');

  $cap = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
  $cap->set_header('X-API-Key', $key);
  check(!empty(rest_do_request($cap)->get_data()['capabilities']['pluginUpdates']), 'advertises pluginUpdates');
} finally {
  update_option('home', $old_home);
  update_option('siteurl', $old_siteurl);
  deactivate_plugins($file, true);
  delete_plugins([$file]);
  delete_site_transient('update_plugins');
  array_map('unlink', glob("$work/*.zip") ?: []);
  @rmdir($work);
}

exit($GLOBALS['fails'] ? 1 : 0);
