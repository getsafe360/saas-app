<?php
// Runs inside WordPress via `wp eval-file`. Exits non-zero on the first failed check.
// Exercises the connector's /audit endpoint against a real WordPress install.

$fails = 0;
function check($ok, $label) {
  global $fails;
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $fails++;
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
$key = hash('sha256', 'integration-token');

function audit_request($key, $refresh = false) {
  $req = new WP_REST_Request('GET', '/getsafe360/v1/audit');
  if ($key) $req->set_header('X-API-Key', $key);
  if ($refresh) $req->set_param('refresh', 1);
  return rest_do_request($req);
}

check(audit_request(null)->get_status() === 401, 'audit refuses requests without the key');

$baseline_uploads_php = audit_request($key, true)->get_data()['redFlags']['uploadsPhpFiles'];

// Fixture: genuine checksums served locally, one tampered core file, one PHP file in uploads.
$sums = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ABSPATH, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
  $rel = substr($f->getPathname(), strlen(ABSPATH));
  if (preg_match('#^(wp-admin|wp-includes)/#', $rel)) $sums[$rel] = md5_file($f->getPathname());
}
$sums['wp-content/plugins/hello.php'] = 'not-a-real-hash';
add_filter('pre_http_request', function ($pre, $args, $url) use ($sums) {
  if (strpos($url, 'api.wordpress.org/core/checksums') === false) return $pre;
  return ['headers' => [], 'body' => json_encode(['checksums' => $sums]),
          'response' => ['code' => 200, 'message' => 'OK'], 'cookies' => [], 'filename' => null];
}, 10, 3);

$version_file = ABSPATH . 'wp-includes/version.php';
$original = file_get_contents($version_file);
file_put_contents($version_file, $original . "\n// tampered by integration test\n");
$uploads = wp_upload_dir();
wp_mkdir_p($uploads['basedir'] . '/2026/11');
file_put_contents($uploads['basedir'] . '/2026/11/planted.php', '<?php // test');

try {
  $res = audit_request($key, true);
  $data = $res->get_data();
  check($res->get_status() === 200, 'audit answers with the key');
  check(($data['schema'] ?? null) === 1, 'schema version 1');

  foreach (['core', 'security', 'plugins', 'themes', 'performance', 'database', 'cron', 'redFlags', 'environment'] as $section) {
    check(isset($data[$section]) && is_array($data[$section]), "section present: $section");
  }

  check($data['security']['hasAdminUsername'] === true, 'flags the "admin" login (installed as admin)');
  check(is_int($data['security']['adminCount']) && $data['security']['adminCount'] >= 1, 'counts administrators');
  check($data['security']['saltsConfigured'] === true, 'detects configured salts');
  check($data['redFlags']['uploadsPhpFiles'] === $baseline_uploads_php + 1, 'counts PHP files in uploads');
  check($data['redFlags']['coreModifiedFiles'] === 1, 'detects one modified core file, ignores wp-content');
  check(is_int($data['database']['autoloadBytes']) && $data['database']['autoloadBytes'] > 0, 'measures autoloaded options');
  check(is_int($data['cron']['events']), 'counts cron events');

  // Privacy: no usernames, emails or site secrets anywhere in the payload.
  $json = json_encode($data);
  $user = get_user_by('login', 'admin');
  check(strpos($json, $user->user_email) === false, 'payload contains no email address');
  check(strpos($json, '"admin"') === false && strpos($json, 'user_login') === false, 'payload contains no username');
  check(strpos($json, AUTH_KEY) === false, 'payload contains no secret keys');

  $again = audit_request($key)->get_data();
  check($again['redFlags']['scannedAt'] === $data['redFlags']['scannedAt'], 'file scans are cached between calls');

  $cap = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
  $cap->set_header('X-API-Key', $key);
  check(rest_do_request($cap)->get_data()['capabilities']['siteAudit'] === true, 'advertises the siteAudit capability');
} finally {
  file_put_contents($version_file, $original);
  @unlink($uploads['basedir'] . '/2026/11/planted.php');
  delete_transient('getsafe360_audit_scans');
}

exit($fails ? 1 : 0);
