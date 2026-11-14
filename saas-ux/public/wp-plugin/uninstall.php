<?php
/**
 * Runs when the plugin is deleted from the Plugins screen: removes everything
 * it stored, so nothing of it is left on the site.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) exit;

/** Removes this plugin's options and transients from the current site. */
function getsafe360_uninstall_site() {
  global $wpdb;
  foreach ([
    'getsafe360_connector',        // site ID and key from pairing
    'getsafe360_action_state',
    'getsafe360_fix_log',
    'getsafe360_seo_injections',
    'getsafe360_security_headers',
    'getsafe360_restore_points',
    'getsafe360_llms_txt',
    'getsafe360_ai_crawler_rules',
    'getsafe360_schema',
  ] as $option) {
    delete_option($option);
  }

  // Titles and descriptions the connector kept itself (those in Yoast or Rank Math fields stay theirs).
  delete_post_meta_by_key('_getsafe360_seo_title');
  delete_post_meta_by_key('_getsafe360_seo_description');

  delete_transient('getsafe360_audit_scans');

  // Cached official checksums, one transient per WordPress version and locale.
  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one-off cleanup of this plugin's own transients.
  $names = $wpdb->get_col($wpdb->prepare(
    "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s",
    $wpdb->esc_like('_transient_getsafe360_core_sums_') . '%'
  ));
  foreach ($names as $name) {
    delete_transient(substr($name, strlen('_transient_')));
  }
}

// On a network every site may have been connected on its own.
if (is_multisite()) {
  foreach (get_sites(['fields' => 'ids', 'number' => 0]) as $getsafe360_blog_id) {
    switch_to_blog($getsafe360_blog_id);
    getsafe360_uninstall_site();
    restore_current_blog();
  }
} else {
  getsafe360_uninstall_site();
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
