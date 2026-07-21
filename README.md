# CRAVE Platform Backend

A production-grade backend foundation for the CRAVE Platform, built with TypeScript, Express.js, PostgreSQL, and Prisma.

## Project Overview

This is the backend foundation for the CRAVE Platform - Phase 1. It provides a scalable, production-ready architecture with comprehensive security middleware, error handling, logging, and database connectivity. The foundation is designed to support future phases including authentication, orders, rewards, and menu management.

## Tech Stack

- **Language**: TypeScript (Strict Mode)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Logging**: Pino
- **Security**: Helmet, CORS, Compression, express-rate-limit
- **Testing**: Jest, ts-jest, supertest
- **Development**: ts-node-dev, ESLint, Prettier

## Architecture Overview

The backend follows a layered architecture with clear separation of concerns:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Routes**: Define API endpoints
- **Middleware**: Handle cross-cutting concerns (auth, logging, errors)
- **Database**: Prisma ORM for database operations
- **Config**: Centralized configuration with environment validation
- **Utils**: Shared utilities (logger, helpers)

## Folder Structure

```
crave-backend/
├── src/
│   ├── app.ts                 # Express app configuration
│   ├── server.ts              # Server entry point
│   ├── config/                # Configuration management
│   │   └── index.ts
│   ├── routes/                # API routes
│   │   ├── index.ts
│   │   ├── root.route.ts
│   │   ├── health.route.ts
│   │   └── api.route.ts
│   ├── controllers/           # Request handlers
│   │   ├── index.ts
│   │   ├── root.controller.ts
│   │   ├── health.controller.ts
│   │   └── api.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── index.ts
│   │   ├── asyncHandler.ts
│   │   ├── error.middleware.ts
│   │   └── notFound.middleware.ts
│   ├── services/              # Business logic
│   │   ├── index.ts
│   │   └── database.service.ts
│   ├── database/              # Database client
│   │   └── index.ts
│   ├── utils/                 # Utilities
│   │   ├── index.ts
│   │   └── logger.ts
│   ├── types/                 # TypeScript types
│   │   ├── index.ts
│   │   └── errors.ts
│   └── validators/            # Input validation
│       ├── index.ts
│       └── env.validator.ts
├── prisma/
│   └── schema.prisma          # Prisma schema
├── tests/                     # Test files
│   └── health.test.ts
├── logs/                      # Application logs
├── .env.example               # Environment variables template
├── .eslintrc.json            # ESLint configuration
├── .prettierrc               # Prettier configuration
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Jest configuration
└── package.json              # Dependencies and scripts
```

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd crave-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/crave?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
NODE_ENV="development"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT tokens | Required (min 32 chars) |
| `NODE_ENV` | Environment (development/production/test) | development |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | http://localhost:3000 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## Database Setup

1. Create a PostgreSQL database:
```bash
createdb crave
```

2. Update `DATABASE_URL` in your `.env` file with your database credentials.

3. Run Prisma migrations (when models are added in future phases):
```bash
npx prisma migrate dev
```

4. Generate Prisma client:
```bash
npx prisma generate
```

## Prisma Workflow

### View Schema
```bash
npx prisma studio
```

### Create Migration
```bash
npx prisma migrate dev --name migration_name
```

### Reset Database
```bash
npx prisma migrate reset
```

### Generate Client
```bash
npx prisma generate
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run clean` - Remove build directory
- `npm run type-check` - Run TypeScript type checking

## Running Development Server

1. Ensure your `.env` file is configured
2. Ensure PostgreSQL is running
3. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### GET /
Returns service status
```json
{
  "service": "CRAVE Platform API",
  "status": "running"
}
```

### GET /health
Returns health status with database connection
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": "0m 30s"
}
```

### GET /api
Returns API version and environment
```json
{
  "version": "v1",
  "environment": "development"
}
```

## Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Deployment Notes

### Environment Setup
1. Set `NODE_ENV=production` in your production environment
2. Use a strong `JWT_SECRET` (minimum 32 characters)
3. Configure `CORS_ALLOWED_ORIGINS` with your production domains
4. Use a production PostgreSQL instance
5. Set appropriate rate limits based on your traffic

### Build
```bash
npm run build
```

### Start
```bash
npm start
```

## Security Features

- **Helmet**: Sets secure HTTP headers
- **CORS**: Configurable cross-origin resource sharing
- **Compression**: Gzip compression for responses
- **Rate Limiting**: Configurable request rate limits
- **Trust Proxy**: Support for reverse proxy deployments
- **Environment Validation**: Fail-fast on missing required variables
- **Error Handling**: Never exposes stack traces in production

## Logging

- **Development**: Pretty-printed logs with colors
- **Production**: JSON logs for log aggregation
- **Request/Response Logging**: Automatic HTTP request logging
- **Error Logging**: Structured error logging with context

## Future Roadmap

### Phase 2: Authentication
- User registration and login
- JWT token generation and validation
- Password hashing with bcrypt
- Protected routes
- Refresh tokens

### Phase 3: Orders
- Order creation and management
- Order status tracking
- Order history

### Phase 4: Rewards
- Points system
- Reward redemption
- User rewards history

### Phase 5: Menu Management
- Menu item CRUD operations
- Category management
- Availability management

### Phase 6: Admin Dashboard
- Admin authentication
- User management
- Order management
- Analytics and reporting

### Phase 7: Payment Integration
- Payment gateway integration
- Transaction management
- Refund handling

### Phase 8: WhatsApp Integration
- WhatsApp notifications
- Order updates via WhatsApp
- Customer support integration

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
