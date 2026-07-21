import request from 'supertest';
import { createApp } from '../src/app';

jest.mock('../src/services/database.service');

const { DatabaseService } = require('../src/services/database.service');

describe('Health Endpoint', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it('should return health status with database connection', async () => {
    DatabaseService.verifyConnection.mockResolvedValue(undefined);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('uptime');
  });

  it('should return status as healthy when database is connected', async () => {
    DatabaseService.verifyConnection.mockResolvedValue(undefined);

    const response = await request(app).get('/health');

    expect(response.body.status).toBe('healthy');
    expect(response.body.database).toBe('connected');
  });
});
