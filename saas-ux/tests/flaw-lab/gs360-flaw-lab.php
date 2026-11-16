<?php
/**
 * Plugin Name: GetSafe 360 Flaw Lab
 * Description: Seeds known, harmless flaws into a TEST site so GetSafe 360 can rehearse scan → fix → verify → undo. Never install on a real site.
 * Version: 1.0.0
 *
 * Must-use plugin: copy this single file to wp-content/mu-plugins/. It does nothing unless
 * wp-config.php defines GS360_FLAW_LAB as true.
 *
 *   wp gs360-lab status
 *   wp gs360-lab seed all            (or a category: seo, geo, accessibility, performance, security)
 *   wp gs360-lab seed core plugins   (opt-in extras that write files or install a plugin)
 *   wp gs360-lab reset               (removes every seeded flaw and lab page)
 *
 * Without WP-CLI: Tools → GetSafe 360 Flaw Lab.
 * Each flaw is listed with the findings it should cause in tests/flaw-lab/expected.json.
 */

if (!defined('ABSPATH')) exit;
if (!defined('GS360_FLAW_LAB') || GS360_FLAW_LAB !== true) return;

final class GS360_Flaw_Lab {
  const OPTION = 'gs360_flaw_lab';
  const PAGE_META = '_gs360_flaw_lab';
  const UNEXPECTED_FILE = 'wp-includes/gs360-flaw-lab-unexpected.php';
  const MODIFIED_FILE = 'wp-admin/includes/continents-cities.php';
  const OLD_PLUGIN = 'hello-dolly/hello.php';
  const OLD_PLUGIN_ZIP = 'https://downloads.wordpress.org/plugin/hello-dolly.1.6.zip';

  /**
   * Every flaw the lab can seed: id => [category, label]. Kept in step with expected.json by a test.
   * Categories "core" and "plugins" are opt-in: they write files or install a plugin.
   */
  const FLAWS = [
    'title-short'          => ['seo', 'Home page title "Home" (too short)'],
    'multiple-h1'          => ['seo', 'Three H1 headings on the lab home page'],
    'noindex-in-sitemap'   => ['seo', 'A lab page set to noindex but listed in the sitemap'],
    'sitemap-off'          => ['seo', 'WordPress XML sitemap switched off (only when named; hides noindex-in-sitemap)'],
    'ai-search-blocked'    => ['geo', 'robots.txt keeps out every crawler but Google and Bing'],
    'thin-content'         => ['geo', 'Four inner pages with a single sentence each'],
    'lang-missing'         => ['accessibility', 'No lang attribute on <html>'],
    'images-no-alt'        => ['accessibility', 'Images without alt text on the lab home page'],
    'many-scripts'         => ['performance', '24 script tags on every page'],
    'many-images'          => ['performance', '60 images on the lab home page'],
    'large-html'           => ['performance', 'Lab home page HTML over 150 KB'],
    'version-header'       => ['security', 'X-Powered-By header with the PHP version'],
    'expired-transients'   => ['stability', '1,100 expired transients in the options table'],
    'unexpected-core-file' => ['core', 'A harmless extra PHP file in wp-includes'],
    'modified-core-file'   => ['core', 'A comment line appended to a core file'],
    'outdated-plugin'      => ['plugins', 'Hello Dolly 1.6 installed (older than current)'],
  ];
  const OPT_IN = ['core', 'plugins'];
  /** Seeded only when named by id, never by "all" or a category. */
  const EXPLICIT = ['sitemap-off'];
  /** Flaws that cancel each other's findings. */
  const CONFLICTS = ['sitemap-off' => 'noindex-in-sitemap', 'noindex-in-sitemap' => 'sitemap-off'];

  public static function seeded() {
    $value = get_option(self::OPTION, []);
    return is_array($value) && isset($value['flaws']) && is_array($value['flaws']) ? $value : ['flaws' => [], 'restore' => []];
  }

  private static function is_on($flaw) {
    return in_array($flaw, self::seeded()['flaws'], true);
  }

  /** Flaw ids for "all", category names and/or flaw ids. "all" never includes the opt-in extras. */
  public static function resolve(array $targets) {
    $ids = [];
    foreach ($targets as $target) {
      foreach (self::FLAWS as $id => $flaw) {
        if ($target === $id) { $ids[] = $id; continue; }
        if (in_array($id, self::EXPLICIT, true)) continue;
        if ($target === $flaw[0] || ($target === 'all' && !in_array($flaw[0], self::OPT_IN, true))) $ids[] = $id;
      }
    }
    return array_values(array_unique($ids));
  }

  // ---------- runtime flaws: filters, active while seeded ----------

  public static function boot() {
    // Priority 10, before the connector's own title (20), so its title fix can win.
    add_filter('pre_get_document_title', function ($title) {
      return self::is_on('title-short') && is_front_page() ? 'Home' : $title;
    }, 10);
    add_filter('language_attributes', function ($attrs) {
      return self::is_on('lang-missing') && !is_admin() ? trim(preg_replace('/\blang="[^"]*"/', '', $attrs)) : $attrs;
    }, 1000);
    add_filter('wp_sitemaps_enabled', function ($enabled) {
      return self::is_on('sitemap-off') ? false : $enabled;
    }, 1000);
    // Runs before the connector (priority 99): the "*" block catches every AI crawler, and the
    // connector's AI crawler fix then adds named groups for them. Sitemap lines are kept.
    add_filter('robots_txt', function ($output) {
      if (!self::is_on('ai-search-blocked')) return $output;
      preg_match_all('/^sitemap\s*:.*$/mi', (string) $output, $m);
      $robots = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n";
      return $m[0] ? $robots . "\n" . implode("\n", $m[0]) . "\n" : $robots;
    }, 5);
    add_filter('wp_robots', function ($robots) {
      $page = self::seeded()['restore']['noindex_page'] ?? 0;
      if (self::is_on('noindex-in-sitemap') && $page && is_page($page)) $robots['noindex'] = true;
      return $robots;
    }, 1000);
    add_action('send_headers', function () {
      if (self::is_on('version-header')) header('X-Powered-By: PHP/' . PHP_VERSION);
    });
    add_action('wp_footer', function () {
      if (self::is_on('many-scripts')) {
        for ($i = 1; $i <= 24; $i++) echo "<script>/* GetSafe 360 flaw lab: script {$i} */</script>\n";
      }
      if (self::is_on('large-html') && is_front_page()) {
        echo '<!-- GetSafe 360 flaw lab: padding ' . str_repeat('flaw-lab-padding ', 10000) . '-->' . "\n";
      }
    });
    add_action('admin_menu', function () {
      add_management_page('GetSafe 360 Flaw Lab', 'GetSafe 360 Flaw Lab', 'manage_options', 'gs360-flaw-lab', [self::class, 'admin_page']);
    });
    add_action('admin_notices', function () {
      if (!current_user_can('manage_options')) return;
      $count = count(self::seeded()['flaws']);
      echo '<div class="notice notice-warning"><p><strong>GetSafe 360 Flaw Lab is active</strong> on this test site: ' . (int) $count . ' flaw(s) seeded. Never use this on a real site.</p></div>';
    });
  }

  // ---------- seeding and resetting ----------

  /** Seeds the given flaws. Returns [id => message]. */
  public static function seed(array $ids) {
    $state = self::seeded();
    $out = [];
    foreach ($ids as $id) {
      if (!isset(self::FLAWS[$id])) { $out[$id] = 'unknown flaw'; continue; }
      if (in_array($id, $state['flaws'], true)) { $out[$id] = 'already seeded'; continue; }
      $conflict = self::CONFLICTS[$id] ?? null;
      if ($conflict && in_array($conflict, $state['flaws'], true)) { $out[$id] = "not seeded: conflicts with {$conflict}; reset first"; continue; }
      $result = self::apply($id, $state);
      if ($result === true) {
        $state['flaws'][] = $id;
        $out[$id] = 'seeded';
      } else {
        $out[$id] = 'not seeded: ' . $result;
      }
      update_option(self::OPTION, $state, false);
    }
    return $out;
  }

  /** Content, file and plugin flaws need setting up; runtime flaws only need the option. */
  private static function apply($id, array &$state) {
    if ($id === 'thin-content') {
      $titles = ['Opening hours', 'Prices', 'Directions', 'Team'];
      foreach ($titles as $i => $title) {
        $page = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => "Flaw lab: {$title}", 'post_name' => 'flaw-lab-thin-' . ($i + 1), 'post_content' => '<p>More about this soon.</p>']);
        if (is_wp_error($page)) return $page->get_error_message();
        update_post_meta($page, self::PAGE_META, 1);
      }
      return true;
    }
    if (in_array($id, ['multiple-h1', 'images-no-alt', 'many-images', 'large-html'], true)) {
      self::ensure_home_page($state);
      self::render_home_page($state, array_merge($state['flaws'], [$id]));
      return true;
    }
    if ($id === 'noindex-in-sitemap') {
      if (empty($state['restore']['noindex_page'])) {
        $page = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Flaw lab: hidden page', 'post_name' => 'flaw-lab-hidden', 'post_content' => '<p>This page asks search engines not to index it, but the sitemap still lists it.</p>']);
        if (is_wp_error($page)) return $page->get_error_message();
        update_post_meta($page, self::PAGE_META, 1);
        $state['restore']['noindex_page'] = $page;
      }
      return true;
    }
    if ($id === 'expired-transients') {
      global $wpdb;
      $expired = time() - DAY_IN_SECONDS;
      for ($start = 1; $start <= 1100; $start += 100) {
        $rows = [];
        for ($i = $start; $i < $start + 100; $i++) {
          $rows[] = $wpdb->prepare('(%s, %s, %s)', "_transient_timeout_gs360lab_{$i}", (string) $expired, 'no');
          $rows[] = $wpdb->prepare('(%s, %s, %s)', "_transient_gs360lab_{$i}", 'flaw lab', 'no');
        }
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- every row is prepared above.
        if ($wpdb->query("INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES " . implode(',', $rows)) === false) return 'could not insert transients';
      }
      return true;
    }
    if ($id === 'unexpected-core-file') {
      $path = ABSPATH . self::UNEXPECTED_FILE;
      return file_put_contents($path, "<?php\n// GetSafe 360 flaw lab: a harmless file that is not part of WordPress.\n") !== false ? true : 'could not write ' . self::UNEXPECTED_FILE;
    }
    if ($id === 'modified-core-file') {
      $path = ABSPATH . self::MODIFIED_FILE;
      $original = @file_get_contents($path);
      if ($original === false) return 'could not read ' . self::MODIFIED_FILE;
      $state['restore']['modified_original'] = base64_encode($original);
      return file_put_contents($path, rtrim($original) . "\n// GetSafe 360 flaw lab: harmless change.\n") !== false ? true : 'could not write ' . self::MODIFIED_FILE;
    }
    if ($id === 'outdated-plugin') {
      if (file_exists(WP_PLUGIN_DIR . '/' . self::OLD_PLUGIN)) return 'Hello Dolly is already installed; remove it first';
      require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
      require_once ABSPATH . 'wp-admin/includes/plugin.php';
      require_once ABSPATH . 'wp-admin/includes/file.php';
      $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
      $installed = $upgrader->install(self::OLD_PLUGIN_ZIP);
      if ($installed !== true) return is_wp_error($installed) ? $installed->get_error_message() : 'install failed';
      activate_plugin(self::OLD_PLUGIN);
      $state['restore']['installed_plugin'] = self::OLD_PLUGIN;
      return true;
    }
    return true; // runtime flaw
  }

  /** The lab home page, set as the static front page; the previous front page is restored on reset. */
  private static function ensure_home_page(array &$state) {
    if (!empty($state['restore']['home_page']) && get_post($state['restore']['home_page'])) return;
    $page = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'GetSafe 360 Flaw Lab', 'post_name' => 'flaw-lab-home', 'post_content' => '']);
    update_post_meta($page, self::PAGE_META, 1);
    $state['restore']['home_page'] = $page;
    $state['restore']['show_on_front'] = get_option('show_on_front');
    $state['restore']['page_on_front'] = (int) get_option('page_on_front');
    update_option('show_on_front', 'page');
    update_option('page_on_front', $page);
  }

  /** Builds the lab home page from the content flaws that are on. */
  private static function render_home_page(array $state, array $flaws) {
    $page = $state['restore']['home_page'] ?? 0;
    if (!$page) return;
    $image = includes_url('images/w-logo-blue.png');
    $parts = [];
    $parts[] = '<p>This test site belongs to the GetSafe 360 flaw lab. It carries known, harmless flaws so the platform can rehearse finding, fixing and undoing them before it works on a real site. Every flaw can be removed again with one command, and nothing here is meant for visitors.</p>';
    if (in_array('multiple-h1', $flaws, true)) {
      $parts[] = '<h1>Registration service</h1><p>Second H1 on the page.</p>';
      $parts[] = '<h1>Vehicle purchase</h1><p>Third H1 on the page.</p>';
    }
    if (in_array('images-no-alt', $flaws, true)) {
      for ($i = 0; $i < 3; $i++) $parts[] = '<img src="' . esc_url($image) . '" width="80" height="80">';
    }
    if (in_array('many-images', $flaws, true)) {
      for ($i = 0; $i < 60; $i++) $parts[] = '<img src="' . esc_url($image) . '" width="16" height="16" alt="Lab image ' . ($i + 1) . '">';
    }
    wp_update_post(['ID' => $page, 'post_content' => implode("\n", $parts)]);
  }

  /** Removes every flaw: lab pages, front-page setting, files, the installed plugin and the option. */
  public static function reset() {
    $state = self::seeded();
    $restore = $state['restore'];
    $out = [];
    if (isset($restore['show_on_front'])) {
      update_option('show_on_front', $restore['show_on_front']);
      update_option('page_on_front', (int) $restore['page_on_front']);
      $out[] = 'front page restored';
    }
    foreach (get_posts(['post_type' => 'page', 'post_status' => 'any', 'numberposts' => -1, 'meta_key' => self::PAGE_META, 'fields' => 'ids']) as $page) {
      wp_delete_post($page, true);
      $out[] = "lab page {$page} deleted";
    }
    global $wpdb;
    $removed = $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
      $wpdb->esc_like('_transient_timeout_gs360lab_') . '%', $wpdb->esc_like('_transient_gs360lab_') . '%'));
    if ($removed) $out[] = "{$removed} lab transient rows deleted";
    if (file_exists(ABSPATH . self::UNEXPECTED_FILE)) {
      wp_delete_file(ABSPATH . self::UNEXPECTED_FILE);
      $out[] = self::UNEXPECTED_FILE . ' deleted';
    }
    if (!empty($restore['modified_original'])) {
      file_put_contents(ABSPATH . self::MODIFIED_FILE, base64_decode($restore['modified_original']));
      $out[] = self::MODIFIED_FILE . ' restored';
    }
    if (!empty($restore['installed_plugin'])) {
      require_once ABSPATH . 'wp-admin/includes/plugin.php';
      require_once ABSPATH . 'wp-admin/includes/file.php';
      deactivate_plugins($restore['installed_plugin']);
      delete_plugins([$restore['installed_plugin']]);
      $out[] = 'Hello Dolly removed';
    }
    delete_option(self::OPTION);
    $out[] = count($state['flaws']) . ' flaw(s) cleared';
    return $out;
  }

  // ---------- admin page (Tools → GetSafe 360 Flaw Lab) ----------

  public static function admin_page() {
    if (!current_user_can('manage_options')) return;
    $messages = [];
    if (isset($_POST['gs360_lab']) && check_admin_referer('gs360_flaw_lab')) {
      $action = sanitize_key(wp_unslash($_POST['gs360_lab']));
      if ($action === 'reset') {
        $messages = self::reset();
      } elseif ($action === 'seed') {
        $chosen = isset($_POST['flaws']) && is_array($_POST['flaws']) ? array_map('sanitize_key', wp_unslash($_POST['flaws'])) : [];
        foreach (self::seed($chosen) as $id => $result) $messages[] = "{$id}: {$result}";
      }
    }
    $seeded = self::seeded()['flaws'];
    echo '<div class="wrap"><h1>GetSafe 360 Flaw Lab</h1><p>Seeds known flaws into this <strong>test</strong> site. Expected findings: <code>tests/flaw-lab/expected.json</code> in the repository.</p>';
    if ($messages) echo '<div class="notice notice-info"><p>' . implode('<br>', array_map('esc_html', $messages)) . '</p></div>';
    echo '<form method="post">';
    wp_nonce_field('gs360_flaw_lab');
    echo '<table class="widefat striped"><thead><tr><th></th><th>Flaw</th><th>Category</th><th>Status</th></tr></thead><tbody>';
    foreach (self::FLAWS as $id => [$category, $label]) {
      $on = in_array($id, $seeded, true);
      $extra = in_array($category, self::OPT_IN, true) ? ' (opt-in)' : '';
      printf('<tr><td><input type="checkbox" name="flaws[]" value="%1$s" %2$s></td><td><code>%1$s</code> %3$s</td><td>%4$s</td><td>%5$s</td></tr>',
        esc_attr($id), disabled($on, true, false), esc_html($label), esc_html($category . $extra), $on ? '<strong>seeded</strong>' : '–');
    }
    echo '</tbody></table><p><button class="button button-primary" name="gs360_lab" value="seed">Seed selected</button> <button class="button" name="gs360_lab" value="reset" onclick="return confirm(\'Remove every seeded flaw?\')">Reset everything</button></p></form></div>';
  }
}

GS360_Flaw_Lab::boot();

if (defined('WP_CLI') && WP_CLI) {
  WP_CLI::add_command('gs360-lab', new class {
    /**
     * Seeds flaws: all, a category (seo, geo, accessibility, performance, security, core, plugins) or flaw ids.
     *
     * ## OPTIONS
     * <target>...
     */
    public function seed($args) {
      $ids = GS360_Flaw_Lab::resolve($args);
      if (!$ids) WP_CLI::error('Nothing matches: ' . implode(' ', $args));
      foreach (GS360_Flaw_Lab::seed($ids) as $id => $result) WP_CLI::log(str_pad($id, 22) . $result);
    }
    /** Removes every seeded flaw and lab page. */
    public function reset() {
      foreach (GS360_Flaw_Lab::reset() as $line) WP_CLI::log($line);
      WP_CLI::success('Flaw lab reset.');
    }
    /** Lists the flaws and which are seeded. */
    public function status() {
      $seeded = GS360_Flaw_Lab::seeded()['flaws'];
      $rows = [];
      foreach (GS360_Flaw_Lab::FLAWS as $id => [$category, $label]) $rows[] = ['flaw' => $id, 'category' => $category, 'seeded' => in_array($id, $seeded, true) ? 'yes' : '', 'what' => $label];
      WP_CLI\Utils\format_items('table', $rows, ['flaw', 'category', 'seeded', 'what']);
    }
  });
}
