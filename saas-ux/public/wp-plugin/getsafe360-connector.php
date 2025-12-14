<?php
/**
 * Plugin Name: GetSafe 360 Connector
 * Description: Secure connector between your site and GetSafe 360.
 * Version: 0.1.1
 */
/*
// saas-ux/public/wp-plugin/getsafe360-connector.php
// saas-ux/public/wp-plugin/getsafe360-connector.zip
*/
if (!defined('ABSPATH')) exit;

class GetSafe360_Connector {
  const OPTION = 'getsafe360_connector';
  const API_BASE = 'https://saasfly-one-psi.vercel.app';

  public function __construct() {
    add_action('admin_menu', [$this, 'menu']);
    add_action('rest_api_init', [$this, 'routes']);
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

    if ($debug) {
      echo '<details style="margin: 8px 0;"><summary>Debug</summary>';
      echo '<pre style="white-space: pre-wrap; font-size: 11px; background:#f6f7f7; padding:8px; border:1px solid #ccd0d4; overflow:auto;">';
      echo esc_html(wp_json_encode($debug, JSON_PRETTY_PRINT));
      echo '</pre></details>';
    }
    echo '</div>';
  }

  // ---------- admin UI ----------

  public function menu() {
    add_menu_page('GetSafe 360', 'GetSafe 360', 'manage_options', 'getsafe360', [$this, 'admin_page'], 'dashicons-shield', 80);
  }

  public function admin_page() {
    // Handle disconnect
    if (isset($_POST['disconnect']) && check_admin_referer('getsafe360_disconnect')) {
      delete_option(self::OPTION);
      $this->render_notice('success', 'Disconnected', 'This site is no longer linked to GetSafe 360.');
    }

    // Handle connect
    if (isset($_POST['pair_code']) && check_admin_referer('getsafe360_connect')) {
      $pair_code = sanitize_text_field($_POST['pair_code']);
      $site_url = get_site_url();
      $payload = [
        'pairCode'      => $pair_code,
        'siteUrl'       => $site_url,
        'wpVersion'     => get_bloginfo('version'),
        'pluginVersion' => '0.1.1'
      ];

      $endpoint = trailingslashit(self::API_BASE) . 'api/connect/handshake';
      $headers  = $this->api_headers();

      $resp = wp_remote_post($endpoint, [
        'headers'   => $headers,
        'body'      => wp_json_encode($payload),
        'timeout'   => 20,
        'sslverify' => true,
      ]);

      // Build debug context early
      $debug = [
        'api_base'   => self::API_BASE,
        'endpoint'   => $endpoint,
        'payload'    => $payload,
        'headers'    => array_merge($headers, [
          // mask the bypass token in debug output
          'x-vercel-protection-bypass' => isset($headers['x-vercel-protection-bypass'])
            ? $this->mask($headers['x-vercel-protection-bypass'])
            : null,
        ]),
      ];

      if (is_wp_error($resp)) {
        $this->render_notice('error', 'Connection failed',
          $resp->get_error_message(),
          array_merge($debug, ['wp_error' => $resp->get_error_data()])
        );
      } else {
        $code      = wp_remote_retrieve_response_code($resp);
        $body_raw  = wp_remote_retrieve_body($resp);
        $body_json = json_decode($body_raw, true);

        // Optional: probe the code state from /check for extra hints
        $check_url = add_query_arg(['pairCode' => rawurlencode($pair_code)], trailingslashit(self::API_BASE) . 'api/connect/check');
        $check_resp = wp_remote_get($check_url, [
          'headers'   => $headers,
          'timeout'   => 10,
          'sslverify' => true,
        ]);
        $check = is_wp_error($check_resp) ? ['error' => $check_resp->get_error_message()] : json_decode(wp_remote_retrieve_body($check_resp), true);
        $check_code = wp_remote_retrieve_response_code($check_resp);

        $debug = array_merge($debug, [
          'http_code'      => $code,
          'response_body'  => json_decode($body_raw, true) ?: $body_raw,
          'check_endpoint' => $check_url,
          'check_http_code' => $check_code,
          'check_result'   => $check,
        ]);

        if ($code === 200 && is_array($body_json) && isset($body_json['siteToken'])) {
          update_option(self::OPTION, [
            'site_id'     => sanitize_text_field($body_json['siteId']),
            'site_token'  => sanitize_text_field($body_json['siteToken']),
            'connected_at'=> time()
          ], false);

          $this->render_notice('success', 'Connected!', 'Your site is now linked to GetSafe 360.', $debug);
        } else {
          // Prefer server-provided error message, fall back to generic
          $server_error = is_array($body_json) && isset($body_json['error']) ? $body_json['error'] : 'Handshake error';
          // Common hints:
          // - "Invalid code" → start a new code from the app
          // - "Code expired or already used" → regenerate a fresh code
          // - "Site URL mismatch" → you generated the code for a different domain
          $this->render_notice('error', 'Handshake failed', $server_error, $debug);
        }
      }
    }

    $opt = get_option(self::OPTION, []);
    ?>
      <div class="wrap">
        <h1>GetSafe 360</h1>
        <?php if (empty($opt['site_token'])): ?>
          <p>Paste your 6-digit pairing code from GetSafe 360.</p>
          <form method="post">
            <?php wp_nonce_field('getsafe360_connect'); ?>
            <input type="text" name="pair_code" placeholder="123456" style="width:200px;font-size:18px;letter-spacing:3px;" required />
            <p><button class="button button-primary">Connect</button></p>
          </form>
          <p style="margin-top:8px;color:#666;">
            Tip: Make sure you generated the code for the <strong>same domain</strong> you’re connecting (e.g., code made for <code>example.com</code> won’t work on <code>staging.example.com</code>).
          </p>
        <?php else: ?>
          <p>Status: <strong>Connected</strong></p>
          <p><code>Site ID:</code> <?php echo esc_html($opt['site_id']); ?></p>
          <form method="post">
            <?php wp_nonce_field('getsafe360_disconnect'); ?>
            <input type="hidden" name="disconnect" value="1" />
            <button class="button">Disconnect</button>
          </form>
        <?php endif; ?>
      </div>
    <?php
  }

  // ---------- REST routes ----------

  public function routes() {
    register_rest_route('getsafe/v1', '/ping', [
      'methods' => 'GET',
      'callback' => function() { return ['ok' => true, 'site' => get_site_url()]; },
      'permission_callback' => '__return_true'
    ]);

    register_rest_route('getsafe/v1', '/push', [
      'methods' => 'POST',
      'callback' => [$this, 'route_push'],
      'permission_callback' => [$this, 'auth_bearer']
    ]);

    register_rest_route('getsafe/v1', '/pull', [
      'methods' => 'GET',
      'callback' => [$this, 'route_pull'],
      'permission_callback' => [$this, 'auth_bearer']
    ]);
  }

  public function auth_bearer(\WP_REST_Request $req) {
    $opt = get_option(self::OPTION, []);
    $hdr = $req->get_header('authorization');
    if (!$hdr || empty($opt['site_token'])) return false;
    if (stripos($hdr, 'Bearer ') !== 0) return false;
    $token = substr($hdr, 7);
    return hash_equals($opt['site_token'], $token);
  }

  public function route_push(\WP_REST_Request $req) {
    $payload = $req->get_json_params();
    return ['ok'=>true];
  }

  public function route_pull(\WP_REST_Request $req) {
    return [
      'ok'=>true,
      'wpVersion'=>get_bloginfo('version'),
      'plugins'=>get_option('active_plugins', [])
    ];
  }
}
new GetSafe360_Connector();
