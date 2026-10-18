import fs from 'node:fs';
import path from 'node:path';

describe('database migration startup separation', () => {
  it('starts the API without applying migrations and exposes a separate migration command', () => {
    const dockerfile = fs.readFileSync(path.resolve(__dirname, '../Dockerfile'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    expect(dockerfile).not.toMatch(/CMD .*prisma migrate deploy/i);
    expect(packageJson.scripts['migrate:deploy']).toBe('prisma migrate deploy');
  });
});
