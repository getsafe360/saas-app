<?php
// Runs inside WordPress via `wp eval-file`. Exits non-zero if any check fails.
// 1.13: social sharing tags per page (only the missing ones) and a single H1 per page, each with undo.

$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
delete_option('getsafe360_social_tags');
delete_option('getsafe360_heading_fix');
$GLOBALS['key'] = hash('sha256', 'integration-token');

function run_action($type, $payload) {
  $req = new WP_REST_Request('POST', '/getsafe360/v1/actions');
  $req->set_header('X-API-Key', $GLOBALS['key']);
  $req->set_header('Content-Type', 'application/json');
  $req->set_body(wp_json_encode(['actions' => [['id' => 'a-' . $type, 'type' => $type, 'payload' => $payload]]]));
  return rest_do_request($req)->get_data()['results'][0];
}
function undo($result) {
  return run_action($result['rollback']['type'], $result['rollback']['payload']);
}
/** The connector instance, found through one of its hooks. */
function connector() {
  foreach ($GLOBALS['wp_filter']['template_redirect']->callbacks as $callbacks) {
    foreach ($callbacks as $cb) {
      if (is_array($cb['function']) && $cb['function'][0] instanceof GetSafe360_AI) return $cb['function'][0];
    }
  }
  return null;
}
function head_for($post_id) {
  $GLOBALS['wp_query'] = new WP_Query(['page_id' => $post_id]);
  $GLOBALS['wp_the_query'] = $GLOBALS['wp_query'];
  $GLOBALS['wp_query']->the_post();
  ob_start();
  do_action('wp_head');
  return ob_get_clean();
}

$page = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Zulassung', 'post_name' => 'zulassung-social', 'post_content' => 'Wir melden Ihr Auto in Berlin an. Schnell und zuverlässig.', 'post_excerpt' => 'Kfz-Zulassung in Steglitz.']);

// --- Social tags ---
check(strpos(head_for($page), 'og:title') === false, 'no social tags before the fix');
$social = run_action('set_social_tags', ['enabled' => true]);
check($social['status'] === 'applied', 'social tags switched on');
$head = head_for($page);
check(strpos($head, '<meta property="og:title" content="Zulassung') !== false, 'og:title from this page');
check(strpos($head, '<meta property="og:description" content="Kfz-Zulassung in Steglitz.">') !== false, 'og:description from the excerpt');
check(strpos($head, '<meta property="og:url" content="' . esc_url(get_permalink($page)) . '">') !== false, 'og:url is this page');
check(strpos($head, '<meta name="twitter:card" content="summary">') !== false, 'summary card without an image');

// Tags another plugin already prints are never duplicated.
$other = function () { echo '<meta property="og:title" content="From another plugin">' . "\n"; };
add_action('wp_head', $other, 5);
$head = head_for($page);
check(substr_count($head, 'og:title') === 1 && strpos($head, 'From another plugin') !== false, 'an existing og:title is kept, not duplicated');
check(strpos($head, 'og:description') !== false, 'the missing ones are still added');
remove_action('wp_head', $other, 5);

$GLOBALS['wp_query']->is_admin = false;
check(run_action('set_social_tags', ['enabled' => 'yes'])['status'] === 'failed', 'only true or false');
undo($social);
check(strpos(head_for($page), 'og:title') === false && !get_option('getsafe360_social_tags'), 'undo turns them off');

// --- Single H1 ---
$plugin = connector();
check($plugin !== null, 'connector instance found');
$css = 'h2.gs360-h1{font-size:2em}h2.gs360-h1{font-size:44px;font-weight:800}@media (max-width: 600px){h2.gs360-h1{font-size:28px}}';
foreach (['h2.gs360-h1{}</style><script>alert(1)</script>', '@import url(https://evil.example/x.css);h2.gs360-h1{}', 'body{display:none}'] as $bad) {
  run_action('set_heading_fix', ['enabled' => true, 'css' => $bad]);
  check(get_option('getsafe360_heading_fix')['css'] === '', 'unsafe CSS is dropped: ' . substr($bad, 0, 30));
}
delete_option('getsafe360_heading_fix');
$h1 = run_action('set_heading_fix', ['enabled' => true, 'css' => $css]);
check($h1['status'] === 'applied', 'heading fix switched on');
check(get_option('getsafe360_heading_fix')['css'] === $css, "the theme's rules, media queries included, are kept");

$html = '<html><head><title>x</title></head><body><h1 class="site-title">KFZ-Zulassungsdienst in Berlin-Steglitz</h1><div><h1>KFZ-Zulassungsdienst</h1></div><H1 id="a">Fahrzeug-Ankauf</H1><script>const t = "<h1>Dynamic</h1>";</script><!-- <h1>old</h1> --></body></html>';
$out = $plugin->demote_extra_h1($html);
check(substr_count(strtolower($out), '<h1') === 3, 'one real H1 left; the script and the comment keep theirs');
check(strpos($out, '<script>const t = "<h1>Dynamic</h1>";</script>') !== false && strpos($out, '<!-- <h1>old</h1> -->') !== false, 'script and comment contents untouched');
check(strpos($out, '<h2 class="gs360-h1">KFZ-Zulassungsdienst</h2>') !== false && strpos($out, '<h2 id="a" class="gs360-h1">Fahrzeug-Ankauf</h2>') !== false, 'later H1s are H2s with the class');
check(strpos($out, '<style id="gs360-h1">' . $css . '</style></head>') !== false, "the theme's H1 rules go into the head");
check($plugin->demote_extra_h1('<h1>Only one</h1>') === '<h1>Only one</h1>', 'a single H1 is left alone');

undo($h1);
check(get_option('getsafe360_heading_fix', null) === null, 'undo turns the heading fix off');

$capsReq = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
$capsReq->set_header('X-API-Key', $GLOBALS['key']);
$caps = rest_do_request($capsReq)->get_data();
check(!empty($caps['capabilities']['socialTags']) && !empty($caps['capabilities']['headingFix']) && array_key_exists('socialImage', $caps['seo']), 'capabilities report the new fixes');

wp_delete_post($page, true);
exit($GLOBALS['fails'] ? 1 : 0);
