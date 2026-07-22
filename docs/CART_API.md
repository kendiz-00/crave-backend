# Cart API Documentation

## Overview

The Cart API provides endpoints for managing shopping carts in the CRAVE platform. Users can add items to their cart, update quantities, remove items, and clear their cart. All endpoints require authentication.

## Base URL

```
http://localhost:3000/api/cart
```

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Endpoints

### 1. Create or Update Cart

**Endpoint:** `POST /api/cart`

**Description:** Creates a new cart or updates an existing cart with items. If a cart already exists for the user, it will be updated with the provided items.

**Authorization:** Private (All authenticated users)

**Request Body:**

```json
{
  "items": [
    {
      "menuItemId": "menu_item_id",
      "quantity": 2,
      "addOns": [
        {
          "addOnId": "addon_id",
          "name": "Extra Cheese",
          "price": 5.00
        }
      ]
    }
  ]
}
```

**Validation Rules:**

- `items`: Required, array of cart items
- `items[].menuItemId`: Required, string, must be valid menu item ID
- `items[].quantity`: Required, number, must be greater than 0
- `items[].addOns`: Optional, array of add-ons
- `items[].addOns[].addOnId`: Required, string, must be valid add-on ID
- `items[].addOns[].name`: Required, string
- `items[].addOns[].price`: Required, number, must be greater than or equal to 0

**Response (Success - 200):**

```json
{
  "success": true,
  "cart": {
    "id": "cart_id",
    "userId": "user_id",
    "status": "ACTIVE",
    "items": [
      {
        "id": "cart_item_id",
        "menuItemId": "menu_item_id",
        "quantity": 2,
        "totalPrice": 216.98,
        "menuItem": {
          "id": "menu_item_id",
          "name": "Loaded Fries",
          "price": 105.99,
          "imageUrl": "loaded_fries_01.jpg",
          "sku": "LOADED-FRIES-001",
          "isAvailable": true
        },
        "addOns": [
          {
            "id": "cart_item_addon_id",
            "name": "Extra Cheese",
            "price": 5.00
          }
        ]
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "summary": {
    "totalItems": 2,
    "subtotal": 216.98,
    "tax": 10.85,
    "deliveryFee": 15.00,
    "estimatedTotal": 242.83
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid data, validation errors
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Menu item or add-on not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Menu item availability validation
- Add-on existence validation
- Quantity validation (must be positive)
- Automatic price calculation from database

---

### 2. Get Active Cart

**Endpoint:** `GET /api/cart`

**Description:** Retrieves the user's active cart. If no cart exists, an empty cart is returned.

**Authorization:** Private (All authenticated users)

**Request Example:**

```
GET /api/cart
```

**Response (Success - 200):**

```json
{
  "success": true,
  "cart": {
    "id": "cart_id",
    "userId": "user_id",
    "status": "ACTIVE",
    "items": [
      {
        "id": "cart_item_id",
        "menuItemId": "menu_item_id",
        "quantity": 2,
        "totalPrice": 216.98,
        "menuItem": {
          "id": "menu_item_id",
          "name": "Loaded Fries",
          "price": 105.99,
          "imageUrl": "loaded_fries_01.jpg",
          "sku": "LOADED-FRIES-001",
          "isAvailable": true
        },
        "addOns": [
          {
            "id": "cart_item_addon_id",
            "name": "Extra Cheese",
            "price": 5.00
          }
        ]
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "summary": {
    "totalItems": 2,
    "subtotal": 216.98,
    "tax": 10.85,
    "deliveryFee": 15.00,
    "estimatedTotal": 242.83
  }
}
```

**Response (Empty Cart - 200):**

```json
{
  "success": true,
  "cart": {
    "id": "cart_id",
    "userId": "user_id",
    "status": "ACTIVE",
    "items": [],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "summary": {
    "totalItems": 0,
    "subtotal": 0,
    "tax": 0,
    "deliveryFee": 0,
    "estimatedTotal": 0
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only access their own cart)
- Automatic cart creation if none exists

---

### 3. Update Cart Item

**Endpoint:** `PATCH /api/cart/items/:id`

**Description:** Updates the quantity and add-ons of a specific cart item.

**Authorization:** Private (All authenticated users)

**URL Parameters:**

- `id`: Required, string, cart item ID

**Request Body:**

```json
{
  "quantity": 3,
  "addOns": [
    {
      "addOnId": "addon_id",
      "name": "Extra Cheese",
      "price": 5.00
    },
    {
      "addOnId": "addon_id_2",
      "name": "Bacon",
      "price": 8.00
    }
  ]
}
```

**Validation Rules:**

- `quantity`: Required, number, must be greater than 0
- `addOns`: Optional, array of add-ons
- `addOns[].addOnId`: Required, string, must be valid add-on ID
- `addOns[].name`: Required, string
- `addOns[].price`: Required, number, must be greater than or equal to 0

**Response (Success - 200):**

```json
{
  "success": true,
  "cartItem": {
    "id": "cart_item_id",
    "menuItemId": "menu_item_id",
    "quantity": 3,
    "totalPrice": 357.97,
    "menuItem": {
      "id": "menu_item_id",
      "name": "Loaded Fries",
      "price": 105.99,
      "imageUrl": "loaded_fries_01.jpg",
      "sku": "LOADED-FRIES-001",
      "isAvailable": true
    },
    "addOns": [
      {
        "id": "cart_item_addon_id",
        "name": "Extra Cheese",
        "price": 5.00
      },
      {
        "id": "cart_item_addon_id_2",
        "name": "Bacon",
        "price": 8.00
      }
    ]
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid data, validation errors
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Access denied (not your cart)
- `404 Not Found`: Cart item not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only update their own cart items)
- Add-on existence validation
- Quantity validation
- Backend price recalculation

---

### 4. Delete Cart Item

**Endpoint:** `DELETE /api/cart/items/:id`

**Description:** Removes a specific item from the cart.

**Authorization:** Private (All authenticated users)

**URL Parameters:**

- `id`: Required, string, cart item ID

**Request Example:**

```
DELETE /api/cart/items/cart_item_id
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Cart item removed successfully"
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Access denied (not your cart)
- `404 Not Found`: Cart item not found
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only delete their own cart items)

---

### 5. Clear Cart

**Endpoint:** `DELETE /api/cart`

**Description:** Removes all items from the user's active cart. The cart itself is not deleted, only its items.

**Authorization:** Private (All authenticated users)

**Request Example:**

```
DELETE /api/cart
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Cart cleared successfully"
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only clear their own cart)
- Cart status remains ACTIVE (items are removed, not the cart)

---

## Cart Status Values

| Status | Description |
|--------|-------------|
| ACTIVE | Cart is active and can be modified |
| CHECKED_OUT | Cart has been checked out and converted to an order |

## Price Calculation

The API automatically calculates prices based on the following formula:

```
Item Total = (Menu Item Price + Sum of Add-on Prices) × Quantity
Cart Subtotal = Sum of all Item Totals
Tax = Cart Subtotal × 0.05 (5%)
Delivery Fee = 15.00 (for DELIVERY orders) or 0 (for PICKUP orders)
Estimated Total = Cart Subtotal + Tax + Delivery Fee
```

**Important:** All prices are calculated on the server side using current database values. Never trust prices sent from the frontend.

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions or ownership violation |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

## Security Features

1. **Authentication**: All endpoints require valid JWT token
2. **Ownership Validation**: Users can only access and modify their own cart
3. **Input Validation**: All inputs validated using Zod schemas
4. **Price Tampering Prevention**: Backend recalculation of all monetary values
5. **Item Availability**: Only available menu items can be added to cart
6. **Add-on Validation**: Only valid add-ons can be attached to items
7. **Quantity Validation**: Quantities must be positive numbers
8. **Rate Limiting**: API endpoints protected by rate limiting

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Rate limit headers included in responses:
  - `ratelimit-limit`: Total limit
  - `ratelimit-remaining`: Remaining requests
  - `ratelimit-reset`: Reset time (seconds)

## Best Practices

1. **Always fetch the cart before checkout**: Ensure you have the latest cart state
2. **Handle empty carts**: The API returns empty carts with zero totals
3. **Validate menu item availability**: Check `menuItem.isAvailable` before allowing checkout
4. **Use estimated totals for display**: The `estimatedTotal` includes tax and delivery fee
5. **Clear cart after successful checkout**: The cart status changes to CHECKED_OUT after checkout
6. **Handle ownership errors**: 403 errors indicate the user is trying to access another user's cart

## Common Workflows

### Adding Items to Cart

1. Call `POST /api/cart` with the items array
2. The API creates or updates the cart
3. Use the returned cart summary for display

### Updating Cart

1. Call `GET /api/cart` to get current cart state
2. Call `PATCH /api/cart/items/:id` to update specific items
3. Call `DELETE /api/cart/items/:id` to remove items
4. Call `GET /api/cart` again to get updated totals

### Checkout Flow

1. Call `GET /api/cart` to verify cart contents
2. Call `POST /api/orders/checkout` with order details
3. The cart status changes to CHECKED_OUT
4. A new order is created from the cart

### Clearing Cart

1. Call `DELETE /api/cart` to remove all items
2. The cart remains ACTIVE but empty
3. User can add new items to the empty cart
