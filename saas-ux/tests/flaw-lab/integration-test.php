<?php
// Runs inside WordPress via `wp eval-file`, with gs360-flaw-lab.php in mu-plugins,
// GS360_FLAW_LAB defined and the site served at $GS360_LOOPBACK.
// Seeds the flaws, checks each one is visible the way the scanner sees it, then
// checks that reset puts everything back. Exits non-zero if any check fails.

$GLOBALS['fails'] = 0;
function check($ok, $label) {
  echo ($ok ? 'ok: ' : 'FAIL: '), $label, "\n";
  if (!$ok) $GLOBALS['fails']++;
}

$loopback = getenv('GS360_LOOPBACK');
if (!$loopback) { echo "SKIP: GS360_LOOPBACK not set\n"; return; }
if (!class_exists('GS360_Flaw_Lab')) { echo "FAIL: flaw lab not loaded\n"; exit(1); }

$urls = [get_option('home'), get_option('siteurl')];
update_option('home', $loopback);
update_option('siteurl', $loopback);
$before = ['show_on_front' => get_option('show_on_front'), 'page_on_front' => (int) get_option('page_on_front')];
$core_file = ABSPATH . GS360_Flaw_Lab::MODIFIED_FILE;
$core_hash = md5_file($core_file);

function fetch($url) {
  $response = wp_remote_get($url, ['timeout' => 20, 'redirection' => 0]);
  return is_wp_error($response) ? ['body' => '', 'headers' => []] : ['body' => wp_remote_retrieve_body($response), 'headers' => wp_remote_retrieve_headers($response)];
}
function expired_lab_transients() {
  global $wpdb;
  return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d",
    $wpdb->esc_like('_transient_timeout_gs360lab_') . '%', time()));
}
function robots() {
  ob_start();
  // phpcs:ignore -- core hook
  echo apply_filters('robots_txt', "User-agent: *\nDisallow: /wp-admin/\nSitemap: " . home_url('/wp-sitemap.xml') . "\n", true);
  return ob_get_clean();
}

// ---------- what "all" means ----------
$all = GS360_Flaw_Lab::resolve(['all']);
check(count($all) === 12 && !in_array('sitemap-off', $all, true) && !array_intersect($all, ['unexpected-core-file', 'modified-core-file', 'outdated-plugin']),
  '"all" seeds the 12 standard flaws: no opt-in extras, no sitemap-off');
check(GS360_Flaw_Lab::resolve(['performance']) === ['many-scripts', 'many-images', 'large-html'], 'a category resolves to its flaws');
check(GS360_Flaw_Lab::resolve(['sitemap-off']) === ['sitemap-off'], 'sitemap-off is seeded when named');

// ---------- seed ----------
set_transient('getsafe360_audit_scans', ['stale' => true], HOUR_IN_SECONDS);
$result = GS360_Flaw_Lab::seed(array_merge($all, ['unexpected-core-file', 'modified-core-file']));
check(count(array_filter($result, fn($r) => $r === 'seeded')) === 14, 'seeding reports all 14 seeded');
check(get_transient('getsafe360_audit_scans') === false, 'seeding drops the connector\'s cached file scans');
check(GS360_Flaw_Lab::seed(['title-short'])['title-short'] === 'already seeded', 'seeding twice is a no-op');
check(strpos(GS360_Flaw_Lab::seed(['sitemap-off'])['sitemap-off'], 'conflicts with noindex-in-sitemap') !== false, 'sitemap-off refuses while noindex-in-sitemap is seeded');

$state = GS360_Flaw_Lab::seeded();
$home = fetch($loopback . '/');
$html = $home['body'];
check(preg_match('#<title>Home</title>#', $html) === 1, 'title-short: <title> is "Home"');
check(preg_match_all('#<h1[\s>]#i', $html) >= 3, 'multiple-h1: at least three H1s');
check(preg_match('#<html[^>]*\slang=#i', $html) === 0, 'lang-missing: no lang on <html>');
check(preg_match_all('#<img(?![^>]*\balt=)[^>]*>#i', $html) >= 3, 'images-no-alt: images without alt');
check(preg_match_all('#<img\b#i', $html) > 50, 'many-images: more than 50 images');
check(preg_match_all('#<script\b#i', $html) > 20, 'many-scripts: more than 20 scripts');
check(strlen($html) > 150 * 1024, 'large-html: HTML over 150 KB');
check(preg_match('#^PHP/\d+\.\d+#', (string) ($home['headers']['x-powered-by'] ?? '')) === 1, 'version-header: X-Powered-By shows the PHP version');

$hidden = $state['restore']['noindex_page'];
check(preg_match('#<meta name=[\'"]robots[\'"][^>]*noindex#i', fetch($loopback . '/?page_id=' . $hidden)['body']) === 1, 'noindex-in-sitemap: the hidden page says noindex');
check(strpos(fetch($loopback . '/?sitemap=posts&sitemap-subtype=page&paged=1')['body'], 'page_id=' . $hidden) !== false, 'noindex-in-sitemap: the sitemap still lists it');
$thin = get_posts(['post_type' => 'page', 'name' => 'flaw-lab-thin-1', 'numberposts' => 1]);
check($thin && str_word_count(wp_strip_all_tags($thin[0]->post_content)) < 10, 'thin-content: thin inner pages exist');

$text = robots();
check(strpos($text, "User-agent: *\nDisallow: /\n") === 0 && strpos($text, "User-agent: Googlebot\nAllow: /") !== false, 'ai-search-blocked: "*" blocked, Googlebot allowed');
check(strpos($text, 'Sitemap: ' . home_url('/wp-sitemap.xml')) !== false, 'ai-search-blocked: the Sitemap line is kept');
update_option('getsafe360_ai_crawler_rules', ['OAI-SearchBot' => 'allow']);
check(preg_match("#User-agent: OAI-SearchBot\nAllow: /#", robots()) === 1, 'ai-search-blocked: the connector\'s AI crawler fix still adds its Allow group');
delete_option('getsafe360_ai_crawler_rules');

check(expired_lab_transients() === 1100, 'expired-transients: 1,100 expired transients');
check(file_exists(ABSPATH . GS360_Flaw_Lab::UNEXPECTED_FILE), 'unexpected-core-file: the extra file exists');
check(md5_file($core_file) !== $core_hash, 'modified-core-file: the core file changed');

// ---------- reset ----------
set_transient('getsafe360_audit_scans', ['stale' => true], HOUR_IN_SECONDS);
GS360_Flaw_Lab::reset();
check(get_transient('getsafe360_audit_scans') === false, 'reset drops the connector\'s cached file scans');
check(get_option(GS360_Flaw_Lab::OPTION, 'gone') === 'gone', 'reset: the lab option is gone');
check(get_option('show_on_front') === $before['show_on_front'] && (int) get_option('page_on_front') === $before['page_on_front'], 'reset: front page settings restored');
check(!get_posts(['post_type' => 'page', 'post_status' => 'any', 'meta_key' => GS360_Flaw_Lab::PAGE_META, 'numberposts' => 1]), 'reset: lab pages deleted');
check(!file_exists(ABSPATH . GS360_Flaw_Lab::UNEXPECTED_FILE), 'reset: the extra core file is deleted');
check(md5_file($core_file) === $core_hash, 'reset: the core file is byte-for-byte original');
check(expired_lab_transients() === 0, 'reset: lab transients deleted');
$home = fetch($loopback . '/');
check(preg_match('#<html[^>]*\slang=#i', $home['body']) === 1 && strpos($home['body'], 'flaw lab') === false, 'reset: the home page is clean again');
check(empty($home['headers']['x-powered-by']), 'reset: no X-Powered-By header (the server runs with expose_php off)');
check(strpos(robots(), "Disallow: /\n") === false, 'reset: robots.txt no longer blocks everyone');

// ---------- title-short on its own gets a static front page (the title fix needs one) ----------
GS360_Flaw_Lab::seed(['title-short']);
check(get_option('show_on_front') === 'page' && (int) get_option('page_on_front') === GS360_Flaw_Lab::seeded()['restore']['home_page'], 'title-short alone sets the lab page as static front page');
GS360_Flaw_Lab::reset();

// ---------- sitemap-off on its own ----------
GS360_Flaw_Lab::seed(['sitemap-off']);
check(apply_filters('wp_sitemaps_enabled', true) === false, 'sitemap-off: WordPress sitemaps are off');
GS360_Flaw_Lab::reset();
check(apply_filters('wp_sitemaps_enabled', true) === true, 'reset: sitemaps back on');

update_option('home', $urls[0]);
update_option('siteurl', $urls[1]);
if ($GLOBALS['fails'] > 0) { echo $GLOBALS['fails'], " flaw lab check(s) failed\n"; exit(1); }
echo "flaw lab: all checks passed\n";
