# Menu Management API Documentation

## Overview

The Menu Management API provides endpoints for managing menu items, categories, add-ons, and images. This API supports filtering, searching, pagination, and sorting for menu items.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints are public (GET requests). Admin/Owner endpoints require authentication using JWT tokens.

### Authentication Header

```
Authorization: Bearer <access_token>
```

## Categories

### Get All Categories

**Endpoint:** `GET /api/categories`

**Description:** Retrieve all active categories with menu item counts.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Main Course",
      "slug": "main-course",
      "imageUrl": "https://example.com/main.jpg",
      "sortOrder": 0,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "_count": {
        "menuItems": 5
      }
    }
  ]
}
```

### Get Category by ID

**Endpoint:** `GET /api/categories/:id`

**Description:** Retrieve a specific category by ID with its menu items.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Main Course",
    "slug": "main-course",
    "imageUrl": "https://example.com/main.jpg",
    "sortOrder": 0,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "menuItems": [
      {
        "id": "uuid",
        "name": "Burger",
        "slug": "burger",
        "description": "Delicious burger",
        "price": 9.99,
        "imageUrl": "https://example.com/burger.jpg",
        "preparationTime": 15,
        "calories": 500,
        "categoryId": "uuid",
        "isAvailable": true,
        "isFeatured": false,
        "isDeleted": false,
        "sortOrder": 0,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "addOns": [],
        "images": []
      }
    ]
  }
}
```

### Get Category by Slug

**Endpoint:** `GET /api/categories/slug/:slug`

**Description:** Retrieve a specific category by slug with its menu items.

**Response:** Same as Get Category by ID.

### Create Category (Admin/Owner Only)

**Endpoint:** `POST /api/categories`

**Authentication:** Required (Admin/Owner)

**Request Body:**

```json
{
  "name": "Appetizers",
  "slug": "appetizers",
  "imageUrl": "https://example.com/appetizers.jpg",
  "sortOrder": 1,
  "isActive": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": "uuid",
    "name": "Appetizers",
    "slug": "appetizers",
    "imageUrl": "https://example.com/appetizers.jpg",
    "sortOrder": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Category (Admin/Owner Only)

**Endpoint:** `PUT /api/categories/:id`

**Authentication:** Required (Admin/Owner)

**Request Body:**

```json
{
  "name": "Appetizers",
  "slug": "appetizers",
  "imageUrl": "https://example.com/appetizers-updated.jpg",
  "sortOrder": 2,
  "isActive": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": "uuid",
    "name": "Appetizers",
    "slug": "appetizers",
    "imageUrl": "https://example.com/appetizers-updated.jpg",
    "sortOrder": 2,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Delete Category (Admin/Owner Only)

**Endpoint:** `DELETE /api/categories/:id`

**Authentication:** Required (Admin/Owner)

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Category deleted successfully"
  }
}
```

## Menu Items

### Get All Menu Items

**Endpoint:** `GET /api/menu`

**Description:** Retrieve menu items with filtering, pagination, and sorting.

**Query Parameters:**

- `category` (string, optional): Filter by category slug
- `featured` (string, optional): Filter featured items (`true`/`false`)
- `available` (string, optional): Filter available items (`true`/`false`)
- `search` (string, optional): Search by name or description
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `sort` (string, optional): Sort order (`newest`, `price-asc`, `price-desc`, `name-asc`, `name-desc`)

**Example Request:**

```
GET /api/menu?category=main-course&featured=true&page=1&limit=10&sort=price-asc
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Burger",
      "slug": "burger",
      "description": "Delicious burger",
      "price": 9.99,
      "imageUrl": "https://example.com/burger.jpg",
      "preparationTime": 15,
      "calories": 500,
      "categoryId": "uuid",
      "isAvailable": true,
      "isFeatured": true,
      "isDeleted": false,
      "sortOrder": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "category": {
        "id": "uuid",
        "name": "Main Course",
        "slug": "main-course"
      },
      "addOns": [
        {
          "id": "uuid",
          "name": "Cheese",
          "price": 1.50,
          "isRequired": false,
          "maxSelections": 3
        }
      ],
      "images": [
        {
          "id": "uuid",
          "imageUrl": "https://example.com/burger-2.jpg",
          "sortOrder": 1
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### Get Menu Item by ID

**Endpoint:** `GET /api/menu/:id`

**Description:** Retrieve a specific menu item by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Burger",
    "slug": "burger",
    "description": "Delicious burger",
    "price": 9.99,
    "imageUrl": "https://example.com/burger.jpg",
    "preparationTime": 15,
    "calories": 500,
    "categoryId": "uuid",
    "isAvailable": true,
    "isFeatured": false,
    "isDeleted": false,
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "category": {
      "id": "uuid",
      "name": "Main Course",
      "slug": "main-course"
    },
    "addOns": [],
    "images": []
  }
}
```

### Get Menu Item by Slug

**Endpoint:** `GET /api/menu/slug/:slug`

**Description:** Retrieve a specific menu item by slug.

**Response:** Same as Get Menu Item by ID.

### Get Featured Menu Items

**Endpoint:** `GET /api/menu/featured`

**Description:** Retrieve featured menu items.

**Query Parameters:**

- `limit` (number, optional): Maximum number of items (default: 10)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Featured Burger",
      "slug": "featured-burger",
      "description": "Delicious featured burger",
      "price": 12.99,
      "imageUrl": "https://example.com/featured.jpg",
      "preparationTime": 20,
      "categoryId": "uuid",
      "isAvailable": true,
      "isFeatured": true,
      "isDeleted": false,
      "category": {
        "id": "uuid",
        "name": "Main Course",
        "slug": "main-course"
      },
      "addOns": [],
      "images": []
    }
  ]
}
```

### Get Menu Items by Category

**Endpoint:** `GET /api/menu/category/:slug`

**Description:** Retrieve menu items for a specific category.

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Burger",
      "slug": "burger",
      "description": "Delicious burger",
      "price": 9.99,
      "imageUrl": "https://example.com/burger.jpg",
      "preparationTime": 15,
      "categoryId": "uuid",
      "isAvailable": true,
      "isFeatured": false,
      "isDeleted": false,
      "category": {
        "id": "uuid",
        "name": "Main Course",
        "slug": "main-course"
      },
      "addOns": [],
      "images": []
    }
  ],
  "category": {
    "id": "uuid",
    "name": "Main Course",
    "slug": "main-course"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Search Menu Items

**Endpoint:** `GET /api/menu/search`

**Description:** Search menu items by name or description.

**Query Parameters:**

- `q` (string, required): Search query
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `sort` (string, optional): Sort order

**Example Request:**

```
GET /api/menu/search?q=chicken&page=1&limit=10
```

**Response:** Same as Get All Menu Items.

### Create Menu Item (Admin/Owner Only)

**Endpoint:** `POST /api/menu`

**Authentication:** Required (Admin/Owner)

**Request Body:**

```json
{
  "name": "Chicken Burger",
  "slug": "chicken-burger",
  "description": "Tasty chicken burger with fresh vegetables",
  "price": 10.99,
  "imageUrl": "https://example.com/chicken-burger.jpg",
  "preparationTime": 15,
  "calories": 450,
  "categoryId": "uuid",
  "isAvailable": true,
  "isFeatured": false,
  "sortOrder": 0,
  "addOns": [
    {
      "name": "Cheese",
      "price": 1.50,
      "isRequired": false,
      "maxSelections": 3
    },
    {
      "name": "Bacon",
      "price": 2.00,
      "isRequired": false,
      "maxSelections": 1
    }
  ],
  "images": [
    {
      "imageUrl": "https://example.com/chicken-burger-2.jpg",
      "sortOrder": 1
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Menu item created successfully",
  "data": {
    "id": "uuid",
    "name": "Chicken Burger",
    "slug": "chicken-burger",
    "description": "Tasty chicken burger with fresh vegetables",
    "price": 10.99,
    "imageUrl": "https://example.com/chicken-burger.jpg",
    "preparationTime": 15,
    "calories": 450,
    "categoryId": "uuid",
    "isAvailable": true,
    "isFeatured": false,
    "isDeleted": false,
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "category": {
      "id": "uuid",
      "name": "Main Course",
      "slug": "main-course"
    },
    "addOns": [
      {
        "id": "uuid",
        "name": "Cheese",
        "price": 1.50,
        "isRequired": false,
        "maxSelections": 3,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "uuid",
        "name": "Bacon",
        "price": 2.00,
        "isRequired": false,
        "maxSelections": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "images": [
      {
        "id": "uuid",
        "imageUrl": "https://example.com/chicken-burger-2.jpg",
        "sortOrder": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### Update Menu Item (Admin/Owner Only)

**Endpoint:** `PUT /api/menu/:id`

**Authentication:** Required (Admin/Owner)

**Request Body:** Same as Create Menu Item (all fields optional except id).

**Response:**

```json
{
  "success": true,
  "message": "Menu item updated successfully",
  "data": {
    "id": "uuid",
    "name": "Chicken Burger",
    "slug": "chicken-burger",
    "description": "Tasty chicken burger with fresh vegetables",
    "price": 11.99,
    "imageUrl": "https://example.com/chicken-burger.jpg",
    "preparationTime": 15,
    "calories": 450,
    "categoryId": "uuid",
    "isAvailable": true,
    "isFeatured": true,
    "isDeleted": false,
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "category": {
      "id": "uuid",
      "name": "Main Course",
      "slug": "main-course"
    },
    "addOns": [],
    "images": []
  }
}
```

### Delete Menu Item (Admin/Owner Only)

**Endpoint:** `DELETE /api/menu/:id`

**Authentication:** Required (Admin/Owner)

**Description:** Soft delete a menu item (sets isDeleted to true).

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Menu item deleted successfully"
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

### Common HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate slug)
- `500 Internal Server Error` - Server error

## Validation Rules

### Category Validation

- `name`: 2-50 characters
- `slug`: 2-100 characters, lowercase letters, numbers, hyphens only
- `imageUrl`: Valid URL (optional)
- `sortOrder`: Non-negative integer (optional)
- `isActive`: Boolean (optional)

### Menu Item Validation

- `name`: 2-100 characters
- `slug`: 2-100 characters, lowercase letters, numbers, hyphens only
- `description`: 10-500 characters
- `price`: Positive number, less than 10000
- `imageUrl`: Valid URL
- `preparationTime`: 1-180 minutes
- `calories`: Non-negative integer (optional)
- `categoryId`: Valid UUID
- `isAvailable`: Boolean (optional)
- `isFeatured`: Boolean (optional)
- `sortOrder`: Non-negative integer (optional)
- `addOns`: Array of add-on objects (optional)
  - `name`: 2-50 characters
  - `price`: Positive number, less than 1000
  - `isRequired`: Boolean (optional)
  - `maxSelections`: 1-10 (optional)
- `images`: Array of image objects (optional)
  - `imageUrl`: Valid URL
  - `sortOrder`: Non-negative integer (optional)
