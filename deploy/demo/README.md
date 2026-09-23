# ReplenOps Hong Kong Demo

This environment is a public, disposable demonstration. It never imports production data.

## Runtime

- URL: `https://replenops-demo.ouvo.ai`
- Application: `replenops-demo`, bound to `127.0.0.1:13201` and reverse-proxied by 1Panel OpenResty
- Database: `replenops_demo` in the existing `1Panel-postgresql-main` PostgreSQL container
- Database roles: `replenops_demo_owner` for migration/seed, `replenops_demo_app` for runtime DML
- `APP_ENV=preview`, `DEMO_MODE=true`, `DEMO_PUBLIC_ORIGIN=https://replenops-demo.ouvo.ai`
- Public one-click accounts: `demo_store` and `demo_warehouse`; the `demo_owner` account is not exposed

The seed creates eight stores, two warehouses, 66 products, inventory in both warehouses, 77 orders in representative states, stock-in/out documents, inventory and cost logs, and container tracking. All names and records are synthetic. It runs only against an empty database whose name starts with `replenops_demo` and requires an explicit confirmation variable.

## Daily Reset

`replenops-demo-reset.timer` runs at 04:00 Asia/Shanghai. `reset.sh` creates a fresh `replenops_demo_next` database, applies committed Prisma migrations, seeds current-dated synthetic records, verifies counts and inventory/order invariants, grants the runtime role DML access, stops the application, and swaps database names. The previous database remains as `replenops_demo_previous` for rollback until the next successful preparation. Existing browser sessions are invalidated by the reset.

The reset service reads root-owned `/etc/replenops-demo/reset.env` with the following variables:

```text
DEMO_PG_CONTAINER=1Panel-postgresql-main
DEMO_APP_CONTAINER=replenops-demo
DEMO_SEED_IMAGE=<locally-built demo-seeder image tag>
DEMO_APP_IMAGE=<locally-built runner image tag>
DEMO_DB_OWNER_PASSWORD=<64-character lowercase hex secret>
DEMO_ACCOUNT_PASSWORD=<unique random secret, at least 24 characters>
DEMO_OWNER_PASSWORD=<unique random secret, at least 24 characters>
```

The app reads root-owned `/etc/replenops-demo/app.env`, which contains its dedicated `DATABASE_URL`, `JWT_SECRET`, `WECOM_SECRET_KEY`, the demo flags and public host settings. Neither environment file belongs in Git.

On a release, build both `runner` and `demo-seeder` from the same reviewed commit, load the images on the server, update the two image tags, run one reset, and recreate the Compose app. Verify `/api/health`, both demo login roles, and the daily timer before publishing the link.

## TLS

`openresty-http.conf` is used only while obtaining the first Let's Encrypt certificate. `openresty.conf` then provides HTTPS proxying. `replenops-demo-cert.timer` runs weekly and copies renewed certificates into the OpenResty site directory before reloading the proxy.

Do not run `docker volume prune` or drop the shared PostgreSQL container. Docker image pruning is limited to images unused by any container.
