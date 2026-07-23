#!/bin/bash

# CRAVE Backend Database Migration Script
# This script runs Prisma migrations

set -e

echo "Starting database migrations..."

# Run Prisma migrations
npx prisma migrate deploy

echo "Migrations completed successfully"

# Generate Prisma Client after migration
npx prisma generate

echo "Prisma Client generated"
