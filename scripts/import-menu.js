'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '..', 'crave-frontend');
const CANONICAL_FILE = 'production-menu-api.json';
const COMPARISON_FILE = 'current-menu.json';
const PRICE_MAP_FILE = 'map-product-prices.ts';
const IMAGE_MANIFEST_FILE = 'recovery-image-manifest.json';
const EXPECTED = Object.freeze({ products: 56, categories: 11, visibleProducts: 54, addOns: 114 });

class ImporterSafetyError extends Error {}

const VERIFIED_IMAGE_PATHS = Object.freeze({
  'Sexy Pina Colada': 'images/pina_colada.jpg',
  "Bailey's Irish Cream Jar Cake": 'images/bailey.jpg',
  'Biscoff Jar Cake': 'images/biscoff.jpg',
  'Coffee Latte Jar Cake': 'images/coffe_latte.jpg',
  'Lemon Buttercream Jar Cake': 'images/lemon.jpg',
  'Pink Guava Buttercream Jar Cake': 'images/guava.jpg',
  'Pistachio Dream Jar Cake': 'images/pistachio.jpg',
  'Salted Caramel Cake': 'images/salted_caramel.jpg',
  'Vanilla Buttercream Cake Slice': 'images/vanilla.jpg',
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parsePriceMap(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const objectStart = source.indexOf('const targetProducts = {');
  const objectEnd = objectStart < 0 ? -1 : source.indexOf('\n  };', objectStart);
  if (objectStart < 0 || objectEnd < 0) {
    throw new Error(`${PRICE_MAP_FILE} does not contain the expected targetProducts object.`);
  }

  const prices = new Map();
  const objectText = source.slice(objectStart + 'const targetProducts = {'.length, objectEnd);
  for (const line of objectText.split(/\r?\n/)) {
    const property = line.match(/^\s*(['"])((?:\\.|[^'"])*)\1\s*:\s*(-?\d+(?:\.\d+)?)\s*,?\s*$/);
    if (!property) continue;
    const key = property[2].replace(/\\(['"\\])/g, '$1');
    const value = Number(property[3]);
    if (!Number.isFinite(value)) {
      throw new Error(`${PRICE_MAP_FILE} has a non-numeric price for ${key}.`);
    }
    if (prices.has(key)) {
      throw new Error(`${PRICE_MAP_FILE} contains a duplicate product name: ${key}.`);
    }
    prices.set(key, value);
  }
  return prices;
}

function safeImagePath(product) {
  return VERIFIED_IMAGE_PATHS[product.name] || product.imageUrl;
}

function isSafeImagePath(imagePath) {
  return typeof imagePath === 'string' &&
    imagePath.startsWith('images/') &&
    !imagePath.includes('\\') &&
    !imagePath.split('/').some((segment) => !segment || segment === '.' || segment === '..') &&
    path.posix.normalize(imagePath) === imagePath;
}

function compareAddOns(left, right) {
  const leftMap = new Map();
  const rightMap = new Map();
  for (const product of left) {
    for (const addOn of product.addOns || []) leftMap.set(addOn.id, { slug: product.slug, ...addOn });
  }
  for (const product of right) {
    for (const addOn of product.addOns || []) rightMap.set(addOn.id, { slug: product.slug, ...addOn });
  }

  if (leftMap.size !== rightMap.size) return false;
  for (const [id, item] of leftMap) {
    const other = rightMap.get(id);
    if (!other ||
        item.slug !== other.slug ||
        item.name !== other.name ||
        Number(item.price) !== Number(other.price) ||
        item.isRequired !== other.isRequired ||
        item.maxSelections !== other.maxSelections) return false;
  }
  return true;
}

function validateSources(root = BACKEND_ROOT) {
  const errors = [];
  const warnings = [];
  const canonical = readJson(path.join(root, CANONICAL_FILE));
  const comparison = readJson(path.join(root, COMPARISON_FILE));
  const priceMap = parsePriceMap(path.join(root, PRICE_MAP_FILE));
  const imageManifest = readJson(path.join(root, IMAGE_MANIFEST_FILE));
  const products = canonical?.data;
  const comparedProducts = comparison?.data;
  const imageEntries = imageManifest?.products;

  if (canonical?.success !== true || !Array.isArray(products)) {
    errors.push(`${CANONICAL_FILE} must contain a successful API response with a data array.`);
  }
  if (comparison?.success !== true || !Array.isArray(comparedProducts)) {
    errors.push(`${COMPARISON_FILE} must contain a successful API response with a data array.`);
  }
  if (imageManifest?.formatVersion !== 1 || !Array.isArray(imageEntries)) {
    errors.push(`${IMAGE_MANIFEST_FILE} must contain version 1 and a products array.`);
  }
  if (!Array.isArray(products) || !Array.isArray(comparedProducts) || !Array.isArray(imageEntries)) {
    return { errors, warnings, products: [], categories: [], priceDifferences: [], counts: {} };
  }

  const productSlugs = new Set();
  const categoryBySlug = new Map();
  const addonIds = new Set();
  const imageBySlug = new Map();
  const visibleProducts = [];
  let addonCount = 0;
  const normalizedProducts = [];

  for (const entry of imageEntries) {
    if (!entry || typeof entry !== 'object' || typeof entry.slug !== 'string' || !entry.slug ||
        imageBySlug.has(entry.slug) || !isSafeImagePath(entry.imageUrl) ||
        typeof entry.assetPresent !== 'boolean') {
      errors.push(`${IMAGE_MANIFEST_FILE} contains an invalid, duplicate, or unsafe image record.`);
      continue;
    }
    imageBySlug.set(entry.slug, entry);
  }
  if (imageBySlug.size !== EXPECTED.products) {
    errors.push(`${IMAGE_MANIFEST_FILE} must contain exactly ${EXPECTED.products} unique product image records.`);
  }

  for (const product of products) {
    if (!product || typeof product !== 'object') {
      errors.push('Canonical snapshot contains a non-object product.');
      continue;
    }
    if (!product.slug || productSlugs.has(product.slug)) {
      errors.push(`Missing or duplicate product slug: ${product.slug || '(empty)'}.`);
    }
    productSlugs.add(product.slug);

    if (!product.category?.id || !product.category?.name || !product.category?.slug) {
      errors.push(`Product ${product.slug || '(missing slug)'} has an incomplete category mapping.`);
    } else {
      if (product.categoryId !== product.category.id) {
        errors.push(`Product ${product.slug} has conflicting categoryId and nested category IDs.`);
      }
      const identity = `${product.category.id}|${product.category.name}`;
      const prior = categoryBySlug.get(product.category.slug);
      if (prior && prior !== identity) {
        errors.push(`Category slug ${product.category.slug} maps to conflicting category identities.`);
      }
      for (const [slug, existing] of categoryBySlug) {
        if (slug !== product.category.slug && existing.startsWith(`${product.category.id}|`)) {
          errors.push(`Category ID ${product.category.id} maps to more than one slug.`);
        }
      }
      categoryBySlug.set(product.category.slug, identity);
    }

    if (typeof product.isAvailable !== 'boolean' || typeof product.isDeleted !== 'boolean') {
      errors.push(`Product ${product.slug} is missing explicit availability/deletion flags.`);
    }
    const visible = product.isAvailable === true && product.isDeleted === false &&
      product.category?.slug !== 'extras';
    if (visible) visibleProducts.push(product);

    const priceText = String(product.price);
    if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(Number(priceText)) || Number(priceText) < 0) {
      errors.push(`Product ${product.slug} has an invalid price value.`);
    }

    const imagePath = safeImagePath(product);
    const imageEntry = imageBySlug.get(product.slug);
    if (!isSafeImagePath(imagePath)) {
      errors.push(`Product ${product.slug} has an unsafe or invalid image path.`);
    }
    if (!imageEntry || imageEntry.imageUrl !== imagePath) {
      errors.push(`Product ${product.slug} image path does not match ${IMAGE_MANIFEST_FILE}.`);
    } else if (!imageEntry.assetPresent) {
      if (!visible) {
        warnings.push(`Hidden product ${product.slug} has no local image asset at ${imagePath}.`);
      } else {
        errors.push(`Visible product ${product.slug} has no verified image asset at ${imagePath}.`);
      }
    }

    if (!Array.isArray(product.addOns)) {
      errors.push(`Product ${product.slug} has no addOns array.`);
    } else {
      for (const addOn of product.addOns) {
        addonCount += 1;
        if (!addOn?.id || addonIds.has(addOn.id)) {
          errors.push(`Missing or duplicate add-on ID: ${addOn?.id || '(empty)'}.`);
        }
        addonIds.add(addOn?.id);
        if (!addOn?.name || !/^\d+(?:\.\d{1,2})?$/.test(String(addOn.price)) ||
            !Number.isInteger(addOn.maxSelections) || addOn.maxSelections < 1 ||
            typeof addOn.isRequired !== 'boolean') {
          errors.push(`Product ${product.slug} has an invalid add-on record.`);
        }
      }
    }

    normalizedProducts.push({
      ...product,
      imageUrl: imagePath,
    });
  }
  if (products.some((product) => !imageBySlug.has(product.slug)) ||
      [...imageBySlug.keys()].some((slug) => !productSlugs.has(slug))) {
    errors.push(`${IMAGE_MANIFEST_FILE} product slugs do not match ${CANONICAL_FILE}.`);
  }

  const comparedBySlug = new Map(comparedProducts.map((product) => [product.slug, product]));
  const priceDifferences = [];
  if (comparedBySlug.size !== comparedProducts.length) {
    errors.push(`${COMPARISON_FILE} contains duplicate product slugs.`);
  }
  if (productSlugs.size !== comparedBySlug.size ||
      [...productSlugs].some((slug) => !comparedBySlug.has(slug))) {
    errors.push(`The full product sets in ${CANONICAL_FILE} and ${COMPARISON_FILE} differ.`);
  } else {
    for (const product of normalizedProducts) {
      const prior = comparedBySlug.get(product.slug);
      const original = products.find((candidate) => candidate.slug === product.slug);
      if (!prior || !original) {
        errors.push(`Source records cannot be matched by slug for ${product.slug}.`);
        continue;
      }
      const sourceFields = [
        'id',
        'sku',
        'name',
        'description',
        'imageUrl',
        'preparationTime',
        'calories',
        'categoryId',
        'isAvailable',
        'isFeatured',
        'isDeleted',
        'sortOrder',
        'displayOrder',
      ];
      const hasNonPriceDifference = sourceFields.some((field) =>
        (original[field] ?? null) !== (prior[field] ?? null)
      ) || original.category?.id !== prior.category?.id ||
        original.category?.name !== prior.category?.name ||
        original.category?.slug !== prior.category?.slug;
      if (hasNonPriceDifference) {
        errors.push(`Non-price product data conflicts for ${product.slug}.`);
      }
      if (Number(product.price) !== Number(prior.price)) {
        priceDifferences.push({
          slug: product.slug,
          name: product.name,
          currentPrice: String(prior.price),
          proposedPrice: String(product.price),
        });
      }
    }
    if (!compareAddOns(normalizedProducts, comparedProducts)) {
      errors.push(`Add-on IDs, values, or product associations differ between the full snapshots.`);
    }
  }

  let priceMapMatches = 0;
  for (const product of normalizedProducts) {
    if (product.category?.slug === 'extras') continue;
    const mapped = priceMap.get(product.name);
    if (mapped === undefined || mapped !== Number(product.price)) {
      errors.push(`Price map does not corroborate the proposed price for ${product.name}.`);
    } else {
      priceMapMatches += 1;
    }
  }
  if ([...priceMap.keys()].length !== EXPECTED.visibleProducts) {
    errors.push(`${PRICE_MAP_FILE} should contain ${EXPECTED.visibleProducts} visible-product prices.`);
  }

  const categories = [...categoryBySlug.entries()].map(([slug, identity]) => {
    const [id, name] = identity.split('|');
    return { id, name, slug };
  });
  const counts = {
    products: normalizedProducts.length,
    categories: categories.length,
    visibleProducts: visibleProducts.length,
    hiddenProducts: normalizedProducts.length - visibleProducts.length,
    addOns: addonCount,
    priceDifferences: priceDifferences.length,
    priceMapMatches,
  };

  if (canonical?.pagination?.total !== EXPECTED.products ||
      canonical?.pagination?.limit < EXPECTED.products) {
    errors.push(`${CANONICAL_FILE} pagination does not certify all ${EXPECTED.products} products.`);
  }
  if (counts.products !== EXPECTED.products || counts.categories !== EXPECTED.categories ||
      counts.visibleProducts !== EXPECTED.visibleProducts || counts.addOns !== EXPECTED.addOns) {
    errors.push(`Menu counts do not match the expected recovery inventory.`);
  }
  if (priceDifferences.length !== EXPECTED.visibleProducts) {
    errors.push(`Expected ${EXPECTED.visibleProducts} differing visible-product prices; found ${priceDifferences.length}.`);
  }

  return { errors, warnings, products: normalizedProducts, categories, priceDifferences, counts };
}

function parseArgs(args) {
  const parsed = {
    dryRun: false,
    apply: false,
    approvePriceDifferences: false,
    confirmEmptyTarget: false,
    targetName: null,
    targetHost: null,
    postgresMajor: null,
  };
  for (const arg of args) {
    if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--apply') parsed.apply = true;
    else if (arg === '--approve-price-differences') parsed.approvePriceDifferences = true;
    else if (arg === '--confirm-empty-target') parsed.confirmEmptyTarget = true;
    else if (arg.startsWith('--confirm-target-name=')) parsed.targetName = arg.slice('--confirm-target-name='.length);
    else if (arg.startsWith('--confirm-target-host=')) parsed.targetHost = arg.slice('--confirm-target-host='.length).toLowerCase();
    else if (arg.startsWith('--confirm-target-postgres-major=')) parsed.postgresMajor = Number(arg.slice('--confirm-target-postgres-major='.length));
    else throw new Error(`Unknown importer option: ${arg}`);
  }
  if (parsed.apply && parsed.dryRun) {
    throw new Error('--dry-run cannot be combined with --apply.');
  }
  if (parsed.apply && (!parsed.approvePriceDifferences || !parsed.confirmEmptyTarget ||
      !parsed.targetName || !parsed.targetHost || !Number.isInteger(parsed.postgresMajor))) {
    throw new Error(
      'Writes require explicit price approval, empty-target confirmation, target database name, target hostname, and PostgreSQL major version.'
    );
  }
  if (!parsed.apply && (parsed.approvePriceDifferences || parsed.confirmEmptyTarget || parsed.targetName ||
      parsed.targetHost || parsed.postgresMajor !== null)) {
    throw new Error('Approval and target-confirmation flags are only valid together with --apply.');
  }
  if (parsed.postgresMajor !== null && parsed.postgresMajor < 10) {
    throw new Error('The confirmed PostgreSQL major version is invalid.');
  }
  return parsed;
}

function getDatabaseName(databaseUrl) {
  return getDatabaseIdentityFromUrl(databaseUrl).databaseName;
}

function getDatabaseIdentityFromUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new ImporterSafetyError('DATABASE_URL must be a valid PostgreSQL URL before import.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new ImporterSafetyError('DATABASE_URL must use the PostgreSQL protocol.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] || '');
  const hostName = parsed.hostname.toLowerCase();
  if (!databaseName || !hostName || !parsed.username || !parsed.password) {
    throw new ImporterSafetyError('DATABASE_URL must identify a PostgreSQL database with host and credentials configured.');
  }
  return { databaseName, hostName };
}

function assertConfirmedTarget(connectionIdentity, options) {
  if (connectionIdentity.databaseName !== options.targetName) {
    throw new ImporterSafetyError('The confirmed target database name does not match DATABASE_URL.');
  }
  if (connectionIdentity.hostName !== options.targetHost.toLowerCase()) {
    throw new ImporterSafetyError('The confirmed target host does not match DATABASE_URL.');
  }
}

async function assertTransactionTargetIdentity(tx, expectedIdentity) {
  const rows = await tx.$queryRaw`
    SELECT
      current_database() AS database_name,
      inet_server_addr()::text AS server_address,
      current_setting('server_version_num') AS server_version_num
  `;
  const identity = Array.isArray(rows) ? rows[0] : null;
  if (!identity || typeof identity.database_name !== 'string' ||
      typeof identity.server_address !== 'string' || !identity.server_address ||
      typeof identity.server_version_num !== 'string') {
    throw new ImporterSafetyError('Database target identity is ambiguous; no menu data was changed.');
  }
  if (identity.database_name !== expectedIdentity.databaseName) {
    throw new ImporterSafetyError('Connected database identity does not match the confirmed target name.');
  }
  const serverMajor = Math.floor(Number(identity.server_version_num) / 10000);
  if (!Number.isInteger(serverMajor) || serverMajor !== expectedIdentity.postgresMajor) {
    throw new ImporterSafetyError('Connected PostgreSQL major version does not match the confirmed target version.');
  }
}

async function assertMenuTablesEmpty(tx) {
  await tx.$executeRaw`
    LOCK TABLE "Category", "MenuItem", "AddOn", "MenuImage"
    IN SHARE ROW EXCLUSIVE MODE
  `;
  const [categories, products, addOns, images] = await Promise.all([
    tx.category.count(),
    tx.menuItem.count(),
    tx.addOn.count(),
    tx.menuImage.count(),
  ]);
  if ([categories, products, addOns, images].some((count) => !Number.isInteger(count) || count !== 0)) {
    throw new ImporterSafetyError('Target menu tables are not empty or their state is ambiguous; no menu data was changed.');
  }
}

async function assertFreshTarget(tx, expectedIdentity) {
  await assertTransactionTargetIdentity(tx, expectedIdentity);
  await assertMenuTablesEmpty(tx);
}

async function importMenu(prisma, manifest, expectedIdentity) {
  await prisma.$transaction(async (tx) => {
    await assertFreshTarget(tx, expectedIdentity);

    const categoryIds = new Map();
    for (const category of manifest.categories) {
      const saved = await tx.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name },
        create: { id: category.id, name: category.name, slug: category.slug },
        select: { id: true },
      });
      categoryIds.set(category.slug, saved.id);
    }

    const menuItemIds = new Map();
    for (const source of manifest.products) {
      const { id, category, addOns, images, ...rest } = source;
      const data = {
        ...rest,
        categoryId: categoryIds.get(category.slug),
        price: String(source.price),
      };
      const saved = await tx.menuItem.upsert({
        where: { slug: source.slug },
        update: data,
        create: { id, ...data },
        select: { id: true },
      });
      menuItemIds.set(source.slug, saved.id);
    }

    for (const product of manifest.products) {
      for (const addOn of product.addOns) {
        const data = {
          menuItemId: menuItemIds.get(product.slug),
          name: addOn.name,
          price: String(addOn.price),
          isRequired: addOn.isRequired,
          maxSelections: addOn.maxSelections,
        };
        await tx.addOn.upsert({
          where: { id: addOn.id },
          update: data,
          create: { id: addOn.id, ...data },
        });
      }
    }

    const [categoryCount, productCount, addOnCount, imageCount, savedProducts] = await Promise.all([
      tx.category.count(),
      tx.menuItem.count(),
      tx.addOn.count(),
      tx.menuImage.count(),
      tx.menuItem.findMany({ include: { category: true, addOns: true } }),
    ]);
    if (categoryCount !== EXPECTED.categories || productCount !== EXPECTED.products ||
        addOnCount !== EXPECTED.addOns || imageCount !== 0 ||
        savedProducts.length !== EXPECTED.products) {
      throw new Error(
        `Post-import count verification failed (categories=${categoryCount}, products=${productCount}, addOns=${addOnCount}, images=${imageCount}).`
      );
    }

    const savedBySlug = new Map(savedProducts.map((product) => [product.slug, product]));
    for (const expected of manifest.products) {
      const saved = savedBySlug.get(expected.slug);
      const expectedAddOns = expected.addOns.map((addOn) => addOn.id).sort();
      const savedAddOns = (saved?.addOns || []).map((addOn) => addOn.id).sort();
      if (!saved || saved.name !== expected.name ||
          saved.description !== expected.description ||
          Number(saved.price) !== Number(expected.price) ||
          saved.imageUrl !== expected.imageUrl ||
          saved.sku !== expected.sku ||
          saved.preparationTime !== expected.preparationTime ||
          saved.calories !== expected.calories ||
          saved.category.slug !== expected.category.slug ||
          saved.isAvailable !== expected.isAvailable ||
          saved.isDeleted !== expected.isDeleted ||
          saved.isFeatured !== expected.isFeatured ||
          saved.sortOrder !== expected.sortOrder ||
          saved.displayOrder !== expected.displayOrder ||
          JSON.stringify(savedAddOns) !== JSON.stringify(expectedAddOns)) {
        throw new Error(`Post-import record verification failed for ${expected.slug}.`);
      }
      const expectedAddOnById = new Map(expected.addOns.map((addOn) => [addOn.id, addOn]));
      for (const savedAddOn of saved.addOns) {
        const sourceAddOn = expectedAddOnById.get(savedAddOn.id);
        if (!sourceAddOn ||
            savedAddOn.name !== sourceAddOn.name ||
            Number(savedAddOn.price) !== Number(sourceAddOn.price) ||
            savedAddOn.isRequired !== sourceAddOn.isRequired ||
            savedAddOn.maxSelections !== sourceAddOn.maxSelections) {
          throw new Error(`Post-import add-on verification failed for ${expected.slug}.`);
        }
      }
    }
  }, { isolationLevel: 'Serializable' });
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const report = validateSources();
  if (report.errors.length) {
    throw new Error(`Menu source validation failed:\n- ${report.errors.join('\n- ')}`);
  }

  console.log(JSON.stringify({
    mode: options.apply ? 'apply-requested' : 'dry-run',
    source: CANONICAL_FILE,
    comparison: COMPARISON_FILE,
    counts: report.counts,
    priceDifferences: report.priceDifferences,
    warnings: report.warnings,
    validation: 'PASS',
  }, null, 2));

  if (!options.apply) return;
  if (!options.approvePriceDifferences) throw new Error('Explicit approval of the 54 proposed price changes is required.');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL must be explicitly set for an approved import.');
  const connectionIdentity = getDatabaseIdentityFromUrl(databaseUrl);
  assertConfirmedTarget(connectionIdentity, options);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let operationError;
  try {
    await prisma.$connect();
    await importMenu(prisma, report, {
      databaseName: connectionIdentity.databaseName,
      postgresMajor: options.postgresMajor,
    });
    console.log('Menu import and post-import verification completed.');
  } catch (error) {
    operationError = error instanceof ImporterSafetyError
      ? error
      : new Error('Database connection or import failed; client diagnostics were suppressed to protect connection credentials.');
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      if (!operationError) {
        operationError = new Error('Database disconnect failed; client diagnostics were suppressed to protect connection credentials.');
      }
    }
  }
  if (operationError) throw operationError;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED,
  ImporterSafetyError,
  VERIFIED_IMAGE_PATHS,
  assertConfirmedTarget,
  assertFreshTarget,
  assertMenuTablesEmpty,
  assertTransactionTargetIdentity,
  getDatabaseIdentityFromUrl,
  getDatabaseName,
  importMenu,
  parseArgs,
  parsePriceMap,
  safeImagePath,
  validateSources,
};
