import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateProductPrices() {
  console.log('=== PRODUCT PRICE UPDATE ===\n');

  const priceUpdates = [
    { name: 'Cheesy Fries', newPrice: 95 },
    { name: 'Bacon Cheddar Fries', newPrice: 165 },
    { name: 'Loaded BBQ Chicken Cheddar Cheese Fries', newPrice: 110 },
    { name: 'Cheese Beef Loaded Fries', newPrice: 120 },
    { name: 'Loaded Fries', newPrice: 100 },
    { name: 'Cheesy Macaroni and Hot Wings', newPrice: 140 },
    { name: 'Chicken Nuggets and Fries', newPrice: 80 },
    { name: '2 Piece Glazed Crispy Chicken and Fries', newPrice: 100 },
    { name: 'Siracha Mayo Hot Wings (6) and Fries', newPrice: 110 },
    { name: 'Honey BBQ Wings (6) and Fries', newPrice: 150 },
    { name: 'Warning! 2 Piece Extra Insanity Hot Fried Chicken and Fries', newPrice: 125 },
    { name: 'Ultimate Chicken Cheddar Burger', newPrice: 150 },
    { name: 'Loaded Sausage Cheddar Burger', newPrice: 155 },
    { name: 'Melted Cheddar Burger', newPrice: 150 },
    { name: 'Ultimate Bacon Cheddar Burger', newPrice: 165 },
    { name: 'American BLT (Bacon Lettuce Tomato)', newPrice: 120 },
    { name: 'Tuna Fish Sandwich', newPrice: 120 },
    { name: 'Grilled Cheese Sandwich', newPrice: 50 },
    { name: 'Creamy Chicken Fettuccine Alfredo', newPrice: 200 },
    { name: 'Spaghetti Bolognese', newPrice: 140 },
    { name: 'Loaded Mac and Cheese Bowl', newPrice: 220 },
    { name: '2 Beef Crispy Tacos', newPrice: 165 },
    { name: '2 Chicken Crispy Tacos', newPrice: 160 },
    { name: 'Chicken Burrito', newPrice: 170 },
    { name: 'Jerk Chicken Shawarma', newPrice: 80 },
    { name: 'Pork Fried Rice', newPrice: 140 },
    { name: 'Assorted Chicken Fried Rice — Classic', newPrice: 80 },
    { name: 'American Pancakes and Eggs', newPrice: 120 },
    { name: 'French Toast, Maple Syrup and Buttery Eggs', newPrice: 125 },
    { name: 'Loaded Omelette', newPrice: 70 },
    { name: 'Chicken and Waffles', newPrice: 195 },
    { name: 'Red Velvet Cake', newPrice: 40 },
    { name: 'Pink Guava Buttercream Jar Cake', newPrice: 35 },
    { name: 'Coffee Latte Jar Cake', newPrice: 35 },
    { name: 'Pistachio Dream Jar Cake', newPrice: 35 },
    { name: 'Salted Caramel Cake', newPrice: 35 },
    { name: 'Bailey\'s Irish Cream Jar Cake', newPrice: 35 },
    { name: 'Vanilla Buttercream Cake Slice', newPrice: 35 },
    { name: 'Lemon Buttercream Jar Cake', newPrice: 35 },
    { name: 'Biscoff Jar Cake', newPrice: 35 },
    { name: 'Chocolate Rich Buttercream Frosting Jar Cake', newPrice: 35 },
    { name: 'Sunkissed Strawberry Mango Smoothie', newPrice: 40 },
    { name: 'Strawberry Bliss Shake', newPrice: 45 },
    { name: 'Vanilla Bean Shake', newPrice: 65 },
    { name: 'Classic Chocolate Shake', newPrice: 65 },
    { name: 'Banana Peanut Butter Chocolate', newPrice: 45 },
    { name: 'Lemonade Ice', newPrice: 25 },
    { name: 'Strawberries and Cream', newPrice: 60 },
    { name: 'Strawberry Pineapple Tang Smoothie', newPrice: 45 },
    { name: 'Exotic Tropical Fruit Blend Smoothie', newPrice: 40 },
    { name: 'Green Glow', newPrice: 40 },
    { name: 'Water Mint Ice Slushie', newPrice: 40 },
    { name: 'Sexy Pina Colada', newPrice: 40 },
    { name: 'Strawberry Colada Blast Smoothie', newPrice: 40 }
  ];

  try {
    await prisma.$transaction(async (tx) => {
      let totalUpdated = 0;

      for (const update of priceUpdates) {
        console.log(`Updating: ${update.name} → GH¢${update.newPrice}`);

        const result = await tx.menuItem.updateMany({
          where: {
            name: update.name,
            isDeleted: false
          },
          data: {
            price: update.newPrice
          }
        });

        if (result.count === 0) {
          throw new Error(`Product not found: ${update.name}`);
        }

        console.log(`  ✓ Updated ${result.count} record(s)`);
        totalUpdated += result.count;
      }

      console.log(`\n✅ Total updated: ${totalUpdated} records`);
    });

    console.log('\n✅ Transaction committed successfully');

    // Verify Pistachio Dream Jar Cake
    const pistachio = await prisma.menuItem.findFirst({
      where: { name: 'Pistachio Dream Jar Cake', isDeleted: false },
      select: { name: true, price: true }
    });

    if (pistachio) {
      console.log(`\n✅ Pistachio Dream Jar Cake verified: GH¢${pistachio.price}`);
    } else {
      console.log('\n❌ Pistachio Dream Jar Cake not found!');
    }

  } catch (error: any) {
    console.error('❌ Error during price update:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateProductPrices();
