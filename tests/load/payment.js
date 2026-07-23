import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export function setup() {
  // Create a test user, login, create cart, checkout to get an order
  const email = `paymentuser${Math.floor(Math.random() * 100000)}@example.com`;
  const password = 'TestPass123!';
  
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    password,
    name: 'Payment User',
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
  
  const token = loginRes.json('accessToken');
  
  // Get menu and create cart
  const menuRes = http.get(`${BASE_URL}/api/menu`, {
    headers: { 'Accept': 'application/json' },
  });
  
  if (menuRes.status === 200 && menuRes.json('data') && menuRes.json('data').length > 0) {
    const menuItem = menuRes.json('data')[0];
    
    http.post(`${BASE_URL}/api/cart`, JSON.stringify({
      items: [{
        menuItemId: menuItem.id,
        quantity: 1,
        addOns: [],
      }],
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    // Checkout
    const checkoutRes = http.post(`${BASE_URL}/api/orders/checkout`, JSON.stringify({
      customerName: 'Payment Test',
      customerPhone: '+233200000000',
      deliveryAddress: 'Test Address',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return { token, orderId: checkoutRes.json('data.id') };
  }
  
  return { token, orderId: null };
}

export default function(data) {
  if (data.orderId) {
    // Initialize payment
    const initRes = http.post(`${BASE_URL}/api/payments/initialize`, JSON.stringify({
      orderId: data.orderId,
      email: 'test@example.com',
      amount: 50,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
    });
    
    check(initRes, {
      'payment init status is 200': (r) => r.status === 200,
      'payment init has reference': (r) => r.json('reference') !== undefined,
    }) || errorRate.add(1);
    
    // Get payment by order
    const paymentRes = http.get(`${BASE_URL}/api/payments/order/${data.orderId}`, {
      headers: {
        'Authorization': `Bearer ${data.token}`,
      },
    });
    
    check(paymentRes, {
      'payment by order status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  sleep(3);
}
