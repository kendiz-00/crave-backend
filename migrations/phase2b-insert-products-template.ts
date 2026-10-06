import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Category IDs from Phase 2A (PRODUCTION)
const CATEGORY_IDS = {
  LOADED_FRIES: '112c1331-2b3e-40fd-9cc1-158c790b3254',
  CHICKEN_WINGS: 'a9ede120-7918-424e-9763-a2b18176c0eb',
  BURGERS: '8cfe5b5c-8e7a-4398-ba4a-7486e6053f2c',
  AMERICAN_CLASSICS: 'd9d6f406-ff62-437b-a248-c2727fb90b70',
  FRIED_RICE: 'a5542477-e1f9-4ade-804c-17a411ce2994',
  BREAKFAST: 'c19ca51c-7596-493f-85fe-000c5847402b',
  CAKES_DESSERTS: '00109e91-ed16-4b5c-b5d1-bb1e63f11fa7',
  SMOOTHIES_REFRESHERS: 'efa63ccf-80b8-4e35-bbed-1e2277700202',
};

// Product data with approved values
const NEW_PRODUCTS = [
  {
    name: 'Cheesy Fries',
    slug: 'cheesy-fries',
    description: 'Classic crispy fries loaded with melted cheddar cheese',
    price: 32,
    imageUrl: 'images/cheesy_fries.jpg',
    preparationTime: 15,
    calories: null,
    categoryId: CATEGORY_IDS.LOADED_FRIES,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Cheese', price: 8, isRequired: false, maxSelections: 2 }
    ]
  },
  {
    name: 'Chicken Nuggets and Fries',
    slug: 'chicken-nuggets-fries',
    description: 'Crispy chicken nuggets served with golden fries',
    price: 38,
    imageUrl: 'images/chicken_nuggets_fries.jpg',
    preparationTime: 18,
    calories: null,
    categoryId: CATEGORY_IDS.CHICKEN_WINGS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Nuggets (6 pcs)', price: 12, isRequired: false, maxSelections: 2 },
      { name: 'Extra Fries', price: 10, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Cheesy Macaroni and Hot Wings',
    slug: 'cheesy-macaroni-hot-wings',
    description: 'Creamy mac and cheese topped with spicy hot wings',
    price: 42,
    imageUrl: 'images/cheesy_macaroni_hot_wings.jpg',
    preparationTime: 22,
    calories: null,
    categoryId: CATEGORY_IDS.CHICKEN_WINGS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Wings (2)', price: 25, isRequired: false, maxSelections: 2 },
      { name: 'Extra Cheese', price: 8, isRequired: false, maxSelections: 2 }
    ]
  },
  {
    name: 'Loaded Sausage Cheddar Burger',
    slug: 'loaded-sausage-cheddar-burger',
    description: 'Premium sausage patty with melted cheddar on a toasted bun',
    price: 45,
    imageUrl: 'images/loaded_sausage_cheddar_burger.jpg',
    preparationTime: 18,
    calories: null,
    categoryId: CATEGORY_IDS.BURGERS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Sausage', price: 12, isRequired: false, maxSelections: 1 },
      { name: 'Extra Cheese', price: 6, isRequired: false, maxSelections: 2 },
      { name: 'Bacon', price: 10, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Ultimate Chicken Cheddar Burger',
    slug: 'ultimate-chicken-cheddar-burger',
    description: 'Crispy chicken breast with melted cheddar and premium toppings',
    price: 42,
    imageUrl: 'images/ultimate_chicken_cheddar_burger.jpg',
    preparationTime: 18,
    calories: null,
    categoryId: CATEGORY_IDS.BURGERS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Chicken', price: 12, isRequired: false, maxSelections: 1 },
      { name: 'Extra Cheese', price: 6, isRequired: false, maxSelections: 2 },
      { name: 'Bacon', price: 10, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Loaded Mac and Cheese Bowl',
    slug: 'loaded-mac-cheese-bowl',
    description: 'Creamy mac and cheese bowl with your choice of protein',
    price: 38,
    imageUrl: 'images/loaded_mac_cheese_bowl.jpg',
    preparationTime: 20,
    calories: null,
    categoryId: CATEGORY_IDS.AMERICAN_CLASSICS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Chicken', price: 15, isRequired: false, maxSelections: 1 },
      { name: 'Extra Beef', price: 12, isRequired: false, maxSelections: 1 },
      { name: 'Bacon', price: 10, isRequired: false, maxSelections: 1 },
      { name: 'Extra Cheese', price: 8, isRequired: false, maxSelections: 2 }
    ]
  },
  {
    name: 'Spaghetti Bolognese',
    slug: 'spaghetti-bolognese',
    description: 'Classic Italian spaghetti with rich meat sauce',
    price: 40,
    imageUrl: 'images/spaghetti_bolognese.jpg',
    preparationTime: 25,
    calories: null,
    categoryId: CATEGORY_IDS.AMERICAN_CLASSICS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Meat Sauce', price: 8, isRequired: false, maxSelections: 1 },
      { name: 'Extra Cheese', price: 8, isRequired: false, maxSelections: 2 },
      { name: 'Garlic Bread', price: 10, isRequired: false, maxSelections: 2 }
    ]
  },
  {
    name: 'Creamy Chicken Fettuccine Alfredo',
    slug: 'creamy-chicken-fettuccine-alfredo',
    description: 'Creamy alfredo sauce with chicken and fettuccine pasta',
    price: 42,
    imageUrl: 'images/creamy_chicken_fettuccine_alfredo.jpg',
    preparationTime: 25,
    calories: null,
    categoryId: CATEGORY_IDS.AMERICAN_CLASSICS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Chicken', price: 15, isRequired: false, maxSelections: 1 },
      { name: 'Extra Cheese', price: 8, isRequired: false, maxSelections: 2 },
      { name: 'Bacon', price: 10, isRequired: false, maxSelections: 1 },
      { name: 'Garlic Bread', price: 10, isRequired: false, maxSelections: 2 }
    ]
  },
  {
    name: 'Assorted Chicken Fried Rice — Classic',
    slug: 'assorted-chicken-fried-rice',
    description: 'Classic fried rice with mixed vegetables and chicken',
    price: 35,
    imageUrl: 'images/assorted_chicken_fried_rice.jpg',
    preparationTime: 18,
    calories: null,
    categoryId: CATEGORY_IDS.FRIED_RICE,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Chicken', price: 12, isRequired: false, maxSelections: 1 },
      { name: 'Extra Egg', price: 3, isRequired: false, maxSelections: 2 },
      { name: 'Extra Vegetables', price: 5, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Pork Fried Rice',
    slug: 'pork-fried-rice',
    description: 'Fried rice with seasoned pork and vegetables',
    price: 38,
    imageUrl: 'images/pork_fried_rice.jpg',
    preparationTime: 18,
    calories: null,
    categoryId: CATEGORY_IDS.FRIED_RICE,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Pork', price: 12, isRequired: false, maxSelections: 1 },
      { name: 'Extra Egg', price: 3, isRequired: false, maxSelections: 2 },
      { name: 'Extra Vegetables', price: 5, isRequired: false, maxSelections: 1 },
      { name: 'Soy Sauce', price: 2, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'French Toast, Maple Syrup and Buttery Eggs',
    slug: 'french-toast-maple-syrup-eggs',
    description: 'Golden French toast with maple syrup and scrambled eggs',
    price: 42,
    imageUrl: 'images/french_toast.jpg',
    preparationTime: 20,
    calories: null,
    categoryId: CATEGORY_IDS.BREAKFAST,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Eggs', price: 5, isRequired: false, maxSelections: 2 },
      { name: 'Bacon', price: 8, isRequired: false, maxSelections: 1 },
      { name: 'Sausage', price: 8, isRequired: false, maxSelections: 1 },
      { name: 'Extra Syrup', price: 3, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'American Pancakes and Eggs',
    slug: 'american-pancakes-eggs',
    description: 'Fluffy American pancakes with scrambled eggs and syrup',
    price: 40,
    imageUrl: 'images/american_pancakes.jpg',
    preparationTime: 20,
    calories: null,
    categoryId: CATEGORY_IDS.BREAKFAST,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Pancakes (2 pcs)', price: 8, isRequired: false, maxSelections: 2 },
      { name: 'Extra Eggs', price: 5, isRequired: false, maxSelections: 2 },
      { name: 'Bacon', price: 8, isRequired: false, maxSelections: 1 },
      { name: 'Sausage', price: 8, isRequired: false, maxSelections: 1 },
      { name: 'Extra Syrup', price: 3, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Red Velvet Cake',
    slug: 'red-velvet-cake',
    description: 'Classic red velvet cake with creamy frosting',
    price: 35,
    imageUrl: 'images/red_velvet_cake.jpg',
    preparationTime: 5,
    calories: null,
    categoryId: CATEGORY_IDS.CAKES_DESSERTS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Cream Cheese Frosting Extra', price: 5, isRequired: false, maxSelections: 1 },
      { name: 'Whipped Cream', price: 5, isRequired: false, maxSelections: 1 },
      { name: 'Chocolate Syrup', price: 3, isRequired: false, maxSelections: 1 }
    ]
  },
  {
    name: 'Sunkissed Strawberry Mango Smoothie',
    slug: 'sunkissed-strawberry-mango-smoothie',
    description: 'Refreshing blend of sweet strawberries and tropical mango',
    price: 28,
    imageUrl: 'images/sunkissed_strawberry_mango_smoothie.jpg',
    preparationTime: 6,
    calories: null,
    categoryId: CATEGORY_IDS.SMOOTHIES_REFRESHERS,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    addOns: [
      { name: 'Extra Strawberry', price: 6, isRequired: false, maxSelections: 1 },
      { name: 'Extra Mango', price: 6, isRequired: false, maxSelections: 1 },
      { name: 'Whipped Cream', price: 5, isRequired: false, maxSelections: 1 },
      { name: 'Protein Boost', price: 8, isRequired: false, maxSelections: 1 }
    ]
  },
];

async function validateProductData() {
  console.log('=== VALIDATING PRODUCT DATA ===\n');
  
  const errors = [];
  
  for (const product of NEW_PRODUCTS) {
    console.log(`Validating: ${product.name}`);

    // Check for placeholder values
    if (typeof product.price !== 'number' || product.price <= 0) {
      errors.push(`${product.name}: Price is missing or invalid`);
    }

    if (!product.description || product.description.trim() === '') {
      errors.push(`${product.name}: Description is missing or invalid`);
    }

    if (typeof product.preparationTime !== 'number' || product.preparationTime < 1) {
      errors.push(`${product.name}: Preparation time is missing or invalid`);
    }

    if (!product.imageUrl || product.imageUrl.trim() === '') {
      errors.push(`${product.name}: Image URL is missing or invalid`);
    }

    // Validate calories if provided
    if (product.calories !== null && product.calories !== undefined) {
      const parsedCalories = parseInt(product.calories);
      if (isNaN(parsedCalories) || parsedCalories < 0) {
        errors.push(`${product.name}: Calories must be a non-negative integer`);
      }
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(product.slug)) {
      errors.push(`${product.name}: Slug must be lowercase with hyphens only`);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n❌ VALIDATION FAILED:');
    errors.forEach(error => console.log(`   - ${error}`));
    throw new Error('Product data validation failed. Please provide all required fields.');
  }
  
  console.log('   ✓ All product data is valid');
}

async function getNextDisplayOrder(categoryId: string): Promise<number> {
  const categoryProducts = await prisma.menuItem.findMany({
    where: {
      categoryId: categoryId,
      isDeleted: false
    },
    select: {
      displayOrder: true
    },
    orderBy: {
      displayOrder: 'desc'
    },
    take: 1
  });
  
  if (categoryProducts.length === 0) {
    return 1;
  }
  
  return categoryProducts[0].displayOrder + 1;
}

async function insertPhase2BProducts() {
  console.log('=== PHASE 2B - INSERT NEW PRODUCTS ===\n');

  try {
    // Step 1: Validate all data BEFORE opening transaction
    await validateProductData();
    
    // Step 2: Validate no duplicate slugs
    console.log('\n2. Validating no duplicate slugs...');
    
    const existingSlugs = await prisma.menuItem.findMany({
      where: {
        slug: { in: NEW_PRODUCTS.map(p => p.slug) }
      },
      select: { slug: true }
    });
    
    if (existingSlugs.length > 0) {
      throw new Error(`Duplicate slugs found: ${existingSlugs.map(s => s.slug).join(', ')}`);
    }
    
    console.log('   ✓ No duplicate slugs found');
    
    // Step 3: Validate category IDs
    console.log('\n3. Validating category IDs...');
    
    const categoryIds = Object.values(CATEGORY_IDS);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    });
    
    if (categories.length !== categoryIds.length) {
      throw new Error('Some category IDs are invalid');
    }
    
    console.log('   ✓ All category IDs valid');
    
    // Step 4: Calculate displayOrder for each product
    console.log('\n4. Calculating displayOrder values...');
    
    // Group products by category
    const productsByCategory = new Map();
    for (const product of NEW_PRODUCTS) {
      if (!productsByCategory.has(product.categoryId)) {
        productsByCategory.set(product.categoryId, []);
      }
      productsByCategory.get(product.categoryId).push(product);
    }
    
    const productsWithOrder: any[] = [];

    for (const [categoryId, categoryProducts] of productsByCategory.entries()) {
      const nextDisplayOrder = await getNextDisplayOrder(categoryId);

      // Assign sequential displayOrder to products in this category
      categoryProducts.forEach((product: any, index: number) => {
        const calculatedDisplayOrder = nextDisplayOrder + index;
        productsWithOrder.push({
          ...product,
          displayOrder: calculatedDisplayOrder
        });
        console.log(`   ${product.name}: displayOrder = ${calculatedDisplayOrder}`);
      });
    }
    
    // Step 5: Begin transaction
    console.log('\n5. Beginning transaction...');
    
    await prisma.$transaction(async (tx) => {
      console.log('   Inserting new products...');
      
      for (const product of productsWithOrder) {
        console.log(`   Inserting: ${product.name}`);
        
        const { addOns, price, ...productData } = product;
        
        // Parse price (should already be validated)
        const priceValue = parseFloat(price);
        
        const menuItem = await tx.menuItem.create({
          data: {
            ...productData,
            price: new Prisma.Decimal(priceValue),
            addOns: addOns && addOns.length > 0
              ? {
                  create: addOns.map((addOn: any) => ({
                    name: addOn.name,
                    price: new Prisma.Decimal(addOn.price),
                    isRequired: addOn.isRequired || false,
                    maxSelections: addOn.maxSelections || 1,
                  }))
                }
              : undefined
          },
          include: {
            category: true,
            addOns: true
          }
        });
        
        console.log(`   ✓ Created: ${menuItem.name} (ID: ${menuItem.id})`);
      }
      
      console.log('\n✅ All products inserted successfully');
    });
    
    console.log('\n✅ Transaction committed successfully');
    
  } catch (error) {
    console.error('❌ Error during Phase 2B:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

insertPhase2BProducts().catch(console.error);
