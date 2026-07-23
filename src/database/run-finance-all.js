/**
 * Finance All-in-One Migration Runner
 * Runs finance schema, lease calculation, compliance, and notifications migrations sequentially.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  { name: 'Base Lender/Template/Signature SQL Migrations', script: 'run-all-new-migrations.js' },
  { name: 'Finance Schema Migration', script: 'run-finance-schema-migration.js' },
  { name: 'Lease Calculation Migration', script: 'run-lease-calculation-migration.js' },
  { name: 'Finance Compliance Migration', script: 'run-finance-compliance-migration.js' },
  { name: 'Finance Notifications Migration', script: 'run-notifications-schema-migration.js' }
];

function runMigration(index = 0) {
  if (index >= migrations.length) {
    console.log('\n✅ All finance migrations completed!');
    process.exit(0);
  }

  const migration = migrations[index];
  const scriptPath = path.join(__dirname, migration.script);

  console.log(`\n🚀 Running ${migration.name}...`);

  const child = spawn('node', [scriptPath], { stdio: 'inherit' });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ ${migration.name} failed with exit code ${code}`);
      process.exit(code);
    } else {
      console.log(`✅ ${migration.name} completed`);
      runMigration(index + 1);
    }
  });

  child.on('error', (err) => {
    console.error(`❌ Failed to start ${migration.name}:`, err);
    process.exit(1);
  });
}

runMigration();

