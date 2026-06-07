# WP Plugin Handoff: Auto-Updates + Full i18n — v0.3.0

**Repo:** `getsafe360/getsafe360-saas`
**Branch to create:** `feature/wp-plugin-v0.3-updates-i18n`
**PR title:** `feat(wp-plugin): automatic updates + full i18n for 6 languages (v0.3.0)`

---

## Overview

This task upgrades the GetSafe 360 WordPress connector plugin from v0.2.1 → v0.3.0 with two features:

1. **Automatic Updates** — WP-native update notices driven by a custom SaaS endpoint (no wordpress.org required)
2. **Full i18n** — all user-visible strings wrapped in gettext functions; `.pot` template + `.po`/`.mo` files for `de_DE`, `es_ES`, `fr_FR`, `it_IT`, `pt_BR`

The languages match the SaaS app's locales: `en`, `de`, `es`, `fr`, `it`, `pt`.

---

## Files to create / modify

```
saas-ux/public/wp-plugin/
├── getsafe360-connector.php          ← MODIFY (main plugin file)
└── languages/
    ├── getsafe360-connector.pot      ← CREATE
    ├── getsafe360-connector-de_DE.po ← CREATE
    ├── getsafe360-connector-de_DE.mo ← CREATE (compile from .po)
    ├── getsafe360-connector-es_ES.po ← CREATE
    ├── getsafe360-connector-es_ES.mo ← CREATE
    ├── getsafe360-connector-fr_FR.po ← CREATE
    ├── getsafe360-connector-fr_FR.mo ← CREATE
    ├── getsafe360-connector-it_IT.po ← CREATE
    ├── getsafe360-connector-it_IT.mo ← CREATE
    ├── getsafe360-connector-pt_BR.po ← CREATE
    └── getsafe360-connector-pt_BR.mo ← CREATE

saas-ux/app/api/wp-plugin/
└── info/
    └── route.ts                      ← CREATE (update check endpoint)
```

> `.mo` files are binary gettext compiled files. If `wp-cli` is available run `wp i18n make-mo saas-ux/public/wp-plugin/languages/`. Otherwise use `msgfmt getsafe360-connector-de_DE.po -o getsafe360-connector-de_DE.mo` for each language. Do not leave `.mo` files missing — WP will silently skip translations if they are absent.

---

## Task 1 — Automatic Updates

### How WordPress custom update checks work

WordPress 5.8 introduced the `Update URI` plugin header. When present, WP fires a filter named `update_plugins_{hostname}` (where `hostname` is extracted from the URI) instead of hitting the wordpress.org API. The plugin hooks into this filter, calls the SaaS endpoint, and returns a stdClass that tells WP a new version is available.

### 1a. Plugin header changes

Replace the existing header block with:

```php
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
```

Key additions:
- `Version` bumped to `0.3.0`
- `Text Domain: getsafe360-connector`
- `Domain Path: /languages`
- `Update URI: https://www.getsafe360.ai` — WordPress derives the filter name `update_plugins_www.getsafe360.ai` from this

Also update the class constant: `const VERSION = '0.3.0';`

### 1b. Constructor additions

Add these two lines to `__construct()`:

```php
add_filter('update_plugins_www.getsafe360.ai', [$this, 'check_for_update'], 10, 4);
add_filter('plugins_api', [$this, 'plugin_api_info'], 10, 3);
```

### 1c. New methods — add after `route_pull()`

```php
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
```

### 1d. SaaS API endpoint — `saas-ux/app/api/wp-plugin/info/route.ts`

Create this file:

```typescript
import { NextResponse } from 'next/server';

// Bump PLUGIN_VERSION and set WP_PLUGIN_DOWNLOAD_URL env var with each release.
// WP_PLUGIN_DOWNLOAD_URL should point to the publicly accessible plugin ZIP
// (e.g. a Vercel Blob URL: https://xxxx.blob.vercel-storage.com/getsafe360-connector-v0.3.0.zip)
const PLUGIN_VERSION = '0.3.0';

export async function GET() {
    const downloadUrl = process.env.WP_PLUGIN_DOWNLOAD_URL ?? '';

    return NextResponse.json(
        {
            version: PLUGIN_VERSION,
            download_url: downloadUrl,
            tested: '6.7',
            requires: '5.0',
            requires_php: '7.2',
            description:
                'Secure connector between your WordPress site and GetSafe 360 AI for automated security scanning, performance monitoring, and AI-powered repairs.',
            changelog:
                '<h4>0.3.0</h4><ul><li>Automatic updates via WordPress update system</li><li>Full i18n: German, Spanish, French, Italian, Portuguese</li></ul>' +
                '<h4>0.2.1</h4><ul><li>SEO injection via wp_head</li><li>REST API routes: ping, status, push, pull</li></ul>' +
                '<h4>0.2.0</h4><ul><li>Initial release</li></ul>',
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        }
    );
}
```

Add `WP_PLUGIN_DOWNLOAD_URL` to `.env.example` (leave value blank — it's set per-release in Vercel dashboard):

```
WP_PLUGIN_DOWNLOAD_URL=
```

> **Note on the ZIP:** Upload the plugin ZIP to Vercel Blob manually after building it (zip the `wp-plugin/` folder, exclude this HANDOFF file). Then set `WP_PLUGIN_DOWNLOAD_URL` in the Vercel environment. The ZIP must be publicly accessible (no auth headers needed — WordPress fetches it directly during update).

---

## Task 2 — Full i18n

### 2a. `load_plugin_textdomain` in constructor

Add as the **first line** of `__construct()`:

```php
load_plugin_textdomain('getsafe360-connector', false, dirname(plugin_basename(__FILE__)) . '/languages');
```

### 2b. String wrapping — patterns to use

| Pattern | Use case |
|---------|----------|
| `__('string', 'getsafe360-connector')` | Return translated string |
| `_e('string', 'getsafe360-connector')` | Echo translated string |
| `esc_html__('string', 'getsafe360-connector')` | Return translated + HTML-escaped |
| `esc_html_e('string', 'getsafe360-connector')` | Echo translated + HTML-escaped |
| `esc_attr__('string', 'getsafe360-connector')` | Return translated + attr-escaped |
| `printf(esc_html__('Hello %s', 'getsafe360-connector'), $var)` | Translated with variable |

**For strings with `<strong>` or other HTML tags**, pass the tags as printf arguments so translators never need to touch HTML:

```php
// Before:
echo '<li>Log in to your <strong>GetSafe 360 dashboard</strong></li>';

// After:
printf(
    '<li>' . __('Log in to your %1$sGetSafe 360 dashboard%2$s', 'getsafe360-connector') . '</li>',
    '<strong>', '</strong>'
);
```

**For the date display** (line ~279), replace `date()` with `wp_date()` which handles timezone and locale:

```php
// Before:
echo esc_html(date('F j, Y \a\t g:i a', $opt['connected_at']));

// After:
/* translators: PHP date format for "connected since" display. See https://www.php.net/date */
echo esc_html(wp_date(__('F j, Y \a\t g:i a', 'getsafe360-connector'), $opt['connected_at']));
```

Apply wrapping to **every** user-visible string throughout the file. The complete set is enumerated in the `.pot` file below.

### 2c. `languages/getsafe360-connector.pot`

```
# GetSafe 360 AI Connector – Translation Template
# Copyright (C) 2026 GetSafe 360 AI
# This file is distributed under the GPL v2 or later.
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"Report-Msgid-Bugs-To: https://www.getsafe360.ai/support\n"
"POT-Creation-Date: 2026-06-07T00:00:00+00:00\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Language: \n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr ""

msgid "Disconnected"
msgstr ""

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr ""

msgid "Connection Failed"
msgstr ""

msgid "Connection timed out. Please check your internet connection and try again."
msgstr ""

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr ""

msgid "Successfully Connected!"
msgstr ""

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr ""

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr ""

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr ""

msgid "GetSafe 360 Connector"
msgstr ""

msgid "Version %s"
msgstr ""

msgid "Connect Your WordPress Site"
msgstr ""

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr ""

msgid "How to connect:"
msgstr ""

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr ""

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr ""

msgid "Copy the %1$s6-digit code%2$s"
msgstr ""

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr ""

msgid "Enter Pairing Code:"
msgstr ""

msgid "Connect to GetSafe 360"
msgstr ""

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr ""

msgid "Connection Status"
msgstr ""

msgid "Connected"
msgstr ""

msgid "Site ID"
msgstr ""

msgid "Connected Since"
msgstr ""

#. translators: PHP date format. See https://www.php.net/date
msgid "F j, Y \\a\\t g:i a"
msgstr ""

msgid "WordPress Version"
msgstr ""

msgid "Plugin Version"
msgstr ""

msgid "Site URL"
msgstr ""

msgid "Disconnect Site"
msgstr ""

msgid "Are you sure?"
msgstr ""

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr ""

msgid "Yes, Disconnect"
msgstr ""

msgid "Cancel"
msgstr ""

msgid "What's Next?"
msgstr ""

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr ""

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr ""

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr ""

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr ""

msgid "Need Help?"
msgstr ""

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr ""
```

---

### 2d. German — `languages/getsafe360-connector-de_DE.po`

```
# GetSafe 360 AI Connector – German (Germany)
# Copyright (C) 2026 GetSafe 360 AI
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"PO-Revision-Date: 2026-06-07T00:00:00+00:00\n"
"Language: de_DE\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr "Debug-Informationen"

msgid "Disconnected"
msgstr "Getrennt"

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr "Ihre Website ist nicht mehr mit GetSafe 360 verknüpft. Sie können sich jederzeit erneut verbinden."

msgid "Connection Failed"
msgstr "Verbindung fehlgeschlagen"

msgid "Connection timed out. Please check your internet connection and try again."
msgstr "Verbindungszeit überschritten. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut."

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr "SSL-Zertifikat-Überprüfung fehlgeschlagen. Ihre Website benötigt möglicherweise aktualisierte SSL-Zertifikate."

msgid "Successfully Connected!"
msgstr "Erfolgreich verbunden!"

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr "Ihre WordPress-Website ist jetzt mit GetSafe 360 verknüpft. Sie können jetzt Sicherheitsscans und Performance-Überprüfungen von Ihrem Dashboard aus starten."

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Dieser Kopplungscode ist abgelaufen. Bitte generieren Sie einen neuen Code in Ihrem GetSafe 360-Dashboard."

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Dieser Kopplungscode wurde bereits verwendet. Bitte generieren Sie einen neuen Code in Ihrem GetSafe 360-Dashboard."

msgid "GetSafe 360 Connector"
msgstr "GetSafe 360 Connector"

msgid "Version %s"
msgstr "Version %s"

msgid "Connect Your WordPress Site"
msgstr "Ihre WordPress-Website verbinden"

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr "Verknüpfen Sie diese WordPress-Website mit Ihrem GetSafe 360-Dashboard für automatisiertes Sicherheits-Scanning, Performance-Monitoring und KI-gestützte Website-Reparaturen."

msgid "How to connect:"
msgstr "So verbinden Sie sich:"

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr "Melden Sie sich in Ihrem %1$sGetSafe 360-Dashboard%2$s an"

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr "Klicken Sie auf %1$s„Website hinzufügen"%2$s oder %3$s„Kopplungscode generieren"%4$s"

msgid "Copy the %1$s6-digit code%2$s"
msgstr "Kopieren Sie den %1$s6-stelligen Code%2$s"

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr "Fügen Sie ihn unten ein und klicken Sie auf %1$s„Verbinden"%2$s"

msgid "Enter Pairing Code:"
msgstr "Kopplungscode eingeben:"

msgid "Connect to GetSafe 360"
msgstr "Mit GetSafe 360 verbinden"

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr "Hinweis: Der Kopplungscode läuft in 10 Minuten ab. Stellen Sie sicher, dass Sie den Code für genau diese Website-URL generiert haben: %s"

msgid "Connection Status"
msgstr "Verbindungsstatus"

msgid "Connected"
msgstr "Verbunden"

msgid "Site ID"
msgstr "Website-ID"

msgid "Connected Since"
msgstr "Verbunden seit"

msgid "F j, Y \\a\\t g:i a"
msgstr "j. F Y \\u\\m g:i"

msgid "WordPress Version"
msgstr "WordPress-Version"

msgid "Plugin Version"
msgstr "Plugin-Version"

msgid "Site URL"
msgstr "Website-URL"

msgid "Disconnect Site"
msgstr "Website trennen"

msgid "Are you sure?"
msgstr "Sind Sie sicher?"

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr "Durch das Trennen werden alle automatisierten Scans und das Monitoring für diese Website gestoppt. Sie können sich jederzeit mit einem neuen Kopplungscode erneut verbinden."

msgid "Yes, Disconnect"
msgstr "Ja, trennen"

msgid "Cancel"
msgstr "Abbrechen"

msgid "What's Next?"
msgstr "Was kommt als Nächstes?"

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr "Besuchen Sie Ihr %1$sGetSafe 360 KI-Dashboard%2$s, um Sicherheitsscans durchzuführen"

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr "Aktivieren Sie %1$sKI-gestützte automatische Reparaturen%2$s für häufige Probleme"

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr "Richten Sie %1$sgeplante Scans%2$s ein, um Ihre Website rund um die Uhr zu überwachen"

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr "Zeigen Sie detaillierte %1$sPerformance-Berichte%2$s und Empfehlungen an"

msgid "Need Help?"
msgstr "Brauchen Sie Hilfe?"

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr "Besuchen Sie unsere %1$sDokumentation%2$s oder %3$skontaktieren Sie den Support%4$s."
```

---

### 2e. Spanish — `languages/getsafe360-connector-es_ES.po`

```
# GetSafe 360 AI Connector – Spanish (Spain)
# Copyright (C) 2026 GetSafe 360 AI
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"PO-Revision-Date: 2026-06-07T00:00:00+00:00\n"
"Language: es_ES\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr "Información de depuración"

msgid "Disconnected"
msgstr "Desconectado"

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr "Tu sitio ya no está vinculado a GetSafe 360. Puedes volver a conectarte en cualquier momento."

msgid "Connection Failed"
msgstr "Conexión fallida"

msgid "Connection timed out. Please check your internet connection and try again."
msgstr "La conexión ha agotado el tiempo de espera. Por favor, comprueba tu conexión a internet e inténtalo de nuevo."

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr "La verificación del certificado SSL ha fallado. Es posible que tu sitio necesite certificados SSL actualizados."

msgid "Successfully Connected!"
msgstr "¡Conectado correctamente!"

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr "Tu sitio de WordPress ahora está vinculado a GetSafe 360. Ahora puedes ejecutar análisis de seguridad y comprobaciones de rendimiento desde tu panel."

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Este código de emparejamiento ha caducado. Por favor, genera un nuevo código desde tu panel de GetSafe 360."

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Este código de emparejamiento ya ha sido utilizado. Por favor, genera un nuevo código desde tu panel de GetSafe 360."

msgid "GetSafe 360 Connector"
msgstr "GetSafe 360 Connector"

msgid "Version %s"
msgstr "Versión %s"

msgid "Connect Your WordPress Site"
msgstr "Conectar tu sitio WordPress"

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr "Vincula este sitio de WordPress con tu panel de GetSafe 360 para el análisis de seguridad automatizado, el monitoreo de rendimiento y las reparaciones potenciadas por IA."

msgid "How to connect:"
msgstr "Cómo conectarse:"

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr "Inicia sesión en tu %1$spanel de GetSafe 360%2$s"

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr "Haz clic en %1$s«Añadir sitio»%2$s o %3$s«Generar código de emparejamiento»%4$s"

msgid "Copy the %1$s6-digit code%2$s"
msgstr "Copia el %1$scódigo de 6 dígitos%2$s"

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr "Pégalo a continuación y haz clic en %1$s«Conectar»%2$s"

msgid "Enter Pairing Code:"
msgstr "Introducir código de emparejamiento:"

msgid "Connect to GetSafe 360"
msgstr "Conectar a GetSafe 360"

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr "Nota: El código de emparejamiento caduca en 10 minutos. Asegúrate de haber generado el código para esta URL exacta del sitio: %s"

msgid "Connection Status"
msgstr "Estado de la conexión"

msgid "Connected"
msgstr "Conectado"

msgid "Site ID"
msgstr "ID del sitio"

msgid "Connected Since"
msgstr "Conectado desde"

msgid "F j, Y \\a\\t g:i a"
msgstr "j \\d\\e F \\d\\e Y \\a \\l\\a\\s g:i a"

msgid "WordPress Version"
msgstr "Versión de WordPress"

msgid "Plugin Version"
msgstr "Versión del plugin"

msgid "Site URL"
msgstr "URL del sitio"

msgid "Disconnect Site"
msgstr "Desconectar sitio"

msgid "Are you sure?"
msgstr "¿Estás seguro?"

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr "Al desconectarte se detendrán todos los análisis y el monitoreo automatizados de este sitio. Puedes volver a conectarte en cualquier momento con un nuevo código de emparejamiento."

msgid "Yes, Disconnect"
msgstr "Sí, desconectar"

msgid "Cancel"
msgstr "Cancelar"

msgid "What's Next?"
msgstr "¿Qué sigue?"

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr "Visita tu %1$spanel de IA de GetSafe 360%2$s para ejecutar análisis de seguridad"

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr "Activa las %1$sreparaciones automáticas potenciadas por IA%2$s para problemas comunes"

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr "Configura %1$sanálisis programados%2$s para monitorear tu sitio 24/7"

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr "Consulta %1$sinformes de rendimiento%2$s detallados y recomendaciones"

msgid "Need Help?"
msgstr "¿Necesitas ayuda?"

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr "Visita nuestra %1$sdocumentación%2$s o %3$scontacta con soporte%4$s."
```

---

### 2f. French — `languages/getsafe360-connector-fr_FR.po`

```
# GetSafe 360 AI Connector – French (France)
# Copyright (C) 2026 GetSafe 360 AI
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"PO-Revision-Date: 2026-06-07T00:00:00+00:00\n"
"Language: fr_FR\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr "Informations de débogage"

msgid "Disconnected"
msgstr "Déconnecté"

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr "Votre site n'est plus lié à GetSafe 360. Vous pouvez vous reconnecter à tout moment."

msgid "Connection Failed"
msgstr "Échec de la connexion"

msgid "Connection timed out. Please check your internet connection and try again."
msgstr "La connexion a expiré. Veuillez vérifier votre connexion Internet et réessayer."

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr "La vérification du certificat SSL a échoué. Votre site peut avoir besoin de certificats SSL mis à jour."

msgid "Successfully Connected!"
msgstr "Connexion réussie !"

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr "Votre site WordPress est maintenant lié à GetSafe 360. Vous pouvez maintenant effectuer des analyses de sécurité et des vérifications de performances depuis votre tableau de bord."

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Ce code d'appairage a expiré. Veuillez générer un nouveau code depuis votre tableau de bord GetSafe 360."

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Ce code d'appairage a déjà été utilisé. Veuillez générer un nouveau code depuis votre tableau de bord GetSafe 360."

msgid "GetSafe 360 Connector"
msgstr "GetSafe 360 Connector"

msgid "Version %s"
msgstr "Version %s"

msgid "Connect Your WordPress Site"
msgstr "Connecter votre site WordPress"

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr "Liez ce site WordPress à votre tableau de bord GetSafe 360 pour l'analyse de sécurité automatisée, la surveillance des performances et les réparations alimentées par l'IA."

msgid "How to connect:"
msgstr "Comment se connecter :"

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr "Connectez-vous à votre %1$stableau de bord GetSafe 360%2$s"

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr "Cliquez sur %1$s« Ajouter un site »%2$s ou %3$s« Générer un code d'appairage »%4$s"

msgid "Copy the %1$s6-digit code%2$s"
msgstr "Copiez le %1$scode à 6 chiffres%2$s"

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr "Collez-le ci-dessous et cliquez sur %1$s« Connecter »%2$s"

msgid "Enter Pairing Code:"
msgstr "Saisir le code d'appairage :"

msgid "Connect to GetSafe 360"
msgstr "Connecter à GetSafe 360"

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr "Remarque : Le code d'appairage expire dans 10 minutes. Assurez-vous d'avoir généré le code pour cette URL exacte du site : %s"

msgid "Connection Status"
msgstr "État de la connexion"

msgid "Connected"
msgstr "Connecté"

msgid "Site ID"
msgstr "ID du site"

msgid "Connected Since"
msgstr "Connecté depuis"

msgid "F j, Y \\a\\t g:i a"
msgstr "j F Y \\à g\\h i"

msgid "WordPress Version"
msgstr "Version de WordPress"

msgid "Plugin Version"
msgstr "Version du plugin"

msgid "Site URL"
msgstr "URL du site"

msgid "Disconnect Site"
msgstr "Déconnecter le site"

msgid "Are you sure?"
msgstr "Êtes-vous sûr ?"

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr "La déconnexion arrêtera toutes les analyses et la surveillance automatisées pour ce site. Vous pouvez vous reconnecter à tout moment avec un nouveau code d'appairage."

msgid "Yes, Disconnect"
msgstr "Oui, déconnecter"

msgid "Cancel"
msgstr "Annuler"

msgid "What's Next?"
msgstr "Et maintenant ?"

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr "Visitez votre %1$stableau de bord IA GetSafe 360%2$s pour effectuer des analyses de sécurité"

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr "Activez les %1$sréparations automatiques alimentées par l'IA%2$s pour les problèmes courants"

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr "Configurez des %1$sanalyses programmées%2$s pour surveiller votre site 24h/24 et 7j/7"

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr "Consultez des %1$srapports de performance%2$s détaillés et des recommandations"

msgid "Need Help?"
msgstr "Besoin d'aide ?"

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr "Visitez notre %1$sdocumentation%2$s ou %3$scontactez le support%4$s."
```

---

### 2g. Italian — `languages/getsafe360-connector-it_IT.po`

```
# GetSafe 360 AI Connector – Italian (Italy)
# Copyright (C) 2026 GetSafe 360 AI
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"PO-Revision-Date: 2026-06-07T00:00:00+00:00\n"
"Language: it_IT\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr "Informazioni di debug"

msgid "Disconnected"
msgstr "Disconnesso"

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr "Il tuo sito non è più collegato a GetSafe 360. Puoi riconnetterti in qualsiasi momento."

msgid "Connection Failed"
msgstr "Connessione fallita"

msgid "Connection timed out. Please check your internet connection and try again."
msgstr "La connessione è scaduta. Controlla la tua connessione Internet e riprova."

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr "Verifica del certificato SSL fallita. Il tuo sito potrebbe aver bisogno di certificati SSL aggiornati."

msgid "Successfully Connected!"
msgstr "Connesso con successo!"

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr "Il tuo sito WordPress è ora collegato a GetSafe 360. Ora puoi eseguire scansioni di sicurezza e controlli delle prestazioni dal tuo pannello."

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Questo codice di abbinamento è scaduto. Genera un nuovo codice dal tuo pannello GetSafe 360."

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Questo codice di abbinamento è già stato utilizzato. Genera un nuovo codice dal tuo pannello GetSafe 360."

msgid "GetSafe 360 Connector"
msgstr "GetSafe 360 Connector"

msgid "Version %s"
msgstr "Versione %s"

msgid "Connect Your WordPress Site"
msgstr "Collega il tuo sito WordPress"

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr "Collega questo sito WordPress al tuo pannello GetSafe 360 per la scansione automatica della sicurezza, il monitoraggio delle prestazioni e le riparazioni basate sull'intelligenza artificiale."

msgid "How to connect:"
msgstr "Come connettersi:"

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr "Accedi al tuo %1$spannello GetSafe 360%2$s"

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr "Clicca su %1$s«Aggiungi sito»%2$s o %3$s«Genera codice di abbinamento»%4$s"

msgid "Copy the %1$s6-digit code%2$s"
msgstr "Copia il %1$scodice a 6 cifre%2$s"

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr "Incollalo qui sotto e clicca su %1$s«Connetti»%2$s"

msgid "Enter Pairing Code:"
msgstr "Inserisci il codice di abbinamento:"

msgid "Connect to GetSafe 360"
msgstr "Connetti a GetSafe 360"

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr "Nota: Il codice di abbinamento scade in 10 minuti. Assicurati di aver generato il codice per esattamente questo URL del sito: %s"

msgid "Connection Status"
msgstr "Stato connessione"

msgid "Connected"
msgstr "Connesso"

msgid "Site ID"
msgstr "ID sito"

msgid "Connected Since"
msgstr "Connesso dal"

msgid "F j, Y \\a\\t g:i a"
msgstr "j F Y \\a\\l\\l\\e g:i"

msgid "WordPress Version"
msgstr "Versione WordPress"

msgid "Plugin Version"
msgstr "Versione plugin"

msgid "Site URL"
msgstr "URL sito"

msgid "Disconnect Site"
msgstr "Disconnetti sito"

msgid "Are you sure?"
msgstr "Sei sicuro?"

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr "La disconnessione interromperà tutte le scansioni automatiche e il monitoraggio per questo sito. Puoi riconnetterti in qualsiasi momento utilizzando un nuovo codice di abbinamento."

msgid "Yes, Disconnect"
msgstr "Sì, disconnetti"

msgid "Cancel"
msgstr "Annulla"

msgid "What's Next?"
msgstr "Cosa succede adesso?"

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr "Visita il tuo %1$spannello AI di GetSafe 360%2$s per eseguire scansioni di sicurezza"

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr "Abilita le %1$sriparazioni automatiche basate sull'AI%2$s per i problemi comuni"

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr "Configura %1$sscansioni pianificate%2$s per monitorare il tuo sito 24/7"

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr "Visualizza %1$sreport sulle prestazioni%2$s dettagliati e raccomandazioni"

msgid "Need Help?"
msgstr "Hai bisogno di aiuto?"

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr "Visita la nostra %1$sdocumentazione%2$s o %3$scontatta il supporto%4$s."
```

---

### 2h. Portuguese (Brazil) — `languages/getsafe360-connector-pt_BR.po`

```
# GetSafe 360 AI Connector – Portuguese (Brazil)
# Copyright (C) 2026 GetSafe 360 AI
msgid ""
msgstr ""
"Project-Id-Version: GetSafe 360 AI Connector 0.3.0\n"
"PO-Revision-Date: 2026-06-07T00:00:00+00:00\n"
"Language: pt_BR\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
"X-Domain: getsafe360-connector\n"

msgid "Debug Information"
msgstr "Informações de depuração"

msgid "Disconnected"
msgstr "Desconectado"

msgid "Your site is no longer linked to GetSafe 360. You can reconnect anytime."
msgstr "Seu site não está mais vinculado ao GetSafe 360. Você pode se reconectar a qualquer momento."

msgid "Connection Failed"
msgstr "Falha na conexão"

msgid "Connection timed out. Please check your internet connection and try again."
msgstr "A conexão expirou. Por favor, verifique sua conexão com a internet e tente novamente."

msgid "SSL certificate verification failed. Your site may need updated SSL certificates."
msgstr "A verificação do certificado SSL falhou. Seu site pode precisar de certificados SSL atualizados."

msgid "Successfully Connected!"
msgstr "Conectado com sucesso!"

msgid "Your WordPress site is now linked to GetSafe 360. You can now run security scans and performance checks from your dashboard."
msgstr "Seu site WordPress agora está vinculado ao GetSafe 360. Você já pode executar análises de segurança e verificações de desempenho pelo seu painel."

msgid "This pairing code has expired. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Este código de emparelhamento expirou. Por favor, gere um novo código no seu painel do GetSafe 360."

msgid "This pairing code has already been used. Please generate a new code from your GetSafe 360 dashboard."
msgstr "Este código de emparelhamento já foi utilizado. Por favor, gere um novo código no seu painel do GetSafe 360."

msgid "GetSafe 360 Connector"
msgstr "GetSafe 360 Connector"

msgid "Version %s"
msgstr "Versão %s"

msgid "Connect Your WordPress Site"
msgstr "Conectar seu site WordPress"

msgid "Link this WordPress site to your GetSafe 360 dashboard for automated security scanning, performance monitoring, and AI-powered site repairs."
msgstr "Vincule este site WordPress ao seu painel do GetSafe 360 para análise de segurança automatizada, monitoramento de desempenho e reparos com inteligência artificial."

msgid "How to connect:"
msgstr "Como se conectar:"

msgid "Log in to your %1$sGetSafe 360 dashboard%2$s"
msgstr "Faça login no seu %1$spainel do GetSafe 360%2$s"

msgid "Click %1$s\"Add Site\"%2$s or %3$s\"Generate Pairing Code\"%4$s"
msgstr "Clique em %1$s\"Adicionar site\"%2$s ou %3$s\"Gerar código de emparelhamento\"%4$s"

msgid "Copy the %1$s6-digit code%2$s"
msgstr "Copie o %1$scódigo de 6 dígitos%2$s"

msgid "Paste it below and click %1$s\"Connect\"%2$s"
msgstr "Cole-o abaixo e clique em %1$s\"Conectar\"%2$s"

msgid "Enter Pairing Code:"
msgstr "Inserir código de emparelhamento:"

msgid "Connect to GetSafe 360"
msgstr "Conectar ao GetSafe 360"

msgid "Note: The pairing code expires in 10 minutes. Make sure you generated the code for this exact site URL: %s"
msgstr "Atenção: O código de emparelhamento expira em 10 minutos. Certifique-se de ter gerado o código para exatamente esta URL do site: %s"

msgid "Connection Status"
msgstr "Status da conexão"

msgid "Connected"
msgstr "Conectado"

msgid "Site ID"
msgstr "ID do site"

msgid "Connected Since"
msgstr "Conectado desde"

msgid "F j, Y \\a\\t g:i a"
msgstr "j \\d\\e F \\d\\e Y \\à\\s g:i"

msgid "WordPress Version"
msgstr "Versão do WordPress"

msgid "Plugin Version"
msgstr "Versão do plugin"

msgid "Site URL"
msgstr "URL do site"

msgid "Disconnect Site"
msgstr "Desconectar site"

msgid "Are you sure?"
msgstr "Tem certeza?"

msgid "Disconnecting will stop all automated scans and monitoring for this site. You can reconnect anytime using a new pairing code."
msgstr "A desconexão irá parar todas as análises e o monitoramento automatizados deste site. Você pode se reconectar a qualquer momento usando um novo código de emparelhamento."

msgid "Yes, Disconnect"
msgstr "Sim, desconectar"

msgid "Cancel"
msgstr "Cancelar"

msgid "What's Next?"
msgstr "O que vem a seguir?"

msgid "Visit your %1$sGetSafe 360 AI dashboard%2$s to run security scans"
msgstr "Acesse seu %1$spainel de IA do GetSafe 360%2$s para executar análises de segurança"

msgid "Enable %1$sAI-powered automatic repairs%2$s for common issues"
msgstr "Ative os %1$sreparos automáticos com IA%2$s para problemas comuns"

msgid "Set up %1$sscheduled scans%2$s to monitor your site 24/7"
msgstr "Configure %1$sanálises agendadas%2$s para monitorar seu site 24/7"

msgid "View detailed %1$sperformance reports%2$s and recommendations"
msgstr "Veja %1$srelatórios de desempenho%2$s detalhados e recomendações"

msgid "Need Help?"
msgstr "Precisa de ajuda?"

msgid "Visit our %1$sdocumentation%2$s or %3$scontact support%4$s."
msgstr "Visite nossa %1$sdocumentação%2$s ou %3$sentre em contato com o suporte%4$s."
```

---

## Compiling .mo files

After creating all `.po` files, compile each one. If `msgfmt` is available:

```bash
cd saas-ux/public/wp-plugin/languages
for f in *.po; do msgfmt "$f" -o "${f%.po}.mo"; done
```

Or with WP-CLI from the plugin root:

```bash
wp i18n make-mo saas-ux/public/wp-plugin/languages/
```

Commit the `.mo` files — they are binary but must be in version control so WordPress can load them.

---

## PR Checklist

Before opening the PR, verify:

- [ ] Plugin header has `Update URI`, `Text Domain`, `Domain Path`, version `0.3.0`
- [ ] `const VERSION = '0.3.0'` updated in the class
- [ ] `load_plugin_textdomain()` is the first call in `__construct()`
- [ ] Every hardcoded user-visible string in the plugin is wrapped (`__()`, `_e()`, `esc_html__()`, etc.)
- [ ] `date()` replaced with `wp_date()` for the "Connected Since" display
- [ ] `check_for_update()` and `plugin_api_info()` methods are present
- [ ] Both filters registered in `__construct()`
- [ ] `saas-ux/app/api/wp-plugin/info/route.ts` created and returns valid JSON
- [ ] `WP_PLUGIN_DOWNLOAD_URL=` added to `.env.example` (blank value)
- [ ] `languages/` directory exists with `.pot` + 5x `.po` + 5x `.mo`
- [ ] This `HANDOFF-*.md` file is **not** included in the plugin ZIP (add to `.gitignore` or note in ZIP build docs)

## PR Description template

```
## Summary
- Bump plugin to v0.3.0
- Add WordPress-native automatic update checker pointing at `/api/wp-plugin/info`
- Add SaaS endpoint `GET /api/wp-plugin/info` serving version + download metadata
- Full i18n: all UI strings wrapped in gettext; translations for de_DE, es_ES, fr_FR, it_IT, pt_BR

## Test plan
- [ ] Install plugin on a WP 5.8+ site; confirm `Update URI` header present in plugin list source
- [ ] Temporarily bump version in `/api/wp-plugin/info` response to trigger update notice in WP admin
- [ ] Switch WP language to DE/ES/FR/IT/PT and confirm admin page renders translated strings
- [ ] Confirm connect/disconnect flow still works after string wrapping changes
- [ ] Confirm `/api/wp-plugin/info` returns 200 JSON in production
```
