#!/usr/bin/env bash
# Integration test for the connector plugin against a real WordPress install.
#
# Needs: php (mysqli), a MySQL/MariaDB server reachable with the credentials
# below, git and curl. Downloads WordPress from its GitHub mirror and wp-cli.
#
#   DB_HOST=127.0.0.1 DB_USER=wp DB_PASS=wp DB_NAME=wp ./run.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN="$HERE/../../../public/wp-plugin/getsafe360-connector.php"
WP_VERSION="${WP_VERSION:-7.1.4}"
WORK="${WORK_DIR:-$(mktemp -d)}"

cd "$WORK"
[ -f wp-cli.phar ] || curl -sSfL -o wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
[ -d wordpress ] || git clone -q --depth 1 --branch "$WP_VERSION" https://github.com/WordPress/WordPress wordpress

WP="php $WORK/wp-cli.phar --allow-root --path=$WORK/wordpress"
[ -f wordpress/wp-config.php ] || $WP config create --dbname="${DB_NAME:-wp}" --dbuser="${DB_USER:-wp}" \
  --dbpass="${DB_PASS:-wp}" --dbhost="${DB_HOST:-127.0.0.1}" --skip-check --quiet
$WP core is-installed 2>/dev/null || $WP core install --url=https://example.test --title=Test \
  --admin_user=admin --admin_password=integration --admin_email=admin@example.test --skip-email --quiet

mkdir -p wordpress/wp-content/plugins/getsafe360-connector
cp "$PLUGIN" wordpress/wp-content/plugins/getsafe360-connector/
$WP plugin activate getsafe360-connector --quiet
$WP eval-file "$HERE/audit-test.php"
$WP eval-file "$HERE/actions-test.php"

# Plugin updates need the site to load itself for the health check: serve it locally.
PORT="${LOOPBACK_PORT:-8089}"
PHP_CLI_SERVER_WORKERS=4 php -S "127.0.0.1:$PORT" -t "$WORK/wordpress" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
for _ in $(seq 1 20); do curl -s --noproxy '*' -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
GS360_LOOPBACK="http://127.0.0.1:$PORT" $WP eval-file "$HERE/plugin-updates-test.php"
