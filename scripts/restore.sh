#!/bin/bash

# CRAVE Backend Database Restore Script
# This script restores a PostgreSQL database from a backup

set -e

# Configuration
BACKUP_DIR="/backups"
BACKUP_FILE="${1}"

# Database configuration (from environment)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-crave}"
DB_USER="${POSTGRES_USER:-crave}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Check if backup file is provided
if [ -z "${BACKUP_FILE}" ]; then
  echo "Error: No backup file specified"
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -lh "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "Starting database restore from ${BACKUP_FILE}"

# Decompress if needed
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  TEMP_FILE="${BACKUP_FILE%.gz}"
  echo "Decompressing backup..."
  gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
  BACKUP_FILE="${TEMP_FILE}"
fi

# Perform restore using pg_restore
PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --clean \
  --if-exists \
  "${BACKUP_FILE}"

echo "Restore completed successfully"

# Clean up temporary file if it was decompressed
if [[ "${TEMP_FILE}" == *.sql ]]; then
  rm -f "${TEMP_FILE}"
fi
