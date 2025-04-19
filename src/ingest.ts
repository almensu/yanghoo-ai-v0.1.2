import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ManifestSchema, Manifest, TaskStateEnum, FILE_TYPES } from './types/manifest';

/**
 * Creates a new content bucket with initial manifest.json
 * 
 * @param {string} url URL of the content to ingest
 * @returns {string} The hashId of the created bucket
 */
export function ingest(url: string): string {
  // Generate a unique hashId (UUID)
  const hashId = uuidv4();
  
  // Create bucket directory
  const bucketDir = path.join(process.cwd(), 'storage', 'content-studio', hashId);
  fs.mkdirSync(bucketDir, { recursive: true });
  
  // Current timestamp in ISO format
  const timestamp = new Date().toISOString();
  
  // Create initial manifest
  const initialManifest: Manifest = {
    id: hashId.substring(0, 8), // Short ID from first 8 chars of UUID
    hashId,
    metadata: {
      sourceUrl: url,
    },
    fileManifest: [],
    tasks: [
      {
        id: 'fetch_info_json',
        title: 'Fetch info.json',
        state: TaskStateEnum.enum.queued,
        percent: 0,
        relatedOutput: 'original/info.json',
        startedAt: null,
        updatedAt: null,
        error: null,
        context: {
          url
        }
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: '0.3.5'
  };
  
  // Create the original directory
  fs.mkdirSync(path.join(bucketDir, 'original'), { recursive: true });
  
  // Write manifest.json
  fs.writeFileSync(
    path.join(bucketDir, 'manifest.json'),
    JSON.stringify(initialManifest, null, 2)
  );
  
  // Update library.json
  updateLibrary(hashId, url, timestamp);
  
  console.log(`Created new content bucket: ${hashId}`);
  return hashId;
}

/**
 * Updates the library.json index file
 */
function updateLibrary(hashId: string, url: string, timestamp: string): void {
  const libraryPath = path.join(process.cwd(), 'storage', 'content-studio', 'library.json');
  
  // Create library structure if it doesn't exist
  if (!fs.existsSync(libraryPath)) {
    fs.writeFileSync(
      libraryPath,
      JSON.stringify({
        schemaVersion: '0.3.5',
        updatedAt: timestamp,
        items: []
      }, null, 2)
    );
  }
  
  // Read existing library
  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
  
  // Add new item
  library.items.push({
    hashId,
    title: url, // Initial title is the URL, will be updated later
    platform: getPlatformFromUrl(url),
    duration: 0, // Will be updated after info.json is fetched
    quality: 'best', // Default quality
    thumbnail: '', // Will be updated after download
    createdAt: timestamp,
    tags: [],
    summary: '',
    state: 'ingesting',
    diskSize: 0,
    hasOriginalMedia: false
  });
  
  // Update timestamp
  library.updatedAt = timestamp;
  
  // Write updated library
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2));
}

/**
 * Determines the platform from the URL
 */
function getPlatformFromUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'twitter';
  } else if (url.includes('vimeo.com')) {
    return 'vimeo';
  } else if (url.includes('bilibili.com')) {
    return 'bilibili';
  } else {
    return 'other';
  }
}

// When called directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node src/ingest.ts <url>');
    process.exit(1);
  }
  
  const url = args[0];
  ingest(url);
} 