import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mapProducts() {
  console.log('=== PRODUCT PRICE MAPPING ===\n');

  const targetProducts = {
    'Cheesy Fries': 95,
    'Bacon Cheddar Fries': 165,
    'Loaded BBQ Chicken Cheddar Cheese Fries': 110,
    'Cheese Beef Loaded Fries': 120,
    'Loaded Fries': 100,
    'Cheesy Macaroni and Hot Wings': 140,
    'Chicken Nuggets and Fries': 80,
    '2 Piece Glazed Crispy Chicken and Fries': 100,
    'Siracha Mayo Hot Wings (6) and Fries': 110,
    'Honey BBQ Wings (6) and Fries': 150,
    'Warning! 2 Piece Extra Insanity Hot Fried Chicken and Fries': 125,
    'Ultimate Chicken Cheddar Burger': 150,
    'Loaded Sausage Cheddar Burger': 155,
    'Melted Cheddar Burger': 150,
    'Ultimate Bacon Cheddar Burger': 165,
    'American BLT (Bacon Lettuce Tomato)': 120,
    'Tuna Fish Sandwich': 120,
    'Grilled Cheese Sandwich': 50,
    'Creamy Chicken Fettuccine Alfredo': 200,
    'Spaghetti Bolognese': 140,
    'Loaded Mac and Cheese Bowl': 220,
    '2 Beef Crispy Tacos': 165,
    '2 Chicken Crispy Tacos': 160,
    'Chicken Burrito': 170,
    'Jerk Chicken Shawarma': 80,
    'Pork Fried Rice': 140,
    'Assorted Chicken Fried Rice — Classic': 80,
    'American Pancakes and Eggs': 120,
    'French Toast, Maple Syrup and Buttery Eggs': 125,
    'Loaded Omelette': 70,
    'Chicken and Waffles': 195,
    'Red Velvet Cake': 40,
    'Pink Guava Buttercream Jar Cake': 35,
    'Coffee Latte Jar Cake': 35,
    'Pistachio Dream Jar Cake': 35,
    'Salted Caramel Cake': 35,
    'Bailey\'s Irish Cream Jar Cake': 35,
    'Vanilla Buttercream Cake Slice': 35,
    'Lemon Buttercream Jar Cake': 35,
    'Biscoff Jar Cake': 35,
    'Chocolate Rich Buttercream Frosting Jar Cake': 35,
    'Sunkissed Strawberry Mango Smoothie': 40,
    'Strawberry Bliss Shake': 45,
    'Vanilla Bean Shake': 65,
    'Classic Chocolate Shake': 65,
    'Banana Peanut Butter Chocolate': 45,
    'Lemonade Ice': 25,
    'Strawberries and Cream': 60,
    'Strawberry Pineapple Tang Smoothie': 45,
    'Exotic Tropical Fruit Blend Smoothie': 40,
    'Green Glow': 40,
    'Water Mint Ice Slushie': 40,
    'Sexy Pina Colada': 40,
    'Strawberry Colada Blast Smoothie': 40
  };

  const products = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, price: true }
  });

  const mapping = [];
  const notFound = [];

  for (const [name, newPrice] of Object.entries(targetProducts)) {
    const product = products.find(p => p.name === name);
    if (product) {
      mapping.push({
        name,
        id: product.id,
        currentPrice: product.price,
        newPrice
      });
    } else {
      notFound.push(name);
    }
  }

  console.log('=== PRODUCT MAPPING ===\n');
  mapping.forEach(m => {
    console.log(`${m.name}`);
    console.log(`  ID: ${m.id}`);
    console.log(`  Current: GH¢${m.currentPrice}`);
    console.log(`  New: GH¢${m.newPrice}`);
    console.log();
  });

  if (notFound.length > 0) {
    console.log('=== NOT FOUND ===\n');
    notFound.forEach(n => console.log(`  - ${n}`));
  }

  console.log(`\nTotal matched: ${mapping.length}`);
  console.log(`Total not found: ${notFound.length}`);

  await prisma.$disconnect();
}

mapProducts();
