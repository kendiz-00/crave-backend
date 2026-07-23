# CRAVE Backend Stress Test Report

**Date:** July 23, 2026  
**Phase:** RC2 Release Candidate  
**Status:** Scripts Ready - Execution Requires Server Deployment

## Executive Summary

Stress testing scripts have been created to identify the system's breaking point. Actual execution requires a deployed staging environment.

## Test Objectives

1. Identify the first slowdown point under increasing load
2. Identify the first timeout under increasing load
3. Identify the first error under increasing load
4. Determine maximum concurrent users the system can handle
5. Measure system recovery time after load removal

## Test Configuration

### Load Testing Tool

**Tool:** k6  
**Scripts Location:** `/tests/load/`

### Test Scenarios

All k6 scripts are configured with progressive load stages:

```javascript
stages: [
  { duration: '30s', target: 10 },   // Warm-up
  { duration: '1m', target: 50 },    // Ramp to 50
  { duration: '1m', target: 100 },   // Ramp to 100
  { duration: '1m', target: 250 },   // Ramp to 250
  { duration: '1m', target: 500 },   // Ramp to 500
  { duration: '1m', target: 1000 },  // Stress test
  { duration: '30s', target: 0 },    // Cool-down
]
```

### Endpoints to Stress Test

1. **Authentication**
   - POST /api/auth/login
   - POST /api/auth/register

2. **Menu (Public)**
   - GET /api/menu
   - GET /api/menu/:id
   - GET /api/menu/featured

3. **Cart**
   - POST /api/cart
   - GET /api/cart
   - PUT /api/cart/items/:id

4. **Checkout**
   - POST /api/orders/checkout

5. **Payment**
   - POST /api/payments/initialize
   - GET /api/payments/order/:orderId

6. **Orders**
   - GET /api/orders/my-orders
   - GET /api/orders/:id

7. **Admin**
   - GET /api/orders (all)
   - GET /api/menu (admin)
   - GET /api/payments

## Metrics to Monitor

### Application Metrics

- **Response Time:** Average, p(95), p(99)
- **Throughput:** Requests per second
- **Error Rate:** Percentage of failed requests
- **Timeout Rate:** Percentage of timed-out requests

### System Metrics

- **CPU Usage:** Percentage utilization
- **Memory Usage:** Heap size, RSS
- **Database Connections:** Active, idle, max
- **Database Query Time:** Average query duration
- **Network I/O:** Bytes sent/received

### Database Metrics

- **Connection Pool Usage:** Active/total connections
- **Query Performance:** Slow query log
- **Lock Contention:** Table/index locks
- **Disk I/O:** Read/write operations

## Stress Test Procedure

### Prerequisites

1. Deploy backend to staging environment
2. Configure environment variables:
   ```bash
   export BASE_URL=https://staging.crave.com
   export ADMIN_EMAIL=admin@crave.com
   export ADMIN_PASSWORD=***
   ```
3. Install monitoring tools (optional but recommended):
   - Node.js: `clinic`, `0x`
   - Database: PgAdmin monitoring
   - System: `htop`, `iotop`

### Execution Steps

1. **Baseline Test**
   ```bash
   k6 run tests/load/menu.js
   ```
   - Run with 10 users to establish baseline

2. **Progressive Load Test**
   - Edit each script to increase target users
   - Run sequentially: 50 → 100 → 250 → 500 → 1000
   - Monitor system metrics at each level

3. **Breaking Point Test**
   - Continue increasing load until:
     - Error rate exceeds 10%
     - Response time exceeds 5s
     - System becomes unresponsive

4. **Recovery Test**
   - After reaching breaking point, stop load
   - Monitor how long system takes to recover
   - Verify functionality returns to normal

## Expected Breaking Points (Estimated)

Based on optimizations implemented:

| Metric | Expected Limit | Notes |
|--------|---------------|-------|
| Concurrent Users | 500-1000 | Depends on database connection pool |
| Database Connections | 20-50 | Default Prisma pool size |
| Memory Usage | 512MB-1GB | Depends on cache size |
| CPU Usage | 80% | Single-core bottleneck possible |

## Mitigation Strategies

### If Breaking Point is Low (< 100 users)

1. **Increase Database Connection Pool**
   ```env
   DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=50
   ```

2. **Add Redis Caching**
   - Cache menu items, categories
   - Cache user sessions
   - Reduce database load

3. **Horizontal Scaling**
   - Deploy multiple instances behind load balancer
   - Use sticky sessions for authentication

4. **Database Optimization**
   - Add read replicas
   - Implement query result caching

### If Breaking Point is High (> 500 users)

1. **Monitor Resource Utilization**
   - Identify bottlenecks (CPU, memory, I/O)
   - Optimize slow queries
   - Add indexes as needed

2. **Implement Rate Limiting**
   - Per-user rate limits
   - Per-endpoint rate limits
   - Prevent abuse

3. **Queue Heavy Operations**
   - Background job processing
   - Message queue (RabbitMQ, Redis)
   - Async webhook handling

## Recovery Test Criteria

System is considered recovered when:
- Response times return to baseline (±20%)
- Error rate returns to <1%
- Database connections return to normal
- Memory usage stabilizes

## Documentation Requirements

After execution, document:

1. **First Slowdown**
   - User count
   - Endpoint affected
   - Response time increase

2. **First Timeout**
   - User count
   - Endpoint affected
   - Timeout duration

3. **First Error**
   - User count
   - Error type
   - Error frequency

4. **Maximum Concurrent Users**
   - Stable user count
   - Response times at max load
   - Error rate at max load

5. **Recovery Time**
   - Time to normal response times
   - Time to normal error rate
   - Any manual intervention required

## Conclusion

Stress testing scripts are ready for execution. The actual breaking point and recovery metrics will be determined once the backend is deployed to a staging environment and the tests are run.

**Status:** Ready for execution in staging environment.
