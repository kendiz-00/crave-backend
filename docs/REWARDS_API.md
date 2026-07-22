# Rewards API Documentation

## Overview

The Rewards API provides endpoints for managing reward points, reward codes, and reward transactions in the CRAVE platform. Users earn points from orders and can redeem them for discounts. All endpoints require authentication.

## Base URL

```
http://localhost:3000/api/rewards
```

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Endpoints

### 1. Get Reward Balance

**Endpoint:** `GET /api/rewards/balance`

**Description:** Retrieves the current user's reward point balance.

**Authorization:** Private (All authenticated users)

**Request Example:**

```
GET /api/rewards/balance
```

**Response (Success - 200):**

```json
{
  "success": true,
  "balance": {
    "userId": "user_id",
    "totalPoints": 500,
    "availablePoints": 250,
    "redeemedPoints": 250,
    "pendingPoints": 0
  }
}
```

**Response (No Rewards - 200):**

```json
{
  "success": true,
  "balance": {
    "userId": "user_id",
    "totalPoints": 0,
    "availablePoints": 0,
    "redeemedPoints": 0,
    "pendingPoints": 0
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only view their own balance)
- Automatic balance calculation from transactions

---

### 2. Get Reward History

**Endpoint:** `GET /api/rewards/history`

**Description:** Retrieves the current user's reward transaction history.

**Authorization:** Private (All authenticated users)

**Query Parameters:**

- `page`: Optional, number, default 1
- `limit`: Optional, number, default 20
- `type`: Optional, string (EARN, REDEEM)

**Request Example:**

```
GET /api/rewards/history?page=1&limit=20&type=EARN
```

**Response (Success - 200):**

```json
{
  "success": true,
  "transactions": [
    {
      "id": "transaction_id",
      "userId": "user_id",
      "orderId": "order_id",
      "type": "EARN",
      "points": 162,
      "description": "Order completed",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "transaction_id_2",
      "userId": "user_id",
      "orderId": null,
      "type": "REDEEM",
      "points": -10,
      "description": "Reward code redemption",
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only view their own history)
- Pagination support for large transaction histories

---

### 3. Validate Reward Code

**Endpoint:** `POST /api/rewards/validate`

**Description:** Validates a reward code for use during checkout. Checks if the code is valid, not expired, and belongs to the user.

**Authorization:** Private (All authenticated users)

**Request Body:**

```json
{
  "code": "CRV-2024-ABC123"
}
```

**Validation Rules:**

- `code`: Required, string, must be a valid reward code format

**Response (Success - 200):**

```json
{
  "success": true,
  "valid": true,
  "rewardCode": {
    "id": "reward_code_id",
    "code": "CRV-2024-ABC123",
    "userId": "user_id",
    "status": "GENERATED",
    "points": 10,
    "discountValue": 10.00,
    "expiresAt": "2024-12-31T23:59:59Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Response (Invalid - 200):**

```json
{
  "success": true,
  "valid": false,
  "reason": "Reward code has expired"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid code format
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Security Features:**

- Ownership validation (users can only validate their own codes)
- Expiration validation
- Status validation (must be GENERATED)
- Duplicate usage prevention

---

## Reward Transaction Types

| Type | Description | Points |
|------|-------------|--------|
| EARN | Points earned from orders | Positive (1 point per GHS spent) |
| REDEEM | Points redeemed for discount | Negative (points deducted) |

## Reward Code Status Values

| Status | Description |
|--------|-------------|
| GENERATED | Code is generated and ready to use |
| REDEEMED | Code has been used and is no longer valid |

## Reward Code Format

Reward codes follow the format: `CRV-YYYY-XXXXXX`

- `CRV`: Constant prefix
- `YYYY`: Year of generation
- `XXXXXX`: 6-character alphanumeric code

## Point Calculation

### Earning Points

Users earn points based on their order total:

```
Points Earned = floor(Grand Total)
```

- 1 point per GHS spent
- Points are rounded down to the nearest integer
- Points are awarded after successful order completion

### Redeeming Points

Users can redeem points for discounts:

```
Discount Value = Points Redeemed × Conversion Rate
```

- Current conversion rate: 1 point = GHS 1 discount
- Points are deducted at redemption time
- Redeemed points cannot be recovered

## Reward Code Lifecycle

1. **Generation**: Code is automatically generated after order completion
2. **Available**: Code is in GENERATED status and can be used
3. **Redemption**: Code is used during checkout, status changes to REDEEMED
4. **Expired**: Code expires after the expiration date (typically 1 year)

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
2. **Ownership Validation**: Users can only access their own rewards
3. **Code Validation**: Comprehensive validation of reward codes
4. **Expiration Checks**: Automatic expiration of old codes
5. **Duplicate Prevention**: Codes can only be used once
6. **Transaction Integrity**: All transactions logged and auditable
7. **Rate Limiting**: API endpoints protected by rate limiting

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Rate limit headers included in responses:
  - `ratelimit-limit`: Total limit
  - `ratelimit-remaining`: Remaining requests
  - `ratelimit-reset`: Reset time (seconds)

## Best Practices

1. **Validate codes before checkout**: Use the validate endpoint before applying codes
2. **Handle expiration gracefully**: Check expiration dates before displaying codes
3. **Track point changes**: Monitor transaction history for point changes
4. **Display available balance**: Always show available points to users
5. **Handle invalid codes**: Provide clear error messages for invalid codes
6. **Cache reward codes**: Cache valid codes to reduce API calls

## Common Workflows

### Getting User's Reward Status

1. Call `GET /api/rewards/balance` to get current balance
2. Display available points to user
3. Call `GET /api/rewards/history` to transaction history
4. Show recent transactions to user

### Using Reward Code During Checkout

1. Call `POST /api/rewards/validate` with the code
2. Check if code is valid and belongs to user
3. Apply discount if valid
4. Include code in checkout request
5. Code is automatically marked as REDEEMED

### Tracking Point Changes

1. Call `GET /api/rewards/history` with pagination
2. Filter by type (EARN or REDEEM)
3. Display transaction history to user
4. Calculate net points from transactions

## Reward Code Validation Rules

The following validations are performed when validating or using a reward code:

1. **Existence**: Code must exist in the database
2. **Status**: Code must be in GENERATED status
3. **Ownership**: Code must belong to the current user
4. **Expiration**: Code must not be expired
5. **Uniqueness**: Code must not have been used before (orderId must be null)

## Transaction Integrity

All reward transactions are created within database transactions to ensure:

- Points are never lost or duplicated
- Balance calculations are always accurate
- Audit trail is maintained for all transactions
- Rollback capability for failed operations

## Integration with Orders

Reward codes are integrated with the order system:

1. **Order Completion**: Generates new reward code
2. **Checkout**: Accepts reward code for discount
3. **Transaction**: Creates reward transaction for points earned
4. **Redemption**: Marks code as REDEEMED and creates redemption transaction

## Future Enhancements

Potential future features for the rewards system:

- Tiered reward levels (Bronze, Silver, Gold)
- Point expiration policies
- Bonus points for special promotions
- Referral point bonuses
- Point gifting between users
- Reward code sharing restrictions
- Advanced analytics and reporting
