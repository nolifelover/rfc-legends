# PocketBase 0.40.4 for the rfctv box (D2).
# Build context: pocketbase/ — ships the exact pinned binary already used in
# dev, plus the shared migrations/hooks. Data lives in a mounted volume.
FROM alpine:3.20
WORKDIR /app
COPY pocketbase ./pocketbase
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
RUN chmod +x ./pocketbase && apk add --no-cache ca-certificates
EXPOSE 8091
# upsert the superuser against the mounted data dir, then serve
CMD ["/bin/sh", "-c", "./pocketbase superuser upsert \"$POCKETBASE_SUPERUSER_EMAIL\" \"$POCKETBASE_SUPERUSER_PASSWORD\" --dir /app/pb_data && exec ./pocketbase serve --http 0.0.0.0:8091 --dir /app/pb_data --migrationsDir pb_migrations --hooksDir pb_hooks"]
