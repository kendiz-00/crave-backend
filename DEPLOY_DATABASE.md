# CRAVE PostgreSQL Production Deployment Guide

**Version:** v1.0.0-rc1  
**Date:** July 23, 2026  
**Document Type:** Database Deployment  
**Status:** Staging Deployment

---

## Overview

This guide covers PostgreSQL deployment for CRAVE using Render managed PostgreSQL. It includes migration procedures, backup strategies, and production safety checks.

---

## PART 1: Prisma Production Configuration

### Current Schema Status

The Prisma schema is production-ready with:
- ✅ Proper relationships and cascade deletes
- ✅ Indexes on critical fields
- ✅ Enum definitions for status fields
- ✅ Decimal types for financial data
- ✅ UUID primary keys
- ✅ Timestamps for audit trails

### Migration Strategy

**IMPORTANT:** Always use `npx prisma migrate deploy` in production, NEVER `npx prisma migrate dev`.

**Why:**
- `migrate deploy` only applies pending migrations
- `migrate dev` creates new migrations and modifies schema
- `migrate dev` can cause schema drift in production
- `migrate deploy` is idempotent and safe for CI/CD

---

## PART 2: Database Migration Workflow

### Development Workflow

```bash
# Create new migration (development only)
npx prisma migrate dev --name migration_name

# Generate Prisma Client
npx prisma generate

# Seed database (development only)
npm run seed
```

### Staging Workflow

```bash
# Generate Prisma Client
npx prisma generate

# Apply pending migrations (staging)
npx prisma migrate deploy

# Seed database (staging - optional)
npm run seed
```

### Production Workflow

```bash
# Generate Prisma Client
npx prisma generate

# Apply pending migrations (production)
npx prisma migrate deploy

# NEVER seed production database
# Production data should be migrated, not seeded
```

---

## PART 3: Render PostgreSQL Setup

### Step 1: Create PostgreSQL Instance

1. Log in to Render dashboard
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name:** crave-db (staging: crave-db-staging, production: crave-db-prod)
   - **Database:** crave_db
   - **User:** crave_user
   - **Region:** Oregon (same as backend)
   - **Plan:** Starter ($7/month) or Standard ($25/month)
4. Click "Create Database"

### Step 2: Get Connection String

1. Go to database instance
2. Copy "Internal Database URL"
3. Format: `postgresql://crave_user:password@host:5432/crave_db`

### Step 3: Configure Environment Variables

In Render backend service:
1. Add `DATABASE_URL` environment variable
2. Paste connection string
3. Mark as sensitive (sync: false in render.yaml)

---

## PART 4: Migration Deployment

### Initial Deployment

```bash
# Connect to Render database via psql
psql $DATABASE_URL

# Verify connection
SELECT version();

# Exit
\q

# Run migrations
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status

# Generate Prisma Client
npx prisma generate
```

### Subsequent Deployments

Render automatically runs:
```bash
npm install
npm run build
npx prisma generate
npx prisma migrate deploy
```

---

## PART 5: Database Backup Strategy

### Render Automatic Backups

Render provides:
- **Daily backups:** Automatic, 7-day retention
- **Point-in-time recovery:** Up to 7 days
- **Physical backups:** Stored securely
- **No additional cost:** Included in plan

### Manual Backup Procedure

```bash
# Export database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to secure storage (S3, etc.)
# (Optional but recommended)
```

### Backup Schedule

- **Daily:** Automatic (Render)
- **Weekly:** Manual backup before major changes
- **Pre-deployment:** Manual backup before production deployment
- **On-demand:** Manual backup before schema changes

---

## PART 6: Database Restore Strategy

### Point-in-Time Recovery (Render)

1. Go to Render database dashboard
2. Click "Backups"
3. Select backup to restore
4. Click "Restore"
5. Confirm restore
6. Wait for restore completion
7. Verify data integrity

### Manual Restore Procedure

```bash
# Decompress backup
gunzip backup_20260723_120000.sql.gz

# Restore database
psql $DATABASE_URL < backup_20260723_120000.sql

# Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
```

### Restore Verification

```sql
-- Verify user count
SELECT COUNT(*) FROM "User";

-- Verify order count
SELECT COUNT(*) FROM "Order";

-- Verify payment count
SELECT COUNT(*) FROM "Payment";

-- Verify recent orders
SELECT * FROM "Order" ORDER BY createdAt DESC LIMIT 5;
```

---

## PART 7: Database Indexes

### Current Indexes

The schema includes indexes on:
- `User.email`, `User.phone`
- `Category.slug`, `Category.isActive`
- `MenuItem.categoryId`, `MenuItem.slug`, `MenuItem.sku`
- `MenuItem.isAvailable`, `MenuItem.isFeatured`, `MenuItem.isDeleted`
- `MenuItem.displayOrder`
- `AddOn.menuItemId`
- `MenuImage.menuItemId`
- `CartItem.cartId`, `CartItem.menuItemId`
- `CartItemAddOn.cartItemId`
- `Order.userId`, `Order.orderNumber`, `Order.status`
- `Order.paymentStatus`, `Order.createdAt`
- `OrderItem.orderId`, `OrderItem.menuItemId`
- `OrderItemAddOn.orderItemId`
- `RewardTransaction.userId`, `RewardTransaction.orderId`
- `RewardTransaction.createdAt`
- `RewardCode.userId`, `RewardCode.code`, `RewardCode.status`
- `RewardCode.expiresAt`, `RewardCode.orderId`
- `Payment.orderId`, `Payment.reference`, `Payment.status`
- `Payment.createdAt`

### Index Performance

All critical query paths are indexed:
- User authentication (email, phone)
- Menu browsing (category, slug, availability)
- Order management (userId, status, createdAt)
- Payment processing (orderId, reference, status)
- Rewards (userId, code, status)

---

## PART 8: Database Connection Pooling

### Prisma Connection Pooling

Prisma automatically manages connection pooling:
- Default pool size: 10 connections
- Configurable via `connection_limit` in DATABASE_URL
- Render PostgreSQL supports up to 100 connections

### Connection String Format

```
postgresql://user:password@host:5432/database?connection_limit=10
```

### Production Recommendation

For production (Standard tier):
```
postgresql://user:password@host:5432/database?connection_limit=20
```

---

## PART 9: Database Security

### Security Measures

1. **SSL/TLS:** All connections encrypted (Render default)
2. **Private Networking:** Database accessible only from Render services
3. **Strong Passwords:** Auto-generated by Render
4. **Access Control:** Role-based access (crave_user)
5. **Audit Logging:** Query logging available in Render dashboard

### Best Practices

- Never expose DATABASE_URL in code
- Use environment variables only
- Rotate database passwords regularly
- Monitor query performance
- Use read replicas for scaling (future)

---

## PART 10: Database Monitoring

### Render Dashboard Metrics

- **CPU Usage:** Database CPU utilization
- **Memory Usage:** Database memory utilization
- **Disk Usage:** Storage utilization
- **Connection Count:** Active connections
- **Query Performance:** Slow query logs

### Custom Monitoring Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Database size
SELECT pg_size_pretty(pg_database_size('crave_db'));

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Slow queries (requires pg_stat_statements)
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## PART 11: Production Safety Checklist

### Pre-Deployment Checklist

- [ ] Database backup created
- [ ] Migration reviewed and tested in staging
- [ ] Migration is reversible (has down migration)
- [ ] Prisma client generated
- [ ] Connection string verified
- [ ] Indexes reviewed
- [ ] Data migration plan documented
- [ ] Rollback plan documented

### Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] Prisma migrate status shows all applied
- [ ] Database connectivity verified
- [ ] Critical queries tested
- [ ] Performance metrics reviewed
- [ ] Error logs reviewed
- [ ] Data integrity verified
- [ ] Rollback capability confirmed

---

## PART 12: Troubleshooting

### Migration Fails

**Issue:** Migration fails to apply

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Resolve migration conflict
npx prisma migrate resolve --applied migration_name

# Or rollback
npx prisma migrate resolve --rolled-back migration_name
```

### Connection Refused

**Issue:** Cannot connect to database

**Solution:**
1. Verify DATABASE_URL is correct
2. Check Render database status
3. Verify private networking is enabled
4. Check firewall rules

### Slow Queries

**Issue:** Database queries are slow

**Solution:**
1. Check query execution plan with `EXPLAIN ANALYZE`
2. Review indexes
3. Consider adding missing indexes
4. Optimize queries
5. Consider database upgrade

---

## PART 13: Disaster Recovery

### Recovery Time Objective (RTO)

**Target:** 1 hour

**Procedure:**
1. Identify last good backup
2. Initiate restore via Render dashboard
3. Wait for restore completion (30-45 minutes)
4. Verify data integrity
5. Test application connectivity
6. Resume operations

### Recovery Point Objective (RPO)

**Target:** 24 hours (daily backups)

**Procedure:**
- Render automatic daily backups
- Manual backups before major changes
- Point-in-time recovery available

---

## Conclusion

The CRAVE PostgreSQL deployment strategy uses Render managed PostgreSQL for simplicity and reliability. The migration workflow ensures production safety by using `npx prisma migrate deploy` exclusively. Automatic backups and point-in-time recovery provide disaster recovery capabilities.

**Next Steps:**
1. Create PostgreSQL instance on Render
2. Configure DATABASE_URL environment variable
3. Run initial migration
4. Verify database connectivity
5. Test application with database

---

**Document Version:** 1.0  
**Last Updated:** July 23, 2026  
**Next Review:** After staging deployment
