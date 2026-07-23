#!/bin/bash

# CRAVE Backend Database Backup Script
# This script creates a backup of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/crave_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=7

# Database configuration (from environment)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-crave}"
DB_USER="${POSTGRES_USER:-crave}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Starting database backup at ${TIMESTAMP}"

# Perform backup using pg_dump
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --no-owner \
  --no-acl \
  > "${BACKUP_FILE}"

# Compress the backup
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup completed: ${BACKUP_FILE}"

# Clean up old backups (keep last RETENTION_DAYS days)
find "${BACKUP_DIR}" -name "crave_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "Old backups cleaned up (retaining last ${RETENTION_DAYS} days)"
