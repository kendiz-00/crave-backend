import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function phase2AMenuReorganization() {
  console.log('=== PHASE 2A - MENU REORGANIZATION (EXISTING PRODUCTS ONLY) ===\n');
  
  try {
    await prisma.$transaction(async (tx) => {
      console.log('1. Creating new categories...');
      
      // Create Burgers category
      const burgersCategory = await tx.category.create({
        data: {
          name: 'Burgers',
          slug: 'burgers',
          description: 'Delicious burgers with premium toppings',
          sortOrder: 3,
          isActive: true
        }
      });
      console.log(`   Created Burgers category: ${burgersCategory.id}`);
      
      // Create Fried Rice category
      const friedRiceCategory = await tx.category.create({
        data: {
          name: 'Fried Rice',
          slug: 'fried-rice',
          description: 'Authentic fried rice dishes',
          sortOrder: 7,
          isActive: true
        }
      });
      console.log(`   Created Fried Rice category: ${friedRiceCategory.id}`);
      
      // Create Breakfast category
      const breakfastCategory = await tx.category.create({
        data: {
          name: 'Breakfast',
          slug: 'breakfast',
          description: 'Start your day with our delicious breakfast items',
          sortOrder: 8,
          isActive: true
        }
      });
      console.log(`   Created Breakfast category: ${breakfastCategory.id}`);
      
      console.log('\n2. Renaming existing categories...');
      
      // Rename Texas Crispy Chicken → Chicken & Wings
      const texasChicken = await tx.category.findUnique({
        where: { slug: 'texas-crispy-chicken' }
      });
      if (texasChicken) {
        await tx.category.update({
          where: { id: texasChicken.id },
          data: {
            name: 'Chicken & Wings',
            slug: 'chicken-wings',
            description: 'Crispy chicken and wings with Texas-style flavors',
            sortOrder: 2
          }
        });
        console.log(`   Renamed Texas Crispy Chicken → Chicken & Wings`);
      }
      
      // Rename Sides → Sandwiches
      const sides = await tx.category.findUnique({
        where: { slug: 'sides' }
      });
      if (sides) {
        await tx.category.update({
          where: { id: sides.id },
          data: {
            name: 'Sandwiches',
            slug: 'sandwiches',
            description: 'Classic sandwiches and deli favorites',
            sortOrder: 4
          }
        });
        console.log(`   Renamed Sides → Sandwiches`);
      }
      
      // Rename Cake & Shakes → American Classics
      const cakeShakes = await tx.category.findUnique({
        where: { slug: 'cake-shakes' }
      });
      if (cakeShakes) {
        await tx.category.update({
          where: { id: cakeShakes.id },
          data: {
            name: 'American Classics',
            slug: 'american-classics',
            description: 'Classic American comfort food favorites',
            sortOrder: 5
          }
        });
        console.log(`   Renamed Cake & Shakes → American Classics`);
      }
      
      // Rename Jamaican Kitchen → Mexican Food
      const jamaican = await tx.category.findUnique({
        where: { slug: 'jamaican-kitchen' }
      });
      if (jamaican) {
        await tx.category.update({
          where: { id: jamaican.id },
          data: {
            name: 'Mexican Food',
            slug: 'mexican-food',
            description: 'Authentic Mexican flavors with a CRAVE twist',
            sortOrder: 6
          }
        });
        console.log(`   Renamed Jamaican Kitchen → Mexican Food`);
      }
      
      // Rename Cupcakes → Cakes & Desserts
      const cupcakes = await tx.category.findUnique({
        where: { slug: 'cupcakes' }
      });
      if (cupcakes) {
        await tx.category.update({
          where: { id: cupcakes.id },
          data: {
            name: 'Cakes & Desserts',
            slug: 'cakes-desserts',
            description: 'Sweet treats and decadent desserts',
            sortOrder: 9
          }
        });
        console.log(`   Renamed Cupcakes → Cakes & Desserts`);
      }
      
      // Merge Smoothies + Milkshakes → Smoothies & Refreshers
      const smoothies = await tx.category.findUnique({
        where: { slug: 'smoothies' }
      });
      const milkshakes = await tx.category.findUnique({
        where: { slug: 'milkshakes' }
      });
      
      if (smoothies && milkshakes) {
        // Rename Smoothies to Smoothies & Refreshers
        await tx.category.update({
          where: { id: smoothies.id },
          data: {
            name: 'Smoothies & Refreshers',
            slug: 'smoothies-refreshers',
            description: 'Refreshing blends and fruit drinks',
            sortOrder: 10
          }
        });
        console.log(`   Renamed Smoothies → Smoothies & Refreshers`);
        
        // Move all milkshake items to Smoothies & Refreshers
        const milkshakeItems = await tx.menuItem.findMany({
          where: { categoryId: milkshakes.id }
        });
        
        for (const item of milkshakeItems) {
          await tx.menuItem.update({
            where: { id: item.id },
            data: { categoryId: smoothies.id }
          });
        }
        console.log(`   Moved ${milkshakeItems.length} milkshake items to Smoothies & Refreshers`);
        
        // Deactivate Milkshakes category
        await tx.category.update({
          where: { id: milkshakes.id },
          data: { isActive: false }
        });
        console.log(`   Deactivated Milkshakes category`);
      }
      
      console.log('\n3. Reassigning menu items to new categories...');
      
      // Reassign burgers to Burgers category
      const burgerItems = await tx.menuItem.findMany({
        where: {
          slug: {
            in: ['ultimate-bacon-cheddar-burger', 'melted-cheddar-burger']
          }
        }
      });
      
      for (const item of burgerItems) {
        await tx.menuItem.update({
          where: { id: item.id },
          data: { categoryId: burgersCategory.id }
        });
      }
      console.log(`   Moved ${burgerItems.length} burger items to Burgers category`);
      
      // Reassign breakfast items to Breakfast category
      const breakfastItems = await tx.menuItem.findMany({
        where: {
          slug: {
            in: ['loaded-omelette', 'chicken-waffles']
          }
        }
      });
      
      for (const item of breakfastItems) {
        await tx.menuItem.update({
          where: { id: item.id },
          data: { categoryId: breakfastCategory.id }
        });
      }
      console.log(`   Moved ${breakfastItems.length} breakfast items to Breakfast category`);
      
      // Get current Sandwiches category (renamed from Sides)
      const sandwichesCategory = await tx.category.findUnique({
        where: { slug: 'sandwiches' }
      });
      
      if (sandwichesCategory) {
        // Ensure sandwich items are in the right category
        const sandwichItems = await tx.menuItem.findMany({
          where: {
            slug: {
              in: ['tuna-fish-sandwich', 'grilled-cheese-sandwich', 'american-blt']
            }
          }
        });
        
        for (const item of sandwichItems) {
          await tx.menuItem.update({
            where: { id: item.id },
            data: { categoryId: sandwichesCategory.id }
          });
        }
        console.log(`   Ensured ${sandwichItems.length} sandwich items are in Sandwiches category`);
      }
      
      console.log('\n4. Renaming smoothie products (marketing name updates)...');
      
      const smoothieRenames = {
        'strawberry-colada': 'Strawberry Colada Blast Smoothie',
        'pina-colada': 'Sexy Pina Colada',
        'watermelon-mint-ice': 'Water Mint Ice Slushie',
        'tropical-fruit-blend': 'Exotic Tropical Fruit Blend Smoothie',
        'pineapple-strawberry': 'Strawberry Pineapple Tang Smoothie'
      };
      
      for (const [oldSlug, newName] of Object.entries(smoothieRenames)) {
        const item = await tx.menuItem.findUnique({
          where: { slug: oldSlug }
        });
        
        if (item) {
          const newSlug = oldSlug.replace('strawberry-colada', 'strawberry-colada-blast')
            .replace('pina-colada', 'sexy-pina-colada')
            .replace('watermelon-mint-ice', 'water-mint-ice-slushie')
            .replace('tropical-fruit-blend', 'exotic-tropical-fruit-blend')
            .replace('pineapple-strawberry', 'strawberry-pineapple-tang');
          
          await tx.menuItem.update({
            where: { id: item.id },
            data: {
              name: newName,
              slug: newSlug
            }
          });
          console.log(`   Renamed: ${item.name} → ${newName}`);
        }
      }
      
      console.log('\n5. Updating Loaded Fries sortOrder...');
      await tx.category.update({
        where: { slug: 'loaded-fries' },
        data: { sortOrder: 1 }
      });
      console.log(`   Loaded Fries sortOrder set to 1`);
      
      console.log('\n✅ PHASE 2A COMPLETE');
      console.log('   - Categories renamed');
      console.log('   - New categories created');
      console.log('   - Menu items reassigned');
      console.log('   - Smoothie products renamed');
      console.log('   - SortOrder updated');
    });
    
    console.log('\n✅ Transaction committed successfully');
    
  } catch (error) {
    console.error('❌ Error during Phase 2A:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

phase2AMenuReorganization().catch(console.error);
