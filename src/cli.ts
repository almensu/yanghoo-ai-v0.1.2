#!/usr/bin/env node

import { ingest } from './ingest';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'ingest':
    if (args.length < 2) {
      console.error('Usage: ts-node src/cli.ts ingest <url>');
      process.exit(1);
    }
    
    const url = args[1];
    const hashId = ingest(url);
    console.log(`Content ingested successfully with ID: ${hashId}`);
    break;
    
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Available commands:');
    console.error('  ingest <url>  - Add new content to the library');
    process.exit(1);
} 