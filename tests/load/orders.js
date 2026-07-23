import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export function setup() {
  // Create a test user and login
  const email = `ordersuser${Math.floor(Math.random() * 100000)}@example.com`;
  const password = 'TestPass123!';
  
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password,
    name: 'Orders User',
    phone: '+233200000000',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email,
    password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return { token: loginRes.json('accessToken'), userId: loginRes.json('user.id') };
}

export default function(data) {
  // Get my orders
  const myOrdersRes = http.get(`${BASE_URL}/api/orders/my-orders?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(myOrdersRes, {
    'my orders status is 200': (r) => r.status === 200,
    'my orders has pagination': (r) => r.json('total') !== undefined,
  }) || errorRate.add(1);
  
  // Get reward balance
  const balanceRes = http.get(`${BASE_URL}/api/rewards/balance`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(balanceRes, {
    'reward balance status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // Get reward history
  const historyRes = http.get(`${BASE_URL}/api/rewards/history?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  });
  
  check(historyRes, {
    'reward history status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // If user has orders, get order details
  if (myOrdersRes.status === 200 && myOrdersRes.json('data') && myOrdersRes.json('data').length > 0) {
    const orderId = myOrdersRes.json('data')[0].id;
    const orderRes = http.get(`${BASE_URL}/api/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${data.token}`,
      },
    });
    
    check(orderRes, {
      'order detail status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  sleep(1);
}
