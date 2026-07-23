# CRAVE Backend Load Testing

This directory contains k6 load testing scripts for the CRAVE backend API.

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

## Running Tests

### Set environment variables

```bash
export BASE_URL=http://localhost:4000
export ADMIN_EMAIL=admin@crave.com
export ADMIN_PASSWORD=AdminPass123!
```

### Run individual tests

```bash
# Login test
k6 run login.js

# Menu test (public endpoints)
k6 run menu.js

# Checkout test
k6 run checkout.js

# Payment test
k6 run payment.js

# Orders test
k6 run orders.js

# Admin test
k6 run admin.js
```

### Run with different user loads

Edit the `stages` in each script to test different user levels:

- 10 users: `{ duration: '30s', target: 10 }`
- 50 users: `{ duration: '30s', target: 50 }`
- 100 users: `{ duration: '30s', target: 100 }`
- 250 users: `{ duration: '30s', target: 250 }`
- 500 users: `{ duration: '30s', target: 500 }`

### Run all tests

```bash
k6 run login.js menu.js checkout.js payment.js orders.js admin.js
```

## Metrics Measured

- Average response time
- 95th percentile response time
- 99th percentile response time
- Requests per second
- Failure rate
- Timeout rate

## Thresholds

Each test has thresholds defined:

- p(95) < 500ms for most endpoints
- p(99) < 1000ms for most endpoints
- Error rate < 5%

## Notes

- Tests create temporary users for authentication
- Admin test requires an existing admin user
- Payment test uses mock payment initialization (no real payment processed)
- Tests clean up after themselves in teardown functions
