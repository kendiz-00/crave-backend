#!/bin/bash

# CRAVE Backend Database Rollback Script
# This script rolls back the database to a previous migration

set -e

# Configuration
MIGRATION_STEP="${1:-1}"

echo "Rolling back database by ${MIGRATION_STEP} migration(s)..."

# Rollback Prisma migration
npx prisma migrate resolve --rolled-back "${MIGRATION_STEP}"

echo "Rollback completed successfully"

# Generate Prisma Client after rollback
npx prisma generate

echo "Prisma Client generated"
