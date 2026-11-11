<?php
// Runs inside WordPress via `wp eval-file`. Exits non-zero on the first failed check.
// SEO fixes pushed by GetSafe 360 may only add <meta>, <link> and valid JSON-LD to <head>.

// eval-file runs this file inside a function, so the counter must live in $GLOBALS.
$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
delete_option('getsafe360_seo_injections');
$key = hash('sha256', 'integration-token');

$req = new WP_REST_Request('POST', '/getsafe360/v1/push');
$req->set_header('X-API-Key', $key);
$req->set_header('Content-Type', 'application/json');
$req->set_body(wp_json_encode(['fixes' => [
  [
    'id' => 'og', 'fixType' => 'code',
    'snippet' => '<meta property="og:title" content="Hello" onload="alert(1)"><p>stray text</p><script>alert(2)</script>',
  ],
  [
    'id' => 'schema', 'fixType' => 'code',
    'snippet' => '<script type="application/ld+json" src="https://evil.example/x.js">{"@context":"https://schema.org","name":"A</script><script>alert(3)</script>"}</script>',
  ],
  [
    'id' => 'schema-ok', 'fixType' => 'code',
    'snippet' => '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Tom & Jerry </b>"}</script>',
  ],
]]));
$res = rest_do_request($req)->get_data();
check($res['applied'] === 2 && $res['appliedIds'] === ['og', 'schema-ok'], 'applies only fixes with valid head content');

$injections = get_option('getsafe360_seo_injections');
check($injections['og'] === '<meta property="og:title" content="Hello">', 'keeps allowed meta attributes only, drops text and scripts');

// Something stored by an older version is sanitised again on output.
$injections['legacy'] = '<link rel="canonical" href="https://example.test/"> visible text <img src=x onerror=alert(4)>';
update_option('getsafe360_seo_injections', $injections);

ob_start();
do_action('wp_head');
$head = ob_get_clean();
check(strpos($head, 'alert') === false, 'no script from a fix reaches the page');
check(strpos($head, 'stray text') === false && strpos($head, 'visible text') === false, 'no text from a fix reaches the page');
check(strpos($head, '<link rel="canonical" href="https://example.test/">') !== false, 'legacy allowed tags still render');
check(strpos($head, '"name":"Tom \u0026 Jerry \u003C/b\u003E"') !== false, 'JSON-LD is re-encoded so it cannot close the script element');
check(substr_count($head, '<script type="application/ld+json">') === 1, 'only valid JSON-LD blocks render');

delete_option('getsafe360_seo_injections');
exit($GLOBALS['fails'] ? 1 : 0);
