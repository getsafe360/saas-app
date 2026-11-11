<?php
// Runs inside WordPress via `wp eval-file`. Exercises the 1.7 connector actions
// against a real WordPress install: each change, what the audit then reports,
// and that the returned rollback restores the previous state.

// eval-file runs this file inside a function, so the counter must live in $GLOBALS.
$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
$key = hash('sha256', 'integration-token');

function run_action($key, $type, $payload, $id = 'test-action') {
  $req = new WP_REST_Request('POST', '/getsafe360/v1/actions');
  if ($key) $req->set_header('X-API-Key', $key);
  $req->set_header('Content-Type', 'application/json');
  $req->set_body(wp_json_encode(['actions' => [['id' => $id, 'type' => $type, 'payload' => $payload]]]));
  $res = rest_do_request($req);
  $data = $res->get_data();
  return $res->get_status() === 200 ? $data['results'][0] : ['status' => 'http-' . $res->get_status()];
}

function replay_rollback($key, $result) {
  $rb = $result['rollback'];
  // Round-trip through JSON exactly like the SaaS stores and replays it.
  $rb = json_decode(wp_json_encode($rb), true);
  return run_action($key, $rb['type'], $rb['payload'], $rb['id']);
}

function audit($key) {
  $req = new WP_REST_Request('GET', '/getsafe360/v1/audit');
  $req->set_header('X-API-Key', $key);
  return rest_do_request($req)->get_data();
}

// The connector instance WordPress loaded keeps a per-request state cache; each
// REST call below goes through that same instance, as in production.
wp_set_current_user(get_user_by('login', 'admin')->ID);

$denied = run_action(null, 'cleanup_database', ['task' => 'expired_transients'])['status'];
check(in_array($denied, ['http-401', 'http-403'], true), 'actions refuse requests without the key');

// ---------- file editor lock ----------
check(current_user_can('edit_plugins'), 'admin can edit plugin files before the lock');
$res = run_action($key, 'update_connector_setting', ['key' => 'disableFileEditor', 'enabled' => true]);
check($res['status'] === 'applied', 'file editor lock applies');
check(!current_user_can('edit_plugins') && !current_user_can('edit_themes'), 'admin can no longer edit plugin or theme files');
check(audit($key)['security']['fileEditDisabled'] === true, 'audit reports the file editor as disabled');
replay_rollback($key, $res);
check(current_user_can('edit_plugins'), 'rollback unlocks the file editor');

// ---------- core security updates ----------
add_filter('allow_minor_auto_core_updates', '__return_false', 10);
check(audit($key)['autoUpdates']['coreMinor'] === false, 'audit sees security updates switched off by a filter');
$res = run_action($key, 'update_connector_setting', ['key' => 'enableCoreSecurityUpdates', 'enabled' => true]);
check($res['status'] === 'applied', 'security updates switch applies');
check(audit($key)['autoUpdates']['coreMinor'] === true, 'audit reports security updates on');
replay_rollback($key, $res);
check(audit($key)['autoUpdates']['coreMinor'] === false, 'rollback restores the previous behaviour');
remove_filter('allow_minor_auto_core_updates', '__return_false', 10);

add_filter('automatic_updater_disabled', '__return_true');
$blocked = run_action($key, 'update_connector_setting', ['key' => 'enableCoreSecurityUpdates', 'enabled' => true]);
check($blocked['status'] === 'failed' && $blocked['rollback'] === null, 'refuses when the background updater is disabled');
check(audit($key)['autoUpdates']['updaterDisabled'] === true, 'audit reports the updater as disabled');
remove_filter('automatic_updater_disabled', '__return_true');

// ---------- default role ----------
update_option('users_can_register', 1);
update_option('default_role', 'administrator');
check(audit($key)['security']['defaultRoleIsAdmin'] === true, 'audit flags administrator as default role');
$res = run_action($key, 'set_default_role', ['role' => 'subscriber']);
check($res['status'] === 'applied' && get_option('default_role') === 'subscriber', 'default role becomes subscriber');
check($res['rollback'] === null, 'replacing an administrator default role cannot be undone');
check(run_action($key, 'set_default_role', ['role' => 'administrator'])['status'] === 'failed', 'refuses to make administrator the default role');
check(run_action($key, 'set_default_role', ['role' => 'editor'])['status'] === 'failed', 'refuses editor-level roles too');
check(get_option('default_role') === 'subscriber', 'refused requests change nothing');
update_option('default_role', 'author');
$res = run_action($key, 'set_default_role', ['role' => 'subscriber']);
replay_rollback($key, $res);
check(get_option('default_role') === 'author', 'rollback restores an unprivileged previous role');
update_option('users_can_register', 0);
update_option('default_role', 'subscriber');

// ---------- wp-config.php permissions ----------
$config = file_exists(ABSPATH . 'wp-config.php') ? ABSPATH . 'wp-config.php' : dirname(ABSPATH) . '/wp-config.php';
$original_mode = fileperms($config) & 0777;
chmod($config, 0644);
clearstatcache();
check(audit($key)['security']['wpConfigWorldReadable'] === true, 'audit flags a world-readable wp-config.php');
$res = run_action($key, 'set_config_permissions', ['mode' => 'tighten']);
clearstatcache();
check($res['status'] === 'applied' && (fileperms($config) & 0777) === 0640, 'tightens wp-config.php to 640');
check(audit($key)['security']['wpConfigWorldReadable'] === false, 'audit reports wp-config.php as private');
check(run_action($key, 'set_config_permissions', ['mode' => '0666'])['status'] === 'failed', 'refuses a world-writable mode');
replay_rollback($key, $res);
clearstatcache();
check((fileperms($config) & 0777) === 0644, 'rollback restores 644');
chmod($config, $original_mode);

// ---------- plugin auto-updates ----------
$before = get_site_option('auto_update_plugins', []);
$res = run_action($key, 'set_plugin_auto_updates', ['enable' => 'all']);
$au = audit($key)['autoUpdates'];
check($res['status'] === 'applied' && $au['pluginsEnabled'] === $au['pluginsTotal'] && $au['pluginsTotal'] > 0, 'turns on auto-updates for every installed plugin');
replay_rollback($key, $res);
check(get_site_option('auto_update_plugins', []) == $before, 'rollback restores the previous auto-update list');
check(run_action($key, 'set_plugin_auto_updates', ['plugins' => ['../../evil.php'], 'replace' => true])['status'] === 'applied'
  && get_site_option('auto_update_plugins', []) === [], 'drops invalid plugin paths');
update_site_option('auto_update_plugins', $before);

// ---------- database cleanup ----------
$post_id = wp_insert_post(['post_title' => 'Revision test', 'post_content' => 'v0', 'post_status' => 'publish']);
for ($i = 1; $i <= 8; $i++) {
  wp_update_post(['ID' => $post_id, 'post_content' => "v$i"]);
}
$audit = audit($key);
check($audit['database']['revisionsRemovable'] >= 3, 'audit counts revisions beyond the newest 5 per post');
$res = run_action($key, 'cleanup_database', ['task' => 'revisions']);
check($res['status'] === 'applied' && $res['rollback'] === null, 'revision cleanup applies and is final');
check(count(wp_get_post_revisions($post_id)) === 5, 'keeps the newest 5 revisions of the post');
check(audit($key)['database']['revisionsRemovable'] === 0, 'nothing left to remove');
$newest = array_values(wp_get_post_revisions($post_id))[0];
check($newest->post_content === 'v8', 'the newest revision survives');
wp_delete_post($post_id, true);

// Many revisions: more than one 500-row step, and a spent budget deletes nothing.
$big = wp_insert_post(['post_title' => 'Busy page', 'post_content' => 'v0', 'post_status' => 'publish', 'post_type' => 'page']);
for ($i = 1; $i <= 620; $i++) {
  $GLOBALS['wpdb']->update($GLOBALS['wpdb']->posts, ['post_content' => "v$i"], ['ID' => $big]);
  clean_post_cache($big);
  _wp_put_post_revision(get_post($big));
}
$connector = $GLOBALS['getsafe360_connector_instance'] ?? new GetSafe360_Connector();
$trim = new ReflectionMethod($connector, 'trim_revisions');
$trim->setAccessible(true);
$spent = $trim->invoke($connector, 5, microtime(true) - 1);
check($spent['deleted'] === 0 && $spent['remaining'] >= 615, 'a spent budget deletes nothing and reports what remains');
$res = run_action($key, 'cleanup_database', ['task' => 'revisions']);
check($res['status'] === 'applied' && count(wp_get_post_revisions($big)) === 5, 'clears hundreds of revisions in bounded steps, keeping 5');
check(strpos($res['message'], 'more remain') === false, 'reports nothing left over');
wp_delete_post($big, true);

for ($i = 0; $i < 3; $i++) {
  update_option("_transient_timeout_gs360_test_$i", time() - 3600, false);
  update_option("_transient_gs360_test_$i", 'stale', false);
}
check(audit($key)['database']['expiredTransients'] >= 3, 'audit counts expired transients');
$res = run_action($key, 'cleanup_database', ['task' => 'expired_transients']);
check($res['status'] === 'applied' && audit($key)['database']['expiredTransients'] === 0, 'removes expired transients');
check($GLOBALS['wpdb']->get_var("SELECT COUNT(*) FROM {$GLOBALS['wpdb']->options} WHERE option_name LIKE '\\_transient\\_gs360\\_test%'") === '0', 'the transient values are gone too');

check(run_action($key, 'cleanup_database', ['task' => 'everything'])['status'] === 'failed', 'rejects unknown cleanup tasks');
check(run_action($key, 'drop_tables', [])['status'] === 'skipped', 'skips unknown action types');

$cap = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
$cap->set_header('X-API-Key', $key);
$caps = rest_do_request($cap)->get_data()['capabilities'];
foreach (['securityDisableFileEditor', 'securityDefaultRole', 'securityConfigPermissions', 'autoUpdatesCore', 'autoUpdatesPlugins', 'databaseCleanup'] as $name) {
  check(!empty($caps[$name]), "advertises $name");
}

exit($GLOBALS['fails'] ? 1 : 0);
