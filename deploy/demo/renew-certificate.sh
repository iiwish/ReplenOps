#!/usr/bin/env bash
set -Eeuo pipefail

domain=replenops-demo.ouvo.ai
site_ssl=/opt/1panel/apps/openresty/openresty/www/sites/$domain/ssl
webroot=/opt/1panel/apps/openresty/openresty/root

docker run --rm --network host \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v "$webroot:/var/www/acme" \
  certbot/certbot:latest renew --non-interactive --quiet

certificate=/etc/letsencrypt/live/$domain/fullchain.pem
private_key=/etc/letsencrypt/live/$domain/privkey.pem
openssl x509 -in "$certificate" -noout -checkend 604800 >/dev/null
install -d -m 700 "$site_ssl"
install -m 644 "$certificate" "$site_ssl/fullchain.pem"
install -m 600 "$private_key" "$site_ssl/privkey.pem"
docker exec 1Panel-openresty-gtwt openresty -t
docker exec 1Panel-openresty-gtwt openresty -s reload
