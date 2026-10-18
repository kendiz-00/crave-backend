'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const backendRoot = path.resolve(__dirname, '..');
const ignoreRules = fs.readFileSync(path.join(backendRoot, '.dockerignore'), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

test('Docker build context excludes environment files, private keys and local database exports', () => {
    for (const requiredRule of [
        '.env',
        '.env.*',
        '**/.env',
        '**/.env.*',
        '*.pem',
        '*.key',
        '*.p12',
        '*.pfx',
        '*.secret',
        '*.secrets',
        '*.asc',
        '*.gpg',
        '.npmrc',
        '.netrc',
        '.pgpass',
        '.my.cnf',
        '**/.ssh/**',
        '**/id_rsa*',
        '**/id_ed25519*',
        '**/secrets/**',
        '**/private/**',
        '**/credentials/**',
        '*.sql',
        '!prisma/migrations/**/*.sql',
        '*.dump',
        '*.backup',
        '*.sqlite',
        '*.sqlite3',
        '*.db'
    ]) {
        assert.ok(ignoreRules.includes(requiredRule), `Missing Docker ignore rule: ${requiredRule}`);
    }
});

test('Docker build context excludes credential-bearing audit scripts and local snapshots', () => {
    for (const requiredRule of [
        '/audit-production-categories-prod.js',
        '/direct-pg-test.js',
        '/direct-prisma-test.js',
        '/direct-prisma-test.ts',
        '/api-menu-response.json',
        '/current-menu.json',
        '/menu.json',
        '/menu-images-audit.json',
        '/production-menu*.json',
        '/migrations/'
    ]) {
        assert.ok(ignoreRules.includes(requiredRule), `Missing Docker ignore rule: ${requiredRule}`);
    }
});

test('Docker build context excludes local tests without excluding production build inputs', () => {
    for (const requiredRule of ['tests', '**/tests/**', '**/__tests__/**', '*.test.*', '*.spec.*']) {
        assert.ok(ignoreRules.includes(requiredRule), `Missing Docker ignore rule: ${requiredRule}`);
    }

    for (const requiredInput of ['package*.json', 'prisma', 'src', 'tsconfig.json']) {
        assert.ok(!ignoreRules.includes(requiredInput), `Production build input must not be ignored: ${requiredInput}`);
    }
});
