<?php
/**
 * Plugin Name: GetSafe 360 Connector
 * Description: Secure connector between your site and GetSafe 360.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) exit;

class GetSafe360_Connector {
  const OPTION = 'getsafe360_connector';
  const API_BASE = 'https://saasfly-n1822z31a-getsafe360-ai-agents.vercel.app';

  public function __construct() {
    add_action('admin_menu', [$this, 'menu']);
    add_action('rest_api_init', [$this, 'routes']);
  }

  public function menu() {
    add_menu_page('GetSafe 360', 'GetSafe 360', 'manage_options', 'getsafe360', [$this, 'admin_page'], 'dashicons-shield', 80);
  }

  public function admin_page() {
    if (isset($_POST['pair_code']) && check_admin_referer('getsafe360_connect')) {
      $pair_code = sanitize_text_field($_POST['pair_code']);
      $site_url = get_site_url();
      $payload = [
        'id' => sanitize_text_field($_POST['pair_id'] ?? ''), // optional, can be omitted if we lookup by code
        'pairCode' => $pair_code,
        'siteUrl' => $site_url,
        'wpVersion' => get_bloginfo('version'),
        'pluginVersion' => '0.1.0'
      ];
      $resp = wp_remote_post(self::API_BASE.'/api/connect/handshake', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => wp_json_encode($payload),
        'timeout' => 15
      ]);
      if (is_wp_error($resp)) {
        echo '<div class="notice notice-error"><p>Connection failed: '.esc_html($resp->get_error_message()).'</p></div>';
      } else {
        $code = wp_remote_retrieve_response_code($resp);
        $body = json_decode(wp_remote_retrieve_body($resp), true);
        if ($code === 200 && isset($body['siteToken'])) {
          update_option(self::OPTION, [
            'site_id' => sanitize_text_field($body['siteId']),
            'site_token' => sanitize_text_field($body['siteToken']),
            'connected_at' => time()
          ], false);
          echo '<div class="notice notice-success"><p>Connected!</p></div>';
        } else {
          echo '<div class="notice notice-error"><p>Handshake error.</p></div>';
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
        <?php else: ?>
          <p>Status: <strong>Connected</strong></p>
          <form method="post">
            <?php wp_nonce_field('getsafe360_disconnect'); ?>
            <input type="hidden" name="disconnect" value="1" />
            <button class="button">Disconnect</button>
          </form>
        <?php endif; ?>
      </div>
    <?php
  }

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
    // Example: receive settings/content to apply
    $payload = $req->get_json_params();
    // TODO: apply changes safely (capabilities, sanitization)
    return ['ok'=>true];
  }
  public function route_pull(\WP_REST_Request $req) {
    // Example: return current SEO/perf settings snapshot
    return [
      'ok'=>true,
      'wpVersion'=>get_bloginfo('version'),
      'plugins'=>get_option('active_plugins', [])
    ];
  }
}
new GetSafe360_Connector();
