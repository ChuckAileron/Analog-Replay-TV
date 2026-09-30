#!/usr/bin/env node
/**
 * Ejecuta las pruebas unitarias de `test/` y muestra el informe de cobertura.
 *
 * Usa la cobertura integrada del runner de Node (`--experimental-test-coverage`),
 * por lo que no añade ninguna dependencia al proyecto.
 *
 *   node scripts/test-coverage.mjs
 *   node scripts/test-coverage.mjs --lines 100 --branches 95
 *   node scripts/test-coverage.mjs --json coverage
 *
 * Los umbrales (`--lines`, `--branches`, `--functions`) hacen que el comando
 * falle si la cobertura baja del mínimo indicado. Cualquier otro argumento se
 * reenvía tal cual al runner de Node.
 */
import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const TEST_DIR = 'dist-test/test';

const THRESHOLD_FLAGS = {
  '--lines': '--test-coverage-lines',
  '--branches': '--test-coverage-branches',
  '--functions': '--test-coverage-functions'
};

const args = process.argv.slice(2);
const nodeArgs = [
  '--test',
  '--experimental-test-coverage',
  '--test-coverage-include=dist-test/electron/**',
  '--test-coverage-include=dist-test/src/**',
  '--test-coverage-exclude=dist-test/test/**'
];
let jsonDir = null;

for (let i = 0; i < args.length; i += 1) {
  const [flag, inlineValue] = args[i].split('=');
  const value = inlineValue ?? args[i + 1];

  if (flag in THRESHOLD_FLAGS) {
    const threshold = Number(value);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      console.error(`Valor inválido para ${flag}: ${value} (se espera 0-100)`);
      process.exit(2);
    }
    nodeArgs.push(`${THRESHOLD_FLAGS[flag]}=${threshold}`);
    if (inlineValue === undefined) i += 1;
  } else if (flag === '--json') {
    if (!value) {
      console.error('Falta el directorio para --json (por ejemplo: --json coverage)');
      process.exit(2);
    }
    jsonDir = value;
    if (inlineValue === undefined) i += 1;
  } else if (flag === '--help' || flag === '-h') {
    console.log('Uso: node scripts/test-coverage.mjs [--lines N] [--branches N] [--functions N] [--json <dir>] [args de node --test]');
    process.exit(0);
  } else {
    nodeArgs.push(args[i]);
  }
}

const env = { ...process.env };
if (jsonDir) {
  const target = path.resolve(ROOT, jsonDir);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  env.NODE_V8_COVERAGE = target;
  console.log(`Cobertura cruda de V8 escrita en: ${path.relative(ROOT, target) || '.'}`);
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: ROOT, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

console.log('Compilando fuentes y pruebas...');
const compileCode = await run(process.execPath, [TSC, '-p', 'tsconfig.test.json']);
if (compileCode !== 0) process.exit(compileCode);

console.log('\nEjecutando pruebas con cobertura...\n');
const testCode = await run(process.execPath, [...nodeArgs, TEST_DIR]);

if (jsonDir) {
  console.log(`\nCobertura cruda de V8 guardada en ${jsonDir}/ (para c8, istanbul o VS Code).`);
}
console.log('Notas:');
console.log('  - El informe muestra rutas de dist-test porque Node no aplica los source maps.');
console.log('  - Para ver el detalle línea a línea sobre el .ts, usa --json y abre el HTML de c8.');
console.log(`  - Ejemplo: npx c8 --reporter=html --all node --test ${TEST_DIR}`);

process.exit(testCode);
