<?php
/**
 * Runs when the plugin is deleted from the Plugins screen: removes everything
 * it stored, so nothing of it is left on the site.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) exit;

foreach ([
  'getsafe360_connector',        // site ID and key from pairing
  'getsafe360_action_state',
  'getsafe360_fix_log',
  'getsafe360_seo_injections',
  'getsafe360_security_headers',
  'getsafe360_restore_points',
] as $getsafe360_option) {
  delete_option($getsafe360_option);
}

delete_transient('getsafe360_audit_scans');

// Cached official checksums, one transient per WordPress version and locale.
global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one-off cleanup of this plugin's own transients.
$getsafe360_transients = $wpdb->get_col($wpdb->prepare(
  "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s",
  $wpdb->esc_like('_transient_getsafe360_core_sums_') . '%'
));
foreach ($getsafe360_transients as $getsafe360_name) {
  delete_transient(substr($getsafe360_name, strlen('_transient_')));
}

// Restore points of plugin updates and core file repairs (the folder is only ours).
$getsafe360_dir = WP_CONTENT_DIR . '/getsafe360-backups';
if (is_dir($getsafe360_dir)) {
  require_once ABSPATH . 'wp-admin/includes/file.php';
  if (WP_Filesystem()) {
    global $wp_filesystem;
    $wp_filesystem->delete($getsafe360_dir, true);
  }
}
