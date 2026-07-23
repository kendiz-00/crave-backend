import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export function setup() {
  // Create a test user
  const email = `testuser${Math.floor(Math.random() * 100000)}@example.com`;
  const password = 'TestPass123!';
  
  const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password,
    name: 'Test User',
    phone: '+233200000000',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return { email, password };
}

export default function(data) {
  // Login test
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: data.email,
    password: data.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const success = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has access token': (r) => r.json('accessToken') !== undefined,
  });
  
  errorRate.add(!success);
  
  if (success) {
    const token = loginRes.json('accessToken');
    
    // Test protected endpoint
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    check(meRes, {
      'me status is 200': (r) => r.status === 200,
      'me has user data': (r) => r.json('id') !== undefined,
    });
  }
  
  sleep(1);
}

export function teardown(data) {
  // Cleanup could be added here
}
