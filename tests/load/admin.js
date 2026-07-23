import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 15 },
    { duration: '1m', target: 15 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<600', 'p(99)<1200'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export function setup() {
  // Login as admin (requires existing admin user)
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: __ENV.ADMIN_EMAIL || 'admin@crave.com',
    password: __ENV.ADMIN_PASSWORD || 'AdminPass123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return { token: loginRes.json('accessToken') };
}

export default function(data) {
  // Get all orders (admin endpoint)
  const allOrdersRes = http.get(`${BASE_URL}/api/orders?page=1&limit=20`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(allOrdersRes, {
    'all orders status is 200': (r) => r.status === 200,
    'all orders has pagination': (r) => r.json('total') !== undefined,
  }) || errorRate.add(1);
  
  // Get all menu items
  const menuRes = http.get(`${BASE_URL}/api/menu?page=1&limit=20`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(menuRes, {
    'admin menu status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // Get all categories
  const categoriesRes = http.get(`${BASE_URL}/api/categories`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(categoriesRes, {
    'admin categories status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // Get all payments
  const paymentsRes = http.get(`${BASE_URL}/api/payments?page=1&limit=20`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(paymentsRes, {
    'admin payments status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
}
