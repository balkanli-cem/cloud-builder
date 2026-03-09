import { runCLI } from './cli/index';

async function main(): Promise<void> {
  await runCLI();
}

main().catch(console.error);
