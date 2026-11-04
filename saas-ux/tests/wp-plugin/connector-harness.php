<?php
// Run: php tests/wp-plugin/connector-harness.php public/wp-plugin/getsafe360-connector.php
// Stubs the few WordPress functions the connector touches and exercises
// the security-headers action and the user-enumeration REST filter.
define('ABSPATH', '/tmp/');
$GLOBALS['opts'] = []; $GLOBALS['sent'] = []; $GLOBALS['ssl'] = true; $GLOBALS['logged_in'] = false;
function add_action(...$a) {} function add_filter(...$a) {} function load_plugin_textdomain(...$a) {}
function plugin_basename($f) { return 'getsafe360-connector/getsafe360-connector.php'; }
function get_option($k, $d = false) { return $GLOBALS['opts'][$k] ?? $d; }
function update_option($k, $v, $a = null) { $GLOBALS['opts'][$k] = $v; return true; }
function sanitize_text_field($s) { return trim(strip_tags((string) $s)); }
function is_ssl() { return $GLOBALS['ssl']; }
function is_user_logged_in() { return $GLOBALS['logged_in']; }
require $argv[1];

$c = new GetSafe360_Connector();
$r = new ReflectionClass($c);
$apply = $r->getMethod('apply_security_headers_action'); $apply->setAccessible(true);
$fails = 0;
function check($cond, $msg) { global $fails; if (!$cond) { $fails++; echo "FAIL: $msg\n"; } else { echo "ok: $msg\n"; } }

// 1. apply allowlisted headers
$res = $apply->invoke($c, 'security-headers', ['headers' => [
  'Strict-Transport-Security' => 'max-age=31536000',
  'X-Content-Type-Options' => 'nosniff',
  'X-Frame-Options' => 'sameorigin',
  'Referrer-Policy' => 'strict-origin-when-cross-origin',
]]);
check($res['status'] === 'applied', 'applies allowlisted headers');
check($GLOBALS['opts']['getsafe360_security_headers']['X-Frame-Options'] === 'SAMEORIGIN', 'normalises X-Frame-Options');
check($res['rollback']['payload']['replace'] === true, 'rollback replaces wholesale');
check($res['rollback']['payload']['headers'] instanceof stdClass, 'rollback to empty encodes as {}');
check(json_encode($res['rollback']['payload']) === '{"replace":true,"headers":{}}', 'rollback JSON shape');

// 2. reject unknown header or bad value: all-or-nothing
$before = $GLOBALS['opts']['getsafe360_security_headers'];
$bad = $apply->invoke($c, 'h2', ['headers' => ['X-Frame-Options' => 'DENY', 'Set-Cookie' => 'a=b']]);
check($bad['status'] === 'failed', 'rejects non-allowlisted header');
check($GLOBALS['opts']['getsafe360_security_headers'] === $before, 'rejection changes nothing');
$bad2 = $apply->invoke($c, 'h3', ['headers' => ['Strict-Transport-Security' => "max-age=1\r\nX-Evil: 1"]]);
check($bad2['status'] === 'failed', 'rejects header injection in value');

// 3. rollback restores previous exactly
$second = $apply->invoke($c, 'h4', ['headers' => ['X-Frame-Options' => 'DENY', 'Referrer-Policy' => null]]);
check(!isset($GLOBALS['opts']['getsafe360_security_headers']['Referrer-Policy']), 'null removes a header');
$apply->invoke($c, 'h4-rollback', $second['rollback']['payload']);
check($GLOBALS['opts']['getsafe360_security_headers'] === $before, 'rollback restores previous set');

// 4. REST filter keeps users endpoints for logged-in users
$GLOBALS['opts']['getsafe360_action_state'] = ['blockUserEnumeration' => true];
$eps = ['/wp/v2/users' => 1, '/wp/v2/users/me' => 1, '/wp/v2/posts' => 1];
$GLOBALS['logged_in'] = true;
check(isset($c->filter_rest_endpoints($eps)['/wp/v2/users/me']), 'logged-in users keep /users/me');
$GLOBALS['logged_in'] = false;
$anon = $c->filter_rest_endpoints($eps);
check(!isset($anon['/wp/v2/users']) && !isset($anon['/wp/v2/users/me']) && isset($anon['/wp/v2/posts']), 'anonymous users lose user endpoints only');

exit($fails ? 1 : 0);
