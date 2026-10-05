import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPhase2A() {
  try {
    console.log('=== PHASE 2A VERIFICATION ===\n');
    console.log('DATABASE_HOST:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'HIDDEN');
    console.log('DATABASE_NAME:', process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || 'HIDDEN');

    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true, isActive: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' }
    });

    const products = await prisma.menuItem.count({ where: { isDeleted: false } });

    console.log(`\nTotal Categories: ${categories.length}`);
    console.log(`Total Products: ${products}`);

    console.log('\nCategory Map:');
    console.log('Name | Slug | ID | Active | SortOrder');
    console.log('---|---|---|---|---');
    categories.forEach(c => {
      console.log(`${c.name} | ${c.slug} | ${c.id} | ${c.isActive} | ${c.sortOrder}`);
    });

    // Verify Phase 2A changes
    console.log('\n=== PHASE 2A CHANGE VERIFICATION ===\n');

    const newCategories = ['burgers', 'fried-rice', 'breakfast'];
    const renamedCategories = [
      { old: 'texas-crispy-chicken', new: 'chicken-wings' },
      { old: 'sides', new: 'sandwiches' },
      { old: 'cake-shakes', new: 'american-classics' },
      { old: 'jamaican-kitchen', new: 'mexican-food' },
      { old: 'cupcakes', new: 'cakes-desserts' },
      { old: 'smoothies', new: 'smoothies-refreshers' }
    ];

    const existingSlugs = categories.map(c => c.slug);

    console.log('New Categories (should exist):');
    newCategories.forEach(slug => {
      const exists = existingSlugs.includes(slug);
      console.log(`  ${slug}: ${exists ? '✓ EXISTS' : '✗ MISSING'}`);
    });

    console.log('\nRenamed Categories (should have new slugs):');
    renamedCategories.forEach(({ old, new: newSlug }) => {
      const oldExists = existingSlugs.includes(old);
      const newExists = existingSlugs.includes(newSlug);
      console.log(`  ${old} → ${newSlug}: ${!oldExists && newExists ? '✓ RENAMED' : '✗ ISSUE'}`);
    });

    const milkshakes = categories.find(c => c.slug === 'milkshakes');
    console.log(`\nMilkshakes inactive: ${milkshakes?.isActive === false ? '✓ INACTIVE' : '✗ STILL ACTIVE'}`);

    const loadedFries = categories.find(c => c.slug === 'loaded-fries');
    console.log(`Loaded Fries sortOrder = 1: ${loadedFries?.sortOrder === 1 ? '✓ CORRECT' : '✗ INCORRECT'}`);

    // Verify smoothie renames
    console.log('\nSmoothie Product Renames:');
    const smoothieRenames = {
      'strawberry-colada-blast': 'Strawberry Colada Blast Smoothie',
      'sexy-pina-colada': 'Sexy Pina Colada',
      'water-mint-ice-slushie': 'Water Mint Ice Slushie',
      'exotic-tropical-fruit-blend': 'Exotic Tropical Fruit Blend Smoothie',
      'strawberry-pineapple-tang': 'Strawberry Pineapple Tang Smoothie'
    };

    for (const [slug, expectedName] of Object.entries(smoothieRenames)) {
      const product = await prisma.menuItem.findUnique({
        where: { slug },
        select: { name: true }
      });
      console.log(`  ${slug}: ${product?.name === expectedName ? '✓ RENAMED' : '✗ NOT RENAMED'}`);
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyPhase2A();
