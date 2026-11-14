<?php
/**
 * Plugin Name: GetSafe 360 AI
 * Plugin URI: https://www.getsafe360.ai/docs/wordpress-connector
 * Description: Website Intelligence Platform for WordPress: health, security, SEO, speed and accessibility checks, with safe one-click fixes you can undo.
 * Version: 1.12.0
 * Author: GetSafe 360 AI
 * Author URI: https://www.getsafe360.ai
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Requires at least: 5.6
 * Requires PHP: 7.2
 * Text Domain: getsafe-360-ai
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) exit;

class GetSafe360_AI {
  const VERSION = '1.12.0';
  const SECURITY_HEADERS_OPTION = 'getsafe360_security_headers';
  const OPTION = 'getsafe360_connector';
  const ACTION_STATE_OPTION = 'getsafe360_action_state';
  /** The GetSafe 360 service. Staging setups can point elsewhere with the GETSAFE360_API_BASE constant. */
  const API_BASE = 'https://www.getsafe360.ai';
  /** Markup allowed in translated admin sentences. */
  const INLINE_HTML = [
    'strong' => [],
    'code'   => [],
    'a'      => ['href' => [], 'target' => [], 'rel' => []],
  ];
  /** Tags an SEO fix may place in <head> (JSON-LD is handled separately). */
  const HEAD_HTML = [
    'meta' => ['name' => [], 'property' => [], 'content' => [], 'charset' => [], 'http-equiv' => []],
    'link' => ['rel' => [], 'href' => [], 'type' => [], 'sizes' => [], 'hreflang' => [], 'media' => []],
  ];
  /** Revisions kept per post by the revisions cleanup. */
  const REVISIONS_KEEP = 5;
  /** Well under the SaaS client's 10 s request timeout, so the caller always gets the result. */
  const CLEANUP_BUDGET_SECONDS = 6.0;

  /** Connector settings the SaaS may toggle, with their labels for result messages. */
  const SETTING_LABELS = [
    'disableXmlRpc'             => 'XML-RPC protection',
    'blockUserEnumeration'      => 'user enumeration protection',
    'disableFileEditor'         => 'theme and plugin file editor lock',
    'enableCoreSecurityUpdates' => 'automatic WordPress security updates',
  ];

  /** Capabilities a default role must never carry: they would let anyone who registers take over the site. */
  const PRIVILEGED_CAPS = [
    'manage_options', 'edit_users', 'create_users', 'promote_users', 'delete_users',
    'install_plugins', 'activate_plugins', 'edit_plugins', 'edit_themes', 'unfiltered_upload',
    // Editor level: publishing raw HTML or rewriting other people's content.
    'unfiltered_html', 'edit_others_posts',
  ];

  private $state_cache = null;

  public function __construct() {
    add_action('init', [$this, 'load_textdomain']);
    add_action('admin_menu', [$this, 'menu']);
    add_action('rest_api_init', [$this, 'routes']);
    add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
    add_action('wp_head', [$this, 'output_seo_injections'], 5);
    add_action('wp_head', [$this, 'output_meta_description'], 1);
    add_action('wp_head', [$this, 'output_schema'], 6);
    add_filter('pre_get_document_title', [$this, 'filter_document_title'], 20);
    add_filter('robots_txt', [$this, 'filter_robots_txt'], 99, 2);
    add_action('parse_request', [$this, 'serve_llms_txt'], 0);
    add_filter('xmlrpc_enabled', [$this, 'filter_xmlrpc_enabled']);
    add_filter('rest_endpoints', [$this, 'filter_rest_endpoints']);
    add_action('template_redirect', [$this, 'block_author_enumeration']);
    add_action('send_headers', [$this, 'send_security_headers']);
    add_filter('map_meta_cap', [$this, 'filter_file_editor_caps'], 10, 2);
    add_filter('allow_minor_auto_core_updates', [$this, 'filter_minor_core_updates'], 20);
    add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'action_links']);
  }

  /**
   * Bundled translations, for sites without a language pack from
   * translate.wordpress.org; a language pack, when installed, takes precedence.
   */
  public function load_textdomain() {
    // phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound -- bundled translations until the language packs are complete.
    load_plugin_textdomain('getsafe-360-ai', false, dirname(plugin_basename(__FILE__)) . '/languages');
  }

  /** Base URL of the GetSafe 360 service, without a trailing slash. */
  private function api_base() {
    if (defined('GETSAFE360_API_BASE') && is_string(GETSAFE360_API_BASE) && strpos(GETSAFE360_API_BASE, 'https://') === 0) {
      return untrailingslashit(GETSAFE360_API_BASE);
    }
    return self::API_BASE;
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
    $host = wp_parse_url($this->api_base(), PHP_URL_HOST);
    if ($host && $this->str_ends_with($host, '.vercel.app') && defined('VERCEL_AUTOMATION_BYPASS_SECRET') && VERCEL_AUTOMATION_BYPASS_SECRET) {
      $headers['x-vercel-protection-bypass'] = VERCEL_AUTOMATION_BYPASS_SECRET;
    }
    return $headers;
  }

  private function get_action_state() {
    // map_meta_cap runs many times per request, so the state is read once.
    if ($this->state_cache !== null) {
      return $this->state_cache;
    }
    $defaults = array_fill_keys(array_keys(self::SETTING_LABELS), false);

    $state = get_option(self::ACTION_STATE_OPTION, []);
    $this->state_cache = is_array($state) ? array_merge($defaults, $state) : $defaults;
    return $this->state_cache;
  }

  private function update_action_state($state) {
    update_option(self::ACTION_STATE_OPTION, $state, false);
    $this->state_cache = $state;
    return $state;
  }

  /** Uniform result entry for the actions route. */
  private function action_result($action_id, $type, $status, $message, $state = null, $rollback = null) {
    return [
      'id'       => $action_id,
      'type'     => $type,
      'status'   => $status,
      'message'  => $message,
      'state'    => $state,
      'rollback' => $rollback,
    ];
  }

  private function render_notice($type, $title, $message = '', $debug = null) {
    // $type: success | error | warning | info
    $class = 'notice notice-' . $type;
    echo '<div class="' . esc_attr($class) . '"><p><strong>' . esc_html($title) . '</strong>';
    if ($message) echo ' — ' . esc_html($message);
    echo '</p>';

    if ($debug && (defined('WP_DEBUG') && WP_DEBUG)) {
      echo '<details style="margin: 8px 0;"><summary>' . esc_html__('Debug Information', 'getsafe-360-ai') . '</summary>';
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

  /** Add "Settings" to the plugins list action links. */
  public function action_links($links) {
    $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=getsafe360')) . '">' . esc_html__('Settings', 'getsafe-360-ai') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
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
      $this->render_notice('success', __('Disconnected', 'getsafe-360-ai'), __('Your site is no longer linked to GetSafe 360. You can reconnect anytime.', 'getsafe-360-ai'));
    }

    // Handle connect
    if (isset($_POST['pair_code']) && check_admin_referer('getsafe360_connect')) {
      $pair_code = sanitize_text_field(wp_unslash($_POST['pair_code']));
      $site_url = get_site_url();
      $payload = [
        'pairCode'      => $pair_code,
        'siteUrl'       => $site_url,
        'wpVersion'     => get_bloginfo('version'),
        'pluginVersion' => self::VERSION
      ];

      $endpoint = $this->api_base() . '/api/connect/handshake';
      $headers  = $this->api_headers();

      $resp = wp_remote_post($endpoint, [
        'headers'   => $headers,
        'body'      => wp_json_encode($payload),
        'timeout'   => 20,
        'sslverify' => true,
      ]);

      // Build debug context
      $debug = [
        'api_base'   => $this->api_base(),
        'endpoint'   => $endpoint,
        'payload'    => $payload,
        'plugin_version' => self::VERSION,
      ];

      if (is_wp_error($resp)) {
        $error_message = $resp->get_error_message();

        // User-friendly error messages
        if (strpos($error_message, 'timed out') !== false) {
          $user_message = __('Connection timed out. Please check your internet connection and try again.', 'getsafe-360-ai');
        } else if (strpos($error_message, 'SSL') !== false) {
          $user_message = __('SSL certificate verification failed. Your site may need updated SSL certificates.', 'getsafe-360-ai');
        } else {
          $user_message = $error_message;
        }

        $this->render_notice('error', __('Connection Failed', 'getsafe-360-ai'), $user_message, array_merge($debug, ['wp_error' => $resp->get_error_data()]));
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

          $this->render_notice('success', __('Successfully Connected!', 'getsafe-360-ai'), __('Your WordPress site is now linked to GetSafe 360 AI. You can now run security scans and performance checks from your dashboard.', 'getsafe-360-ai'), $debug);
        } else {
          // User-friendly error messages based on server response
          $server_error = is_array($body_json) && isset($body_json['error']) ? $body_json['error'] : 'Handshake error';

          $user_message = '';
          if (strpos($server_error, 'invalid_or_expired') !== false || strpos($server_error, 'code_expired') !== false) {
            $user_message = __('This pairing code has expired. Please generate a new code from your GetSafe 360 AI dashboard.', 'getsafe-360-ai');
          } else if (strpos($server_error, 'already_used') !== false) {
            $user_message = __('This pairing code has already been used. Please generate a new code from your GetSafe 360 AI dashboard.', 'getsafe-360-ai');
          } else {
            $user_message = $server_error;
          }

          $this->render_notice('error', __('Connection Failed', 'getsafe-360-ai'), $user_message, $debug);
        }
      }
    }

    $opt = get_option(self::OPTION, []);
    $is_connected = !empty($opt['site_token']);

    // Deep-link: pre-fill pairing code when arriving via a GetSafe 360 AI deep link.
    // The SaaS dashboard can append ?gs360_code=XXXXXX to the WP admin URL so the
    // code is already filled in — users just click Connect without any copy-paste.
    $prefill_code = '';
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only pre-fills a form field; connecting still needs the nonce-checked submit.
    if (!$is_connected && isset($_GET['gs360_code'])) {
      // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- see above.
      $prefill_code = preg_replace('/[^0-9]/', '', sanitize_text_field(wp_unslash($_GET['gs360_code'])));
      if (strlen($prefill_code) === 6) {
        echo '<div class="getsafe360-deeplink-notice">✓ ' . esc_html__('Pairing code filled in from GetSafe 360 AI — just click Connect.', 'getsafe-360-ai') . '</div>';
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
          GetSafe 360 AI
        </h1>
        <p><?php
          /* translators: %s: plugin version number. */
          printf(esc_html__('Version %s', 'getsafe-360-ai'), esc_html(self::VERSION));
        ?></p>

        <?php if (!$is_connected): ?>
          <!-- NOT CONNECTED STATE -->
          <div class="getsafe360-card">
            <h2><?php esc_html_e('Connect Your WordPress Site', 'getsafe-360-ai'); ?></h2>
            <p><?php esc_html_e('Link this WordPress site to your GetSafe 360 AI dashboard for automated security scanning, performance monitoring, and AI-powered site repairs.', 'getsafe-360-ai'); ?></p>

            <div class="getsafe360-help">
              <strong><?php esc_html_e('How to connect:', 'getsafe-360-ai'); ?></strong>
              <ol style="margin: 8px 0 0 20px;">
                <li><?php echo wp_kses(sprintf(
                  /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                  __('Log in to your %1$sGetSafe 360 AI dashboard%2$s', 'getsafe-360-ai'),
                  '<strong>', '</strong>'
                ), self::INLINE_HTML); ?></li>
                <li><?php echo wp_kses(sprintf(
                  /* translators: %1$s, %3$s: opening <strong> tags; %2$s, %4$s: closing tags. */
                  __('Click %1$s"Add Site"%2$s or %3$s"Generate Pairing Code"%4$s', 'getsafe-360-ai'),
                  '<strong>', '</strong>', '<strong>', '</strong>'
                ), self::INLINE_HTML); ?></li>
                <li><?php echo wp_kses(sprintf(
                  /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                  __('Copy the %1$s6-digit code%2$s', 'getsafe-360-ai'),
                  '<strong>', '</strong>'
                ), self::INLINE_HTML); ?></li>
                <li><?php echo wp_kses(sprintf(
                  /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                  __('Paste it below and click %1$s"Connect"%2$s', 'getsafe-360-ai'),
                  '<strong>', '</strong>'
                ), self::INLINE_HTML); ?></li>
              </ol>
            </div>

            <form method="post" style="margin-top: 20px;">
              <?php wp_nonce_field('getsafe360_connect'); ?>
              <p><label for="pair_code"><strong><?php esc_html_e('Enter Pairing Code:', 'getsafe-360-ai'); ?></strong></label></p>
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
                  <?php esc_html_e('Connect to GetSafe 360 AI', 'getsafe-360-ai'); ?>
                </button>
              </p>
            </form>

            <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd; color: #666; font-size: 13px;">
              <?php printf(
                /* translators: %s: this site's URL. */
                esc_html__('Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s', 'getsafe-360-ai'),
                '<code>' . esc_html(get_site_url()) . '</code>'
              ); ?>
            </p>
          </div>

        <?php else: ?>
          <!-- CONNECTED STATE -->
          <div class="getsafe360-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <h2 style="margin: 0;"><?php esc_html_e('Connection Status', 'getsafe-360-ai'); ?></h2>
                <p style="margin: 8px 0 0 0;">
                  <span class="getsafe360-status connected">
                    <span class="dashicons dashicons-yes-alt" style="margin-top: 2px;"></span>
                    <?php esc_html_e('Connected', 'getsafe-360-ai'); ?>
                  </span>
                </p>
              </div>
            </div>

            <table class="form-table" role="presentation">
              <tbody>
                <tr>
                  <th scope="row"><?php esc_html_e('Site ID', 'getsafe-360-ai'); ?></th>
                  <td><code><?php echo esc_html($opt['site_id']); ?></code></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Connected Since', 'getsafe-360-ai'); ?></th>
                  <td><?php
                    /* translators: PHP date format for "connected since" display. See https://www.php.net/date */
                    echo esc_html(wp_date(__('F j, Y \a\t g:i a', 'getsafe-360-ai'), $opt['connected_at']));
                  ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('WordPress Version', 'getsafe-360-ai'); ?></th>
                  <td><?php echo esc_html(get_bloginfo('version')); ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Plugin Version', 'getsafe-360-ai'); ?></th>
                  <td><?php echo esc_html(self::VERSION); ?></td>
                </tr>
                <tr>
                  <th scope="row"><?php esc_html_e('Site URL', 'getsafe-360-ai'); ?></th>
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
                <?php esc_html_e('Disconnect Site', 'getsafe-360-ai'); ?>
              </button>

              <div id="disconnect-confirm" class="getsafe360-disconnect-confirm">
                <p><strong>⚠️ <?php esc_html_e('Are you sure?', 'getsafe-360-ai'); ?></strong></p>
                <p><?php esc_html_e('Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code.', 'getsafe-360-ai'); ?></p>
                <form method="post" style="display: inline-block; margin-right: 8px;">
                  <?php wp_nonce_field('getsafe360_disconnect'); ?>
                  <input type="hidden" name="disconnect" value="1" />
                  <button type="submit" class="getsafe360-btn-danger">
                    <?php esc_html_e('Yes, Disconnect', 'getsafe-360-ai'); ?>
                  </button>
                </form>
                <button
                  type="button"
                  class="button"
                  onclick="document.getElementById('disconnect-confirm').style.display='none'; document.querySelector('.getsafe360-btn-danger').style.display='inline-block';"
                >
                  <?php esc_html_e('Cancel', 'getsafe-360-ai'); ?>
                </button>
              </div>
            </div>
          </div>

          <div class="getsafe360-help" style="margin-top: 20px;">
            <strong>✨ <?php esc_html_e("What's Next?", 'getsafe-360-ai'); ?></strong>
            <ul style="margin: 8px 0 0 20px;">
              <li><?php echo wp_kses(sprintf(
                /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                __('Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans', 'getsafe-360-ai'),
                '<strong>', '</strong>'
              ), self::INLINE_HTML); ?></li>
              <li><?php echo wp_kses(sprintf(
                /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                __('Enable %1$sAI-powered automatic repairs%2$s for common issues', 'getsafe-360-ai'),
                '<strong>', '</strong>'
              ), self::INLINE_HTML); ?></li>
              <li><?php echo wp_kses(sprintf(
                /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                __('Set up %1$sscheduled scans%2$s to monitor your site 24/7', 'getsafe-360-ai'),
                '<strong>', '</strong>'
              ), self::INLINE_HTML); ?></li>
              <li><?php echo wp_kses(sprintf(
                /* translators: %1$s and %2$s: opening and closing <strong> tags. */
                __('View detailed %1$sperformance reports%2$s and recommendations', 'getsafe-360-ai'),
                '<strong>', '</strong>'
              ), self::INLINE_HTML); ?></li>
            </ul>
          </div>
        <?php endif; ?>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>
            <strong><?php esc_html_e('Need Help?', 'getsafe-360-ai'); ?></strong>
            <?php echo wp_kses(sprintf(
              /* translators: %1$s and %2$s wrap the link to the documentation, %3$s and %4$s the link to support. */
              __('Visit our %1$sdocumentation%2$s or %3$scontact support%4$s.', 'getsafe-360-ai'),
              '<a href="https://www.getsafe360.ai/docs/wordpress-connector" target="_blank" rel="noopener noreferrer">',
              '</a>',
              '<a href="https://www.getsafe360.ai/support" target="_blank" rel="noopener noreferrer">',
              '</a>'
            ), self::INLINE_HTML); ?>
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

    // Only hide users from anonymous visitors: the block editor and other
    // logged-in tooling call /wp/v2/users and /wp/v2/users/me.
    if (is_user_logged_in()) {
      return $endpoints;
    }

    $keys_to_remove = [
      '/wp/v2/users',
      '/wp/v2/users/(?P<id>[\d]+)',
      '/wp/v2/users/me',
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

    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- reads the public ?author= probe in order to block it; no state changes.
    $author_probe = isset($_GET['author']) ? sanitize_text_field(wp_unslash($_GET['author'])) : '';
    if ($author_probe !== '' && ctype_digit($author_probe)) {
      status_header(403);
      nocache_headers();
      wp_die(
        esc_html__('Author enumeration blocked by GetSafe 360 AI.', 'getsafe-360-ai'),
        esc_html__('Forbidden', 'getsafe-360-ai'),
        ['response' => 403]
      );
    }
  }

  /** Locks the theme/plugin file editor, like DISALLOW_FILE_EDIT, without touching wp-config.php. */
  public function filter_file_editor_caps($caps, $cap) {
    if (!in_array($cap, ['edit_themes', 'edit_plugins', 'edit_files'], true)) {
      return $caps;
    }
    $state = $this->get_action_state();
    if (empty($state['disableFileEditor'])) {
      return $caps;
    }
    $caps[] = 'do_not_allow';
    return $caps;
  }

  public function filter_minor_core_updates($allow) {
    $state = $this->get_action_state();
    return empty($state['enableCoreSecurityUpdates']) ? $allow : true;
  }

  // ---------- security headers ----------

  /**
   * Allowlisted headers and the values accepted for each. Anything else is
   * rejected, so the SaaS can never inject arbitrary headers.
   */
  const CSP_DIRECTIVES = [
    'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'media-src',
    'frame-src', 'worker-src', 'manifest-src', 'object-src', 'base-uri', 'form-action',
    'frame-ancestors', 'upgrade-insecure-requests', 'report-uri',
  ];

  /** CSP reports may only go to GetSafe 360, never to a third party. */
  private function csp_report_hosts() {
    $hosts = ['getsafe360.ai', 'www.getsafe360.ai'];
    $api = wp_parse_url($this->api_base(), PHP_URL_HOST);
    if ($api) {
      $hosts[] = strtolower($api);
    }
    return $hosts;
  }

  private function is_csp_source($token) {
    static $keywords = ["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", "'unsafe-hashes'", "'wasm-unsafe-eval'", "'report-sample'"];
    static $schemes = ['https:', 'http:', 'data:', 'blob:', 'wss:', 'ws:', 'mediastream:'];
    return $token === '*'
      || in_array($token, $keywords, true)
      || in_array($token, $schemes, true)
      || preg_match("#^'sha(256|384|512)-[A-Za-z0-9+/]+=*'$#", $token)
      || preg_match('#^(?:(?:https?|wss?)://)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?(?:/[A-Za-z0-9._~/-]*)?$#i', $token);
  }

  /** Known directives once each, valid sources, a default-src, reports only to GetSafe 360, at most 4 KB. */
  private function sanitize_csp($value) {
    if ($value === '' || strlen($value) > 4096 || preg_match('/[\x00-\x1f\x7f,]/', $value)) {
      return null;
    }
    $seen = [];
    foreach (explode(';', $value) as $part) {
      $tokens = preg_split('/\s+/', trim($part), -1, PREG_SPLIT_NO_EMPTY);
      if (empty($tokens)) {
        continue;
      }
      $name = strtolower(array_shift($tokens));
      if (!in_array($name, self::CSP_DIRECTIVES, true) || isset($seen[$name])) {
        return null;
      }
      $seen[$name] = true;
      if ($name === 'upgrade-insecure-requests') {
        if (!empty($tokens)) {
          return null;
        }
        continue;
      }
      if (empty($tokens)) {
        return null;
      }
      if ($name === 'report-uri') {
        $parts = count($tokens) === 1 ? wp_parse_url($tokens[0]) : false;
        if (!$parts || (isset($parts['scheme']) ? $parts['scheme'] : '') !== 'https'
          || !in_array(strtolower(isset($parts['host']) ? $parts['host'] : ''), $this->csp_report_hosts(), true)) {
          return null;
        }
        continue;
      }
      foreach ($tokens as $token) {
        if (!$this->is_csp_source($token)) {
          return null;
        }
      }
    }
    return isset($seen['default-src']) ? $value : null;
  }

  private function sanitize_security_header($name, $value) {
    $value = trim((string) $value);
    switch ($name) {
      case 'Content-Security-Policy':
      case 'Content-Security-Policy-Report-Only':
        return $this->sanitize_csp($value);
      case 'Strict-Transport-Security':
        return preg_match('/^max-age=\d{1,9}(; ?includeSubDomains)?(; ?preload)?$/i', $value) ? $value : null;
      case 'X-Content-Type-Options':
        return strtolower($value) === 'nosniff' ? 'nosniff' : null;
      case 'X-Frame-Options':
        $upper = strtoupper($value);
        return in_array($upper, ['DENY', 'SAMEORIGIN'], true) ? $upper : null;
      case 'Referrer-Policy':
        $allowed = [
          'no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin',
          'same-origin', 'strict-origin', 'strict-origin-when-cross-origin',
        ];
        return in_array(strtolower($value), $allowed, true) ? strtolower($value) : null;
      default:
        return null;
    }
  }

  private function get_security_headers() {
    $headers = get_option(self::SECURITY_HEADERS_OPTION, []);
    return is_array($headers) ? $headers : [];
  }

  public function send_security_headers() {
    if (headers_sent()) {
      return;
    }
    foreach ($this->get_security_headers() as $name => $value) {
      // HSTS over plain HTTP is ignored by browsers and misleading in reports.
      if ($name === 'Strict-Transport-Security' && !is_ssl()) {
        continue;
      }
      $clean = $this->sanitize_security_header($name, $value);
      if ($clean !== null) {
        header($name . ': ' . $clean);
      }
    }
  }

  /**
   * Apply a set_security_headers action. `headers` maps header name to value
   * (null removes it). With `replace`, the stored set is replaced wholesale,
   * which is how rollback restores the previous configuration exactly.
   * Validation is all-or-nothing: one rejected header changes nothing.
   */
  private function apply_security_headers_action($action_id, $payload) {
    $previous = $this->get_security_headers();
    $requested = isset($payload['headers']) && is_array($payload['headers']) ? $payload['headers'] : [];
    $replace = !empty($payload['replace']);
    $next = $replace ? [] : $previous;
    $rejected = [];
    // Undo restores only the headers this run touched (1.10), so independent runs
    // (e.g. security headers, then a CSP test) can be undone in any order.
    $restore = [];

    foreach ($requested as $name => $value) {
      $name = sanitize_text_field((string) $name);
      $restore[$name] = array_key_exists($name, $previous) ? $previous[$name] : null;
      if ($value === null) {
        unset($next[$name]);
        continue;
      }
      $clean = $this->sanitize_security_header($name, $value);
      if ($clean === null) {
        $rejected[] = $name;
        continue;
      }
      $next[$name] = $clean;
    }

    if (!empty($rejected)) {
      return [
        'id' => $action_id,
        'type' => 'set_security_headers',
        'status' => 'failed',
        'message' => 'Rejected header(s): ' . implode(', ', $rejected) . '. Nothing was changed.',
        'state' => ['securityHeaders' => $previous],
        'rollback' => null,
      ];
    }

    update_option(self::SECURITY_HEADERS_OPTION, $next, false);

    return [
      'id' => $action_id,
      'type' => 'set_security_headers',
      'status' => 'applied',
      'message' => sprintf('%d security header(s) configured.', count($next)),
      'state' => ['securityHeaders' => $next],
      'rollback' => [
        'id' => $action_id . '-rollback',
        'type' => 'set_security_headers',
        'payload' => $replace
          // Undoing a wholesale replace (pre-1.10 rollbacks) restores the whole previous set.
          ? ['replace' => true, 'headers' => empty($previous) ? new \stdClass() : $previous]
          : ['headers' => empty($restore) ? new \stdClass() : $restore],
      ],
    ];
  }

  // ---------- 1.7 actions ----------

  private function wp_config_path() {
    $path = ABSPATH . 'wp-config.php';
    if (!file_exists($path)) {
      $path = dirname(ABSPATH) . '/wp-config.php';
    }
    return file_exists($path) ? $path : null;
  }

  /** Which permission bits PHP itself reads wp-config.php through: 'owner', 'group', 'other', or null if unknown. */
  private function config_reader_class($path) {
    if (!function_exists('posix_geteuid')) {
      return null;
    }
    $owner = @fileowner($path);
    $group = @filegroup($path);
    if ($owner === false || $group === false) {
      return null;
    }
    if ($owner === posix_geteuid()) {
      return 'owner';
    }
    $groups = function_exists('posix_getgroups') ? (array) posix_getgroups() : [];
    $groups[] = posix_getegid();
    return in_array($group, $groups, true) ? 'group' : 'other';
  }

  /**
   * set_config_permissions: `mode: "tighten"` removes the "others" and execute
   * bits; an explicit octal `mode` (rollback) restores a previous value. The
   * read bit PHP depends on is never removed, and wp-config.php is never made
   * world-writable.
   */
  private function apply_config_permissions_action($action_id, $payload) {
    $type = 'set_config_permissions';
    $path = $this->wp_config_path();
    if (!$path) {
      return $this->action_result($action_id, $type, 'failed', 'wp-config.php was not found. Nothing was changed.');
    }
    clearstatcache(true, $path);
    $perms = @fileperms($path);
    if ($perms === false) {
      return $this->action_result($action_id, $type, 'failed', 'The permissions of wp-config.php could not be read. Nothing was changed.');
    }
    $current = $perms & 0777;

    $mode = isset($payload['mode']) ? (string) $payload['mode'] : 'tighten';
    if ($mode === 'tighten') {
      $target = $current & ~0007 & ~0111;
    } elseif (preg_match('/^0?[0-7]{3}$/', $mode)) {
      $target = octdec($mode);
    } else {
      return $this->action_result($action_id, $type, 'failed', 'Unsupported permission mode. Nothing was changed.');
    }
    if ($target & 0002) {
      return $this->action_result($action_id, $type, 'failed', 'wp-config.php must never be world-writable. Nothing was changed.');
    }

    $reader = $this->config_reader_class($path);
    $needs = ['owner' => 0400, 'group' => 0040, 'other' => 0004];
    if ($reader === null) {
      return $this->action_result($action_id, $type, 'failed', 'Could not tell which account PHP uses to read wp-config.php, so its permissions were left unchanged. Ask your host to set them to 640.');
    }
    if (($target & $needs[$reader]) === 0) {
      return $this->action_result($action_id, $type, 'failed', 'PHP reads wp-config.php through the "others" permission on this server; removing it would take the site offline. Ask your host to set the file to 640 with the PHP user as owner or group.');
    }

    $state = ['wpConfigMode' => sprintf('%04o', $target)];
    // A world-writable original is not worth restoring.
    $rollback = ($current & 0002) ? null : [
      'id' => $action_id . '-rollback',
      'type' => $type,
      'payload' => ['mode' => sprintf('%04o', $current)],
    ];
    if ($target === $current) {
      return $this->action_result($action_id, $type, 'applied', sprintf('wp-config.php already has permissions %04o.', $current), $state, $rollback);
    }
    // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- owner-approved permission fix for wp-config.php, verified and reverted below.
    if (!@chmod($path, $target)) {
      return $this->action_result($action_id, $type, 'failed', 'The server did not allow changing the permissions of wp-config.php. Nothing was changed.');
    }
    clearstatcache(true, $path);
    $after = @fileperms($path);
    if ($after === false || ($after & 0777) !== $target) {
      @chmod($path, $current); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- reverts the change above.
      return $this->action_result($action_id, $type, 'failed', 'The permission change did not take effect and was reverted.');
    }

    return $this->action_result(
      $action_id, $type, 'applied',
      sprintf('wp-config.php permissions changed from %04o to %04o.', $current, $target),
      $state, $rollback
    );
  }

  private function is_privileged_role($role_name) {
    $role = get_role($role_name);
    if (!$role) {
      return true;
    }
    foreach (self::PRIVILEGED_CAPS as $cap) {
      if ($role->has_cap($cap)) {
        return true;
      }
    }
    return false;
  }

  /**
   * set_default_role: the role new registrations receive. Only roles without
   * administrative capabilities are accepted, so this action can close the
   * "anyone can register as administrator" hole but never open it; for the
   * same reason, replacing a privileged default role cannot be undone.
   */
  private function apply_default_role_action($action_id, $payload) {
    $type = 'set_default_role';
    $previous = (string) get_option('default_role', 'subscriber');
    $role = isset($payload['role']) ? sanitize_key($payload['role']) : '';
    if ($role === '' || $this->is_privileged_role($role)) {
      return $this->action_result($action_id, $type, 'failed', 'Only an existing role without administrative capabilities can be the default role. Nothing was changed.', ['defaultRole' => $previous]);
    }

    update_option('default_role', $role);
    $rollback = $this->is_privileged_role($previous) ? null : [
      'id' => $action_id . '-rollback',
      'type' => $type,
      'payload' => ['role' => $previous],
    ];
    return $this->action_result($action_id, $type, 'applied', sprintf('New users now get the "%s" role.', $role), ['defaultRole' => $role], $rollback);
  }

  /** Loads the WordPress admin helpers the auto-update checks need (also in REST requests). */
  private function load_update_helpers() {
    foreach (['wp-admin/includes/plugin.php', 'wp-admin/includes/class-wp-automatic-updater.php', 'wp-admin/includes/update.php'] as $file) {
      if (file_exists(ABSPATH . $file)) {
        require_once ABSPATH . $file;
      }
    }
  }

  /** True when WordPress's background updater is switched off (constants, DISALLOW_FILE_MODS, filters). */
  private function auto_updater_disabled() {
    $this->load_update_helpers();
    if (!class_exists('WP_Automatic_Updater')) {
      return null;
    }
    $updater = new \WP_Automatic_Updater();
    return (bool) $updater->is_disabled();
  }

  private function plugin_auto_updates_allowed() {
    $this->load_update_helpers();
    return function_exists('wp_is_auto_update_enabled_for_type') ? (bool) wp_is_auto_update_enabled_for_type('plugin') : null;
  }

  private function plugin_file_list($values) {
    $clean = [];
    foreach ((array) $values as $value) {
      if (is_string($value) && preg_match('#^[A-Za-z0-9._/-]+\.php$#', $value) && strpos($value, '..') === false) {
        $clean[] = $value;
      }
    }
    return array_values(array_unique($clean));
  }

  /**
   * set_plugin_auto_updates: `enable: "all"` turns on WordPress's own
   * per-plugin auto-update for every installed plugin (the same switch as the
   * Plugins screen); `plugins` with `replace` restores an exact previous list.
   */
  private function apply_plugin_auto_updates_action($action_id, $payload) {
    $type = 'set_plugin_auto_updates';
    $this->load_update_helpers();
    $installed = array_keys(get_plugins());
    $previous = $this->plugin_file_list(get_site_option('auto_update_plugins', []));

    if (!empty($payload['replace'])) {
      if (!isset($payload['plugins']) || !is_array($payload['plugins'])) {
        return $this->action_result($action_id, $type, 'failed', 'Missing plugin list. Nothing was changed.');
      }
      $next = $this->plugin_file_list($payload['plugins']);
    } elseif (isset($payload['enable']) && $payload['enable'] === 'all') {
      if ($this->plugin_auto_updates_allowed() === false) {
        return $this->action_result($action_id, $type, 'failed', 'Plugin auto-updates are switched off on this site (wp-config.php, the host or another plugin). Nothing was changed.');
      }
      $next = array_values(array_unique(array_merge($previous, $installed)));
    } else {
      return $this->action_result($action_id, $type, 'failed', 'Unsupported auto-update request. Nothing was changed.');
    }

    update_site_option('auto_update_plugins', $next);
    $enabled = count(array_intersect($next, $installed));
    return $this->action_result(
      $action_id, $type, 'applied',
      sprintf('Automatic updates are on for %d of %d plugins.', $enabled, count($installed)),
      ['pluginsAutoUpdateEnabled' => $enabled, 'pluginsTotal' => count($installed)],
      ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => ['plugins' => $previous, 'replace' => true]]
    );
  }

  // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- counts and cleanup on core tables need live results; there is no WordPress API for them.
  private function count_expired_transients() {
    global $wpdb;
    $count = $wpdb->get_var($wpdb->prepare(
      "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d",
      $wpdb->esc_like('_transient_timeout_') . '%',
      time()
    ));
    return $count === null ? null : (int) $count;
  }

  /** Revisions beyond the newest REVISIONS_KEEP per post; autosaves are left alone. */
  private function count_excess_revisions() {
    global $wpdb;
    $count = $wpdb->get_var($wpdb->prepare(
      "SELECT COALESCE(SUM(GREATEST(c - %d, 0)), 0) FROM (
         SELECT COUNT(*) AS c FROM {$wpdb->posts}
         WHERE post_type = 'revision' AND post_name NOT LIKE %s
         GROUP BY post_parent
       ) AS per_post",
      self::REVISIONS_KEEP,
      '%' . $wpdb->esc_like('-autosave') . '%'
    ));
    return $count === null ? null : (int) $count;
  }

  /**
   * Deletes revisions beyond the newest $keep per post until $deadline. Works
   * post by post in bounded batches (never loads every revision at once), so
   * revision-heavy sites make progress on every run.
   */
  private function trim_revisions($keep, $deadline) {
    global $wpdb;
    $not_autosave = '%' . $wpdb->esc_like('-autosave') . '%';
    $deleted = 0;

    while (microtime(true) < $deadline) {
      $parents = $wpdb->get_col($wpdb->prepare(
        "SELECT post_parent FROM {$wpdb->posts}
         WHERE post_type = 'revision' AND post_name NOT LIKE %s
         GROUP BY post_parent HAVING COUNT(*) > %d LIMIT 100",
        $not_autosave,
        $keep
      ));
      if (empty($parents)) {
        break;
      }

      $deleted_in_page = 0;
      foreach ($parents as $parent) {
        if (microtime(true) > $deadline) {
          break 2;
        }
        // Everything after the newest $keep of this post, at most 500 per step.
        $ids = $wpdb->get_col($wpdb->prepare(
          "SELECT ID FROM {$wpdb->posts}
           WHERE post_type = 'revision' AND post_parent = %d AND post_name NOT LIKE %s
           ORDER BY post_date DESC, ID DESC LIMIT %d, 500",
          (int) $parent,
          $not_autosave,
          $keep
        ));
        foreach (array_chunk(array_map('intval', $ids), 200) as $chunk) {
          $in = implode(',', array_fill(0, count($chunk), '%d'));
          // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $in holds only %d placeholders.
          $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->postmeta} WHERE post_id IN ($in)", $chunk));
          $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->term_relationships} WHERE object_id IN ($in)", $chunk));
          $removed = $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->posts} WHERE ID IN ($in) AND post_type = 'revision'", $chunk));
          // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
          foreach ($chunk as $id) {
            clean_post_cache($id);
          }
          $deleted_in_page += is_int($removed) ? $removed : 0;
        }
      }

      $deleted += $deleted_in_page;
      if ($deleted_in_page === 0) {
        break; // Nothing could be deleted; do not spin until the deadline.
      }
    }

    $remaining = $this->count_excess_revisions();
    return ['deleted' => $deleted, 'remaining' => $remaining === null ? 0 : $remaining];
  }
  // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

  /**
   * cleanup_database: removes data WordPress no longer needs. Deleted rows
   * cannot be restored, so these actions return no rollback.
   */
  private function apply_cleanup_action($action_id, $payload) {
    $type = 'cleanup_database';
    $task = isset($payload['task']) ? sanitize_key($payload['task']) : '';

    if ($task === 'expired_transients') {
      $before = $this->count_expired_transients();
      delete_expired_transients(true);
      $after = $this->count_expired_transients();
      return $this->action_result(
        $action_id, $type, 'applied',
        sprintf('%d expired transient(s) removed.', max(0, (int) $before - (int) $after)),
        ['expiredTransients' => $after]
      );
    }

    if ($task === 'revisions') {
      $result = $this->trim_revisions(self::REVISIONS_KEEP, microtime(true) + self::CLEANUP_BUDGET_SECONDS);
      $message = sprintf('%d old revision(s) removed; the newest %d per post were kept.', $result['deleted'], self::REVISIONS_KEEP);
      if ($result['remaining'] > 0) {
        $message .= sprintf(' %d more remain; run the cleanup again.', $result['remaining']);
      }
      return $this->action_result($action_id, $type, 'applied', $message, ['revisionsRemovable' => $result['remaining']]);
    }

    return $this->action_result($action_id, $type, 'failed', 'Unsupported cleanup task. Nothing was changed.');
  }

  // ---------- 1.8 plugin updates with restore points ----------

  const RESTORE_POINTS_OPTION = 'getsafe360_restore_points';
  const RESTORE_POINT_DAYS = 14;
  const RESTORE_POINTS_PER_PLUGIN = 3;
  const MAX_UPDATES_PER_RUN = 5;
  /** No new update starts after this many seconds, so a run ends well inside the SaaS timeout. */
  const UPDATE_START_BUDGET_SECONDS = 20.0;

  private function backup_dir() {
    return WP_CONTENT_DIR . '/getsafe360-backups';
  }

  /** Creates the restore-point folder and blocks web access to it (Apache, IIS; zip names are random for the rest). */
  private function ensure_backup_dir() {
    $dir = $this->backup_dir();
    if (!is_dir($dir) && !wp_mkdir_p($dir)) {
      return false;
    }
    $guards = [
      'index.php'  => "<?php\n// Silence is golden.\n",
      '.htaccess'  => "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n",
      'web.config' => "<?xml version=\"1.0\"?>\n<configuration><system.webServer><authorization><deny users=\"*\" /></authorization></system.webServer></configuration>\n",
    ];
    foreach ($guards as $name => $content) {
      if (!file_exists("$dir/$name")) {
        @file_put_contents("$dir/$name", $content);
      }
    }
    return wp_is_writable($dir) ? $dir : false;
  }

  private function get_restore_points() {
    $points = get_option(self::RESTORE_POINTS_OPTION, []);
    return is_array($points) ? $points : [];
  }

  private function save_restore_points($points) {
    update_option(self::RESTORE_POINTS_OPTION, $points, false);
  }

  /** Drops restore points older than RESTORE_POINT_DAYS and beyond the newest few per plugin. */
  private function prune_restore_points() {
    $points = $this->get_restore_points();
    uasort($points, function ($a, $b) { return $b['createdAt'] <=> $a['createdAt']; });
    $cutoff = time() - self::RESTORE_POINT_DAYS * DAY_IN_SECONDS;
    $per_plugin = [];
    foreach ($points as $id => $point) {
      $plugin = isset($point['plugin']) ? $point['plugin'] : '';
      $per_plugin[$plugin] = isset($per_plugin[$plugin]) ? $per_plugin[$plugin] + 1 : 1;
      if ($point['createdAt'] < $cutoff || $per_plugin[$plugin] > self::RESTORE_POINTS_PER_PLUGIN) {
        wp_delete_file($this->backup_dir() . '/' . $id . '.zip');
        unset($points[$id]);
      }
    }
    $this->save_restore_points($points);
  }

  /** Absolute path of a plugin's code: its folder, or the file for single-file plugins. */
  private function plugin_path($plugin_file) {
    $dir = dirname($plugin_file);
    return $dir === '.' ? WP_PLUGIN_DIR . '/' . $plugin_file : WP_PLUGIN_DIR . '/' . $dir;
  }

  /** Zips the plugin's current files. Returns the restore point id, or a WP_Error. */
  private function create_restore_point($plugin_file, $version, $was_active, $update_offer) {
    $dir = $this->ensure_backup_dir();
    if (!$dir) {
      return new \WP_Error('backup_dir', 'The restore-point folder could not be created.');
    }
    $source = $this->plugin_path($plugin_file);
    $id = bin2hex(random_bytes(16));
    $zip_path = "$dir/$id.zip";
    $base = WP_PLUGIN_DIR . '/';

    $files = [];
    if (is_dir($source)) {
      $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS));
      foreach ($it as $file) {
        if ($file->isFile()) {
          $files[] = $file->getPathname();
        }
      }
    } elseif (is_file($source)) {
      $files[] = $source;
    }
    if (empty($files)) {
      return new \WP_Error('backup_empty', 'The plugin files could not be read.');
    }

    if (class_exists('ZipArchive')) {
      $zip = new \ZipArchive();
      if ($zip->open($zip_path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
        return new \WP_Error('backup_zip', 'The restore point could not be written.');
      }
      foreach ($files as $path) {
        $zip->addFile($path, substr($path, strlen($base)));
      }
      $ok = $zip->close();
    } else {
      require_once ABSPATH . 'wp-admin/includes/class-pclzip.php';
      $zip = new \PclZip($zip_path);
      $ok = $zip->create($files, PCLZIP_OPT_REMOVE_PATH, rtrim($base, '/')) !== 0;
    }
    if (!$ok || !file_exists($zip_path)) {
      wp_delete_file($zip_path);
      return new \WP_Error('backup_zip', 'The restore point could not be written.');
    }

    $points = $this->get_restore_points();
    $points[$id] = [
      'plugin'    => $plugin_file,
      'version'   => (string) $version,
      'wasActive' => (bool) $was_active,
      'createdAt' => time(),
      // Put back into the update list on restore, so the site still reports the update.
      'update'    => $update_offer ? wp_json_encode($update_offer) : null,
    ];
    $this->save_restore_points($points);
    return $id;
  }

  /** Marks plugins active again without loading their code in this request (like a silent deactivation, reversed). */
  private function set_plugins_active($plugin_files) {
    if (empty($plugin_files)) {
      return;
    }
    $active = (array) get_option('active_plugins', []);
    foreach ($plugin_files as $file) {
      if (!in_array($file, $active, true)) {
        $active[] = $file;
      }
    }
    sort($active);
    update_option('active_plugins', array_values($active));
  }

  private function init_filesystem() {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    if (get_filesystem_method() !== 'direct') {
      return false;
    }
    return WP_Filesystem();
  }

  /** Plugin updates need direct file access and must not be disabled by DISALLOW_FILE_MODS. */
  private function plugin_updates_possible() {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    return wp_is_file_mod_allowed('capability_update_plugin') && get_filesystem_method() === 'direct';
  }

  /**
   * Loads the homepage the way a visitor would. Returns true (healthy), false
   * (server error or PHP fatal) or null (the site cannot reach itself, so the
   * check is inconclusive).
   */
  private function site_responds() {
    $url = add_query_arg('gs360_health', (string) microtime(true), home_url('/'));
    $response = wp_remote_get($url, [
      'timeout'     => 10,
      'redirection' => 3,
      // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- the core filter for loopback requests.
      'sslverify'   => apply_filters('https_local_ssl_verify', false),
      'headers'     => ['Cache-Control' => 'no-cache'],
    ]);
    if (is_wp_error($response)) {
      return null;
    }
    $code = (int) wp_remote_retrieve_response_code($response);
    $body = (string) wp_remote_retrieve_body($response);
    if ($code >= 500 || stripos($body, '<b>Fatal error</b>') !== false || stripos($body, 'Fatal error: ') !== false) {
      return false;
    }
    return $code > 0 && $code < 500;
  }

  /** Replaces the plugin's files with a restore point. Returns true or a WP_Error. */
  private function restore_from_point($id) {
    global $wp_filesystem;
    $points = $this->get_restore_points();
    if (!preg_match('/^[a-f0-9]{32}$/', $id) || !isset($points[$id])) {
      return new \WP_Error('restore_missing', 'The restore point no longer exists.');
    }
    $point = $points[$id];
    if (isset($point['kind']) && $point['kind'] === 'core') {
      return new \WP_Error('restore_missing', 'That restore point holds core files, not a plugin.');
    }
    $zip = $this->backup_dir() . "/$id.zip";
    if (!file_exists($zip)) {
      return new \WP_Error('restore_missing', 'The restore point file is missing.');
    }
    if (!$this->init_filesystem()) {
      return new \WP_Error('filesystem', 'WordPress cannot write plugin files directly on this server.');
    }

    // Unpack into a staging folder first: a damaged archive must never cost the installed version.
    $target = $this->plugin_path($point['plugin']);
    $name = dirname($point['plugin']) === '.' ? $point['plugin'] : dirname($point['plugin']);
    $staging = $this->backup_dir() . '/restore-' . bin2hex(random_bytes(8));
    $unzipped = unzip_file($zip, $staging);
    if (is_wp_error($unzipped) || !file_exists("$staging/$name") || !file_exists("$staging/{$point['plugin']}")) {
      $wp_filesystem->delete($staging, true);
      return new \WP_Error('restore_corrupt', 'The restore point could not be unpacked; the installed version was left in place.');
    }
    $previous = file_exists($target) ? "$staging/previous" : null;
    if ($previous && !$wp_filesystem->move($target, $previous)) {
      $wp_filesystem->delete($staging, true);
      return new \WP_Error('restore_move', 'The installed version could not be moved aside; nothing was changed.');
    }
    if (!$wp_filesystem->move("$staging/$name", $target)) {
      if ($previous) {
        $wp_filesystem->move($previous, $target);
      }
      $wp_filesystem->delete($staging, true);
      return new \WP_Error('restore_move', 'The restore point could not be put in place; the installed version was kept.');
    }
    $wp_filesystem->delete($staging, true);
    if (is_dir($target) && function_exists('wp_opcache_invalidate_directory')) {
      wp_opcache_invalidate_directory($target);
    } else {
      $this->invalidate_php_cache($target);
    }
    if (!empty($point['wasActive'])) {
      $this->set_plugins_active([$point['plugin']]);
    }
    if (!empty($point['update'])) {
      $offer = json_decode($point['update']);
      $transient = get_site_transient('update_plugins');
      if (is_object($transient) && is_object($offer)) {
        $transient->response[$point['plugin']] = $offer;
        unset($transient->no_update[$point['plugin']]);
        set_site_transient('update_plugins', $transient);
      }
    }
    if (function_exists('wp_clean_plugins_cache')) {
      wp_clean_plugins_cache(false);
    }
    return true;
  }

  /**
   * update_plugins: updates outdated plugins one at a time. Each update is
   * preceded by a restore point; if the site then fails to load, the old
   * version is put back at once. The rollback restores every plugin this run
   * updated. Payload: `plugins: "outdated"` or a list of plugin files.
   */
  private function apply_update_plugins_action($action_id, $payload) {
    $type = 'update_plugins';
    $started = microtime(true);
    $this->load_update_helpers();
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';

    if (is_multisite()) {
      return $this->action_result($action_id, $type, 'failed', 'On multisite networks, update plugins from the network admin. Nothing was changed.');
    }
    if (!$this->plugin_updates_possible() || !$this->init_filesystem()) {
      return $this->action_result($action_id, $type, 'failed', 'WordPress cannot update plugins on this server without FTP credentials, or file changes are disabled (DISALLOW_FILE_MODS). Update plugins in the WordPress dashboard instead.');
    }
    if (function_exists('set_time_limit')) {
      @set_time_limit(120); // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- plugin updates can take longer than the default limit.
    }

    $transient = get_site_transient('update_plugins');
    $offers = (is_object($transient) && isset($transient->response) && is_array($transient->response)) ? $transient->response : [];
    $installed = get_plugins();
    $self = plugin_basename(__FILE__);

    $requested = isset($payload['plugins']) ? $payload['plugins'] : 'outdated';
    $candidates = $requested === 'outdated' ? array_keys($offers) : $this->plugin_file_list($requested);

    $plan = [];
    $skipped = [];
    foreach ($candidates as $file) {
      if ($file === $self || !isset($installed[$file]) || !isset($offers[$file])) {
        continue;
      }
      if (empty($offers[$file]->package)) {
        $skipped[] = ['plugin' => $file, 'reason' => 'no_package'];
        continue;
      }
      $plan[] = $file;
    }
    if (empty($plan)) {
      return $this->action_result($action_id, $type, 'skipped', empty($skipped)
        ? 'No plugin updates are available.'
        : 'The available updates need a licence or download link that WordPress does not have; update those plugins in the dashboard.', ['skipped' => $skipped]);
    }

    $this->prune_restore_points();
    $baseline = $this->site_responds();
    $results = [];
    $restore_ids = [];

    foreach ($plan as $index => $file) {
      if ($index >= self::MAX_UPDATES_PER_RUN || microtime(true) - $started > self::UPDATE_START_BUDGET_SECONDS) {
        $results[] = ['plugin' => $file, 'status' => 'pending'];
        continue;
      }
      $from = isset($installed[$file]['Version']) ? (string) $installed[$file]['Version'] : '';
      $to = isset($offers[$file]->new_version) ? (string) $offers[$file]->new_version : '';
      $was_active = is_plugin_active($file);

      $point = $this->create_restore_point($file, $from, $was_active, $offers[$file]);
      if (is_wp_error($point)) {
        $results[] = ['plugin' => $file, 'status' => 'failed', 'from' => $from, 'to' => $to, 'reason' => $point->get_error_message()];
        continue;
      }

      $upgrader = new \Plugin_Upgrader(new \Automatic_Upgrader_Skin());
      $outcome = $upgrader->upgrade($file, ['clear_update_cache' => false]);
      // Outside cron WordPress deactivates the plugin and leaves reactivation to a later page load.
      if ($was_active) {
        $this->set_plugins_active([$file]);
      }
      if ($outcome !== true) {
        $message = is_wp_error($outcome) ? $outcome->get_error_message() : 'WordPress could not install the update.';
        $restored = $this->restore_from_point($point);
        $results[] = ['plugin' => $file, 'status' => 'failed', 'from' => $from, 'to' => $to, 'reason' => $message, 'restored' => $restored === true];
        continue;
      }

      $health = $baseline === true ? $this->site_responds() : null;
      if ($health === false) {
        $restored = $this->restore_from_point($point);
        $results[] = ['plugin' => $file, 'status' => 'restored', 'from' => $from, 'to' => $to, 'reason' => 'site_error', 'restored' => $restored === true];
        continue;
      }

      $restore_ids[] = $point;
      $results[] = ['plugin' => $file, 'status' => 'updated', 'from' => $from, 'to' => $to, 'healthChecked' => $health === true];
    }

    // The upgrader dropped the cached update list; keep it, minus what is now up to date.
    if (is_object($transient)) {
      $fresh = get_site_transient('update_plugins');
      $list = is_object($fresh) ? $fresh : $transient;
      foreach ($results as $entry) {
        if ($entry['status'] === 'updated') {
          unset($list->response[$entry['plugin']]);
        } elseif (isset($offers[$entry['plugin']])) {
          $list->response[$entry['plugin']] = $offers[$entry['plugin']];
        }
      }
      set_site_transient('update_plugins', $list);
    }
    wp_clean_plugins_cache(false);

    $count = function ($status) use ($results) {
      return count(array_filter($results, function ($entry) use ($status) { return $entry['status'] === $status; }));
    };
    $updated = $count('updated');
    $parts = [sprintf('%d plugin(s) updated', $updated)];
    if ($count('restored') > 0) {
      $parts[] = sprintf('%d put back to the previous version because the site stopped loading', $count('restored'));
    }
    if ($count('failed') > 0) {
      $parts[] = sprintf('%d failed', $count('failed'));
    }
    if ($count('pending') > 0) {
      $parts[] = sprintf('%d left for the next run', $count('pending'));
    }
    if (!empty($skipped)) {
      $parts[] = sprintf('%d need a licence or manual update', count($skipped));
    }
    if ($updated > 0 && $baseline !== true) {
      $parts[] = 'the site could not load itself to check the result, so verify it from outside';
    }

    return $this->action_result(
      $action_id, $type, $updated > 0 ? 'applied' : 'failed',
      ucfirst(implode('; ', $parts)) . '.',
      ['plugins' => $results, 'skipped' => $skipped],
      empty($restore_ids) ? null : [
        'id' => $action_id . '-rollback',
        'type' => 'restore_plugins',
        'payload' => ['restorePoints' => $restore_ids],
      ]
    );
  }

  /** restore_plugins: puts plugins back to the versions saved in the given restore points. */
  private function apply_restore_plugins_action($action_id, $payload) {
    $type = 'restore_plugins';
    $this->load_update_helpers();
    $ids = isset($payload['restorePoints']) && is_array($payload['restorePoints']) ? $payload['restorePoints'] : [];
    $ids = array_values(array_filter($ids, function ($id) { return is_string($id) && preg_match('/^[a-f0-9]{32}$/', $id); }));
    if (empty($ids)) {
      return $this->action_result($action_id, $type, 'failed', 'No valid restore points were given. Nothing was changed.');
    }
    $points = $this->get_restore_points();
    $restored = [];
    $errors = [];
    foreach ($ids as $id) {
      $result = $this->restore_from_point($id);
      $plugin = isset($points[$id]['plugin']) ? $points[$id]['plugin'] : $id;
      if ($result === true) {
        $restored[] = ['plugin' => $plugin, 'version' => $points[$id]['version']];
      } else {
        $errors[] = ['plugin' => $plugin, 'reason' => $result->get_error_message()];
      }
    }
    // Any failure keeps the run undoable: restoring the others again is harmless.
    $status = empty($errors) ? 'applied' : 'failed';
    $message = sprintf('%d plugin(s) restored to their previous version.', count($restored));
    if (!empty($errors)) {
      $message .= sprintf(' %d could not be restored: %s', count($errors), implode('; ', array_map(function ($e) { return $e['plugin'] . ' (' . $e['reason'] . ')'; }, $errors)));
    }
    return $this->action_result($action_id, $type, $status, $message, ['restored' => $restored, 'errors' => $errors]);
  }

  // ---------- 1.9 core file integrity ----------

  /** Diffs sent to the SaaS are capped; they are reviewed, never stored long-term. */
  const CORE_DIFF_MAX_BYTES = 20000;
  const CORE_FILE_MAX_BYTES = 1048576;
  const CORE_SCAN_BUDGET_SECONDS = 8.0;
  const CORE_FILES_PER_ACTION = 50;
  const CORE_DOWNLOAD_BUDGET_SECONDS = 25.0;

  /**
   * Official checksums for this WordPress version, cached for a day. With a
   * $deadline the download counts against that time budget.
   */
  private function fetch_core_checksums($deadline = null) {
    $version = get_bloginfo('version');
    $cache_key = 'getsafe360_core_sums_' . md5($version . '|' . get_locale());
    $cached = get_site_transient($cache_key);
    if (is_array($cached) && !empty($cached)) {
      return $cached;
    }
    if (!function_exists('get_core_checksums')) {
      require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    $cap_timeout = function ($args, $url) use ($deadline) {
      if ($deadline !== null && strpos($url, 'api.wordpress.org/core/checksums') !== false) {
        $args['timeout'] = max(1, min((float) $args['timeout'], $deadline - microtime(true)));
      }
      return $args;
    };
    add_filter('http_request_args', $cap_timeout, 10, 2);
    try {
      foreach (array_unique([get_locale(), 'en_US']) as $locale) {
        if ($deadline !== null && $deadline - microtime(true) < 1.0) {
          return null;
        }
        $checksums = get_core_checksums($version, $locale);
        if (is_array($checksums) && !empty($checksums)) {
          set_site_transient($cache_key, $checksums, DAY_IN_SECONDS);
          return $checksums;
        }
      }
    } finally {
      remove_filter('http_request_args', $cap_timeout, 10);
    }
    return null;
  }

  /** A relative core path we may read or change: no traversal, never wp-content or wp-config.php. */
  private function is_safe_core_path($path) {
    return is_string($path)
      && preg_match('#^[A-Za-z0-9._/-]+$#', $path)
      && strpos($path, '..') === false
      // Canonical spelling only: "a/./b", "a//b" or "./a" would dodge the checksum lookup.
      && !preg_match('#(^|/)\.(/|$)|//|^/|/$#', $path)
      && strpos($path, 'wp-content/') !== 0
      && $path !== 'wp-config.php';
  }

  /** PHP files in wp-admin/ or wp-includes/ that are not part of WordPress. */
  private function is_unexpected_candidate($path) {
    return $this->is_safe_core_path($path) && preg_match('#^(wp-admin|wp-includes)/.+\.php$#', $path);
  }

  /**
   * Scans core files under a time budget. Returns ['modified' => paths,
   * 'unexpected' => paths, 'complete' => bool] or null without checksums.
   */
  private function scan_core_files($deadline, $with_modified = true) {
    $checksums = $this->fetch_core_checksums($deadline);
    if (!is_array($checksums)) {
      return null;
    }
    $modified = [];
    $complete = true;
    foreach ($with_modified ? $checksums : [] as $file => $md5) {
      if (microtime(true) > $deadline) {
        $complete = false;
        break;
      }
      if (!$this->is_safe_core_path($file)) {
        continue;
      }
      $path = ABSPATH . $file;
      if (is_file($path) && md5_file($path) !== $md5) {
        $modified[] = $file;
      }
    }

    $unexpected = [];
    foreach (['wp-admin', 'wp-includes'] as $dir) {
      if (!$complete || !is_dir(ABSPATH . $dir)) {
        continue;
      }
      $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(ABSPATH . $dir, \FilesystemIterator::SKIP_DOTS));
      foreach ($it as $file) {
        if (microtime(true) > $deadline) {
          $complete = false;
          break 2;
        }
        $rel = str_replace('\\', '/', substr($file->getPathname(), strlen(ABSPATH)));
        if ($file->isFile() && !isset($checksums[$rel]) && $this->is_unexpected_candidate($rel)) {
          $unexpected[] = $rel;
        }
      }
    }
    sort($modified);
    sort($unexpected);
    return ['modified' => $modified, 'unexpected' => $unexpected, 'complete' => $complete];
  }

  /** Downloads the official copy of a core file and checks it against the official checksum. */
  private function official_core_file($path, $checksums, $timeout = 15.0) {
    if (!isset($checksums[$path])) {
      return new \WP_Error('not_core', 'Not a WordPress core file.');
    }
    $url = 'https://core.svn.wordpress.org/tags/' . rawurlencode(get_bloginfo('version')) . '/' . implode('/', array_map('rawurlencode', explode('/', $path)));
    $response = wp_remote_get($url, ['timeout' => max(1.0, (float) $timeout)]);
    if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
      return new \WP_Error('download', sprintf('The official copy of %s could not be downloaded.', $path));
    }
    $body = wp_remote_retrieve_body($response);
    if (md5($body) !== $checksums[$path]) {
      return new \WP_Error('checksum', sprintf('The downloaded copy of %s does not match the official checksum.', $path));
    }
    return $body;
  }

  /** Makes PHP run the file as it is now on disk, also where OPcache never re-checks timestamps. */
  private function invalidate_php_cache($absolute_path) {
    if (function_exists('wp_opcache_invalidate')) {
      wp_opcache_invalidate($absolute_path, true);
    } elseif (function_exists('opcache_invalidate')) {
      @opcache_invalidate($absolute_path, true);
    }
  }

  private function split_lines($text) {
    $lines = explode("\n", str_replace("\r\n", "\n", (string) $text));
    if (end($lines) === '') {
      array_pop($lines);
    }
    return $lines;
  }

  /** Unified diff (3 lines of context), capped at $max_bytes. Returns [text, truncated]. */
  private function unified_diff($old_text, $new_text, $max_bytes) {
    if (!class_exists('Text_Diff', false)) {
      require_once ABSPATH . WPINC . '/Text/Diff.php';
    }
    $diff = new \Text_Diff('auto', [$this->split_lines($old_text), $this->split_lines($new_text)]);
    $lines = [];
    foreach ($diff->getDiff() as $op) {
      if ($op instanceof \Text_Diff_Op_copy) {
        foreach ((array) $op->orig as $line) {
          $lines[] = [' ', $line];
        }
        continue;
      }
      foreach (is_array($op->orig) ? $op->orig : [] as $line) {
        $lines[] = ['-', $line];
      }
      foreach (is_array($op->final) ? $op->final : [] as $line) {
        $lines[] = ['+', $line];
      }
    }

    $count = count($lines);
    $keep = array_fill(0, $count, false);
    foreach ($lines as $i => $line) {
      if ($line[0] !== ' ') {
        for ($j = max(0, $i - 3); $j <= min($count - 1, $i + 3); $j++) {
          $keep[$j] = true;
        }
      }
    }

    $out = '';
    $old = 0;
    $new = 0;
    $i = 0;
    while ($i < $count) {
      if (!$keep[$i]) {
        $old++;
        $new++;
        $i++;
        continue;
      }
      $start_old = $old + 1;
      $start_new = $new + 1;
      $body = '';
      $old_count = 0;
      $new_count = 0;
      while ($i < $count && $keep[$i]) {
        list($kind, $text) = $lines[$i];
        $body .= $kind . $text . "\n";
        if ($kind !== '+') { $old++; $old_count++; }
        if ($kind !== '-') { $new++; $new_count++; }
        $i++;
      }
      $out .= sprintf("@@ -%d,%d +%d,%d @@\n", $start_old, $old_count, $start_new, $new_count) . $body;
      if (strlen($out) > $max_bytes) {
        return [substr($out, 0, $max_bytes), true];
      }
    }
    return [$out, false];
  }

  /** GET /core-files — paths of modified and unexpected core files (no contents). */
  public function route_core_files(\WP_REST_Request $req) {
    $scan = $this->scan_core_files(microtime(true) + self::CORE_SCAN_BUDGET_SECONDS);
    if ($scan === null) {
      return new \WP_Error('checksums_unavailable', 'Official WordPress checksums could not be loaded.', ['status' => 503]);
    }
    return [
      'success'    => true,
      'version'    => get_bloginfo('version'),
      'modified'   => $scan['modified'],
      'unexpected' => $scan['unexpected'],
      'complete'   => $scan['complete'],
    ];
  }

  /**
   * GET /core-files/diff?path=… — the changed lines of one core file against
   * the official copy, or the start of an unexpected file. Only core
   * locations; never wp-config.php or wp-content.
   */
  public function route_core_file_diff(\WP_REST_Request $req) {
    $path = (string) $req->get_param('path');
    if (!$this->is_safe_core_path($path) || !is_file(ABSPATH . $path)) {
      return new \WP_Error('invalid_path', 'Not a core file on this site.', ['status' => 400]);
    }
    $checksums = $this->fetch_core_checksums(microtime(true) + 5.0);
    if (!is_array($checksums)) {
      return new \WP_Error('checksums_unavailable', 'Official WordPress checksums could not be loaded.', ['status' => 503]);
    }
    $size = (int) @filesize(ABSPATH . $path);
    $current = $size <= self::CORE_FILE_MAX_BYTES ? (string) @file_get_contents(ABSPATH . $path) : null;

    if (isset($checksums[$path])) {
      if (md5_file(ABSPATH . $path) === $checksums[$path]) {
        return ['success' => true, 'path' => $path, 'kind' => 'unchanged', 'diff' => '', 'truncated' => false];
      }
      if ($current === null) {
        return ['success' => true, 'path' => $path, 'kind' => 'modified', 'diff' => null, 'truncated' => true, 'size' => $size];
      }
      $official = $this->official_core_file($path, $checksums);
      if (is_wp_error($official)) {
        return new \WP_Error($official->get_error_code(), $official->get_error_message(), ['status' => 502]);
      }
      list($diff, $truncated) = $this->unified_diff($official, $current, self::CORE_DIFF_MAX_BYTES);
      return ['success' => true, 'path' => $path, 'kind' => 'modified', 'diff' => $diff, 'truncated' => $truncated, 'size' => $size];
    }

    if (!$this->is_unexpected_candidate($path)) {
      return new \WP_Error('invalid_path', 'Only files in wp-admin and wp-includes can be reviewed.', ['status' => 400]);
    }
    list($diff, $truncated) = $this->unified_diff('', (string) $current, self::CORE_DIFF_MAX_BYTES);
    return ['success' => true, 'path' => $path, 'kind' => 'unexpected', 'diff' => $diff, 'truncated' => $truncated || $current === null, 'size' => $size];
  }

  /** Zips the given core files (relative paths) into a restore point of kind "core". */
  private function create_core_restore_point($paths) {
    $dir = $this->ensure_backup_dir();
    if (!$dir) {
      return new \WP_Error('backup_dir', 'The restore-point folder could not be created.');
    }
    $id = bin2hex(random_bytes(16));
    $zip_path = "$dir/$id.zip";
    if (!class_exists('ZipArchive')) {
      return new \WP_Error('backup_zip', 'PHP ZipArchive is required to save core files before changing them.');
    }
    $zip = new \ZipArchive();
    if ($zip->open($zip_path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
      return new \WP_Error('backup_zip', 'The restore point could not be written.');
    }
    foreach ($paths as $path) {
      $zip->addFile(ABSPATH . $path, $path);
    }
    if (!$zip->close() || !file_exists($zip_path)) {
      wp_delete_file($zip_path);
      return new \WP_Error('backup_zip', 'The restore point could not be written.');
    }
    $points = $this->get_restore_points();
    $points[$id] = ['kind' => 'core', 'plugin' => '__core__', 'files' => array_values($paths), 'createdAt' => time()];
    $this->save_restore_points($points);
    return $id;
  }

  /** Puts core files back from a "core" restore point: checked in staging first, then copied into place. */
  private function restore_core_point($id) {
    global $wp_filesystem;
    $points = $this->get_restore_points();
    if (!preg_match('/^[a-f0-9]{32}$/', $id) || !isset($points[$id]) || (isset($points[$id]['kind']) ? $points[$id]['kind'] : '') !== 'core') {
      return new \WP_Error('restore_missing', 'The restore point no longer exists.');
    }
    $zip = $this->backup_dir() . "/$id.zip";
    if (!file_exists($zip) || !$this->init_filesystem()) {
      return new \WP_Error('restore_missing', 'The restore point file is missing or files cannot be written.');
    }
    $files = array_values(array_filter((array) $points[$id]['files'], function ($path) {
      return $this->is_safe_core_path($path);
    }));
    $staging = $this->backup_dir() . '/restore-' . bin2hex(random_bytes(8));
    $unzipped = unzip_file($zip, $staging);
    foreach ($files as $path) {
      if (is_wp_error($unzipped) || !is_file("$staging/$path")) {
        $wp_filesystem->delete($staging, true);
        return new \WP_Error('restore_corrupt', 'The restore point could not be unpacked; nothing was changed.');
      }
    }
    foreach ($files as $path) {
      wp_mkdir_p(dirname(ABSPATH . $path));
      // phpcs:ignore PluginCheck.CodeAnalysis.WriteFile.ABSPATHDetected -- puts back core files from this plugin's own restore point.
      if (!@copy("$staging/$path", ABSPATH . $path)) {
        $wp_filesystem->delete($staging, true);
        return new \WP_Error('restore_write', sprintf('%s could not be written.', $path));
      }
      $this->invalidate_php_cache(ABSPATH . $path);
    }
    $wp_filesystem->delete($staging, true);
    return true;
  }

  /**
   * restore_core_files: replaces modified core files with the official copies
   * (each checked against the official checksum before anything is written).
   * `paths: "modified"` or a list. The previous contents go into a restore
   * point; if the site stops loading, they are put back at once.
   */
  private function apply_restore_core_files_action($action_id, $payload) {
    $type = 'restore_core_files';
    if (!$this->init_filesystem()) {
      return $this->action_result($action_id, $type, 'failed', 'WordPress cannot write files directly on this server. Reinstall WordPress from Dashboard → Updates instead.');
    }
    $checksums = $this->fetch_core_checksums(microtime(true) + 5.0);
    if (!is_array($checksums)) {
      return $this->action_result($action_id, $type, 'failed', 'Official WordPress checksums could not be loaded. Nothing was changed.');
    }

    $requested = isset($payload['paths']) ? $payload['paths'] : 'modified';
    if ($requested === 'modified') {
      $scan = $this->scan_core_files(microtime(true) + self::CORE_SCAN_BUDGET_SECONDS);
      $paths = $scan ? $scan['modified'] : [];
    } else {
      $paths = array_values(array_filter((array) $requested, function ($p) use ($checksums) {
        return $this->is_safe_core_path($p) && isset($checksums[$p]) && is_file(ABSPATH . $p) && md5_file(ABSPATH . $p) !== $checksums[$p];
      }));
    }
    $paths = array_slice(array_values(array_unique($paths)), 0, self::CORE_FILES_PER_ACTION);
    if (empty($paths)) {
      return $this->action_result($action_id, $type, 'skipped', 'All core files already match the official release.');
    }

    // Download and check the official copies first. Downloads share a budget that leaves
    // room for the backup, the writes and two health checks inside the SaaS's 60 s wait;
    // whatever does not fit is left for the next run.
    $download_deadline = microtime(true) + self::CORE_DOWNLOAD_BUDGET_SECONDS;
    $official = [];
    foreach ($paths as $path) {
      $remaining = $download_deadline - microtime(true);
      if ($remaining < 2.0) {
        break;
      }
      $content = $this->official_core_file($path, $checksums, min(15.0, $remaining));
      if (is_wp_error($content)) {
        return $this->action_result($action_id, $type, 'failed', $content->get_error_message() . ' Nothing was changed.');
      }
      $official[$path] = $content;
    }
    if (empty($official)) {
      return $this->action_result($action_id, $type, 'failed', 'The official files could not be downloaded in time. Nothing was changed.');
    }
    $left_over = count($paths) - count($official);
    $paths = array_keys($official);

    $baseline = $this->site_responds();
    $point = $this->create_core_restore_point($paths);
    if (is_wp_error($point)) {
      return $this->action_result($action_id, $type, 'failed', $point->get_error_message() . ' Nothing was changed.');
    }
    foreach ($official as $path => $content) {
      // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, PluginCheck.CodeAnalysis.WriteFile.ABSPATHDetected -- restores an official WordPress core file, verified against the official checksum.
      if (@file_put_contents(ABSPATH . $path, $content) === false) {
        $this->restore_core_point($point);
        return $this->action_result($action_id, $type, 'failed', sprintf('%s could not be written; every file was put back.', $path));
      }
      $this->invalidate_php_cache(ABSPATH . $path);
    }
    if ($baseline === true && $this->site_responds() === false) {
      $this->restore_core_point($point);
      return $this->action_result($action_id, $type, 'failed', 'The site stopped loading after the official files were restored, so the previous files were put back. The site may depend on these changes; review them with a developer.');
    }

    delete_transient('getsafe360_audit_scans');
    return $this->action_result(
      $action_id, $type, 'applied',
      sprintf('%d core file(s) restored to the official WordPress %s version.', count($paths), get_bloginfo('version'))
        . ($left_over > 0 ? sprintf(' %d more remain; run the restore again.', $left_over) : ''),
      ['files' => $paths],
      ['id' => $action_id . '-rollback', 'type' => 'restore_core_backup', 'payload' => ['restorePoint' => $point]]
    );
  }

  /**
   * quarantine_core_files: removes PHP files from wp-admin/wp-includes that are
   * not part of WordPress (a common hiding place for backdoors). They are kept
   * in a restore point and come back on undo, or at once if the site breaks.
   */
  private function apply_quarantine_core_files_action($action_id, $payload) {
    $type = 'quarantine_core_files';
    if (!$this->init_filesystem()) {
      return $this->action_result($action_id, $type, 'failed', 'WordPress cannot write files directly on this server. Ask your host to remove these files.');
    }
    $checksums = $this->fetch_core_checksums(microtime(true) + 5.0);
    if (!is_array($checksums)) {
      return $this->action_result($action_id, $type, 'failed', 'Official WordPress checksums could not be loaded. Nothing was changed.');
    }
    $requested = isset($payload['paths']) ? $payload['paths'] : 'unexpected';
    if ($requested === 'unexpected') {
      $scan = $this->scan_core_files(microtime(true) + self::CORE_SCAN_BUDGET_SECONDS);
      $paths = $scan ? $scan['unexpected'] : [];
    } else {
      $paths = array_values(array_filter((array) $requested, function ($p) use ($checksums) {
        return $this->is_unexpected_candidate($p) && !isset($checksums[$p]) && is_file(ABSPATH . $p);
      }));
    }
    $paths = array_slice(array_values(array_unique($paths)), 0, self::CORE_FILES_PER_ACTION);
    if (empty($paths)) {
      return $this->action_result($action_id, $type, 'skipped', 'No unexpected files were found in wp-admin or wp-includes.');
    }

    $baseline = $this->site_responds();
    $point = $this->create_core_restore_point($paths);
    if (is_wp_error($point)) {
      return $this->action_result($action_id, $type, 'failed', $point->get_error_message() . ' Nothing was changed.');
    }
    foreach ($paths as $path) {
      wp_delete_file(ABSPATH . $path);
      $this->invalidate_php_cache(ABSPATH . $path);
    }
    if ($baseline === true && $this->site_responds() === false) {
      $this->restore_core_point($point);
      return $this->action_result($action_id, $type, 'failed', 'The site stopped loading without these files, so they were put back. Review them with a developer.');
    }

    delete_transient('getsafe360_audit_scans');
    return $this->action_result(
      $action_id, $type, 'applied',
      sprintf('%d unexpected file(s) moved to quarantine.', count($paths)),
      ['files' => $paths],
      ['id' => $action_id . '-rollback', 'type' => 'restore_core_backup', 'payload' => ['restorePoint' => $point]]
    );
  }

  /** restore_core_backup: the undo of restore_core_files and quarantine_core_files. */
  private function apply_restore_core_backup_action($action_id, $payload) {
    $type = 'restore_core_backup';
    $id = isset($payload['restorePoint']) ? (string) $payload['restorePoint'] : '';
    $result = $this->restore_core_point($id);
    if ($result !== true) {
      return $this->action_result($action_id, $type, 'failed', $result->get_error_message());
    }
    delete_transient('getsafe360_audit_scans');
    $points = $this->get_restore_points();
    return $this->action_result($action_id, $type, 'applied', sprintf('%d file(s) put back as they were.', count($points[$id]['files'])), ['files' => $points[$id]['files']]);
  }

  /** Cached file-scan count for the audit: PHP files in wp-admin/wp-includes that are not part of WordPress. */
  private function audit_unexpected_core_files($deadline) {
    // The modified-file count has its own scan; here only the directory walk is needed.
    $scan = $this->scan_core_files($deadline, false);
    return ($scan === null || !$scan['complete']) ? null : count($scan['unexpected']);
  }

  // ---------- site audit (read-only) ----------

  const AUDIT_SCHEMA = 1;
  const AUDIT_CACHE_TTL = 43200; // 12 hours
  const AUDIT_SCAN_BUDGET_SECONDS = 4.0;

  /**
   * GET /wp-json/getsafe360/v1/audit
   *
   * Read-only health and security telemetry. Sends flags and counts only:
   * never usernames, emails, file contents or option values. Plugin slugs and
   * versions are included because outdated-plugin checks need them.
   * Pass ?refresh=1 to bypass the cached file scans.
   */
  public function route_audit(\WP_REST_Request $req) {
    $started = microtime(true);
    $refresh = (bool) $req->get_param('refresh');

    return [
      'success'     => true,
      'schema'      => self::AUDIT_SCHEMA,
      'generatedAt' => gmdate('c'),
      'core'        => $this->audit_core(),
      'security'    => $this->audit_security(),
      'plugins'     => $this->audit_plugins(),
      'themes'      => $this->audit_themes(),
      'performance' => $this->audit_performance(),
      'database'    => $this->audit_database(),
      'cron'        => $this->audit_cron(),
      'autoUpdates' => $this->audit_auto_updates(),
      'redFlags'    => $this->audit_red_flags($refresh),
      'environment' => $this->audit_environment(),
      'durationMs'  => (int) round((microtime(true) - $started) * 1000),
    ];
  }

  private function audit_core() {
    $update = get_site_transient('update_core');
    $update_available = null;
    if (is_object($update) && isset($update->updates) && is_array($update->updates)) {
      $update_available = false;
      foreach ($update->updates as $offer) {
        if (isset($offer->response) && $offer->response === 'upgrade') {
          $update_available = true;
          break;
        }
      }
    }

    return [
      'version'         => get_bloginfo('version'),
      'updateAvailable' => $update_available,
    ];
  }

  private function audit_security() {
    global $wpdb;
    $state = $this->get_action_state();

    $admins = get_users(['role' => 'administrator', 'fields' => 'ID', 'number' => 100]);
    $weak_admin_login = false;
    foreach (['admin', 'administrator'] as $login) {
      $user = get_user_by('login', $login);
      if ($user && user_can($user, 'manage_options')) {
        $weak_admin_login = true;
        break;
      }
    }

    $wp_config = $this->wp_config_path();
    $world_readable = null;
    if ($wp_config) {
      clearstatcache(true, $wp_config);
      $perms = @fileperms($wp_config);
      $world_readable = $perms === false ? null : (bool) ($perms & 0x0004);
    }

    return [
      'adminCount'           => is_array($admins) ? count($admins) : null,
      'hasAdminUsername'     => $weak_admin_login,
      'usersCanRegister'     => (bool) get_option('users_can_register'),
      'defaultRoleIsAdmin'   => get_option('default_role') === 'administrator',
      'fileEditDisabled'     => (defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT)
        || (defined('DISALLOW_FILE_MODS') && DISALLOW_FILE_MODS)
        || !empty($state['disableFileEditor']),
      'debug'                => defined('WP_DEBUG') && WP_DEBUG,
      'debugDisplay'         => defined('WP_DEBUG') && WP_DEBUG && (!defined('WP_DEBUG_DISPLAY') || WP_DEBUG_DISPLAY),
      'debugLog'             => defined('WP_DEBUG_LOG') && WP_DEBUG_LOG,
      'saltsConfigured'      => $this->audit_salts_configured(),
      'dbPrefixDefault'      => $wpdb->prefix === 'wp_',
      // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- reads the core setting.
      'xmlrpcEnabled'        => (bool) apply_filters('xmlrpc_enabled', true),
      'homeHttps'            => strpos(home_url(), 'https://') === 0,
      'adminHttps'           => defined('FORCE_SSL_ADMIN') && FORCE_SSL_ADMIN,
      'wpConfigWorldReadable' => $world_readable,
    ];
  }

  private function audit_salts_configured() {
    $keys = [
      'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY',
      'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT',
    ];
    $seen = [];
    foreach ($keys as $key) {
      if (!defined($key)) {
        return false;
      }
      $value = (string) constant($key);
      if (strlen($value) < 32 || stripos($value, 'put your unique phrase here') !== false || isset($seen[$value])) {
        return false;
      }
      $seen[$value] = true;
    }
    return true;
  }

  private function audit_plugins() {
    if (!function_exists('get_plugins')) {
      require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    $all = get_plugins();
    $active = (array) get_option('active_plugins', []);
    $updates = get_site_transient('update_plugins');
    $pending = (is_object($updates) && isset($updates->response) && is_array($updates->response))
      ? $updates->response
      : null;

    $items = [];
    $without_package = 0;
    foreach ($all as $file => $data) {
      $items[] = [
        'slug'            => strpos($file, '/') !== false ? strstr($file, '/', true) : basename($file, '.php'),
        'version'         => isset($data['Version']) ? (string) $data['Version'] : '',
        'active'          => in_array($file, $active, true) || (is_multisite() && is_plugin_active_for_network($file)),
        'updateAvailable' => $pending === null ? null : isset($pending[$file]),
        'newVersion'      => ($pending !== null && isset($pending[$file]->new_version)) ? (string) $pending[$file]->new_version : null,
      ];
      if ($pending !== null && isset($pending[$file]) && empty($pending[$file]->package)) {
        $without_package++;
      }
    }

    $active_count = count(array_filter($items, function ($item) { return $item['active']; }));

    return [
      'total'            => count($items),
      'active'           => $active_count,
      'inactive'         => count($items) - $active_count,
      'updatesAvailable' => $pending === null ? null : count(array_intersect_key($pending, $all)),
      'mustUse'          => count(get_mu_plugins()),
      // 1.8: whether the connector can install updates, and how many updates need a licence first.
      'updatesPossible'  => !is_multisite() && $this->plugin_updates_possible(),
      'updatesWithoutPackage' => $pending === null ? null : $without_package,
      'items'            => $items,
    ];
  }

  private function audit_themes() {
    $themes = wp_get_themes();
    $current = wp_get_theme();
    $updates = get_site_transient('update_themes');
    $pending = (is_object($updates) && isset($updates->response) && is_array($updates->response))
      ? $updates->response
      : null;

    $in_use = [$current->get_stylesheet() => true, $current->get_template() => true];

    return [
      'total'                 => count($themes),
      'inactive'              => count(array_diff_key($themes, $in_use)),
      'childTheme'            => $current->get_stylesheet() !== $current->get_template(),
      'activeUpdateAvailable' => $pending === null
        ? null
        : (isset($pending[$current->get_stylesheet()]) || isset($pending[$current->get_template()])),
    ];
  }

  private function audit_performance() {
    global $wpdb;

    $opcache = null;
    if (function_exists('opcache_get_status')) {
      $status = @opcache_get_status(false);
      $opcache = is_array($status) && !empty($status['opcache_enabled']);
    } elseif (!extension_loaded('Zend OPcache')) {
      $opcache = false;
    }

    $page_cache = (defined('WP_CACHE') && WP_CACHE && file_exists(WP_CONTENT_DIR . '/advanced-cache.php'));

    return [
      'phpVersion'       => PHP_VERSION,
      'mysqlVersion'     => $wpdb->db_version(),
      'memoryLimitBytes' => wp_convert_hr_to_bytes((string) ini_get('memory_limit')),
      'maxExecutionTime' => (int) ini_get('max_execution_time'),
      'opcache'          => $opcache,
      'objectCache'      => (bool) wp_using_ext_object_cache(),
      'pageCache'        => $page_cache,
    ];
  }

  // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- counts and cleanup on core tables need live results; there is no WordPress API for them.
  private function audit_database() {
    global $wpdb;

    $autoload = $wpdb->get_var(
      "SELECT SUM(LENGTH(option_value)) FROM {$wpdb->options} WHERE autoload IN ('yes','on','auto-on','auto')"
    );
    $expired = $this->count_expired_transients();
    $revisions = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'");

    $size = null;
    $suppress = $wpdb->suppress_errors(true);
    $size_value = $wpdb->get_var($wpdb->prepare(
      'SELECT SUM(data_length + index_length) FROM information_schema.TABLES WHERE table_schema = %s',
      DB_NAME
    ));
    $wpdb->suppress_errors($suppress);
    if ($size_value !== null) {
      $size = (int) $size_value;
    }

    return [
      'autoloadBytes'     => $autoload === null ? null : (int) $autoload,
      'expiredTransients' => $expired,
      'revisions'         => $revisions === null ? null : (int) $revisions,
      'revisionsRemovable' => $this->count_excess_revisions(),
      'sizeBytes'         => $size,
    ];
  }
  // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

  /** Mirrors Core_Upgrader::should_update_to_version() for minor releases. */
  private function audit_auto_updates() {
    $disabled = $this->auto_updater_disabled();

    $minor = get_site_option('auto_update_core_minor', 'enabled') === 'enabled';
    if (defined('WP_AUTO_UPDATE_CORE')) {
      $minor = WP_AUTO_UPDATE_CORE !== false;
    }
    $minor = (bool) apply_filters('allow_minor_auto_core_updates', $minor); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- reads the core setting.

    $installed = array_keys(get_plugins());
    $enabled = array_intersect($this->plugin_file_list(get_site_option('auto_update_plugins', [])), $installed);

    return [
      'updaterDisabled' => $disabled,
      'coreMinor'       => $disabled === true ? false : $minor,
      'pluginsAllowed'  => $disabled === true ? false : $this->plugin_auto_updates_allowed(),
      'pluginsEnabled'  => count($enabled),
      'pluginsTotal'    => count($installed),
    ];
  }

  private function audit_cron() {
    $events = 0;
    $overdue = 0;
    $cron = _get_cron_array();
    $threshold = time() - HOUR_IN_SECONDS;
    if (is_array($cron)) {
      foreach ($cron as $timestamp => $hooks) {
        $count = 0;
        foreach ((array) $hooks as $instances) {
          $count += is_array($instances) ? count($instances) : 0;
        }
        $events += $count;
        if ((int) $timestamp < $threshold) {
          $overdue += $count;
        }
      }
    }

    return [
      'disabled'  => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON,
      'alternate' => defined('ALTERNATE_WP_CRON') && ALTERNATE_WP_CRON,
      'events'    => $events,
      'overdue'   => $overdue,
    ];
  }

  /**
   * Expensive file scans, each under a time budget and cached for 12 hours.
   * A scan that runs out of time reports null (unknown), never a partial count.
   */
  private function audit_red_flags($refresh) {
    $cached = $refresh ? false : get_transient('getsafe360_audit_scans');
    if (is_array($cached)) {
      return $cached;
    }

    $deadline = microtime(true) + self::AUDIT_SCAN_BUDGET_SECONDS;
    $result = [
      'uploadsPhpFiles'    => $this->audit_count_uploads_php($deadline),
      'coreModifiedFiles'  => $this->audit_core_modified_files($deadline),
      'unexpectedCoreFiles' => $this->audit_unexpected_core_files($deadline),
      'scannedAt'          => gmdate('c'),
    ];
    set_transient('getsafe360_audit_scans', $result, self::AUDIT_CACHE_TTL);
    return $result;
  }

  private function audit_count_uploads_php($deadline) {
    $uploads = wp_upload_dir(null, false);
    $base = isset($uploads['basedir']) ? $uploads['basedir'] : '';
    if (!$base || !is_dir($base)) {
      return 0;
    }

    $count = 0;
    try {
      $iterator = new \RecursiveIteratorIterator(
        new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS),
        \RecursiveIteratorIterator::LEAVES_ONLY
      );
      foreach ($iterator as $file) {
        if (microtime(true) > $deadline) {
          return null;
        }
        if (!preg_match('/\.(php[0-9]?|phtml|phar)$/i', $file->getFilename())) {
          continue;
        }
        // Plugins drop tiny "Silence is golden" index.php files into upload
        // folders to block directory listing; those are not a red flag.
        if (strtolower($file->getFilename()) === 'index.php' && $file->getSize() <= 128) {
          $silence = (string) @file_get_contents($file->getPathname());
          if (preg_match('#^<\?php\s*(//[^\r\n]*|/\*.*?\*/)?\s*$#s', $silence)) {
            continue;
          }
        }
        $count++;
      }
    } catch (\Exception $e) {
      return null;
    }
    return $count;
  }

  private function audit_core_modified_files($deadline) {
    $checksums = $this->fetch_core_checksums($deadline);
    if (!is_array($checksums) || empty($checksums)) {
      return null;
    }

    $modified = 0;
    foreach ($checksums as $file => $md5) {
      if (microtime(true) > $deadline) {
        return null;
      }
      // wp-content is user territory, and bundled themes/plugins may be updated or removed.
      if (strpos($file, 'wp-content/') === 0) {
        continue;
      }
      $path = ABSPATH . $file;
      if (!file_exists($path)) {
        continue;
      }
      if (md5_file($path) !== $md5) {
        $modified++;
      }
    }
    return $modified;
  }

  private function audit_environment() {
    $active = (array) get_option('active_plugins', []);
    if (is_multisite()) {
      // Network-activated plugins live in a site option, not in active_plugins.
      $active = array_merge($active, array_keys((array) get_site_option('active_sitewide_plugins', [])));
    }
    $has = function ($needle) use ($active) {
      foreach ($active as $file) {
        if (strpos($file, $needle) === 0) {
          return true;
        }
      }
      return false;
    };

    $multilingual = null;
    if ($has('sitepress-multilingual-cms/')) {
      $multilingual = 'wpml';
    } elseif ($has('polylang/') || $has('polylang-pro/')) {
      $multilingual = 'polylang';
    } elseif ($has('translatepress-multilingual/')) {
      $multilingual = 'translatepress';
    }

    return [
      'multisite'    => is_multisite(),
      'woocommerce'  => $has('woocommerce/'),
      'multilingual' => $multilingual,
      'locale'       => get_locale(),
    ];
  }

  // ---------- 1.12 GEO fixes: llms.txt, AI crawler rules, schema gaps, SEO meta ----------

  /** AI crawlers whose robots.txt rules the connector may set (same list the SaaS measures). */
  const AI_CRAWLERS = [
    'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
    'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot',
    'Meta-ExternalAgent', 'Bytespider',
  ];
  const LLMS_TXT_OPTION = 'getsafe360_llms_txt';
  const AI_CRAWLER_OPTION = 'getsafe360_ai_crawler_rules';
  const SCHEMA_OPTION = 'getsafe360_schema';
  const META_TITLE_KEY = '_getsafe360_seo_title';
  const META_DESCRIPTION_KEY = '_getsafe360_seo_description';
  const LLMS_TXT_MAX_BYTES = 65536;

  /** The SEO plugin that owns titles, descriptions and site schema, if any. */
  private function seo_plugin() {
    if (defined('WPSEO_VERSION')) return 'yoast';
    if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) return 'rank-math';
    if (defined('AIOSEO_VERSION')) return 'aioseo';
    if (defined('SEOPRESS_VERSION')) return 'seopress';
    return null;
  }

  /** llms.txt and robots.txt live at the domain root: only a root install can serve them. */
  private function serves_domain_root() {
    $path = wp_parse_url(home_url('/'), PHP_URL_PATH);
    return $path === null || $path === '/';
  }

  /** Serves the stored llms.txt (a real file on disk wins: the web server answers before WordPress). */
  public function serve_llms_txt() {
    if (!isset($_SERVER['REQUEST_URI'])) return;
    $path = wp_parse_url(esc_url_raw(wp_unslash($_SERVER['REQUEST_URI'])), PHP_URL_PATH);
    if ($path !== '/llms.txt' || !$this->serves_domain_root()) return;
    $content = get_option(self::LLMS_TXT_OPTION, '');
    if (!is_string($content) || $content === '') return;
    status_header(200);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    // Plain text with nosniff: nothing in it is interpreted as markup.
    echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- served as text/plain.
    exit;
  }

  /** Markdown text safe to store: valid UTF-8, no control characters but tabs and newlines. */
  private function clean_llms_txt($text) {
    if (!is_string($text)) return '';
    $text = wp_check_invalid_utf8(str_replace(["\r\n", "\r"], "\n", $text), true);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
    return trim($text) . "\n";
  }

  private function apply_llms_txt_action($action_id, $payload) {
    $type = 'set_llms_txt';
    $previous = get_option(self::LLMS_TXT_OPTION, '');
    $previous = is_string($previous) && $previous !== '' ? $previous : null;
    $state = function ($content) { return ['llmsTxt' => $content !== null]; };

    if (!array_key_exists('content', $payload)) {
      return $this->action_result($action_id, $type, 'failed', 'No llms.txt content given. Nothing was changed.', $state($previous));
    }
    if ($payload['content'] === null) {
      delete_option(self::LLMS_TXT_OPTION);
      return $this->action_result($action_id, $type, 'applied', 'llms.txt removed.', $state(null),
        ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => ['content' => $previous]]);
    }
    if (!$this->serves_domain_root()) {
      return $this->action_result($action_id, $type, 'failed', 'WordPress runs in a subfolder, so it cannot answer at /llms.txt. Nothing was changed.', $state($previous));
    }
    if (file_exists(ABSPATH . 'llms.txt')) {
      return $this->action_result($action_id, $type, 'failed', 'An llms.txt file already exists on the server and takes precedence. Nothing was changed.', $state($previous));
    }
    $content = $this->clean_llms_txt($payload['content']);
    if (strpos($content, '# ') !== 0 || strlen($content) > self::LLMS_TXT_MAX_BYTES) {
      return $this->action_result($action_id, $type, 'failed', 'llms.txt must start with a "# " title and stay under 64 KB. Nothing was changed.', $state($previous));
    }
    update_option(self::LLMS_TXT_OPTION, $content, false);
    return $this->action_result($action_id, $type, 'applied', 'llms.txt is now served at /llms.txt.', $state($content),
      ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => ['content' => $previous]]);
  }

  /** The stored per-crawler rules: agent => 'allow' | 'block'. */
  private function get_ai_crawler_rules() {
    $rules = get_option(self::AI_CRAWLER_OPTION, []);
    return is_array($rules) ? array_intersect_key($rules, array_flip(self::AI_CRAWLERS)) : [];
  }

  /** robots.txt as WordPress and other plugins write it, without the connector's rules. */
  private function robots_without_ours() {
    remove_filter('robots_txt', [$this, 'filter_robots_txt'], 99);
    // The same start do_robots() gives other filters.
    $public = (bool) get_option('blog_public');
    $output = "User-agent: *\n"
      . 'Disallow: ' . wp_parse_url(admin_url(), PHP_URL_PATH) . "\n"
      . 'Allow: ' . wp_parse_url(admin_url('admin-ajax.php'), PHP_URL_PATH) . "\n";
    // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core's own robots.txt filter.
    $output = (string) apply_filters('robots_txt', $output, $public);
    add_filter('robots_txt', [$this, 'filter_robots_txt'], 99, 2);
    return $output;
  }

  /** Agents (lower-case) that already have their own group in a robots.txt text. */
  private function robots_agents($robots) {
    preg_match_all('/^\s*user-agent\s*:\s*(\S+)/mi', $robots, $m);
    return array_map('strtolower', $m[1]);
  }

  /** The `*` group's path rules, minus a blanket block, so an allowed AI crawler keeps the site's private paths. */
  private function wildcard_path_rules($robots) {
    $rules = [];
    $agents = [];       // agents of the current group
    $in_rules = false;  // a rule line ends the run of user-agent lines that opens a group
    foreach (preg_split('/\r?\n/', $robots) as $line) {
      $line = trim(preg_replace('/#.*/', '', $line));
      if ($line === '') continue;
      if (preg_match('/^user-agent\s*:\s*(\S+)/i', $line, $m)) {
        if ($in_rules) {
          $agents = [];
          $in_rules = false;
        }
        $agents[] = $m[1];
        continue;
      }
      if (preg_match('/^(allow|disallow)\s*:\s*(\S*)/i', $line, $m)) {
        $in_rules = true;
        if (!in_array('*', $agents, true)) continue;
        $path = $m[2];
        if (strtolower($m[1]) === 'disallow' && ($path === '/' || $path === '')) continue;
        $rules[] = ucfirst(strtolower($m[1])) . ': ' . $path;
      }
    }
    return array_values(array_unique($rules));
  }

  /** Appends the connector's AI crawler groups to the virtual robots.txt. */
  public function filter_robots_txt($output, $public) {
    if (!$public) return $output; // "Discourage search engines" stays absolute (WordPress passes a bool).
    $rules = $this->get_ai_crawler_rules();
    if (empty($rules)) return $output;
    $existing = $this->robots_agents($output);
    $path_rules = $this->wildcard_path_rules($output);
    $groups = [];
    foreach ($rules as $agent => $rule) {
      if (in_array(strtolower($agent), $existing, true)) continue; // Never contradict a group someone else wrote.
      $lines = $rule === 'block' ? ['Disallow: /'] : array_merge(['Allow: /'], $path_rules);
      $groups[] = 'User-agent: ' . $agent . "\n" . implode("\n", $lines);
    }
    if (empty($groups)) return $output;
    return rtrim($output) . "\n\n# GetSafe 360 AI: AI crawler rules\n" . implode("\n\n", $groups) . "\n";
  }

  private function apply_ai_crawler_rules_action($action_id, $payload) {
    $type = 'set_ai_crawler_rules';
    $previous = $this->get_ai_crawler_rules();
    $requested = isset($payload['rules']) && is_array($payload['rules']) ? $payload['rules'] : [];
    $state = function ($rules) { return ['aiCrawlerRules' => empty($rules) ? new \stdClass() : $rules]; };

    if (empty($requested)) {
      return $this->action_result($action_id, $type, 'failed', 'No crawler rules given. Nothing was changed.', $state($previous));
    }
    if (file_exists(ABSPATH . 'robots.txt')) {
      return $this->action_result($action_id, $type, 'failed', 'A robots.txt file exists on the server, so WordPress does not write robots.txt. Edit that file instead. Nothing was changed.', $state($previous));
    }
    if (!$this->serves_domain_root()) {
      return $this->action_result($action_id, $type, 'failed', 'WordPress runs in a subfolder, so its robots.txt is not the one crawlers read. Nothing was changed.', $state($previous));
    }
    if (!get_option('blog_public')) {
      return $this->action_result($action_id, $type, 'failed', '"Discourage search engines" is on in Settings > Reading, so no crawler rules are added. Nothing was changed.', $state($previous));
    }

    $others = $this->robots_agents($this->robots_without_ours());
    $next = $previous;
    $restore = [];
    $conflicts = [];
    foreach ($requested as $agent => $rule) {
      if (!in_array($agent, self::AI_CRAWLERS, true) || !in_array($rule, ['allow', 'block', null], true)) {
        return $this->action_result($action_id, $type, 'failed', 'Unsupported crawler or rule: ' . sanitize_text_field((string) $agent) . '. Nothing was changed.', $state($previous));
      }
      if ($rule !== null && in_array(strtolower($agent), $others, true)) {
        $conflicts[] = $agent;
        continue;
      }
      $restore[$agent] = isset($previous[$agent]) ? $previous[$agent] : null;
      if ($rule === null) {
        unset($next[$agent]);
      } else {
        $next[$agent] = $rule;
      }
    }
    if (empty($restore)) {
      return $this->action_result($action_id, $type, 'skipped', 'robots.txt already has its own rules for ' . implode(', ', $conflicts) . '. Nothing was changed.', $state($previous));
    }

    update_option(self::AI_CRAWLER_OPTION, $next, false);
    $message = sprintf('%d AI crawler rule(s) set in robots.txt.', count($restore));
    if (!empty($conflicts)) {
      $message .= ' Left alone, as robots.txt already has rules for them: ' . implode(', ', $conflicts) . '.';
    }
    return $this->action_result($action_id, $type, 'applied', $message, $state($next),
      ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => ['rules' => $restore]]);
  }

  /** Stored schema settings: which types to add and the organisation's profiles. */
  private function get_schema_settings() {
    $settings = get_option(self::SCHEMA_OPTION, []);
    return is_array($settings) ? $settings : [];
  }

  /** The Organization and WebSite JSON-LD graph for the home page, from WordPress's own settings. */
  private function schema_graph($settings) {
    $home = home_url('/');
    $graph = [];
    $types = isset($settings['types']) && is_array($settings['types']) ? $settings['types'] : [];
    if (in_array('Organization', $types, true)) {
      $org = ['@type' => 'Organization', '@id' => $home . '#organization', 'name' => get_bloginfo('name'), 'url' => $home];
      $logo_id = (int) get_theme_mod('custom_logo');
      $logo = $logo_id ? wp_get_attachment_image_url($logo_id, 'full') : get_site_icon_url(512);
      if ($logo) $org['logo'] = $logo;
      if (!empty($settings['sameAs'])) $org['sameAs'] = array_values($settings['sameAs']);
      $graph[] = $org;
    }
    if (in_array('WebSite', $types, true)) {
      $site = ['@type' => 'WebSite', '@id' => $home . '#website', 'name' => get_bloginfo('name'), 'url' => $home];
      $tagline = get_bloginfo('description');
      if ($tagline) $site['description'] = $tagline;
      if (in_array('Organization', $types, true)) $site['publisher'] = ['@id' => $home . '#organization'];
      $site['potentialAction'] = [
        '@type' => 'SearchAction',
        'target' => ['@type' => 'EntryPoint', 'urlTemplate' => home_url('/?s={search_term_string}')],
        'query-input' => 'required name=search_term_string',
      ];
      $graph[] = $site;
    }
    return $graph;
  }

  /** Home-page schema, only while no SEO plugin writes its own (it would be a duplicate). */
  public function output_schema() {
    if (!is_front_page() || $this->seo_plugin() !== null) return;
    $graph = $this->schema_graph($this->get_schema_settings());
    if (empty($graph)) return;
    echo "\n<script type=\"application/ld+json\">"
      . wp_json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
      . "</script>\n";
  }

  private function apply_schema_action($action_id, $payload) {
    $type = 'set_schema';
    $previous = $this->get_schema_settings();
    $state = function ($settings) { return ['schema' => empty($settings) ? new \stdClass() : $settings]; };
    $rollback = ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => empty($previous) ? ['types' => []] : $previous];

    $types = isset($payload['types']) && is_array($payload['types']) ? array_values(array_unique($payload['types'])) : null;
    if ($types === null || array_diff($types, ['Organization', 'WebSite'])) {
      return $this->action_result($action_id, $type, 'failed', 'Only Organization and WebSite schema can be added. Nothing was changed.', $state($previous));
    }
    if (empty($types)) {
      delete_option(self::SCHEMA_OPTION);
      return $this->action_result($action_id, $type, 'applied', 'Home-page schema removed.', $state([]), $rollback);
    }
    $plugin = $this->seo_plugin();
    if ($plugin !== null) {
      return $this->action_result($action_id, $type, 'skipped', sprintf('%s already writes the site schema; set the organisation there to avoid duplicates. Nothing was changed.', $plugin), $state($previous));
    }
    $same_as = [];
    foreach (isset($payload['sameAs']) && is_array($payload['sameAs']) ? array_slice($payload['sameAs'], 0, 10) : [] as $url) {
      $url = esc_url_raw((string) $url, ['https']);
      if ($url !== '') $same_as[] = $url;
    }
    $next = ['types' => $types, 'sameAs' => $same_as];
    update_option(self::SCHEMA_OPTION, $next, false);
    return $this->action_result($action_id, $type, 'applied', sprintf('%s schema added to the home page.', implode(' and ', $types)), $state($next), $rollback);
  }

  /** Where titles and descriptions are kept: the SEO plugin's own fields, or the connector's. */
  private function meta_keys($plugin) {
    if ($plugin === 'yoast') return ['title' => '_yoast_wpseo_title', 'description' => '_yoast_wpseo_metadesc'];
    if ($plugin === 'rank-math') return ['title' => 'rank_math_title', 'description' => 'rank_math_description'];
    if ($plugin === null) return ['title' => self::META_TITLE_KEY, 'description' => self::META_DESCRIPTION_KEY];
    return null;
  }

  /** The published post or page behind a site path, or 0. */
  private function post_for_path($path) {
    if (!is_string($path) || $path === '' || $path[0] !== '/') return 0;
    if ($path === '/') {
      return get_option('show_on_front') === 'page' ? (int) get_option('page_on_front') : 0;
    }
    $id = url_to_postid(home_url($path));
    if (!$id) {
      // Plain permalinks: url_to_postid only knows ?p= addresses; look the slug path up instead.
      $post = get_page_by_path(trim($path, '/'), OBJECT, ['page', 'post']);
      $id = $post ? $post->ID : 0;
    }
    return $id && get_post_status($id) === 'publish' ? (int) $id : 0;
  }

  private function apply_seo_meta_action($action_id, $payload) {
    $type = 'set_seo_meta';
    $plugin = $this->seo_plugin();
    $keys = $this->meta_keys($plugin);
    if ($keys === null) {
      return $this->action_result($action_id, $type, 'skipped', sprintf('Titles and descriptions are managed by %s, which the connector does not write to yet. Nothing was changed.', $plugin));
    }
    $post_id = isset($payload['postId']) ? absint($payload['postId']) : $this->post_for_path(isset($payload['path']) ? $payload['path'] : '');
    if (!$post_id || !get_post($post_id)) {
      $message = isset($payload['path']) && $payload['path'] === '/'
        ? 'The home page lists the latest posts; set its title and description in the SEO settings. Nothing was changed.'
        : 'No published page found for this address. Nothing was changed.';
      return $this->action_result($action_id, $type, 'failed', $message);
    }

    $limits = ['title' => 120, 'description' => 320];
    // An undo puts back what was there before, which the SEO plugin may have allowed to be longer.
    $restoring = !empty($payload['restore']);
    $values = [];
    foreach ($limits as $field => $max) {
      if (!array_key_exists($field, $payload)) continue;
      if ($payload[$field] === null) {
        $values[$field] = null;
        continue;
      }
      if ($restoring) $max = 2000;
      $value = sanitize_text_field((string) $payload[$field]);
      if ($value === '' || mb_strlen($value) > $max) {
        return $this->action_result($action_id, $type, 'failed', sprintf('The %s must be 1 to %d characters. Nothing was changed.', $field, $max));
      }
      $values[$field] = $value;
    }
    if (empty($values)) {
      return $this->action_result($action_id, $type, 'failed', 'No title or description given. Nothing was changed.');
    }

    $restore = ['postId' => $post_id, 'restore' => true];
    foreach ($values as $field => $value) {
      $old = get_post_meta($post_id, $keys[$field], true);
      $restore[$field] = $old === '' ? null : $old;
      if ($value === null) {
        delete_post_meta($post_id, $keys[$field]);
      } else {
        update_post_meta($post_id, $keys[$field], $value);
      }
    }
    $where = $plugin === 'yoast' ? 'Yoast SEO' : ($plugin === 'rank-math' ? 'Rank Math' : 'the page');
    return $this->action_result($action_id, $type, 'applied', sprintf('Updated %s of "%s" in %s.', implode(' and ', array_keys($values)), get_the_title($post_id), $where),
      ['postId' => $post_id, 'seoPlugin' => $plugin],
      ['id' => $action_id . '-rollback', 'type' => $type, 'payload' => $restore]);
  }

  /** The connector's own title, used only while no SEO plugin is active. */
  public function filter_document_title($title) {
    if ($this->seo_plugin() !== null || !is_singular()) return $title;
    $own = get_post_meta(get_queried_object_id(), self::META_TITLE_KEY, true);
    return is_string($own) && $own !== '' ? $own : $title;
  }

  /** The connector's own meta description, used only while no SEO plugin is active. */
  public function output_meta_description() {
    if ($this->seo_plugin() !== null || !is_singular()) return;
    $own = get_post_meta(get_queried_object_id(), self::META_DESCRIPTION_KEY, true);
    if (is_string($own) && $own !== '') {
      echo '<meta name="description" content="' . esc_attr($own) . "\">\n";
    }
  }

  /** What the SaaS needs to choose GEO fixes that fit this site. */
  private function seo_environment() {
    return [
      'seoPlugin'      => $this->seo_plugin(),
      'rootInstall'    => $this->serves_domain_root(),
      'robotsFile'     => file_exists(ABSPATH . 'robots.txt'),
      'llmsFile'       => file_exists(ABSPATH . 'llms.txt'),
      'searchVisible'  => (bool) get_option('blog_public'),
      'staticHomePage' => get_option('show_on_front') === 'page' && (int) get_option('page_on_front') > 0,
      'llmsTxt'        => get_option(self::LLMS_TXT_OPTION, '') !== '',
      'aiCrawlerRules' => empty($this->get_ai_crawler_rules()) ? new \stdClass() : $this->get_ai_crawler_rules(),
      'schemaTypes'    => isset($this->get_schema_settings()['types']) ? $this->get_schema_settings()['types'] : [],
    ];
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

    // Audit endpoint - read-only health and security telemetry (flags and counts only)
    register_rest_route('getsafe360/v1', '/audit', [
      'methods' => 'GET',
      'callback' => [$this, 'route_audit'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);

    // Core integrity (1.9): modified/unexpected core file paths, and one file's changed lines
    register_rest_route('getsafe360/v1', '/core-files', [
      'methods' => 'GET',
      'callback' => [$this, 'route_core_files'],
      'permission_callback' => [$this, 'auth_api_key']
    ]);
    register_rest_route('getsafe360/v1', '/core-files/diff', [
      'methods' => 'GET',
      'callback' => [$this, 'route_core_file_diff'],
      'permission_callback' => [$this, 'auth_api_key'],
      'args' => ['path' => ['required' => true, 'type' => 'string']],
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
          // Only <meta>, <link> and valid JSON-LD survive; everything else is dropped.
          $safe_snippet = $this->sanitize_head_snippet($snippet);

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
    if (empty($injections) || !is_array($injections)) return;

    echo "\n<!-- GetSafe360 SEO fixes -->\n";
    foreach ($injections as $id => $snippet) {
      echo '<!-- fix:' . esc_html(str_replace('--', '', (string) $id)) . " -->\n";
      // Sanitised again on output, so nothing stored earlier can reach the page unchecked.
      echo wp_kses($this->sanitize_head_snippet((string) $snippet), self::HEAD_HTML + ['script' => ['type' => []]]) . "\n";
    }
    echo "<!-- /GetSafe360 SEO fixes -->\n";
  }

  /**
   * Head markup an SEO fix may add: <meta> and <link> tags from an allowlist,
   * and JSON-LD blocks whose content is valid JSON, re-encoded so it cannot
   * close the script element. Anything else, including text, is dropped.
   */
  private function sanitize_head_snippet($snippet) {
    $out = [];
    if (preg_match_all('/<(?:meta|link)\b[^>]*>/i', $snippet, $tags)) {
      foreach ($tags[0] as $tag) {
        $clean = trim(wp_kses($tag, self::HEAD_HTML));
        if ($clean !== '') {
          $out[] = $clean;
        }
      }
    }
    if (preg_match_all('/<script\b[^>]*\btype\s*=\s*["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $snippet, $blocks)) {
      foreach ($blocks[1] as $json) {
        $data = json_decode(trim($json), true);
        if (is_array($data)) {
          $out[] = '<script type="application/ld+json">'
            . wp_json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            . '</script>';
        }
      }
    }
    return implode("\n", $out);
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
      'securityHeaders' => $this->get_security_headers(),
      'seo' => $this->seo_environment(),
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

      $action_payload = isset($action['payload']) && is_array($action['payload']) ? $action['payload'] : [];
      $handlers = [
        'set_security_headers'    => 'apply_security_headers_action',
        'set_config_permissions'  => 'apply_config_permissions_action',
        'set_default_role'        => 'apply_default_role_action',
        'set_plugin_auto_updates' => 'apply_plugin_auto_updates_action',
        'cleanup_database'        => 'apply_cleanup_action',
        'update_plugins'          => 'apply_update_plugins_action',
        'restore_plugins'         => 'apply_restore_plugins_action',
        'restore_core_files'      => 'apply_restore_core_files_action',
        'quarantine_core_files'   => 'apply_quarantine_core_files_action',
        'restore_core_backup'     => 'apply_restore_core_backup_action',
        'set_llms_txt'            => 'apply_llms_txt_action',
        'set_ai_crawler_rules'    => 'apply_ai_crawler_rules_action',
        'set_schema'              => 'apply_schema_action',
        'set_seo_meta'            => 'apply_seo_meta_action',
      ];
      if (isset($handlers[$action_type])) {
        $results[] = $this->{$handlers[$action_type]}($action_id, $action_payload);
        continue;
      }

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

      if (!isset(self::SETTING_LABELS[$key])) {
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

      // The background updater must be running for the security-update switch to mean anything.
      if ($key === 'enableCoreSecurityUpdates' && $enabled && $this->auto_updater_disabled()) {
        $results[] = [
          'id' => $action_id,
          'type' => $action_type,
          'status' => 'failed',
          'message' => 'WordPress automatic updates are switched off on this site (AUTOMATIC_UPDATER_DISABLED, DISALLOW_FILE_MODS or the host). Nothing was changed.',
          'state' => $state,
          'rollback' => null,
        ];
        continue;
      }

      $previous = !empty($state[$key]);
      $state[$key] = $enabled;
      $this->update_action_state($state);

      $label = self::SETTING_LABELS[$key];

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
        'securityHeaders'      => true,
        'siteAudit'            => true,
        'rollback'             => true,
        'securityDisableFileEditor' => true,
        'securityDefaultRole'  => true,
        'securityConfigPermissions' => true,
        'autoUpdatesCore'      => true,
        'autoUpdatesPlugins'   => true,
        'databaseCleanup'      => true,
        'pluginUpdates'        => true,
        'coreIntegrity'        => true,
        'securityCsp'          => true,
        'llmsTxt'              => true,
        'aiCrawlerRules'       => true,
        'schemaGaps'           => true,
        'seoMeta'              => true,
      ],
      'seo'                => $this->seo_environment(),
    ];
  }
}

new GetSafe360_AI();
