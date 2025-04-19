import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

/**
 * Simple test script for the extract-audio worker
 * Usage: ts-node test.ts <hashId>
 */

// Get the hashId from command line arguments
const hashId = process.argv[2];
if (!hashId) {
  console.error('Please provide a hash ID as argument');
  process.exit(1);
}

// Define paths
const rootDir = path.resolve(__dirname, '..', '..');
const contentDir = path.join(rootDir, 'storage', 'content-studio', hashId);
const manifestPath = path.join(contentDir, 'manifest.json');

// Check if manifest exists
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest file not found at: ${manifestPath}`);
  process.exit(1);
}

try {
  // Read and parse manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  // Find or create extract_audio task
  let extractAudioTask = manifest.tasks.find((task: any) => task.id === 'extract_audio');
  
  if (!extractAudioTask) {
    // Create the task if it doesn't exist
    console.log('Creating extract_audio task in manifest...');
    
    extractAudioTask = {
      id: 'extract_audio',
      title: 'Extract Audio',
      state: 'queued',
      percent: 0,
      relatedOutput: 'extracted_audio',
      startedAt: null,
      updatedAt: null,
      error: null,
      context: null
    };
    
    manifest.tasks.push(extractAudioTask);
    
    // Write updated manifest back to file
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Task added to manifest.');
  } else {
    // Reset task to queued state if it already exists
    extractAudioTask.state = 'queued';
    extractAudioTask.percent = 0;
    extractAudioTask.error = null;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Reset existing task to queued state.');
  }
  
  // Run the worker
  console.log('Running extract-audio worker...');
  
  const workerProcess = exec(`ts-node index.ts ${manifestPath}`);
  
  // Forward stdout and stderr
  workerProcess.stdout?.on('data', (data) => {
    try {
      // Try to parse as JSON for progress updates
      const jsonData = JSON.parse(data);
      if (jsonData.percent !== undefined) {
        console.log(`Progress: ${jsonData.percent}%`);
      } else {
        console.log(data);
      }
    } catch {
      // If not JSON, just log as is
      console.log(data);
    }
  });
  
  workerProcess.stderr?.on('data', (data) => {
    console.error(data);
  });
  
  // Handle completion
  workerProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Worker completed successfully');
    } else {
      console.error(`Worker exited with code ${code}`);
    }
  });
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} 