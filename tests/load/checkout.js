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
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export function setup() {
  // Create a test user and login
  const email = `checkoutuser${Math.floor(Math.random() * 100000)}@example.com`;
  const password = 'TestPass123!';
  
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password,
    name: 'Checkout User',
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
  // Get menu items first
  const menuRes = http.get(`${BASE_URL}/api/menu`, {
    headers: { 'Accept': 'application/json' },
  });
  
  if (menuRes.status === 200 && menuRes.json('data') && menuRes.json('data').length > 0) {
    const menuItem = menuRes.json('data')[0];
    
    // Create cart
    const cartRes = http.post(`${BASE_URL}/api/cart`, JSON.stringify({
      items: [{
        menuItemId: menuItem.id,
        quantity: 2,
        addOns: [],
      }],
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
    });
    
    check(cartRes, {
      'cart status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'cart has data': (r) => r.json('data') !== undefined,
    }) || errorRate.add(1);
    
    if (cartRes.status === 200 || cartRes.status === 201) {
      // Checkout
      const checkoutRes = http.post(`${BASE_URL}/api/orders/checkout`, JSON.stringify({
        customerName: 'Test Customer',
        customerPhone: '+233200000000',
        deliveryAddress: 'Test Address',
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
        },
      });
      
      check(checkoutRes, {
        'checkout status is 200 or 201': (r) => r.status === 200 || r.status === 201,
        'checkout has order': (r) => r.json('data') !== undefined,
      }) || errorRate.add(1);
    }
  }
  
  sleep(2);
}
