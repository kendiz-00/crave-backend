import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function() {
  // Test public menu endpoints (no auth required)
  
  // Get all menu items
  const menuRes = http.get(`${BASE_URL}/api/menu`, {
    headers: { 'Accept': 'application/json' },
  });
  
  check(menuRes, {
    'menu status is 200': (r) => r.status === 200,
    'menu has data': (r) => r.json('data') !== undefined,
  }) || errorRate.add(1);
  
  // Get featured menu items
  const featuredRes = http.get(`${BASE_URL}/api/menu/featured?limit=10`, {
    headers: { 'Accept': 'application/json' },
  });
  
  check(featuredRes, {
    'featured status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // Get menu item by ID (using a known ID or first from list)
  if (menuRes.json('data') && menuRes.json('data').length > 0) {
    const itemId = menuRes.json('data')[0].id;
    const itemRes = http.get(`${BASE_URL}/api/menu/${itemId}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    check(itemRes, {
      'item status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // Search menu items
  const searchRes = http.get(`${BASE_URL}/api/menu/search?q=rice`, {
    headers: { 'Accept': 'application/json' },
  });
  
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
}
