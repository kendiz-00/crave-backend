import { Router } from 'express';
import prisma from '@/database';
import { asyncHandler } from '@/middleware/asyncHandler';

const router = Router();

// Temporary diagnostic endpoint - REMOVE IN PRODUCTION
router.get('/debug/db-info', asyncHandler(async (_req, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');

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
      databaseUrl: maskedUrl,
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

export default router;
