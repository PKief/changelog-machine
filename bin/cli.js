#!/usr/bin/env node
import { run } from '../lib/cli/index.js';
run().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
