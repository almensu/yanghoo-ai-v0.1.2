import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ManifestSchema, Manifest, TaskStateEnum, FILE_TYPES } from './types/manifest';
import { updateLibrary } from './updateLibrary';

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
  
  // Update library.json using the dedicated updateLibrary function
  updateLibrary()
    .then(() => console.log('Library index updated'))
    .catch(error => console.error('Error updating library:', error));
  
  console.log(`Created new content bucket: ${hashId}`);
  return hashId;
}

/**
 * Determines the platform from the URL
 */
function getPlatformFromUrl(url: string): string {
  // 视频平台
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'twitter';
  } else if (url.includes('vimeo.com')) {
    return 'vimeo';
  } else if (url.includes('bilibili.com')) {
    return 'bilibili';
  } else if (url.includes('xiaoyuzhoufm.com')) {
    return 'xiaoyuzhoufm';
  } else if (url.includes('instagram.com')) {
    return 'instagram';
  } 
  
  // 播客平台 - 详细检测
  // Apple Podcasts
  else if (url.includes('apple.com/podcast') || 
           url.includes('itunes.apple.com/podcast') || 
           url.includes('podcasts.apple.com')) {
    return 'podcast_apple';
  } 
  // Spotify
  else if (url.includes('spotify.com/show') || 
           url.includes('spotify.com/episode') || 
           url.includes('open.spotify.com/show')) {
    return 'podcast_spotify';
  } 
  // Google Podcasts
  else if (url.includes('podcasts.google.com') || 
           url.includes('google.com/podcasts')) {
    return 'podcast_google';
  }
  // 喜马拉雅
  else if (url.includes('ximalaya.com')) {
    return 'podcast_ximalaya';
  }
  // 蜻蜓FM
  else if (url.includes('qingting.fm')) {
    return 'podcast_qingting';
  }
  // 荔枝FM
  else if (url.includes('lizhi.fm')) {
    return 'podcast_lizhi';
  }
  // 懒人听书
  else if (url.includes('lrts.me')) {
    return 'podcast_lanren';
  }
  // SoundCloud
  else if (url.includes('soundcloud.com')) {
    return 'podcast_soundcloud';
  }
  // Podbean
  else if (url.includes('podbean.com')) {
    return 'podcast_podbean';
  }
  // Stitcher
  else if (url.includes('stitcher.com')) {
    return 'podcast_stitcher';
  }
  // iHeartRadio
  else if (url.includes('iheart.com')) {
    return 'podcast_iheart';
  }
  // Castbox
  else if (url.includes('castbox.fm')) {
    return 'podcast_castbox';
  }
  // Overcast
  else if (url.includes('overcast.fm')) {
    return 'podcast_overcast';
  }
  // PocketCasts
  else if (url.includes('pocketcasts.com')) {
    return 'podcast_pocketcasts';
  }
  // 通用播客URL检测
  else if ((url.includes('/podcast/') || 
            url.includes('/podcasts/') || 
            url.includes('/show/') ||
            url.includes('/episode/') ||
            url.includes('/feed/podcast/')) && 
            !url.includes('blog') && 
            !url.includes('article')) {
    return 'podcast_other';
  }
  // 其他包含podcast关键词的情况
  else if ((url.toLowerCase().includes('podcast') || 
            url.toLowerCase().includes('pod-') || 
            url.toLowerCase().includes('-pod')) &&
            !url.includes('blog') &&
            !url.includes('article')) {
    return 'podcast_generic';
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