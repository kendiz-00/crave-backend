const importer = require('../../scripts/import-menu');

const EXPECTED_IDENTITY = { databaseName: 'crave_db_v2', postgresMajor: 18 };

type MockTable = { count: jest.Mock; upsert: jest.Mock };
type MockTransaction = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  category: MockTable;
  menuItem: MockTable & { findMany: jest.Mock };
  addOn: MockTable;
  menuImage: MockTable;
};

function createTargetTransaction(
  counts: { category: number | null; menuItem: number | null; addOn: number | null; menuImage: number | null } =
    { category: 0, menuItem: 0, addOn: 0, menuImage: 0 },
  identity: { database_name: string; server_address: string | null; server_version_num: string } = {
    database_name: 'crave_db_v2',
    server_address: '10.0.0.5',
    server_version_num: '180001',
  }
): MockTransaction {
  return {
    $queryRaw: jest.fn().mockResolvedValue([identity]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    category: {
      count: jest.fn().mockResolvedValue(counts.category),
      upsert: jest.fn(),
    },
    menuItem: {
      count: jest.fn().mockResolvedValue(counts.menuItem),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    addOn: {
      count: jest.fn().mockResolvedValue(counts.addOn),
      upsert: jest.fn(),
    },
    menuImage: {
      count: jest.fn().mockResolvedValue(counts.menuImage),
      upsert: jest.fn(),
    },
  };
}

describe('read-only menu recovery validation', () => {
  it('validates the complete proposed snapshot and the three required source cross-checks', () => {
    const report = importer.validateSources();

    expect(report.errors).toEqual([]);
    expect(report.counts).toEqual({
      products: 56,
      categories: 11,
      visibleProducts: 54,
      hiddenProducts: 2,
      addOns: 114,
      priceDifferences: 54,
      priceMapMatches: 54,
    });
    expect(report.warnings).toHaveLength(2);
    expect(report.priceDifferences).toHaveLength(54);
  });

  it('parses and cross-checks the price map without loading a TypeScript runtime dependency', () => {
    const path = require('node:path');
    const prices = importer.parsePriceMap(
      path.resolve(__dirname, '../../map-product-prices.ts')
    );

    expect(prices.size).toBe(54);
    expect(prices.get("Bailey's Irish Cream Jar Cake")).toBe(35);
  });

  it('validates product image paths against the packaged manifest without frontend files', () => {
    const report = importer.validateSources();

    expect(Object.keys(importer.VERIFIED_IMAGE_PATHS)).toHaveLength(9);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(2);
    expect(report.products.filter((product: { category: { slug: string } }) =>
      product.category.slug === 'extras'
    ).map((product: { imageUrl: string }) => product.imageUrl)).toEqual([
      'images/napkins.jpg',
      'images/sauce.jpg',
    ]);
  });

  it('rejects a missing or mismatched packaged image manifest', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crave-menu-import-'));
    try {
      for (const file of [
        'production-menu-api.json',
        'current-menu.json',
        'map-product-prices.ts',
        'recovery-image-manifest.json',
      ]) {
        fs.copyFileSync(path.resolve(__dirname, '../..', file), path.join(temporaryRoot, file));
      }
      const manifestPath = path.join(temporaryRoot, 'recovery-image-manifest.json');
      const imageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      imageManifest.products[0].imageUrl = 'images/not-the-approved-image.jpg';
      fs.writeFileSync(manifestPath, JSON.stringify(imageManifest));

      const report = importer.validateSources(temporaryRoot);
      expect(report.errors).toContain(
        `Product ${report.products[0].slug} image path does not match recovery-image-manifest.json.`
      );
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('defaults to dry-run and rejects writes without explicit approvals and target identity', () => {
    expect(importer.parseArgs([]).apply).toBe(false);
    expect(importer.parseArgs(['--dry-run']).apply).toBe(false);
    expect(() => importer.parseArgs(['--apply'])).toThrow('explicit price approval');
    expect(() => importer.parseArgs(['--approve-price-differences'])).toThrow('--apply');
    expect(() => importer.parseArgs(['--apply', '--dry-run'])).toThrow('--dry-run cannot be combined');
    expect(() => importer.parseArgs([
      '--apply',
      '--approve-price-differences',
      '--confirm-target-name=crave_db_v2',
      '--confirm-target-host=db-v2.internal',
      '--confirm-target-postgres-major=18',
    ])).toThrow('empty-target confirmation');
    expect(() => importer.parseArgs([
      '--apply',
      '--approve-price-differences',
      '--confirm-empty-target',
      '--confirm-target-name=crave_db_v2',
      '--confirm-target-host=db-v2.internal',
    ])).toThrow('PostgreSQL major version');
  });

  it('requires price approval, empty-target acknowledgement, host, database and PostgreSQL version', () => {
    expect(importer.parseArgs([
      '--apply',
      '--approve-price-differences',
      '--confirm-empty-target',
      '--confirm-target-name=crave_db_v2',
      '--confirm-target-host=db-v2.internal',
      '--confirm-target-postgres-major=18',
    ])).toMatchObject({
      apply: true,
      approvePriceDifferences: true,
      confirmEmptyTarget: true,
      targetName: 'crave_db_v2',
      targetHost: 'db-v2.internal',
      postgresMajor: 18,
    });
  });

  it('matches confirmed host and database to DATABASE_URL without exposing credentials', () => {
    const identity = importer.getDatabaseIdentityFromUrl(
      'postgresql://private-user:private-password@db-v2.internal:5432/crave_db_v2?sslmode=require'
    );
    expect(identity).toEqual({ databaseName: 'crave_db_v2', hostName: 'db-v2.internal' });
    expect(importer.getDatabaseName(
      'postgresql://private-user:private-password@db-v2.internal:5432/crave_db_v2'
    )).toBe('crave_db_v2');
    expect(() => importer.getDatabaseIdentityFromUrl('https://db-v2.internal/crave_db_v2')).toThrow('PostgreSQL');
    expect(() => importer.getDatabaseIdentityFromUrl('postgresql://db-v2.internal/crave_db_v2')).toThrow('host and credentials');
    expect(() => importer.assertConfirmedTarget(identity, {
      targetName: 'crave_db_v2',
      targetHost: 'other-host.internal',
    })).toThrow('host does not match');
    expect(() => importer.assertConfirmedTarget(identity, {
      targetName: 'different_database',
      targetHost: 'db-v2.internal',
    })).toThrow('name does not match');
  });

  it('accepts only verified empty menu tables while holding a transaction lock', async () => {
    const tx = createTargetTransaction();

    await importer.assertFreshTarget(tx, EXPECTED_IDENTITY);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.calls[0][0].join('')).toContain(
      'LOCK TABLE "Category", "MenuItem", "AddOn", "MenuImage"'
    );
    expect(tx.category.count).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.count).toHaveBeenCalledTimes(1);
    expect(tx.addOn.count).toHaveBeenCalledTimes(1);
    expect(tx.menuImage.count).toHaveBeenCalledTimes(1);
  });

  it('rejects populated and ambiguous table counts before any upsert', async () => {
    const manifest = importer.validateSources();
    const populated = createTargetTransaction({ category: 1, menuItem: 0, addOn: 0, menuImage: 0 });
    populated.category.upsert = jest.fn();
    const populatedClient = { $transaction: jest.fn((callback: (tx: typeof populated) => Promise<void>) => callback(populated)) };
    await expect(importer.importMenu(populatedClient, manifest, EXPECTED_IDENTITY)).rejects.toThrow('not empty');

    const ambiguous = createTargetTransaction({ category: 0, menuItem: null, addOn: 0, menuImage: 0 });
    ambiguous.category.upsert = jest.fn();
    const ambiguousClient = { $transaction: jest.fn((callback: (tx: typeof ambiguous) => Promise<void>) => callback(ambiguous)) };
    await expect(importer.importMenu(ambiguousClient, manifest, EXPECTED_IDENTITY)).rejects.toThrow('not empty');
    expect(populated.category.upsert).not.toHaveBeenCalled();
    expect(ambiguous.category.upsert).not.toHaveBeenCalled();
  });

  it('rejects mismatched connected identity and PostgreSQL major before table locks', async () => {
    const wrongDatabase = createTargetTransaction(undefined, {
      database_name: 'another_database',
      server_address: '10.0.0.5',
      server_version_num: '180001',
    });
    await expect(importer.assertFreshTarget(wrongDatabase, EXPECTED_IDENTITY)).rejects.toThrow('database identity');
    expect(wrongDatabase.$executeRaw).not.toHaveBeenCalled();

    const wrongVersion = createTargetTransaction(undefined, {
      database_name: 'crave_db_v2',
      server_address: '10.0.0.5',
      server_version_num: '170006',
    });
    await expect(importer.assertFreshTarget(wrongVersion, EXPECTED_IDENTITY)).rejects.toThrow('major version');
    expect(wrongVersion.$executeRaw).not.toHaveBeenCalled();

    const ambiguousIdentity = createTargetTransaction(undefined, {
      database_name: 'crave_db_v2',
      server_address: null,
      server_version_num: '180001',
    });
    await expect(importer.assertFreshTarget(ambiguousIdentity, EXPECTED_IDENTITY)).rejects.toThrow('ambiguous');
    expect(ambiguousIdentity.$executeRaw).not.toHaveBeenCalled();
  });

  it('keeps checks and upserts in one serializable transaction and propagates write failures for rollback', async () => {
    const manifest = importer.validateSources();
    const tx = createTargetTransaction();
    const transactionState: string[] = [];
    tx.category.upsert = jest.fn().mockImplementation(async () => {
      transactionState.push('category');
      return { id: 'category-id' };
    });
    tx.menuItem = {
      ...tx.menuItem,
      upsert: jest.fn().mockImplementation(async () => {
        transactionState.push('product');
        throw new Error('simulated import failure');
      }),
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>, options: object) => {
        expect(options).toEqual({ isolationLevel: 'Serializable' });
        try {
          return await callback(tx);
        } catch (error) {
          transactionState.length = 0;
          throw error;
        }
      }),
    };

    await expect(importer.importMenu(prisma, manifest, EXPECTED_IDENTITY)).rejects.toThrow('simulated import failure');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.category.upsert).toHaveBeenCalledTimes(11);
    expect(tx.menuItem.upsert).toHaveBeenCalledTimes(1);
    expect(transactionState).toEqual([]);
  });
});
