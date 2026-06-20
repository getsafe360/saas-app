<?php
/**
 * Plugin Name: GetSafe 360 AI Connector
 * Description: Secure connector between your WordPress site and GetSafe 360 AI for automated security scanning, performance monitoring, and AI-powered repairs.
 * Version: 1.4.0
 * Author: GetSafe 360 AI
 * Author URI: https://www.getsafe360.ai
 * License: GPL v2 or later
 * Requires at least: 5.0
 * Requires PHP: 7.2
 * Text Domain: getsafe360-connector
 * Domain Path: /languages
 * Update URI: https://www.getsafe360.ai
 */
/*
// saas-ux/public/wp-plugin/getsafe360-connector.php
// saas-ux/public/wp-plugin/getsafe360-connector.zip
*/

if (!defined('ABSPATH')) exit;

class GetSafe360_Connector {
  const VERSION = '1.4.0';
  const OPTION = 'getsafe360_connector';
  const ACTION_STATE_OPTION = 'getsafe360_action_state';
  const API_BASE = 'https://saasfly-one-psi.vercel.app';

  public function __construct() {
    load_plugin_textdomain('getsafe360-connector', false, dirname(plugin_basename(__FILE__)) . '/languages');
    add_action('admin_menu', [$this, 'menu']);
    add_action('rest_api_init', [$this, 'routes']);
    add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
    add_action('wp_head', [$this, 'output_seo_injections'], 5);
    add_filter('xmlrpc_enabled', [$this, 'filter_xmlrpc_enabled']);
    add_filter('rest_endpoints', [$this, 'filter_rest_endpoints']);
    add_action('template_redirect', [$this, 'block_author_enumeration']);
    add_filter('update_plugins_www.getsafe360.ai', [$this, 'check_for_update'], 10, 4);
    add_filter('plugins_api', [$this, 'plugin_api_info'], 10, 3);
    add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'action_links']);
    add_filter('pre_set_site_transient_update_plugins', [$this, 'register_for_updates']);
  }

  // ---------- helpers ----------

  private function str_ends_with($haystack, $needle) {
    $len = strlen($needle);
    if ($len === 0) return true;
    return (substr($haystack, -$len) === $needle);
  }

  private function mask($s, $keepStart = 6, $keepEnd = 2) {
    if (!$s) return '';
    $len = strlen($s);
    if ($len <= $keepStart + $keepEnd) return str_repeat('*', $len);
    return substr($s, 0, $keepStart) . str_repeat('*', max(0, $len - $keepStart - $keepEnd)) . substr($s, -$keepEnd);
  }

  private function api_headers() {
    $headers = [
      'Content-Type' => 'application/json',
      'Accept'       => 'application/json',
    ];

    // Add bypass header only for protected *.vercel.app previews AND when token is defined
    // This is only used for development/staging environments
    $host = parse_url(self::API_BASE, PHP_URL_HOST);
    if ($host && $this->str_ends_with($host, '.vercel.app') && defined('VERCEL_AUTOMATION_BYPASS_SECRET') && VERCEL_AUTOMATION_BYPASS_SECRET) {
      $headers['x-vercel-protection-bypass'] = VERCEL_AUTOMATION_BYPASS_SECRET;
    }
    return $headers;
  }

  private function get_action_state() {
    $defaults = [
      'disableXmlRpc' => false,
      'blockUserEnumeration' => false,
    ];

    $state = get_option(self::ACTION_STATE_OPTION, []);
    if (!is_array($state)) {
      return $defaults;
    }

    return array_merge($defaults, $state);
  }

  private function update_action_state($state) {
    update_option(self::ACTION_STATE_OPTION, $state, false);
    return $state;
  }

  private function render_notice($type, $title, $message = '', $debug = null) {
    // $type: success | error | warning | info
    $class = 'notice notice-' . $type;
    echo '<div class="' . esc_attr($class) . '"><p><strong>' . esc_html($title) . '</strong>';
    if ($message) echo ' — ' . esc_html($message);
    echo '</p>';

    if ($debug && (defined('WP_DEBUG') && WP_DEBUG)) {
      echo '<details style="margin: 8px 0;"><summary>' . esc_html__('Debug Information', 'getsafe360-connector') . '</summary>';
      echo '<pre style="white-space: pre-wrap; font-size: 11px; background:#f6f7f7; padding:8px; border:1px solid #ccd0d4; overflow:auto;">';
      echo esc_html(wp_json_encode($debug, JSON_PRETTY_PRINT));
      echo '</pre></details>';
    }
    echo '</div>';
  }

  /** Returns a base64 data-URI of the GetSafe 360 AI brand icon (blue, single-path). */
  private function svg_icon_base64() {
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 287 282"><path fill="currentColor" fill-rule="evenodd" d="M 137.5 56.9 C 124.7 60.4 110.9 68.4 105.7 75.3 C 99.3 83.9 91.9 98.0 87.5 110.2 C 85.8 114.8 85.8 114.8 81.0 111.4 C 78.4 109.5 74.5 107.4 72.4 106.6 C 68.6 105.3 68.6 105.3 83.2 90.9 C 97.8 76.5 97.8 76.5 98.4 70 C 98.8 66.4 99.3 62.0 99.7 60.3 C 100.2 57 100.2 57 60.3 57 C 15.7 57 19.4 55.3 17.4 76.8 C 16.7 84.2 16.7 84.2 37.1 83.8 C 57.5 83.5 57.5 83.5 46 94.8 C 25.9 114.6 26.3 113.9 29.0 122.6 C 31.4 130 31.4 130 37.8 130 C 55.5 130 64.7 136.6 60.6 146.4 C 56.0 157.4 37.1 158.6 23.4 148.8 C 20.4 146.6 17.5 145.2 17.0 145.6 C 2.4 161.5 -1.1 168.8 3.8 173.0 C 27.3 193.2 69.4 187.8 86.0 162.5 C 87.8 159.7 87.8 159.7 89.3 163.1 C 101.0 190.6 145.5 192.4 168.6 166.4 C 170.8 163.9 170.8 163.9 173.3 168.3 C 185.8 189.5 221.0 191.5 241.3 172.2 C 267.3 147.3 273.3 80.7 251.1 63.1 C 221.8 39.9 182.7 60.4 170.5 105.3 C 168.9 111.1 168.9 111.1 165.2 107.9 C 156.3 100.0 139.6 97.0 128.3 101.3 C 123.1 103.2 123.1 103.0 127.5 97.0 C 135.7 85.8 149.8 81.4 163.9 85.6 C 166.8 86.4 169.4 86.9 169.7 86.6 C 171.2 85.1 181.0 61.4 180.6 60.3 C 178.8 55.8 149.8 53.5 137.5 56.9 M 282.9 57.1 C 277.8 61.1 269.2 61.6 262.8 58.3 C 259.3 56.6 259.3 57.4 262.6 61.2 C 268.2 68.0 274 84.1 274 93.2 C 274 102.0 279.5 90.0 284.6 70.1 C 288.3 55.9 287.9 53.2 282.9 57.1 M 214.3 85.9 C 202.3 93.2 194.8 143.7 204.2 153.7 C 216.0 166.3 230.2 143.6 231.7 109.5 C 232.7 87.5 226.2 78.7 214.3 85.9 M 120.3 126.5 C 108.8 131.5 117.9 156.0 131.3 156.0 C 136.0 156.0 144.9 147.8 145.2 143.2 C 146.2 128.5 134.2 120.4 120.3 126.5 M 173 196.1 C 87.6 276.5 4.5 276.3 21.6 195.8 C 23.1 188.8 19.8 193.9 17.0 202.8 C -15.1 306.3 90.4 308.5 195.8 206.6 C 207.8 194.9 207.6 195.5 200.0 194.7 C 194.9 194.1 188.6 192.4 182 189.7 C 181.0 189.3 177.9 191.5 173 196.1"/></svg>';
    return 'data:image/svg+xml;base64,' . base64_encode($svg);
  }

  // ---------- admin UI ----------

  public function menu() {
    add_menu_page(
      'GetSafe 360 AI',
      'GetSafe 360 AI',
      'manage_options',
      'getsafe360',
      [$this, 'admin_page'],
      $this->svg_icon_base64(),
      80
    );
  }

  /** Add "View details" and "Settings" to the plugins list action links. */
  public function action_links($links) {
    $details_url = admin_url('plugin-install.php?tab=plugin-information&plugin=getsafe360-connector&TB_iframe=true&width=620&height=560');
    $detail_link = '<a href="' . esc_url($details_url) . '" class="thickbox open-plugin-details-modal">' . esc_html__('View details', 'getsafe360-connector') . '</a>';
    $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=getsafe360')) . '">' . esc_html__('Settings', 'getsafe360-connector') . '</a>';
    array_unshift($links, $detail_link, $settings_link);
    return $links;
  }

  /**
   * Ensure this plugin appears in the update_plugins transient so WordPress
   * always shows the auto-update toggle, even when no update is pending.
   */
  public function register_for_updates($transient) {
    if (!is_object($transient)) $transient = new \stdClass();
    $plugin_file = plugin_basename(__FILE__);
    if (!isset($transient->checked)) $transient->checked = [];
    if (!isset($transient->checked[$plugin_file])) {
      $transient->checked[$plugin_file] = self::VERSION;
    }
    return $transient;
  }

  public function enqueue_admin_assets($hook) {
    // Only load on our admin page
    if ($hook !== 'toplevel_page_getsafe360') return;

    // Inline styles for better UX
    $custom_css = "
      .getsafe360-container { max-width: 800px; }
      .getsafe360-card { background: #fff; border: 1px solid #ccd0d4; border-radius: 4px; padding: 20px; margin: 20px 0; }
      .getsafe360-status { display: inline-block; padding: 4px 12px; border-radius: 3px; font-size: 13px; font-weight: 600; }
      .getsafe360-status.connected { background: #d4edda; color: #155724; }
      .getsafe360-status.disconnected { background: #f8d7da; color: #721c24; }
      .getsafe360-code-input { width: 250px; font-size: 24px; letter-spacing: 8px; text-align: center; padding: 12px; font-family: monospace; }
      .getsafe360-help { background: #e7f3ff; border-left: 4px solid #0073aa; padding: 12px; margin: 12px 0; }
      .getsafe360-btn-primary { background: #0073aa; color: #fff; border: none; padding: 12px 24px; font-size: 14px; border-radius: 3px; cursor: pointer; }
      .getsafe360-btn-primary:hover { background: #005a87; }
      .getsafe360-btn-danger { background: #dc3545; color: #fff; border: none; padding: 8px 16px; font-size: 13px; border-radius: 3px; cursor: pointer; }
      .getsafe360-btn-danger:hover { background: #c82333; }
      .getsafe360-disconnect-confirm { display: none; background: #fff3cd; border: 1px solid #ffc107; padding: 12px; margin-top: 10px; border-radius: 3px; }
      .getsafe360-deeplink-notice { background: #e8f4e8; border-left: 4px solid #46b450; padding: 10px 14px; margin: 0 0 16px; border-radius: 0 3px 3px 0; font-size: 13px; }
    ";
    wp_add_inline_style('wp-admin', $custom_css);
  }

  public function admin_page() {
    // Handle disconnect
    if (isset($_POST['disconnect']) && check_admin_referer('getsafe360_disconnect')) {
      delete_option(self::OPTION);
      $this->render_notice('success', __('Disconnected', 'getsafe360-connector'), __('Your site is no longer linked to GetSafe 360. You can reconnect anytime.', 'getsafe360-connector'));
    }

    // Handle connect
    if (isset($_POST['pair_code']) && check_admin_referer('getsafe360_connect')) {
      $pair_code = sanitize_text_field($_POST['pair_code']);
      $site_url = get_site_url();
      $payload = [
        'pairCode'      => $pair_code,
        'siteUrl'       => $site_url,
        'wpVersion'     => get_bloginfo('version'),
        'pluginVersion' => self::VERSION
      ];

      $endpoint = trailingslashit(self::API_BASE) . 'api/connect/handshake';
      $headers  = $this->api_headers();

      $resp = wp_remote_post($endpoint, [
        'headers'   => $headers,
        'body'      => wp_json_encode($payload),
        'timeout'   => 20,
        'sslverify' => true,
      ]);

      // Build debug context
      $debug = [
        'api_base'   => self::API_BASE,
        'endpoint'   => $endpoint,
        'payload'    => $payload,
        'plugin_version' => self::VERSION,
      ];

      if (is_wp_error($resp)) {
        $error_message = $resp->get_error_message();

        // User-friendly error messages
        if (strpos($error_message, 'timed out') !== false) {
          $user_message = __('Connection timed out. Please check your internet connection and try again.', 'getsafe360-connector');
        } else if (strpos($error_message, 'SSL') !== false) {
          $user_message = __('SSL certificate verification failed. Your site may need updated SSL certificates.', 'getsafe360-connector');
        } else {
          $user_message = $error_message;
        }

        $this->render_notice('error', __('Connection Failed', 'getsafe360-connector'), $user_message, array_merge($debug, ['wp_error' => $resp->get_error_data()]));
      } else {
        $code      = wp_remote_retrieve_response_code($resp);
        $body_raw  = wp_remote_retrieve_body($resp);
        $body_json = json_decode($body_raw, true);

        $debug = array_merge($debug, [
          'http_code'      => $code,
          'response_body'  => is_array($body_json) ? $body_json : $body_raw,
        ]);

        if ($code === 200 && is_array($body_json) && isset($body_json['siteToken'])) {
          update_option(self::OPTION, [
            'site_id'      => sanitize_text_field($body_json['siteId']),
            'site_token'   => sanitize_text_field($body_json['siteToken']),
            'connected_at' => time(),
            'wp_version'   => get_bloginfo('version'),
            'plugin_version' => self::VERSION,
          ], false);

          $this->render_notice('success', __('Successfully Connected!', 'getsafe360-connector'), __('Your WordPress site is now linked to GetSafe 360 AI. You can now run security scans and performance checks from your dashboard.', 'getsafe360-connector'), $debug);
        } else {
          // User-friendly error messages based on server response
          $server_error = is_array($body_json) && isset($body_json['error']) ? $body_json['error'] : 'Handshake error';

          $user_message = '';
          if (strpos($server_error, 'invalid_or_expired') !== false || strpos($server_error, 'code_expired') !== false) {
            $user_message = __('This pairing code has expired. Please generate a new code from your GetSafe 360 AI dashboard.', 'getsafe360-connector');
          } else if (strpos($server_error, 'already_used') !== false) {
            $user_message = __('This pairing code has already been used. Please generate a new code from your GetSafe 360 AI dashboard.', 'getsafe360-connector');
          } else {
            $user_message = $server_error;
          }

          $this->render_notice('error', __('Connection Failed', 'getsafe360-connector'), $user_message, $debug);
        }
      }
    }

    $opt = get_option(self::OPTION, []);
    $is_connected = !empty($opt['site_token']);

    // Deep-link: pre-fill pairing code when arriving via a GetSafe 360 AI deep link.
    // The SaaS dashboard can append ?gs360_code=XXXXXX to the WP admin URL so the
    // code is already filled in — users just click Connect without any copy-paste.
    $prefill_code = '';
    if (!$is_connected && isset($_GET['gs360_code'])) {
      $prefill_code = preg_replace('/[^0-9]/', '', sanitize_text_field($_GET['gs360_code']));
      if (strlen($prefill_code) === 6) {
        echo '<div class="getsafe360-deeplink-notice">✓ ' . esc_html__('Pairing code filled in from GetSafe 360 AI — just click Connect.', 'getsafe360-connector') . '</div>';
      } else {
        $prefill_code = '';
      }
    }
    ?>
      <div class="wrap getsafe360-container">
        <h1 style="display: flex; align-items: center; gap: 12px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 287 282" aria-hidden="true">
            <path fill="#167dc4" fill-rule="evenodd" d="M 137.5 56.9 C 124.7 60.4 110.9 68.4 105.7 75.3 C 99.3 83.9 91.9 98.0 87.5 110.2 C 85.8 114.8 85.8 114.8 81.0 111.4 C 78.4 109.5 74.5 107.4 72.4 106.6 C 68.6 105.3 68.6 105.3 83.2 90.9 C 97.8 76.5 97.8 76.5 98.4 70 C 98.8 66.4 99.3 62.0 99.7 60.3 C 100.2 57 100.2 57 60.3 57 C 15.7 57 19.4 55.3 17.4 76.8 C 16.7 84.2 16.7 84.2 37.1 83.8 C 57.5 83.5 57.5 83.5 46 94.8 C 25.9 114.6 26.3 113.9 29.0 122.6 C 31.4 130 31.4 130 37.8 130 C 55.5 130 64.7 136.6 60.6 146.4 C 56.0 157.4 37.1 158.6 23.4 148.8 C 20.4 146.6 17.5 145.2 17.0 145.6 C 2.4 161.5 -1.1 168.8 3.8 173.0 C 27.3 193.2 69.4 187.8 86.0 162.5 C 87.8 159.7 87.8 159.7 89.3 163.1 C 101.0 190.6 145.5 192.4 168.6 166.4 C 170.8 163.9 170.8 163.9 173.3 168.3 C 185.8 189.5 221.0 191.5 241.3 172.2 C 267.3 147.3 273.3 80.7 251.1 63.1 C 221.8 39.9 182.7 60.4 170.5 105.3 C 168.9 111.1 168.9 111.1 165.2 107.9 C 156.3 100.0 139.6 97.0 128.3 101.3 C 123.1 103.2 123.1 103.0 127.5 97.0 C 135.7 85.8 149.8 81.4 163.9 85.6 C 166.8 86.4 169.4 86.9 169.7 86.6 C 171.2 85.1 181.0 61.4 180.6 60.3 C 178.8 55.8 149.8 53.5 137.5 56.9 M 282.9 57.1 C 277.8 61.1 269.2 61.6 262.8 58.3 C 259.3 56.6 259.3 57.4 262.6 61.2 C 268.2 68.0 274 84.1 274 93.2 C 274 102.0 279.5 90.0 284.6 70.1 C 288.3 55.9 287.9 53.2 282.9 57.1 M 214.3 85.9 C 202.3 93.2 194.8 143.7 204.2 153.7 C 216.0 166.3 230.2 143.6 231.7 109.5 C 232.7 87.5 226.2 78.7 214.3 85.9 M 120.3 126.5 C 108.8 131.5 117.9 156.0 131.3 156.0 C 136.0 156.0 144.9 147.8 145.2 143.2 C 146.2 128.5 134.2 120.4 120.3 126.5 M 173 196.1 C 87.6 276.5 4.5 276.3 21.6 195.8 C 23.1 188.8 19.8 193.9 17.0 202.8 C -15.1 306.3 90.4 308.5 195.8 206.6 C 207.8 194.9 207.6 195.5 200.0 194.7 C 194.9 194.1 188.6 192.4 182 189.7 C 181.0 189.3 177.9 191.5 173 196.1"/>
            <path fill="#cc3300" fill-rule="evenodd" d="M 266.6 26.0 C 257.5 28.9 253.4 43.0 259.8 49.8 C 270.2 61.1 287.0 55.4 287.0 40.6 C 287.0 29.8 277.1 22.7 266.6 26.0"/>
          </svg>
          <?php esc_html_e('GetSafe 360 AI Connector', 'getsafe360-connector'); ?>
        </h1>
        <p><?php printf(esc_html__('Version %s', 'getsafe360-connector'), esc_html(self::VERSION)); ?></p>

        <?php if (!$is_connected): ?>
          <!-- NOT CONNECTED STATE -->
          <div class="getsafe360-card">
            <h2><?php esc_html_e('Connect Your WordPress Site', 'getsafe360-connector'); ?></h2>
            <p><?php esc_html_e('Link this WordPress site to your GetSafe 360 AI dashboard for automated security scanning, performance monitoring, and AI-powered site repairs.', 'getsafe360-connector'); ?></p>

            <div class="getsafe360-help">
              <strong><?php esc_html_e('How to connect:', 'getsafe360-connector'); ?></strong>
              <ol style="margin: 8px 0 0 20px;">
                <li><?php printf(
                  __('Log in to your %1$sGetSafe 360 AI dashboard%2$s', 'getsafe360-connector'),
                  '<strong>', '</strong>'
                ); ?></li>
                <li><?php printf(
                  __('Click %1$s"Add Site"%2$s or %3$s"Generate Pairing Code"%4$s', 'getsafe360-connector'),
                  '<strong>', '</strong>', '<strong>', '</strong>'
                ); ?></li>
                <li><?php printf(
                  __('Copy the %1$s6-digit code%2$s', 'getsafe360-connector'),
                  '<strong>', '</strong>'
                ); ?></li>
                <li><?php printf(
                  __('Paste it below and click %1$s"Connect"%2$s', 'getsafe360-connector'),
                  '<strong>', '</strong>'
                ); ?></li>
              </ol>
            </div>

            <form method="post" style="margin-top: 20px;">
              <?php wp_nonce_field('getsafe360_connect'); ?>
              <p><label for="pair_code"><strong><?php esc_html_e('Enter Pairing Code:', 'getsafe360-connector'); ?></strong></label></p>
              <p>
                <input
                  type="text"
                  name="pair_code"
                  id="pair_code"
                  class="getsafe360-code-input"
                  placeholder="000000"
                  maxlength="6"
                  pattern="\d{6}"
                  required
                  autocomplete="off"
                  value="<?php echo esc_attr($prefill_code); ?>"
                  <?php if ($prefill_code): ?> autofocus<?php endif; ?>
                />
              </p>
              <p>
                <button type="submit" class="getsafe360-btn-primary">
                  <span class="dashicons dashicons-admin-links" style="margin-top: 4px;"></span>
                  <?php esc_html_e('Connect to GetSafe 360 AI', 'getsafe360-connector'); ?>
                </button>
              </p>
            </form>

            <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd; color: #666; font-size: 13px;">
              <?php printf(
                esc_html__('Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s', 'getsafe360-connector'),
                '<code>' . esc_html(get_site_url()) . '</code>'
              ); ?>
            </p>
          </div>

        <?php else: ?>
          <!-- CONNECTED STATE -->
          <div class="getsafe360-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <h2 style="margin: 0;"><?php esc_html_e('Connection Status', 'getsafe360-connector'); ?></h2>
                <p style="margin: 8px 0 0 0;">
                  <span class="getsafe360-status connected">
                    <span class="dashicons dashicons-yes-alt" style="margin-top: 2px;"></span>
                    <?php esc_html_e('Connected', 'getsafe360-connector'); ?>
                  </span>
                </p>
              </div>
            </div>

            <table class="form-table" role="presentation">
              <tbody>
                <tr>
                  <th scope="row"><?php esc_html_e('Site ID', 'getsafe360-connector'); ?></th>
                  <td><code><?php echo esc_html($opt['site_id']); ?></code></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Connected Since', 'getsafe360-connector'); ?></th>
                  <td><?php
                    /* translators: PHP date format for "connected since" display. See https://www.php.net/date */
                    echo esc_html(wp_date(__('F j, Y \a\t g:i a', 'getsafe360-connector'), $opt['connected_at']));
                  ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('WordPress Version', 'getsafe360-connector'); ?></th>
                  <td><?php echo esc_html(get_bloginfo('version')); ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Plugin Version', 'getsafe360-connector'); ?></th>
                  <td><?php echo esc_html(self::VERSION); ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Site URL', 'getsafe360-connector'); ?></th>
                  <td><code><?php echo esc_html(get_site_url()); ?></code></td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <button
                type="button"
                class="getsafe360-btn-danger"
                onclick="document.getElementById('disconnect-confirm').style.display='block'; this.style.display='none';"
              >
                <span class="dashicons dashicons-dismiss" style="margin-top: 2px;"></span>
                <?php esc_html_e('Disconnect Site', 'getsafe360-connector'); ?>
              </button>

              <div id="disconnect-confirm" class="getsafe360-disconnect-confirm">
                <p><strong>⚠️ <?php esc_html_e('Are you sure?', 'getsafe360-connector'); ?></strong></p>
                <p><?php esc_html_e('Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code.', 'getsafe360-connector'); ?></p>
                <form method="post" style="display: inline-block; margin-right: 8px;">
                  <?php wp_nonce_field('getsafe360_disconnect'); ?>
                  <input type="hidden" name="disconnect" value="1" />
                  <button type="submit" class="getsafe360-btn-danger">
                    <?php esc_html_e('Yes, Disconnect', 'getsafe360-connector'); ?>
                  </button>
                </form>
                <button
                  type="button"
                  class="button"
                  onclick="document.getElementById('disconnect-confirm').style.display='none'; document.querySelector('.getsafe360-btn-danger').style.display='inline-block';"
                >
                  <?php esc_html_e('Cancel', 'getsafe360-connector'); ?>
                </button>
              </div>
            </div>
          </div>

          <div class="getsafe360-help" style="margin-top: 20px;">
            <strong>✨ <?php esc_html_e("What's Next?", 'getsafe360-connector'); ?></strong>
            <ul style="margin: 8px 0 0 20px;">
              <li><?php printf(
                __('Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans', 'getsafe360-connector'),
                '<strong>', '</strong>'
              ); ?></li>
              <li><?php printf(
                __('Enable %1$sAI-powered automatic repairs%2$s for common issues', 'getsafe360-connector'),
                '<strong>', '</strong>'
              ); ?></li>
              <li><?php printf(
                __('Set up %1$sscheduled scans%2$s to monitor your site 24/7', 'getsafe360-connector'),
                '<strong>', '</strong>'
              ); ?></li>
              <li><?php printf(
                __('View detailed %1$sperformance reports%2$s and recommendations', 'getsafe360-connector'),
                '<strong>', '</strong>'
              ); ?></li>
            </ul>
          </div>
        <?php endif; ?>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>
            <strong><?php esc_html_e('Need Help?', 'getsafe360-connector'); ?></strong>
            <?php printf(
              __('Visit our %1$sdocumentation%2$s or %3$scontact support%4$s.', 'getsafe360-connector'),
              '<a href="https://www.getsafe360.ai/docs/wordpress-connector" target="_blank">',
              '</a>',
              '<a href="https://www.getsafe360.ai/support" target="_blank">',
              '</a>'
            ); ?>
          </p>
        </div>
      </div>
    <?php
  }

  // ---------- REST routes ----------

  public function filter_xmlrpc_enabled($enabled) {
    $state = $this->get_action_state();
    if (!empty($state['disableXmlRpc'])) {
      return false;
    }

    return $enabled;
  }

  public function filter_rest_endpoints($endpoints) {
    $state = $this->get_action_state();
    if (empty($state['blockUserEnumeration']) || !is_array($endpoints)) {
      return $endpoints;
    }

    $keys_to_remove = [
      '/wp/v2/users',
      '/wp/v2/users/(?P<id>[\d]+)',
    ];

    foreach ($keys_to_remove as $key) {
      if (isset($endpoints[$key])) {
        unset($endpoints[$key]);
      }
    }

    return $endpoints;
  }

  public function block_author_enumeration() {
    $state = $this->get_action_state();
    if (empty($state['blockUserEnumeration'])) {
      return;
    }

    $author_probe = isset($_GET['author']) ? sanitize_text_field($_GET['author']) : '';
    if ($author_probe !== '' && ctype_digit($author_probe)) {
      status_header(403);
      nocache_headers();
      wp_die(
        esc_html__('Author enumeration blocked by GetSafe 360 AI.', 'getsafe360-connector'),
        esc_html__('Forbidden', 'getsafe360-connector'),
        ['response' => 403]
      );
    }
  }

  public function routes() {
    // Ping endpoint - check if plugin is installed
    register_rest_route('getsafe360/v1', '/ping', [
      'methods' => 'GET',
      'callback' => function() {
        return [
          'pong' => true,
          'version' => self::VERSION,
          'site' => get_site_url()
        ];
      },
      'permission_callback' => '__return_true'
    ]);

    // Status endpoint - get WordPress and plugin info (requires auth)
    register_rest_route('getsafe360/v1', '/status', [
      'methods' => 'GET',
      'callback' => [$this, 'route_status'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Push endpoint - receive data from SaaS platform
    register_rest_route('getsafe360/v1', '/push', [
      'methods' => 'POST',
      'callback' => [$this, 'route_push'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Pull endpoint - send data to SaaS platform
    register_rest_route('getsafe360/v1', '/pull', [
      'methods' => 'GET',
      'callback' => [$this, 'route_pull'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Fixes list endpoint - list all applied fixes
    register_rest_route('getsafe360/v1', '/fixes', [
      'methods' => 'GET',
      'callback' => [$this, 'route_list_fixes'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Fix delete endpoint - remove a specific fix by ID (rollback support)
    register_rest_route('getsafe360/v1', '/fixes/(?P<id>[a-zA-Z0-9_\-]+)', [
      'methods' => 'DELETE',
      'callback' => [$this, 'route_delete_fix'],
      'permission_callback' => [$this, 'auth_api_key'],
      'args' => [
        'id' => [
          'required'          => true,
          'sanitize_callback' => 'sanitize_text_field',
        ],
      ],
    ]);

    // Capabilities endpoint - report what this plugin version can do
    register_rest_route('getsafe360/v1', '/capabilities', [
      'methods' => 'GET',
      'callback' => [$this, 'route_capabilities'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Actions endpoint - apply allowlisted connector-native mutations
    register_rest_route('getsafe360/v1', '/actions', [
      'methods' => 'POST',
      'callback' => [$this, 'route_actions'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);
  }

  // Updated authentication to use X-API-Key header (matches new WordPress client)
  public function auth_api_key(\WP_REST_Request $req) {
    $opt = get_option(self::OPTION, []);

    // Check for token in site_token field
    if (empty($opt['site_token'])) {
      return false;
    }

    // Get API key from header (X-API-Key)
    $api_key = $req->get_header('X-API-Key');

    // Also support Bearer token for backward compatibility
    if (!$api_key) {
      $auth_header = $req->get_header('authorization');
      if ($auth_header && stripos($auth_header, 'Bearer ') === 0) {
        $api_key = substr($auth_header, 7);
      }
    }

    if (!$api_key) {
      return false;
    }

    // The API key from the SaaS platform is the SHA256 hash of the site_token
    // So we hash our stored token and compare
    $stored_token_hash = hash('sha256', $opt['site_token']);
    return hash_equals($stored_token_hash, $api_key);
  }

  public function route_status(\WP_REST_Request $req) {
    return [
      'connected' => true,
      'version' => get_bloginfo('version'),
      'pluginVersion' => self::VERSION,
      'timestamp' => current_time('mysql'),
      'siteUrl' => get_site_url(),
    ];
  }

  /**
   * Receive elaborated SEO fixes from the GetSafe 360 AI platform and apply them.
   *
   * Each fix has:
   *   id        – UUID of the aiRepairAction row
   *   title     – human-readable issue title
   *   section   – SEO section slug (technical-seo, llms-txt, …)
   *   fixType   – code | config | content | manual
   *   snippet   – ready-to-paste HTML/JSON-LD (present when fixType is code/config)
   *   summary   – one-sentence description
   *   steps     – array of implementation steps
   *
   * For fixType=code/config fixes that have a snippet the plugin injects the
   * snippet into <head> via the getsafe360_seo_injections option (keyed by fix id).
   * Manual and content fixes are stored for review only.
   */
  public function route_push(\WP_REST_Request $req) {
    $payload   = $req->get_json_params();
    $fixes     = isset($payload['fixes']) && is_array($payload['fixes']) ? $payload['fixes'] : [];

    $applied   = [];
    $skipped   = [];

    // Load existing injections so we can merge without wiping earlier fixes
    $injections = get_option('getsafe360_seo_injections', []);
    // Log of all received fixes (for admin review / rollback)
    $fix_log = get_option('getsafe360_fix_log', []);

    foreach ($fixes as $fix) {
      if (!is_array($fix) || empty($fix['id'])) continue;

      $fix_id   = sanitize_text_field($fix['id']);
      $fix_type = isset($fix['fixType']) ? sanitize_text_field($fix['fixType']) : 'manual';
      $snippet  = isset($fix['snippet']) ? $fix['snippet'] : '';

      // Record every received fix for review
      $fix_log[$fix_id] = [
        'title'    => isset($fix['title'])   ? sanitize_text_field($fix['title'])   : '',
        'section'  => isset($fix['section']) ? sanitize_text_field($fix['section']) : '',
        'fixType'  => $fix_type,
        'summary'  => isset($fix['summary']) ? sanitize_text_field($fix['summary']) : '',
        'appliedAt'=> current_time('mysql'),
        'status'   => 'skipped',
      ];

      if (($fix_type === 'code' || $fix_type === 'config') && !empty($snippet)) {
        // Defense-in-depth: reject non-head content that must never appear in <head>.
        // The SaaS layer should already filter these out, but verify here as well.
        $is_robots_directive = (strpos($snippet, 'User-agent:') !== false && (strpos($snippet, 'Allow:') !== false || strpos($snippet, 'Disallow:') !== false));
        $is_htaccess         = (strpos($snippet, 'ServerTokens') !== false || strpos($snippet, 'Order Deny') !== false || strpos($snippet, 'Header unset') !== false || strpos($snippet, '<Files') !== false);
        $is_llms_txt         = (substr(ltrim($snippet), 0, 1) === '#' && (strpos($snippet, 'Canonical') !== false || strpos($snippet, 'Attribution') !== false || strpos($snippet, 'User-agent') !== false));

        if ($is_robots_directive || $is_htaccess || $is_llms_txt) {
          $fix_log[$fix_id]['status']      = 'skipped';
          $fix_log[$fix_id]['skip_reason'] = 'non-head content blocked by connector';
          $skipped[] = $fix_id;
        } else {
          // Strip any PHP tags and only allow HTML / JSON-LD content for safety.
          // wp_kses strips <script> entirely; JSON-LD is handled via regex below.
          $safe_snippet = wp_kses($snippet, [
            'meta' => ['name' => [], 'property' => [], 'content' => [], 'charset' => [], 'http-equiv' => []],
            'link' => ['rel' => [], 'href' => [], 'type' => [], 'sizes' => []],
          ]);

          // Extract JSON-LD <script> blocks from the original (wp_kses removes them).
          $jsonld_blocks = [];
          preg_match_all(
            '/<script\s[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>.*?<\/script>/is',
            $snippet,
            $jsonld_blocks
          );
          if (!empty($jsonld_blocks[0])) {
            $safe_snippet = trim($safe_snippet . "\n" . implode("\n", $jsonld_blocks[0]));
          }

          // After sanitisation, a non-empty result means we have valid head content.
          if (!empty(trim($safe_snippet))) {
            $injections[$fix_id]  = $safe_snippet;
            $fix_log[$fix_id]['status'] = 'applied';
            $applied[] = $fix_id;
          } else {
            $skipped[] = $fix_id;
          }
        }
      } else {
        $skipped[] = $fix_id;
      }
    }

    update_option('getsafe360_seo_injections', $injections);
    update_option('getsafe360_fix_log', $fix_log);

    return [
      'success'    => true,
      'applied'    => count($applied),
      'skipped'    => count($skipped),
      'appliedIds' => $applied,
    ];
  }

  /**
   * Output all stored SEO injections inside <head>.
   * Hooked to wp_head with priority 5 so they appear early.
   */
  public function output_seo_injections() {
    $injections = get_option('getsafe360_seo_injections', []);
    if (empty($injections)) return;

    echo "\n<!-- GetSafe360 SEO fixes -->\n";
    foreach ($injections as $id => $snippet) {
      $safe_id = esc_attr($id);
      echo "<!-- fix:{$safe_id} -->\n" . $snippet . "\n";
    }
    echo "<!-- /GetSafe360 SEO fixes -->\n";
  }

  public function route_pull(\WP_REST_Request $req) {
    // Send site data to SaaS platform
    return [
      'success' => true,
      'wpVersion' => get_bloginfo('version'),
      'pluginVersion' => self::VERSION,
      'plugins' => get_option('active_plugins', []),
      'theme' => wp_get_theme()->get('Name'),
      'phpVersion' => PHP_VERSION,
      'mysqlVersion' => $GLOBALS['wpdb']->db_version(),
      'siteUrl' => get_site_url(),
      'timestamp' => current_time('mysql'),
      'protections' => $this->get_action_state(),
    ];
  }

  /**
   * POST /wp-json/getsafe360/v1/actions
   * Applies allowlisted connector-native actions with rollback metadata.
   */
  public function route_actions(\WP_REST_Request $req) {
    $payload = $req->get_json_params();
    $actions = isset($payload['actions']) && is_array($payload['actions']) ? $payload['actions'] : [];
    $state = $this->get_action_state();
    $results = [];

    foreach ($actions as $action) {
      if (!is_array($action) || empty($action['id']) || empty($action['type'])) {
        continue;
      }

      $action_id = sanitize_text_field($action['id']);
      $action_type = sanitize_text_field($action['type']);

      if ($action_type !== 'update_connector_setting') {
        $results[] = [
          'id' => $action_id,
          'type' => $action_type,
          'status' => 'skipped',
          'message' => 'Unsupported action type.',
          'state' => $state,
          'rollback' => null,
        ];
        continue;
      }

      $setting = isset($action['payload']) && is_array($action['payload']) ? $action['payload'] : [];
      $key = isset($setting['key']) ? sanitize_text_field($setting['key']) : '';
      $enabled = isset($setting['enabled']) ? (bool) $setting['enabled'] : true;

      if (!in_array($key, ['disableXmlRpc', 'blockUserEnumeration'], true)) {
        $results[] = [
          'id' => $action_id,
          'type' => $action_type,
          'status' => 'skipped',
          'message' => 'Unsupported connector setting.',
          'state' => $state,
          'rollback' => null,
        ];
        continue;
      }

      $previous = !empty($state[$key]);
      $state[$key] = $enabled;
      $this->update_action_state($state);

      $label = $key === 'disableXmlRpc'
        ? 'XML-RPC protection'
        : 'user enumeration protection';

      $results[] = [
        'id' => $action_id,
        'type' => $action_type,
        'status' => 'applied',
        'message' => sprintf('%s %s.', $label, $enabled ? 'enabled' : 'disabled'),
        'state' => $state,
        'rollback' => [
          'id' => $action_id . '-rollback',
          'type' => 'update_connector_setting',
          'payload' => [
            'key' => $key,
            'enabled' => $previous,
          ],
        ],
      ];
    }

    return [
      'success' => true,
      'results' => $results,
    ];
  }

  /**
   * GET /wp-json/getsafe360/v1/fixes
   * Lists all applied fix IDs with their snippets and metadata.
   */
  public function route_list_fixes(\WP_REST_Request $req) {
    $injections = get_option('getsafe360_seo_injections', []);
    $fix_log    = get_option('getsafe360_fix_log', []);

    $fixes = [];
    foreach ($injections as $id => $snippet) {
      $log_entry = isset($fix_log[$id]) ? $fix_log[$id] : [];
      $fixes[] = [
        'id'        => $id,
        'snippet'   => $snippet,
        'title'     => isset($log_entry['title']) ? $log_entry['title'] : '',
        'section'   => isset($log_entry['section']) ? $log_entry['section'] : '',
        'appliedAt' => isset($log_entry['appliedAt']) ? $log_entry['appliedAt'] : '',
        'status'    => 'applied',
      ];
    }

    return [
      'success' => true,
      'count'   => count($fixes),
      'fixes'   => $fixes,
    ];
  }

  /**
   * DELETE /wp-json/getsafe360/v1/fixes/:id
   * Removes a specific fix snippet from wp_head output.
   * Used by the SaaS rollback system.
   */
  public function route_delete_fix(\WP_REST_Request $req) {
    $fix_id = $req->get_param('id');

    $injections = get_option('getsafe360_seo_injections', []);
    $fix_log    = get_option('getsafe360_fix_log', []);

    if (!isset($injections[$fix_id])) {
      return new \WP_Error(
        'fix_not_found',
        'Fix not found: ' . $fix_id,
        ['status' => 404]
      );
    }

    // Remove from injections (stops it from being output in wp_head)
    unset($injections[$fix_id]);
    update_option('getsafe360_seo_injections', $injections);

    // Mark as rolled back in the fix log
    if (isset($fix_log[$fix_id])) {
      $fix_log[$fix_id]['status']    = 'rolled_back';
      $fix_log[$fix_id]['rolledBackAt'] = current_time('mysql');
      update_option('getsafe360_fix_log', $fix_log);
    }

    return [
      'success'   => true,
      'deletedId' => $fix_id,
      'message'   => 'Fix removed from wp_head output.',
    ];
  }

  /**
   * GET /wp-json/getsafe360/v1/capabilities
   * Reports what this plugin version can do, used by the SaaS loop runner.
   */
  public function route_capabilities(\WP_REST_Request $req) {
    return [
      'connectorVersion'   => self::VERSION,
      'siteUrl'            => get_site_url(),
      'capabilities'       => [
        'headSnippetInjection' => true,
        'jsonLdInjection'      => true,
        'metaTagInjection'     => true,
        'snippetDelete'        => true,
        'snippetList'          => true,
        'postRevisionCreate'   => false,
        'mediaAltUpdate'       => false,
        'optionUpdate'         => false,
        'actionGateway'        => true,
        'securityDisableXmlrpc' => true,
        'securityBlockUserEnumeration' => true,
        'rollback'             => true,
      ],
    ];
  }

  /**
   * Inject update info into the WP update transient.
   * Fires via filter: update_plugins_www.getsafe360.ai
   */
  public function check_for_update($update, $plugin_data, $plugin_file, $locales) {
    if (plugin_basename(__FILE__) !== $plugin_file) return $update;

    $remote = wp_remote_get(trailingslashit(self::API_BASE) . 'api/wp-plugin/info', [
      'timeout' => 10,
      'headers' => ['Accept' => 'application/json'],
    ]);

    if (is_wp_error($remote) || wp_remote_retrieve_response_code($remote) !== 200) {
      return $update;
    }

    $data = json_decode(wp_remote_retrieve_body($remote), true);
    if (!is_array($data) || empty($data['version'])) return $update;

    if (!version_compare($data['version'], self::VERSION, '>')) return $update;

    return (object) [
      'slug'         => 'getsafe360-connector',
      'plugin'       => $plugin_file,
      'new_version'  => sanitize_text_field($data['version']),
      'url'          => 'https://www.getsafe360.ai',
      'package'      => esc_url_raw($data['download_url'] ?? ''),
      'icons'        => ['svg' => 'https://www.getsafe360.ai/icons/360.svg'],
      'banners'      => [],
      'tested'       => sanitize_text_field($data['tested'] ?? ''),
      'requires_php' => '7.2',
    ];
  }

  /**
   * Provide plugin details for the "View details" popup in WP admin.
   */
  public function plugin_api_info($result, $action, $args) {
    if ($action !== 'plugin_information') return $result;
    if (empty($args->slug) || $args->slug !== 'getsafe360-connector') return $result;

    $remote = wp_remote_get(trailingslashit(self::API_BASE) . 'api/wp-plugin/info', [
      'timeout' => 10,
      'headers' => ['Accept' => 'application/json'],
    ]);

    $data = [];
    if (!is_wp_error($remote) && wp_remote_retrieve_response_code($remote) === 200) {
      $data = json_decode(wp_remote_retrieve_body($remote), true) ?: [];
    }

    return (object) [
      'name'          => 'GetSafe 360 AI Connector',
      'slug'          => 'getsafe360-connector',
      'version'       => sanitize_text_field($data['version'] ?? self::VERSION),
      'author'        => '<a href="https://www.getsafe360.ai">GetSafe 360 AI</a>',
      'homepage'      => 'https://www.getsafe360.ai',
      'requires'      => '5.0',
      'tested'        => sanitize_text_field($data['tested'] ?? '6.7'),
      'requires_php'  => '7.2',
      'download_link' => esc_url_raw($data['download_url'] ?? ''),
      'icons'         => ['svg' => 'https://www.getsafe360.ai/icons/360.svg'],
      'banners'       => ['high' => '', 'low' => ''],
      'sections'      => [
        'description' => wp_kses_post(
          $data['description'] ??
          '<p>Secure connector between your WordPress site and <strong>GetSafe 360 AI</strong> for automated security scanning, performance monitoring, and AI-powered repairs.</p>'
          . '<h4>Why connect?</h4>'
          . '<p>GetSafe 360 AI can already inspect your public website from the outside. Connecting adds the secure layer needed to diagnose internal WordPress details and safely apply AI-assisted fixes.</p>'
          . '<ul>'
          . '<li><strong>Without connection:</strong> External analysis, performance/SEO checks, security header inspection, structured data validation</li>'
          . '<li><strong>After connection:</strong> AI-powered optimization workflows, automated WordPress fixes, CMS/plugin-level diagnostics, continuous monitoring, safe repair actions with audit history</li>'
          . '</ul>'
          . '<p>Learn more at <a href="https://www.getsafe360.ai/docs/wordpress-connector">getsafe360.ai/docs/wordpress-connector</a></p>'
        ),
        'installation' => '<ol>'
          . '<li>Install and activate the plugin</li>'
          . '<li>Log in to your <a href="https://www.getsafe360.ai">GetSafe 360 AI dashboard</a></li>'
          . '<li>Add your site and click "Generate Pairing Code"</li>'
          . '<li>Enter the 6-digit code in the plugin settings and click Connect</li>'
          . '</ol>',
        'changelog'   => wp_kses_post(
          $data['changelog'] ??
          '<h4>0.3.0</h4><ul><li>Automatic updates via WordPress update system</li><li>Full i18n: German, Spanish, French, Italian, Portuguese</li><li>Deep-link pairing: arrive from the dashboard with code pre-filled</li><li>GetSafe 360 AI brand icon in admin menu and page header</li></ul>'
          . '<h4>0.2.1</h4><ul><li>SEO injection via wp_head</li><li>REST API routes: ping, status, push, pull</li></ul>'
          . '<h4>0.2.0</h4><ul><li>Initial release</li></ul>'
        ),
      ],
    ];
  }
}

new GetSafe360_Connector();
