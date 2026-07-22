import request from 'supertest';
import { createApp } from '../src/app';

jest.mock('../src/services/menu.service');
jest.mock('../src/services/category.service');
jest.mock('../src/services/database.service');

const { MenuService } = require('../src/services/menu.service');
const { CategoryService } = require('../src/services/category.service');

describe('Menu Endpoints', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  describe('GET /api/menu', () => {
    it('should get menu items with pagination', async () => {
      const mockMenuItems = [
        {
          id: '123',
          name: 'Burger',
          slug: 'burger',
          description: 'Delicious burger',
          price: 9.99,
          imageUrl: 'https://example.com/burger.jpg',
          preparationTime: 15,
          calories: 500,
          categoryId: 'cat-1',
          isAvailable: true,
          isFeatured: false,
          isDeleted: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: 'cat-1', name: 'Main Course', slug: 'main-course' },
          addOns: [],
          images: [],
        },
      ];

      const mockPagination = {
        data: mockMenuItems,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      MenuService.getMenuItems.mockResolvedValue(mockPagination);

      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/menu/featured', () => {
    it('should get featured menu items', async () => {
      const mockMenuItems = [
        {
          id: '123',
          name: 'Featured Burger',
          slug: 'featured-burger',
          description: 'Delicious featured burger',
          price: 12.99,
          imageUrl: 'https://example.com/featured.jpg',
          preparationTime: 20,
          categoryId: 'cat-1',
          isAvailable: true,
          isFeatured: true,
          isDeleted: false,
          category: { id: 'cat-1', name: 'Main Course', slug: 'main-course' },
          addOns: [],
          images: [],
        },
      ];

      MenuService.getFeaturedMenuItems.mockResolvedValue(mockMenuItems);

      const response = await request(app).get('/api/menu/featured');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/menu/search', () => {
    it('should search menu items by query', async () => {
      const mockMenuItems = [
        {
          id: '123',
          name: 'Chicken Burger',
          slug: 'chicken-burger',
          description: 'Tasty chicken burger',
          price: 10.99,
          imageUrl: 'https://example.com/chicken.jpg',
          preparationTime: 15,
          categoryId: 'cat-1',
          isAvailable: true,
          isFeatured: false,
          isDeleted: false,
          category: { id: 'cat-1', name: 'Main Course', slug: 'main-course' },
          addOns: [],
          images: [],
        },
      ];

      const mockPagination = {
        data: mockMenuItems,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      MenuService.getMenuItems.mockResolvedValue(mockPagination);

      const response = await request(app).get('/api/menu/search?q=chicken');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});

describe('Category Endpoints', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  describe('GET /api/categories', () => {
    it('should get all categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Main Course',
          slug: 'main-course',
          imageUrl: 'https://example.com/main.jpg',
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { menuItems: 5 },
        },
      ];

      CategoryService.getAllCategories.mockResolvedValue(mockCategories);

      const response = await request(app).get('/api/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});
