<?php
// Runs after `wp plugin uninstall getsafe-360-ai`: nothing the plugin stored may be left.

// eval-file runs this file inside a function, so the counter must live in $GLOBALS.
$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

global $wpdb;
$left = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '%getsafe360%'");
check($left === [], 'no options or transients left: ' . implode(', ', $left));
check(!is_dir(WP_CONTENT_DIR . '/getsafe360-backups'), 'restore-point folder removed');
check(!is_dir(WP_PLUGIN_DIR . '/getsafe-360-ai'), 'plugin files removed');

exit($GLOBALS['fails'] ? 1 : 0);
