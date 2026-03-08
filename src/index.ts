import { runCLI } from './cli/index.js';

async function main(): Promise<void> {
  await runCLI();
}

main().catch(console.error);
