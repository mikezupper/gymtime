# VPS operation

The production image serves built HTML, CSS, JavaScript, and the Rust service on x86_64. Node is used during builds and is absent from the runtime image. It includes email OTP, invitations, scheduling, notifications, and parent calendars. [Verification](verification.md) records local checks; deployment still requires the owner's hostname, email configuration, and authorization.

## Configure the existing proxy

Copy `.env.example` to a private `.env` and replace its placeholders. Supply your HTTPS origin and matching `APP_HOST`, existing Traefik network, entrypoint, certificate resolver, sender identity, initial organizer email, custom Resend-compatible endpoint, API key, and a random `AUTH_SECRET` of at least 32 bytes. Keep this file out of source control.

`TRUSTED_PROXY_CIDRS` is parsed at startup. Forwarded addresses affect rate limits only when the connection peer falls within a configured proxy range. The app walks the forwarded chain from the trusted peer toward the first untrusted address. Invalid or oversized chains fall back to the peer address. Configure the ranges narrowly for your Traefik network.

The application joins the named external network. Compose contains no proxy service and publishes no host port. Its labels route the configured host through your existing Traefik instance to the internal `APP_PORT`, which defaults to 3000. The database is stored in the `gymtime-data` volume at `/data/gymtime.db`.

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env build app
docker compose --env-file .env up -d app
docker compose --env-file .env exec app curl --fail --silent http://127.0.0.1:3000/health/ready
docker compose --env-file .env logs --tail 100 app
```

Use your selected port in readiness commands if you override `APP_PORT`. The build embeds `APP_PUBLIC_URL` in the landing page's canonical link and sitemap; changing that origin requires rebuilding the image. The image runs as UID/GID 10001. On mounted directories, this identity needs write access to the SQLite directory and its journal files.

Readiness requires successful migrations and a database query. Email availability does not affect readiness. Configuration failures identify the field without printing its value. Structured HTTP logs record method, matched route pattern, action, request ID, status, and latency; team tokens and query strings are omitted.

SQLite uses foreign keys, WAL, a five-second lock wait, and a bounded 60-second pool acquisition wait to tolerate slow startup disk operations. HTTP requests have a ten-second deadline. SIGTERM and Ctrl+C stop request acceptance, bound draining to ten seconds, and close the database pool. Compose allows 15 seconds for shutdown.

## Replace an application container

```bash
docker compose --env-file .env up -d --force-recreate app
docker compose --env-file .env exec app curl --fail --silent http://127.0.0.1:3000/health/ready
```

Replacement keeps the named database volume. Bootstrap grants the first organizer only when no organizer exists; changing the bootstrap email does not grant another organizer on restart. Coach and organizer management use the application's permission checks.

## Make a consistent backup

This first runbook uses a short service interruption. Stop the writer, then copy the entire data directory, including any SQLite journal files. Choose a private backup destination with sufficient space before starting.

```bash
gymtime_backup_dir=/your/private/backups/gymtime-YYYYMMDD-HHMMSS
mkdir -p "$gymtime_backup_dir"
docker compose --env-file .env stop app
gymtime_container_id=$(docker compose --env-file .env ps --all --quiet app)
docker cp "$gymtime_container_id:/data/." "$gymtime_backup_dir/"
docker compose --env-file .env start app
docker compose --env-file .env exec app curl --fail --silent http://127.0.0.1:3000/health/ready
```

If copying fails, keep the incomplete backup separate and restart the service before diagnosing storage. Do not copy only a live database file: committed writes can still be in its WAL. Protect backups as account and schedule data. Select storage, retention, and restore frequency before production use.

## Restore into a separate directory

Keep the original volume and backup intact. Copy the backup into a new directory and give UID/GID 10001 write access. Run the image with that directory mounted at `/data`, private runtime configuration from a file, and a distinct loopback port. The restore environment must contain the same validated application fields as production.

```bash
gymtime_restore_dir=/your/private/restore/gymtime-check
mkdir -p "$gymtime_restore_dir"
cp -a "$gymtime_backup_dir/." "$gymtime_restore_dir/"
docker run --rm --user 0 --entrypoint chown \
  -v "$gymtime_restore_dir:/data" gymtime:local -R 10001:10001 /data
docker run --name gymtime-restore-check --detach \
  --env-file .env -e APP_ENV=production -e DATABASE_URL=sqlite:///data/gymtime.db \
  -v "$gymtime_restore_dir:/data" -p 127.0.0.1:3917:3000 gymtime:local
curl --fail http://127.0.0.1:3917/health/ready
docker logs gymtime-restore-check
docker stop gymtime-restore-check
docker rm gymtime-restore-check
```

Use the matching published container port if `APP_PORT` differs. A restore check must verify expected application data as well as readiness; the current schema includes accounts, grants, OTP challenges, sessions, audit events, notifications, and the email outbox. Verify teams, seasons, slots, bookings, requests, swaps, closures, sharing links, and notification history before switching production storage.

Reverting an image does not undo a migration. Take a backup before upgrades and restore it into separate storage when an older image requires an older schema. Do not run an older image against an unverified newer database. Migrations have no down migration; recovery uses a compatible image and a verified backup.
