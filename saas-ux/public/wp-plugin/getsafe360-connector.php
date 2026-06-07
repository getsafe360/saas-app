<?php
/**
 * Plugin Name: GetSafe 360 AI Connector
 * Description: Secure connector between your WordPress site and GetSafe 360 AI for automated security scanning, performance monitoring, and AI-powered repairs.
 * Version: 0.3.0
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
  const VERSION = '0.3.0';
  const OPTION = 'getsafe360_connector';
  const API_BASE = 'https://saasfly-one-psi.vercel.app';

  public function __construct() {
    load_plugin_textdomain('getsafe360-connector', false, dirname(plugin_basename(__FILE__)) . '/languages');
    add_action('admin_menu', [$this, 'menu']);
    add_action('rest_api_init', [$this, 'routes']);
    add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
    add_action('wp_head', [$this, 'output_seo_injections'], 5);
    add_filter('update_plugins_www.getsafe360.ai', [$this, 'check_for_update'], 10, 4);
    add_filter('plugins_api', [$this, 'plugin_api_info'], 10, 3);
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

  // ---------- admin UI ----------

  public function menu() {
    add_menu_page(
      'GetSafe 360 AI',
      'GetSafe 360 AI',
      'manage_options',
      'getsafe360',
      [$this, 'admin_page'],
      'dashicons-shield-alt',
      80
    );
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

          $this->render_notice('success', __('Successfully Connected!', 'getsafe360-connector'), __('Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard.', 'getsafe360-connector'), $debug);
        } else {
          // User-friendly error messages based on server response
          $server_error = is_array($body_json) && isset($body_json['error']) ? $body_json['error'] : 'Handshake error';

          $user_message = '';
          if (strpos($server_error, 'invalid_or_expired') !== false || strpos($server_error, 'code_expired') !== false) {
            $user_message = __('This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard.', 'getsafe360-connector');
          } else if (strpos($server_error, 'already_used') !== false) {
            $user_message = __('This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard.', 'getsafe360-connector');
          } else {
            $user_message = $server_error;
          }

          $this->render_notice('error', __('Connection Failed', 'getsafe360-connector'), $user_message, $debug);
        }
      }
    }

    $opt = get_option(self::OPTION, []);
    $is_connected = !empty($opt['site_token']);
    ?>
      <div class="wrap getsafe360-container">
        <h1 style="display: flex; align-items: center; gap: 12px;">
          <span class="dashicons dashicons-shield-alt" style="font-size: 32px; color: #0073aa;"></span>
          <?php esc_html_e('GetSafe 360 Connector', 'getsafe360-connector'); ?>
        </h1>
        <p><?php printf(esc_html__('Version %s', 'getsafe360-connector'), esc_html(self::VERSION)); ?></p>

        <?php if (!$is_connected): ?>
          <!-- NOT CONNECTED STATE -->
          <div class="getsafe360-card">
            <h2><?php esc_html_e('Connect Your WordPress Site', 'getsafe360-connector'); ?></h2>
            <p><?php esc_html_e('Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs.', 'getsafe360-connector'); ?></p>

            <div class="getsafe360-help">
              <strong><?php esc_html_e('How to connect:', 'getsafe360-connector'); ?></strong>
              <ol style="margin: 8px 0 0 20px;">
                <li><?php printf(
                  __('Log in to your %1$sGetSafe 360 dashboard%2$s', 'getsafe360-connector'),
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
                />
              </p>
              <p>
                <button type="submit" class="getsafe360-btn-primary">
                  <span class="dashicons dashicons-admin-links" style="margin-top: 4px;"></span>
                  <?php esc_html_e('Connect to GetSafe 360', 'getsafe360-connector'); ?>
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
              '<a href="https://www.getsafe360.ai/docs" target="_blank">',
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
        // Strip any PHP tags and only allow HTML / JSON-LD content for safety
        // wp_kses strips <script> entirely; JSON-LD is handled in the fallback below.
        $safe_snippet = wp_kses($snippet, [
          'meta' => ['name' => [], 'property' => [], 'content' => [], 'charset' => [], 'http-equiv' => []],
          'link' => ['rel' => [], 'href' => [], 'type' => [], 'sizes' => []],
        ]);

        // Always extract JSON-LD blocks from the original snippet and append them.
        // wp_kses strips <script> entirely, so this runs regardless of whether
        // wp_kses already preserved <meta>/<link> tags from a mixed snippet.
        $jsonld_blocks = [];
        preg_match_all(
          '/<script\s[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>.*?<\/script>/is',
          $snippet,
          $jsonld_blocks
        );
        if (!empty($jsonld_blocks[0])) {
          $safe_snippet = trim($safe_snippet . "\n" . implode("\n", $jsonld_blocks[0]));
        }

        if (!empty(trim($safe_snippet))) {
          $injections[$fix_id]  = $safe_snippet;
          $fix_log[$fix_id]['status'] = 'applied';
          $applied[] = $fix_id;
        } else {
          $skipped[] = $fix_id;
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
      'icons'        => [],
      'banners'      => [],
      'tested'       => sanitize_text_field($data['tested'] ?? ''),
      'requires_php' => '7.2',
    ];
  }

  /**
   * Provide plugin details for the "View version X details" popup in WP admin.
   */
  public function plugin_api_info($result, $action, $args) {
    if ($action !== 'plugin_information') return $result;
    if (empty($args->slug) || $args->slug !== 'getsafe360-connector') return $result;

    $remote = wp_remote_get(trailingslashit(self::API_BASE) . 'api/wp-plugin/info', [
      'timeout' => 10,
      'headers' => ['Accept' => 'application/json'],
    ]);

    if (is_wp_error($remote) || wp_remote_retrieve_response_code($remote) !== 200) {
      return $result;
    }

    $data = json_decode(wp_remote_retrieve_body($remote), true);
    if (!is_array($data)) return $result;

    return (object) [
      'name'          => 'GetSafe 360 AI Connector',
      'slug'          => 'getsafe360-connector',
      'version'       => sanitize_text_field($data['version'] ?? self::VERSION),
      'author'        => '<a href="https://www.getsafe360.ai">GetSafe 360 AI</a>',
      'homepage'      => 'https://www.getsafe360.ai',
      'requires'      => '5.0',
      'tested'        => sanitize_text_field($data['tested'] ?? ''),
      'requires_php'  => '7.2',
      'download_link' => esc_url_raw($data['download_url'] ?? ''),
      'sections'      => [
        'description' => wp_kses_post($data['description'] ?? ''),
        'changelog'   => wp_kses_post($data['changelog'] ?? ''),
      ],
    ];
  }
}

new GetSafe360_Connector();
