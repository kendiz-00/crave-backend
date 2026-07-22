# Order API Documentation

## Overview

The Order API provides endpoints for creating, managing, and tracking orders in the CRAVE platform. All endpoints require authentication.

## Base URL

```
http://localhost:3000/api/orders
```

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Endpoints

### 1. Create Order from Cart (Checkout)

**Endpoint:** `POST /api/orders/checkout`

**Description:** Creates a new order from the user's active cart. This validates all items, calculates totals on the server side, and processes the order in a transaction.

**Authorization:** Private (All authenticated users)

**Request Body:**

```json
{
  "orderType": "DELIVERY" | "PICKUP",
  "customerName": "John Doe",
  "customerPhone": "+233201234567",
  "customerEmail": "john@example.com",
  "deliveryAddress": "123 Main St, Accra",
  "latitude": 5.6037,
  "longitude": -0.1870,
  "notes": "Extra napkins please",
  "rewardCodeUsed": "CRV-2024-ABC123"
}
```

**Validation Rules:**

- `orderType`: Required, must be "DELIVERY" or "PICKUP"
- `customerName`: Required, string, max 100 characters
- `customerPhone`: Required, string, valid phone format
- `customerEmail`: Required, string, valid email format
- `deliveryAddress`: Required for DELIVERY orders
- `latitude`: Optional, number, required for DELIVERY
- `longitude`: Optional, number, required for DELIVERY
- `notes`: Optional, string, max 500 characters
- `rewardCodeUsed`: Optional, string, must be valid and belong to user

**Response (Success - 200):**

```json
{
  "success": true,
  "order": {
    "id": "order_id",
    "orderNumber": "CRV-2024-12345",
    "userId": "user_id",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "orderType": "DELIVERY",
    "subtotal": 150.00,
    "discount": 10.00,
    "tax": 7.50,
    "deliveryFee": 15.00,
    "grandTotal": 162.50,
    "rewardCodeUsed": "CRV-2024-ABC123",
    "rewardCodeGenerated": "CRV-2024-XYZ789",
    "rewardPointsEarned": 162,
    "customerName": "John Doe",
    "customerPhone": "+233201234567",
    "customerEmail": "john@example.com",
    "deliveryAddress": "123 Main St, Accra",
    "latitude": 5.6037,
    "longitude": -0.1870,
    "notes": "Extra napkins please",
    "items": [
      {
        "id": "item_id",
        "menuItemId": "menu_item_id",
        "quantity": 2,
        "snapshotName": "Loaded Fries",
        "snapshotPrice": 105.99,
        "snapshotImage": "loaded_fries_01.jpg",
        "snapshotSku": "LOADED-FRIES-001",
        "subtotal": 211.98,
        "addOns": [
          {
            "id": "addon_id",
            "name": "Extra Cheese",
            "snapshotPrice": 5.00
          }
        ]
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Cart is empty, invalid data, validation errors
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Invalid reward code ownership
- `404 Not Found`: Cart not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Backend price recalculation (prevents price tampering)
- Item availability validation
- Reward code validation (expired, duplicate, redeemed, ownership)
- Transactional order creation (all-or-nothing)

---

### 2. Create Order (Alias)

**Endpoint:** `POST /api/orders`

**Description:** Alias for checkout endpoint. Same behavior as POST /api/orders/checkout.

**Authorization:** Private (All authenticated users)

**Request/Response:** Same as checkout endpoint

---

### 3. Get All Orders

**Endpoint:** `GET /api/orders`

**Description:** Retrieves all orders. Only accessible by admin and staff users.

**Authorization:** Private (Admin/Staff only)

**Query Parameters:**

- `page`: Optional, number, default 1
- `limit`: Optional, number, default 20
- `status`: Optional, string (PENDING, PREPARING, READY, DELIVERED, CANCELLED)

**Request Example:**

```
GET /api/orders?page=1&limit=20&status=PENDING
```

**Response (Success - 200):**

```json
{
  "success": true,
  "orders": [
    {
      "id": "order_id",
      "orderNumber": "CRV-2024-12345",
      "userId": "user_id",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "orderType": "DELIVERY",
      "subtotal": 150.00,
      "discount": 10.00,
      "tax": 7.50,
      "deliveryFee": 15.00,
      "grandTotal": 162.50,
      "customerName": "John Doe",
      "customerPhone": "+233201234567",
      "items": [],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Not admin or staff
- `500 Internal Server Error`: Server error

---

### 4. Get My Orders

**Endpoint:** `GET /api/orders/my-orders`

**Description:** Retrieves the current user's orders only.

**Authorization:** Private (All authenticated users)

**Query Parameters:**

- `page`: Optional, number, default 1
- `limit`: Optional, number, default 20
- `status`: Optional, string (PENDING, PREPARING, READY, DELIVERED, CANCELLED)

**Request Example:**

```
GET /api/orders/my-orders?page=1&limit=10
```

**Response (Success - 200):**

```json
{
  "success": true,
  "orders": [
    {
      "id": "order_id",
      "orderNumber": "CRV-2024-12345",
      "userId": "user_id",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "orderType": "DELIVERY",
      "grandTotal": 162.50,
      "items": [],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

---

### 5. Get Order by ID

**Endpoint:** `GET /api/orders/:id`

**Description:** Retrieves a specific order by ID. Customers can only access their own orders.

**Authorization:** Private (All authenticated users)

**URL Parameters:**

- `id`: Required, string, order ID

**Request Example:**

```
GET /api/orders/order_id
```

**Response (Success - 200):**

```json
{
  "success": true,
  "order": {
    "id": "order_id",
    "orderNumber": "CRV-2024-12345",
    "userId": "user_id",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "orderType": "DELIVERY",
    "subtotal": 150.00,
    "discount": 10.00,
    "tax": 7.50,
    "deliveryFee": 15.00,
    "grandTotal": 162.50,
    "rewardCodeUsed": "CRV-2024-ABC123",
    "rewardCodeGenerated": "CRV-2024-XYZ789",
    "rewardPointsEarned": 162,
    "customerName": "John Doe",
    "customerPhone": "+233201234567",
    "customerEmail": "john@example.com",
    "deliveryAddress": "123 Main St, Accra",
    "latitude": 5.6037,
    "longitude": -0.1870,
    "notes": "Extra napkins please",
    "items": [
      {
        "id": "item_id",
        "menuItemId": "menu_item_id",
        "quantity": 2,
        "snapshotName": "Loaded Fries",
        "snapshotPrice": 105.99,
        "snapshotImage": "loaded_fries_01.jpg",
        "snapshotSku": "LOADED-FRIES-001",
        "subtotal": 211.98,
        "addOns": []
      }
    ],
    "user": {
      "id": "user_id",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+233201234567"
    },
    "rewardCode": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Access denied (not your order)
- `404 Not Found`: Order not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (customers can only see their own orders)
- Admin and staff can access any order

---

### 6. Update Order Status

**Endpoint:** `PATCH /api/orders/:id/status`

**Description:** Updates the status of an order. Only accessible by admin and staff.

**Authorization:** Private (Admin/Staff only)

**URL Parameters:**

- `id`: Required, string, order ID

**Request Body:**

```json
{
  "status": "PREPARING"
}
```

**Validation Rules:**

- `status`: Required, must be one of: PENDING, PREPARING, READY, DELIVERED, CANCELLED

**Response (Success - 200):**

```json
{
  "success": true,
  "order": {
    "id": "order_id",
    "status": "PREPARING",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid status value
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Not admin or staff
- `404 Not Found`: Order not found
- `500 Internal Server Error`: Server error

---

### 7. Update Payment Status

**Endpoint:** `PATCH /api/orders/:id/payment`

**Description:** Updates the payment status of an order. Only accessible by admin and staff.

**Authorization:** Private (Admin/Staff only)

**URL Parameters:**

- `id`: Required, string, order ID

**Request Body:**

```json
{
  "paymentStatus": "PAID"
}
```

**Validation Rules:**

- `paymentStatus`: Required, must be one of: PENDING, PAID, FAILED, REFUNDED

**Response (Success - 200):**

```json
{
  "success": true,
  "order": {
    "id": "order_id",
    "paymentStatus": "PAID",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid payment status value
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Not admin or staff
- `404 Not Found`: Order not found
- `500 Internal Server Error`: Server error

---

### 8. Delete Order (Cancel)

**Endpoint:** `DELETE /api/orders/:id`

**Description:** Cancels or deletes an order. Customers can only cancel their own pending orders. Admin and staff can cancel any order.

**Authorization:** Private (All authenticated users)

**URL Parameters:**

- `id`: Required, string, order ID

**Request Example:**

```
DELETE /api/orders/order_id
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Order cancelled successfully"
}
```

**Error Responses:**

- `400 Bad Request`: Order cannot be cancelled (not pending)
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Access denied (not your order)
- `404 Not Found`: Order not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation
- Status validation (only pending orders can be cancelled)
- Admin and staff can cancel any order

---

## Order Status Values

| Status | Description |
|--------|-------------|
| PENDING | Order received, awaiting processing |
| PREPARING | Order is being prepared |
| READY | Order ready for pickup/delivery |
| DELIVERED | Order completed |
| CANCELLED | Order cancelled by customer or staff |

## Payment Status Values

| Status | Description |
|--------|-------------|
| PENDING | Payment not yet processed |
| PAID | Payment successful |
| FAILED | Payment failed |
| REFUNDED | Payment refunded |

## Order Type Values

| Type | Description |
|------|-------------|
| DELIVERY | Order will be delivered |
| PICKUP | Order will be picked up |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

## Security Features

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Role-based access control (Customer, Staff, Admin, Owner)
3. **Ownership Validation**: Customers can only access their own orders
4. **Input Validation**: All inputs validated using Zod schemas
5. **Price Tampering Prevention**: Backend recalculation of all monetary values
6. **Transaction Safety**: Order creation wrapped in database transactions
7. **Rate Limiting**: API endpoints protected by rate limiting

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Rate limit headers included in responses:
  - `ratelimit-limit`: Total limit
  - `ratelimit-remaining`: Remaining requests
  - `ratelimit-reset`: Reset time (seconds)
