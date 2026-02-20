import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

try {
  require.resolve('eslint/package.json');
} catch {
  console.warn('Skipping lint: eslint is not installed.');
  process.exit(0);
}

const result = spawnSync('next', ['lint'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
