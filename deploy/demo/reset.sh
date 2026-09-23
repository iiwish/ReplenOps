#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEMO_PG_CONTAINER:?}"
: "${DEMO_APP_CONTAINER:?}"
: "${DEMO_SEED_IMAGE:?}"
: "${DEMO_DB_OWNER_PASSWORD:?}"
: "${DEMO_ACCOUNT_PASSWORD:?}"
: "${DEMO_OWNER_PASSWORD:?}"

if [[ "$DEMO_PG_CONTAINER" != "1Panel-postgresql-main" || "$DEMO_APP_CONTAINER" != "replenops-demo" ]]; then
  echo 'Unexpected demo infrastructure target' >&2
  exit 1
fi
if [[ ! "$DEMO_DB_OWNER_PASSWORD" =~ ^[a-f0-9]{64}$ ]]; then
  echo 'Demo database owner password must be 64 lowercase hex characters' >&2
  exit 1
fi

exec 9>/run/replenops-demo-reset.lock
flock -n 9 || { echo 'Demo reset is already running' >&2; exit 1; }

admin_sql() {
  docker exec "$DEMO_PG_CONTAINER" sh -c \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -At -c "$2"' \
    sh "$1" "$2"
}

database_exists() {
  [[ "$(admin_sql postgres "SELECT 1 FROM pg_database WHERE datname = '$1'")" == 1 ]]
}

drop_database() {
  admin_sql postgres "DROP DATABASE IF EXISTS $1 WITH (FORCE)" >/dev/null
}

run_seed_command() {
  docker run --rm \
    --network 1panel-network \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m,mode=1777 \
    --memory 768m \
    --cpus 1 \
    -e DATABASE_URL \
    -e APP_ENV \
    -e DEMO_SEED_CONFIRM \
    -e DEMO_ACCOUNT_PASSWORD \
    -e DEMO_OWNER_PASSWORD \
    "$DEMO_SEED_IMAGE" "$@"
}

wait_for_app() {
  local state
  for _ in {1..24}; do
    state="$(docker inspect "$DEMO_APP_CONTAINER" --format '{{.State.Health.Status}}')"
    [[ "$state" == healthy ]] && return 0
    [[ "$state" == unhealthy ]] && return 1
    sleep 5
  done
  return 1
}

echo 'Preparing fresh synthetic demo database'
drop_database replenops_demo_next
admin_sql postgres 'CREATE DATABASE replenops_demo_next OWNER replenops_demo_owner' >/dev/null

export DATABASE_URL="postgresql://replenops_demo_owner:${DEMO_DB_OWNER_PASSWORD}@postgresql:5432/replenops_demo_next"
export APP_ENV=preview
export DEMO_SEED_CONFIRM=replenops-demo-only
run_seed_command node node_modules/prisma/build/index.js migrate deploy
run_seed_command node node_modules/tsx/dist/cli.mjs prisma/seed.ts
run_seed_command node node_modules/tsx/dist/cli.mjs prisma/demo-seed.ts
run_seed_command node node_modules/tsx/dist/cli.mjs prisma/demo-verify.ts
unset DATABASE_URL

admin_sql postgres 'GRANT CONNECT ON DATABASE replenops_demo_next TO replenops_demo_app' >/dev/null
admin_sql replenops_demo_next 'GRANT USAGE ON SCHEMA public TO replenops_demo_app' >/dev/null
admin_sql replenops_demo_next 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO replenops_demo_app' >/dev/null
admin_sql replenops_demo_next 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO replenops_demo_app' >/dev/null

drop_database replenops_demo_previous
drop_database replenops_demo_failed

app_exists=0
if docker container inspect "$DEMO_APP_CONTAINER" >/dev/null 2>&1; then
  app_exists=1
  docker stop -t 20 "$DEMO_APP_CONTAINER" >/dev/null
fi

if database_exists replenops_demo; then
  admin_sql postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'replenops_demo' AND pid <> pg_backend_pid()" >/dev/null
  admin_sql postgres 'ALTER DATABASE replenops_demo RENAME TO replenops_demo_previous' >/dev/null
fi
if ! admin_sql postgres 'ALTER DATABASE replenops_demo_next RENAME TO replenops_demo' >/dev/null; then
  if database_exists replenops_demo_previous; then
    admin_sql postgres 'ALTER DATABASE replenops_demo_previous RENAME TO replenops_demo' >/dev/null
  fi
  if (( app_exists )); then docker start "$DEMO_APP_CONTAINER" >/dev/null; fi
  exit 1
fi

if (( app_exists )); then
  if ! docker start "$DEMO_APP_CONTAINER" >/dev/null || ! wait_for_app; then
    echo 'Demo health check failed; restoring previous database' >&2
    docker stop -t 10 "$DEMO_APP_CONTAINER" >/dev/null 2>&1 || true
    admin_sql postgres 'ALTER DATABASE replenops_demo RENAME TO replenops_demo_failed' >/dev/null
    if database_exists replenops_demo_previous; then
      admin_sql postgres 'ALTER DATABASE replenops_demo_previous RENAME TO replenops_demo' >/dev/null
      docker start "$DEMO_APP_CONTAINER" >/dev/null
    fi
    exit 1
  fi
fi

echo 'Demo database reset completed and verified'
