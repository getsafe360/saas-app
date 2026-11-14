<?php
// Runs inside WordPress via `wp eval-file`. Exits non-zero if any check fails.
// GEO fixes (1.12): llms.txt, AI crawler rules, home-page schema and SEO meta, each with undo.

// eval-file runs this file inside a function, so the counter must live in $GLOBALS.
$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

update_option('getsafe360_connector', ['site_token' => 'integration-token']);
update_option('blog_public', '1');
// llms.txt and robots.txt need a root install; this test site may live in a subfolder.
$GLOBALS['urls'] = [get_option('home'), get_option('siteurl')];
update_option('home', 'https://example.test');
update_option('siteurl', 'https://example.test');
foreach (['getsafe360_llms_txt', 'getsafe360_ai_crawler_rules', 'getsafe360_schema'] as $o) delete_option($o);
$key = hash('sha256', 'integration-token');

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
function robots() {
  ob_start();
  do_robots();
  return ob_get_clean();
}
$GLOBALS['key'] = $key;

// --- llms.txt ---
$bad = run_action('set_llms_txt', ['content' => 'no title']);
check($bad['status'] === 'failed' && get_option('getsafe360_llms_txt', '') === '', 'llms.txt without a "# " title is refused');
$llms = run_action('set_llms_txt', ['content' => "# Test\r\n\r\n> A bakery.\x07\n\n- [About](https://example.test/about/)"]);
check($llms['status'] === 'applied', 'llms.txt stored');
check(get_option('getsafe360_llms_txt') === "# Test\n\n> A bakery.\n\n- [About](https://example.test/about/)\n", 'llms.txt normalised: line endings, control characters');
$undo = undo($llms);
check($undo['status'] === 'applied' && get_option('getsafe360_llms_txt', '') === '', 'undo removes llms.txt');

update_option('home', 'https://example.test/blog');
check(run_action('set_llms_txt', ['content' => "# Test"])['status'] === 'failed', 'llms.txt refused for a subfolder install');
update_option('home', 'https://example.test');

// --- AI crawler rules ---
$before = robots();
$rules = run_action('set_ai_crawler_rules', ['rules' => ['GPTBot' => 'block', 'OAI-SearchBot' => 'allow']]);
check($rules['status'] === 'applied', 'AI crawler rules stored');
$after = robots();
check(strpos($after, $before) === 0 || strpos($after, rtrim($before)) === 0, 'WordPress robots.txt kept as it was');
check(preg_match('/User-agent: GPTBot\nDisallow: \/\n/', $after) === 1, 'GPTBot blocked');
check(preg_match('/User-agent: OAI-SearchBot\nAllow: \/\nDisallow: \/wp-admin\/\nAllow: \/wp-admin\/admin-ajax.php/', $after) === 1, 'OAI-SearchBot allowed, private paths of * kept');
check(run_action('set_ai_crawler_rules', ['rules' => ['EvilBot' => 'allow']])['status'] === 'failed', 'unknown crawlers refused');

// A group shared by * and another agent still passes its private paths on.
$grouped = function ($out) { return "User-agent: *\nUser-agent: Bingbot\nDisallow: /private/\n"; };
add_filter('robots_txt', $grouped, 10);
check(preg_match('/User-agent: OAI-SearchBot\nAllow: \/\nDisallow: \/private\//', robots()) === 1, 'private paths of a grouped * kept');
remove_filter('robots_txt', $grouped, 10);

// Another plugin already writes a ClaudeBot group: the connector leaves it alone.
$other = function ($out) { return $out . "\nUser-agent: ClaudeBot\nDisallow: /private/\n"; };
add_filter('robots_txt', $other, 10);
$skip = run_action('set_ai_crawler_rules', ['rules' => ['ClaudeBot' => 'block']]);
check($skip['status'] === 'skipped', 'a crawler with someone else\'s group is not touched');
remove_filter('robots_txt', $other, 10);

update_option('blog_public', '0');
check(run_action('set_ai_crawler_rules', ['rules' => ['ClaudeBot' => 'allow']])['status'] === 'failed', 'refused while search engines are discouraged');
check(strpos(robots(), 'GPTBot') === false, 'no AI groups while search engines are discouraged');
update_option('blog_public', '1');

undo($rules);
check(get_option('getsafe360_ai_crawler_rules') === [] && robots() === $before, 'undo restores robots.txt');

// --- Home-page schema ---
$schema = run_action('set_schema', ['types' => ['Organization', 'WebSite'], 'sameAs' => ['https://www.instagram.com/test', 'javascript:alert(1)']]);
check($schema['status'] === 'applied', 'schema settings stored');
check(get_option('getsafe360_schema')['sameAs'] === ['https://www.instagram.com/test'], 'only https profile links kept');
check(run_action('set_schema', ['types' => ['Product']])['status'] === 'failed', 'only Organization and WebSite');
$GLOBALS['wp_query']->is_home = true; // the front page (latest posts)
ob_start();
do_action('wp_head');
$head = ob_get_clean();
$GLOBALS['wp_query']->is_home = false;
check(preg_match('/<script type="application\/ld\+json">(.*?)<\/script>/', $head, $m) === 1, 'schema printed on the home page');
$graph = json_decode($m[1] ?? '', true)['@graph'] ?? [];
check(array_column($graph, '@type') === ['Organization', 'WebSite'] && $graph[0]['name'] === 'Test', 'Organization and WebSite from WordPress settings');
undo($schema);
check(get_option('getsafe360_schema', null) === null, 'undo removes schema');

// --- SEO meta (no SEO plugin: the connector's own fields) ---
$page = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'About', 'post_name' => 'about-geo']);
$meta = run_action('set_seo_meta', ['path' => '/about-geo/', 'title' => 'About us | Test <b>bakery</b>', 'description' => 'Family bakery since 1952.']);
check($meta['status'] === 'applied', 'meta stored for the page at the path');
check(get_post_meta($page, '_getsafe360_seo_title', true) === 'About us | Test bakery', 'title sanitised');
check(run_action('set_seo_meta', ['path' => '/missing/', 'title' => 'x'])['status'] === 'failed', 'unknown pages refused');
check(run_action('set_seo_meta', ['postId' => $page, 'description' => str_repeat('x', 400)])['status'] === 'failed', 'over-long description refused');

$GLOBALS['wp_query'] = new WP_Query(['page_id' => $page]);
$GLOBALS['wp_the_query'] = $GLOBALS['wp_query'];
check(wp_get_document_title() === 'About us | Test bakery', 'title used for the page');
ob_start();
do_action('wp_head');
$head = ob_get_clean();
check(strpos($head, '<meta name="description" content="Family bakery since 1952.">') !== false, 'description printed');

undo($meta);
check(get_post_meta($page, '_getsafe360_seo_title', true) === '' && get_post_meta($page, '_getsafe360_seo_description', true) === '', 'undo removes title and description');

// With Yoast active the values go into Yoast's fields, and no duplicate output.
update_post_meta($page, '_yoast_wpseo_title', 'Old Yoast title');
define('WPSEO_VERSION', '99.0');
$yoast = run_action('set_seo_meta', ['postId' => $page, 'title' => 'New title']);
check(get_post_meta($page, '_yoast_wpseo_title', true) === 'New title' && get_post_meta($page, '_getsafe360_seo_title', true) === '', 'Yoast field written');
check(run_action('set_schema', ['types' => ['Organization']])['status'] === 'skipped', 'no schema next to Yoast');
undo($yoast);
check(get_post_meta($page, '_yoast_wpseo_title', true) === 'Old Yoast title', 'undo restores the previous Yoast title');
$long = str_repeat('Long description. ', 25); // ~450 characters, more than a new one may have
update_post_meta($page, '_yoast_wpseo_metadesc', trim($long));
$short = run_action('set_seo_meta', ['postId' => $page, 'description' => 'Short.']);
check(undo($short)['status'] === 'applied' && get_post_meta($page, '_yoast_wpseo_metadesc', true) === trim($long), 'undo restores a longer previous description');

$capsReq = new WP_REST_Request('GET', '/getsafe360/v1/capabilities');
$capsReq->set_header('X-API-Key', $key);
$caps = rest_do_request($capsReq)->get_data();
check(!empty($caps['capabilities']['llmsTxt']) && $caps['seo']['seoPlugin'] === 'yoast', 'capabilities report GEO fixes and the SEO plugin');

wp_delete_post($page, true);
update_option('home', $GLOBALS['urls'][0]);
update_option('siteurl', $GLOBALS['urls'][1]);
exit($GLOBALS['fails'] ? 1 : 0);
