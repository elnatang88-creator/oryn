#!/bin/bash
# Runs once, on first start of an empty database volume.
# ORYN connects as a least-privilege role that owns only its own database (not a superuser).
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v pw="$ORYN_DB_PASSWORD" <<'SQL'
CREATE ROLE oryn_app LOGIN PASSWORD :'pw' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE oryn OWNER oryn_app;
REVOKE ALL ON DATABASE oryn FROM PUBLIC;
SQL
