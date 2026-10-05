import { Router } from 'express';
import prisma from '@/database';
import { asyncHandler } from '@/middleware/asyncHandler';

const router = Router();

// Temporary diagnostic endpoint - REMOVE IN PRODUCTION
router.get('/db-info', asyncHandler(async (_req, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    
    // Extract database name from URL
    const dbNameMatch = dbUrl.match(/\/([^?]+)(\?|$)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'UNKNOWN';

    // Get database-level info
    const dbInfo = await prisma.$queryRaw`
      SELECT 
        current_database(),
        current_schema(),
        current_user,
        current_setting('search_path')
    `;

    const categoryCount = await prisma.category.count();
    const productCount = await prisma.menuItem.count({ where: { isDeleted: false } });

    const phase2bProducts = [
      'Cheesy Fries',
      'Chicken Nuggets and Fries',
      'Cheesy Macaroni and Hot Wings',
      'Loaded Sausage Cheddar Burger',
      'Ultimate Chicken Cheddar Burger',
      'Loaded Mac and Cheese Bowl',
      'Spaghetti Bolognese',
      'Creamy Chicken Fettuccine Alfredo',
      'Assorted Chicken Fried Rice — Classic',
      'Pork Fried Rice',
      'French Toast, Maple Syrup and Buttery Eggs',
      'American Pancakes and Eggs',
      'Red Velvet Cake',
      'Sunkissed Strawberry Mango Smoothie'
    ];

    const phase2bFound = await prisma.menuItem.count({
      where: {
        name: { in: phase2bProducts },
        isDeleted: false
      }
    });

    res.json({
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(2, 15),
      databaseUrl: maskedUrl,
      databaseName: dbName,
      databaseInfo: dbInfo[0],
      categories: categoryCount,
      products: productCount,
      phase2bProducts: phase2bFound,
      nodeEnv: process.env.NODE_ENV
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET'
    });
  }
}));

// Bypass cache - directly query database like /api/menu does
router.get('/menu-raw', asyncHandler(async (_req, res) => {
  try {
    const products = await prisma.menuItem.findMany({
      where: { isDeleted: false },
      include: { category: true },
      orderBy: { sortOrder: 'asc' }
    });

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const productNames = products.map(p => p.name);
    const first5 = productNames.slice(0, 5);
    const last5 = productNames.slice(-5);

    res.json({
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(2, 15),
      bypassedCache: true,
      totalProducts: products.length,
      totalCategories: categories.length,
      first5ProductNames: first5,
      last5ProductNames: last5
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
}));

export default router;
