import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixImagePaths() {
  console.log('=== FIX IMAGE PATHS ===\n');

  try {
    await prisma.$transaction(async (tx) => {
      const updates = [
        {
          name: 'Vanilla Bean Shake',
          oldPath: 'images/vanilla-shake.jpg',
          newPath: 'images/vanilla_shake.jpg'
        },
        {
          name: 'Classic Chocolate Shake',
          oldPath: 'images/chocolate-shake.jpg',
          newPath: 'images/choco_shake.jpg'
        },
        {
          name: 'Strawberry Pineapple Tang Smoothie',
          oldPath: 'images/pineapple-strawberry.jpg',
          newPath: 'images/pineapple_stawberry.jpg'
        },
        {
          name: 'Exotic Tropical Fruit Blend Smoothie',
          oldPath: 'images/tropical-smoothie.jpg',
          newPath: 'images/tropical.jpg'
        },
        {
          name: 'Strawberry Bliss Shake',
          oldPath: 'images/strawberry-shake.jpg',
          newPath: 'images/strawberry_banana.jpg'
        }
      ];

      let totalUpdated = 0;

      for (const update of updates) {
        console.log(`\nVerifying: ${update.name}`);
        
        const product = await tx.menuItem.findFirst({
          where: {
            name: update.name,
            imageUrl: update.oldPath
          },
          select: { id: true, name: true, imageUrl: true }
        });

        if (!product) {
          throw new Error(`ABORT: Product not found with expected image path: ${update.name} with ${update.oldPath}`);
        }

        console.log(`  ✓ Found: ${product.name} with ${product.imageUrl}`);

        const result = await tx.menuItem.updateMany({
          where: {
            name: update.name,
            imageUrl: update.oldPath
          },
          data: {
            imageUrl: update.newPath
          }
        });

        console.log(`  Updated to: ${update.newPath} (${result.count} record(s))`);
        totalUpdated += result.count;
      }

      console.log(`\n✅ Image paths updated successfully (${totalUpdated} total changes)`);
    });

    console.log('\n✅ Transaction committed successfully');

  } catch (error) {
    console.error('❌ Error during image path fix:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixImagePaths().catch(console.error);
