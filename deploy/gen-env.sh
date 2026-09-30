#!/bin/bash
# Creates deploy/.env with fresh random secrets. Run once on the server. The file never goes into git.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then echo ".env already exists — not overwriting."; exit 1; fi
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
read -rp "Domain for ORYN (e.g. oryn.yourcompany.com): " domain
cat > .env <<ENV
ORYN_DOMAIN=${domain}
ORYN_SECRET=$(rand 64)
CRON_SECRET=$(rand 40)
POSTGRES_ADMIN_PASSWORD=$(rand 40)
ORYN_DB_PASSWORD=$(rand 40)
# Demo data (fictional accounts). Keep false for real users.
ORYN_SEED_DEMO=false
# ORYN_DEMO_PASSWORD=choose-one-if-demo-is-true
BACKUP_KEEP_DAYS=14
ENV
chmod 600 .env
echo "Wrote deploy/.env (permissions 600). Keep a copy of it in the company password manager."
