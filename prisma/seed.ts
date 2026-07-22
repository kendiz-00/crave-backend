import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CRAVE database seed...');

  // Clean up existing data (for repeatable seeding)
  console.log('🧹 Cleaning existing data...');
  await prisma.addOn.deleteMany();
  await prisma.menuImage.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();

  // Create Categories
  console.log('📁 Creating categories...');
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'loaded-fries' },
      update: {},
      create: {
        name: 'Loaded Fries',
        slug: 'loaded-fries',
        description: 'Our signature loaded fries with premium toppings',
        imageUrl: 'https://example.com/categories/loaded-fries.jpg',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'texas-crispy-chicken' },
      update: {},
      create: {
        name: 'Texas Crispy Chicken',
        slug: 'texas-crispy-chicken',
        description: 'Crispy fried chicken with Texas-style flavors',
        imageUrl: 'https://example.com/categories/texas-chicken.jpg',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'jamaican-kitchen' },
      update: {},
      create: {
        name: 'Jamaican Kitchen',
        slug: 'jamaican-kitchen',
        description: 'Authentic Jamaican flavors and spices',
        imageUrl: 'https://example.com/categories/jamaican.jpg',
        sortOrder: 3,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'smoothies' },
      update: {},
      create: {
        name: 'Smoothies',
        slug: 'smoothies',
        description: 'Fresh and healthy smoothie blends',
        imageUrl: 'https://example.com/categories/smoothies.jpg',
        sortOrder: 4,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'milkshakes' },
      update: {},
      create: {
        name: 'Milkshakes',
        slug: 'milkshakes',
        description: 'Creamy and delicious milkshakes',
        imageUrl: 'https://example.com/categories/milkshakes.jpg',
        sortOrder: 5,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'cake-shakes' },
      update: {},
      create: {
        name: 'Cake & Shakes',
        slug: 'cake-shakes',
        description: 'Decadent cakes paired with shakes',
        imageUrl: 'https://example.com/categories/cake-shakes.jpg',
        sortOrder: 6,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'cupcakes' },
      update: {},
      create: {
        name: 'Cupcakes',
        slug: 'cupcakes',
        description: 'Artisan cupcakes with premium frosting',
        imageUrl: 'https://example.com/categories/cupcakes.jpg',
        sortOrder: 7,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'sides' },
      update: {},
      create: {
        name: 'Sides',
        slug: 'sides',
        description: 'Perfect sides to complete your meal',
        imageUrl: 'https://example.com/categories/sides.jpg',
        sortOrder: 8,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'extras' },
      update: {},
      create: {
        name: 'Extras',
        slug: 'extras',
        description: 'Add extra flavor to your order',
        imageUrl: 'https://example.com/categories/extras.jpg',
        sortOrder: 9,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Get category IDs for reference
  const categoryMap = Object.fromEntries(
    categories.map((cat: { slug: string; id: string }) => [cat.slug, cat.id])
  );

  // Create Menu Items from frontend data
  console.log('🍔 Creating menu items...');
  
  const menuItems = [
    // Loaded Fries
    {
      name: 'Loaded Fries',
      slug: 'loaded-fries',
      description: 'Our signature loaded fries with jerk chicken, vegetables, melted cheese and special sauces',
      price: 105.99,
      imageUrl: 'images/loaded_fries_01.jpg',
      preparationTime: 15,
      calories: 650,
      categoryId: categoryMap['loaded-fries'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
        { name: 'Bacon', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Jalapeños', price: 3.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Chicken', price: 15.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'Cheese Beef Loaded Fries',
      slug: 'cheese-beef-loaded-fries',
      description: 'Loaded fries with seasoned beef and melted cheese',
      price: 120.99,
      imageUrl: 'images/beef_loaded.jpg',
      preparationTime: 18,
      calories: 720,
      categoryId: categoryMap['loaded-fries'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Extra Beef', price: 12.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Loaded BBQ Chicken Cheddar Cheese Fries',
      slug: 'bbq-chicken-cheddar-fries',
      description: 'Smoky BBQ chicken and melted sharp cheddar over hot, crispy fries — a crowd favorite',
      price: 150.99,
      imageUrl: 'images/bbq_fries.jpg',
      preparationTime: 20,
      calories: 850,
      categoryId: categoryMap['loaded-fries'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Extra BBQ Sauce', price: 2.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Chicken', price: 15.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'Bacon Cheddar Fries',
      slug: 'bacon-cheddar-fries',
      description: 'Crispy fries with bacon and cheddar cheese',
      price: 170.99,
      imageUrl: 'images/bacon_fries.jpg',
      preparationTime: 15,
      calories: 780,
      categoryId: categoryMap['loaded-fries'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 4,
      addOns: [
        { name: 'Extra Bacon', price: 8.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
      ],
    },

    // Texas Crispy Chicken
    {
      name: 'Warning! 2 Piece Extra Insanity Hot Fried Chicken and Fries',
      slug: 'extra-insanity-hot-chicken',
      description: 'Extremely spicy fried chicken - not for the faint of heart!',
      price: 110.99,
      imageUrl: 'images/hot_chicken.jpeg',
      preparationTime: 20,
      calories: 900,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Extra Chicken', price: 20.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Sauce', price: 3.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Honey BBQ Wings (6) and Fries',
      slug: 'honey-bbq-wings-fries',
      description: 'Sweet and tangy BBQ wings with crispy fries',
      price: 160.99,
      imageUrl: 'images/bbq_wings.jpg',
      preparationTime: 18,
      calories: 820,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Extra Wings (2)', price: 25.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra BBQ Sauce', price: 3.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Siracha Mayo Hot Wings (6) and Fries',
      slug: 'siracha-hot-wings-fries',
      description: 'Spicy sriracha mayo wings with fries',
      price: 175.99,
      imageUrl: 'images/siracha_wings_fries.jpg',
      preparationTime: 18,
      calories: 850,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Extra Wings (2)', price: 25.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Sriracha', price: 3.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: '2 Piece Glazed Crispy Chicken and Fries',
      slug: 'glazed-crispy-chicken',
      description: 'Classic crispy chicken with sweet glaze',
      price: 120.99,
      imageUrl: 'images/glazed_chicken_fries.jpg',
      preparationTime: 15,
      calories: 750,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 4,
      addOns: [
        { name: 'Extra Chicken', price: 20.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Glaze', price: 2.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Ultimate Bacon Cheddar Burger',
      slug: 'ultimate-bacon-cheddar-burger',
      description: 'Double bacon patty with extra cheddar',
      price: 140.99,
      imageUrl: 'images/bacon_burger.jpg',
      preparationTime: 20,
      calories: 950,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 5,
      addOns: [
        { name: 'Extra Bacon', price: 8.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'Melted Cheddar Burger',
      slug: 'melted-cheddar-burger',
      description: 'Juicy burger with melted cheddar cheese',
      price: 160.99,
      imageUrl: 'images/melted_burger.jpg',
      preparationTime: 18,
      calories: 880,
      categoryId: categoryMap['texas-crispy-chicken'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 6,
      addOns: [
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
        { name: 'Bacon', price: 8.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Jamaican Kitchen
    {
      name: 'Jerk Chicken Shawarma',
      slug: 'jerk-chicken-shawarma',
      description: 'Traditional jerk chicken wrapped in warm pita',
      price: 90.99,
      imageUrl: 'images/jerk_shawarma.jpeg',
      preparationTime: 15,
      calories: 680,
      categoryId: categoryMap['jamaican-kitchen'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Extra Jerk Sauce', price: 3.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Chicken', price: 15.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Mexican Food
    {
      name: 'Chicken Burrito',
      slug: 'chicken-burrito',
      description: 'Grilled chicken, rice, beans, and salsa wrapped in tortilla',
      price: 200.99,
      imageUrl: 'images/burrito.jpg',
      preparationTime: 18,
      calories: 920,
      categoryId: categoryMap['jamaican-kitchen'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Guacamole', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Chicken', price: 15.00, isRequired: false, maxSelections: 2 },
        { name: 'Sour Cream', price: 3.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: '2 Chicken Crispy Tacos',
      slug: 'chicken-crispy-tacos',
      description: 'Two crispy tacos with seasoned chicken',
      price: 170.99,
      imageUrl: 'images/tacos.jpg',
      preparationTime: 15,
      calories: 780,
      categoryId: categoryMap['jamaican-kitchen'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Extra Taco', price: 50.00, isRequired: false, maxSelections: 3 },
        { name: 'Guacamole', price: 8.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: '2 Beef Crispy Tacos',
      slug: 'beef-crispy-tacos',
      description: 'Two crispy tacos with seasoned ground beef',
      price: 110.99,
      imageUrl: 'images/beef_tacos.jpg',
      preparationTime: 15,
      calories: 750,
      categoryId: categoryMap['jamaican-kitchen'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 4,
      addOns: [
        { name: 'Extra Taco', price: 50.00, isRequired: false, maxSelections: 3 },
        { name: 'Extra Beef', price: 12.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Cupcakes
    {
      name: 'Chocolate Rich Buttercream Frosting Jar Cake',
      slug: 'chocolate-buttercream-jar-cake',
      description: 'Decadent chocolate cake with rich buttercream',
      price: 35.99,
      imageUrl: 'images/choco_jar.jpeg',
      preparationTime: 5,
      calories: 450,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [],
    },
    {
      name: 'Biscoff Jar Cake',
      slug: 'biscoff-jar-cake',
      description: 'Speculoos cookie butter cake in a jar',
      price: 40.99,
      imageUrl: 'images/biscoff-cake.jpg',
      preparationTime: 5,
      calories: 480,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 2,
      addOns: [],
    },
    {
      name: 'Lemon Buttercream Jar Cake',
      slug: 'lemon-buttercream-jar-cake',
      description: 'Fresh lemon cake with zesty buttercream frosting',
      price: 40.99,
      imageUrl: 'images/lemon-cake.jpg',
      preparationTime: 5,
      calories: 420,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 3,
      addOns: [],
    },
    {
      name: 'Vanilla Buttercream Cake Slice',
      slug: 'vanilla-buttercream-cake',
      description: 'Classic vanilla cake with buttercream frosting',
      price: 35.99,
      imageUrl: 'images/vanilla-cake.jpg',
      preparationTime: 5,
      calories: 400,
      categoryId: categoryMap['cupcakes'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 4,
      addOns: [],
    },
    {
      name: "Bailey's Irish Cream Jar Cake",
      slug: 'baileys-irish-cream-cake',
      description: 'Adult cake with Irish cream flavor',
      price: 45.99,
      imageUrl: 'images/baileys-cake.jpg',
      preparationTime: 5,
      calories: 500,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 5,
      addOns: [],
    },
    {
      name: 'Salted Caramel Cake',
      slug: 'salted-caramel-cake',
      description: 'Sweet and salty caramel cake',
      price: 38.99,
      imageUrl: 'images/caramel-cake.jpg',
      preparationTime: 5,
      calories: 460,
      categoryId: categoryMap['cupcakes'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 6,
      addOns: [],
    },
    {
      name: 'Pistachio Dream Jar Cake',
      slug: 'pistachio-dream-cake',
      description: 'Nutty pistachio cake in a jar',
      price: 42.99,
      imageUrl: 'images/pistachio-cake.jpg',
      preparationTime: 5,
      calories: 470,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 7,
      addOns: [],
    },
    {
      name: 'Coffee Latte Jar Cake',
      slug: 'coffee-latte-cake',
      description: 'Coffee-flavored cake with latte frosting',
      price: 38.99,
      imageUrl: 'images/coffee-cake.jpg',
      preparationTime: 5,
      calories: 440,
      categoryId: categoryMap['cupcakes'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 8,
      addOns: [],
    },
    {
      name: 'Pink Guava Buttercream Jar Cake',
      slug: 'pink-guava-cake',
      description: 'Tropical guava cake with buttercream',
      price: 42.99,
      imageUrl: 'images/guava-cake.jpg',
      preparationTime: 5,
      calories: 450,
      categoryId: categoryMap['cupcakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 9,
      addOns: [],
    },

    // Breakfast
    {
      name: 'Chicken and Waffles',
      slug: 'chicken-waffles',
      description: 'Crispy fried chicken on fluffy waffles with syrup',
      price: 85.99,
      imageUrl: 'images/waffles.jpg',
      preparationTime: 20,
      calories: 820,
      categoryId: categoryMap['cake-shakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Maple Syrup', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Spicy Syrup', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Chicken', price: 20.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'Loaded Omelette',
      slug: 'loaded-omelette',
      description: 'Three-egg omelette with cheese, vegetables, and your choice of meat',
      price: 65.99,
      imageUrl: 'images/omelette.jpg',
      preparationTime: 15,
      calories: 650,
      categoryId: categoryMap['cake-shakes'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
        { name: 'Bacon', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Sausage', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Mushrooms', price: 4.00, isRequired: false, maxSelections: 3 },
      ],
    },

    // Smoothies
    {
      name: 'Strawberry Colada',
      slug: 'strawberry-colada',
      description: 'Strawberry and pineapple smoothie with coconut',
      price: 35.99,
      imageUrl: 'images/strawberry_banana.jpg',
      preparationTime: 8,
      calories: 280,
      categoryId: categoryMap['smoothies'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Pina Colada',
      slug: 'pina-colada',
      description: 'Classic pineapple and coconut smoothie',
      price: 35.99,
      imageUrl: 'images/pina-colada.jpg',
      preparationTime: 8,
      calories: 270,
      categoryId: categoryMap['smoothies'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Watermelon Mint Ice',
      slug: 'watermelon-mint-ice',
      description: 'Refreshing watermelon with mint',
      price: 30.99,
      imageUrl: 'images/watermelon_mint.jpg',
      preparationTime: 6,
      calories: 180,
      categoryId: categoryMap['smoothies'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Green Glow',
      slug: 'green-glow',
      description: 'Spinach, kale, banana, and green apple',
      price: 38.99,
      imageUrl: 'images/green_glow.jpg',
      preparationTime: 8,
      calories: 220,
      categoryId: categoryMap['smoothies'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 4,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Tropical Fruit Blend',
      slug: 'tropical-fruit-blend',
      description: 'Mango, pineapple, and passion fruit',
      price: 38.99,
      imageUrl: 'images/tropical-smoothie.jpg',
      preparationTime: 8,
      calories: 260,
      categoryId: categoryMap['smoothies'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 5,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Pineapple Strawberry',
      slug: 'pineapple-strawberry',
      description: 'Sweet pineapple and strawberry blend',
      price: 35.99,
      imageUrl: 'images/pineapple-strawberry.jpg',
      preparationTime: 7,
      calories: 240,
      categoryId: categoryMap['smoothies'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 6,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Strawberries and Cream',
      slug: 'strawberries-cream',
      description: 'Strawberry smoothie with creamy vanilla',
      price: 35.99,
      imageUrl: 'images/strawberry_cream.jpg',
      preparationTime: 7,
      calories: 320,
      categoryId: categoryMap['smoothies'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 7,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Lemonade Ice',
      slug: 'lemonade-ice',
      description: 'Refreshing lemonade ice smoothie',
      price: 30.99,
      imageUrl: 'images/brazilian_lemonade.jpg',
      preparationTime: 6,
      calories: 190,
      categoryId: categoryMap['smoothies'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 8,
      addOns: [
        { name: 'Protein Boost', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Ice', price: 0, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Banana Peanut Butter Chocolate',
      slug: 'banana-peanut-chocolate',
      description: 'Banana, peanut butter, and chocolate protein',
      price: 38.99,
      imageUrl: 'images/peanut.jpeg',
      preparationTime: 8,
      calories: 380,
      categoryId: categoryMap['smoothies'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 9,
      addOns: [
        { name: 'Extra Peanut Butter', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Chocolate', price: 5.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Milkshakes (additional category)
    {
      name: 'Classic Chocolate Shake',
      slug: 'classic-chocolate-shake',
      description: 'Rich and creamy chocolate milkshake',
      price: 45.99,
      imageUrl: 'images/chocolate-shake.jpg',
      preparationTime: 8,
      calories: 520,
      categoryId: categoryMap['milkshakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Oreo Crumble', price: 8.00, isRequired: false, maxSelections: 2 },
        { name: 'Whipped Cream', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Chocolate Syrup', price: 3.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Vanilla Bean Shake',
      slug: 'vanilla-bean-shake',
      description: 'Classic vanilla bean milkshake',
      price: 42.99,
      imageUrl: 'images/vanilla-shake.jpg',
      preparationTime: 8,
      calories: 480,
      categoryId: categoryMap['milkshakes'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Whipped Cream', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Chocolate Syrup', price: 3.00, isRequired: false, maxSelections: 3 },
      ],
    },
    {
      name: 'Strawberry Bliss Shake',
      slug: 'strawberry-bliss-shake',
      description: 'Fresh strawberry milkshake',
      price: 45.99,
      imageUrl: 'images/strawberry-shake.jpg',
      preparationTime: 8,
      calories: 490,
      categoryId: categoryMap['milkshakes'],
      isFeatured: true,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Whipped Cream', price: 5.00, isRequired: false, maxSelections: 2 },
        { name: 'Extra Strawberry', price: 6.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Sides
    {
      name: 'Grilled Cheese Sandwich',
      slug: 'grilled-cheese-sandwich',
      description: 'Classic grilled cheese with melted cheddar',
      price: 45.99,
      imageUrl: 'images/grilled_sandwich.jpg',
      preparationTime: 10,
      calories: 520,
      categoryId: categoryMap['sides'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 1,
      addOns: [
        { name: 'Extra Cheese', price: 5.00, isRequired: false, maxSelections: 3 },
        { name: 'Bacon', price: 8.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'Tuna Fish Sandwich',
      slug: 'tuna-fish-sandwich',
      description: 'Fresh tuna salad sandwich on toasted bread',
      price: 55.99,
      imageUrl: 'images/tuna_sandwich.jpg',
      preparationTime: 12,
      calories: 580,
      categoryId: categoryMap['sides'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 2,
      addOns: [
        { name: 'Extra Tuna', price: 10.00, isRequired: false, maxSelections: 2 },
        { name: 'Cheese', price: 5.00, isRequired: false, maxSelections: 2 },
      ],
    },
    {
      name: 'American BLT (Bacon Lettuce Tomato)',
      slug: 'american-blt',
      description: 'Classic BLT with crispy bacon',
      price: 60.99,
      imageUrl: 'images/blt_sandwich.jpg',
      preparationTime: 10,
      calories: 550,
      categoryId: categoryMap['sides'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 3,
      addOns: [
        { name: 'Extra Bacon', price: 8.00, isRequired: false, maxSelections: 3 },
        { name: 'Avocado', price: 8.00, isRequired: false, maxSelections: 2 },
      ],
    },

    // Extras
    {
      name: 'Extra Sauce Pack',
      slug: 'extra-sauce-pack',
      description: 'Additional sauce for your meal',
      price: 5.00,
      imageUrl: 'images/sauce.jpg',
      preparationTime: 2,
      calories: 50,
      categoryId: categoryMap['extras'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 1,
      addOns: [],
    },
    {
      name: 'Extra Napkins',
      slug: 'extra-napkins',
      description: 'Additional napkins',
      price: 2.00,
      imageUrl: 'images/napkins.jpg',
      preparationTime: 1,
      calories: 0,
      categoryId: categoryMap['extras'],
      isFeatured: false,
      isAvailable: true,
      displayOrder: 2,
      addOns: [],
    },
  ];

  // Create menu items with add-ons
  const createdMenuItems = [];
  for (const item of menuItems) {
    const { addOns, ...menuItemData } = item;
    
    const menuItem = await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: menuItemData,
      create: menuItemData,
    });
    
    // Create add-ons for this menu item
    for (const addOn of addOns) {
      await prisma.addOn.create({
        data: {
          menuItemId: menuItem.id,
          ...addOn,
        },
      });
    }
    
    createdMenuItems.push(menuItem);
  }

  console.log(`✅ Created ${createdMenuItems.length} menu items`);

  // Create additional menu images for featured items
  console.log('📸 Creating menu images...');
  const imageCount = await prisma.menuImage.createMany({
    data: [
      // Extra images for featured items
      { menuItemId: createdMenuItems[0].id, imageUrl: 'images/loaded_fries_02.jpg', sortOrder: 1 },
      { menuItemId: createdMenuItems[4].id, imageUrl: 'images/hot_chicken_02.jpg', sortOrder: 1 },
      { menuItemId: createdMenuItems[9].id, imageUrl: 'images/bacon_burger_02.jpg', sortOrder: 1 },
      { menuItemId: createdMenuItems[13].id, imageUrl: 'images/choco_jar_02.jpg', sortOrder: 1 },
      { menuItemId: createdMenuItems[14].id, imageUrl: 'images/biscoff_02.jpg', sortOrder: 1 },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created ${imageCount.count} menu images`);

  console.log('🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Categories: ${categories.length}`);
  console.log(`   - Menu Items: ${createdMenuItems.length}`);
  console.log(`   - Menu Images: ${imageCount.count}`);
  
  const totalAddOns = await prisma.addOn.count();
  console.log(`   - Add-ons: ${totalAddOns}`);
  
  const featuredCount = await prisma.menuItem.count({ where: { isFeatured: true } });
  console.log(`   - Featured Items: ${featuredCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
