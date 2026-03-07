#!/bin/sh
set -e

# Give Postgres a moment to accept connections (depends_on + healthcheck still need a short delay)
echo "Waiting for database..."
sleep 5

echo "Running prisma generate..."
npx prisma generate

echo "Applying schema (db push)..."
npx prisma db push --accept-data-loss

exec "$@"
