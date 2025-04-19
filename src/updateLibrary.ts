import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import { Manifest, ManifestSchema, LibrarySchema, LibraryItem, FILE_TYPES, FileItem, VideoQualityEnum } from './types/manifest';

/**
 * Updates the library.json index with information from all manifest.json files
 * @returns {Promise<void>}
 */
export async function updateLibrary(): Promise<void> {
  const basePath = path.join(process.cwd(), 'storage', 'content-studio');
  const libraryPath = path.join(basePath, 'library.json');
  const timestamp = new Date().toISOString();

  // Initialize library if it doesn't exist
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
  
  try {
    LibrarySchema.parse(library);
  } catch (error) {
    console.error('Invalid library.json structure:', error);
    throw new Error('Invalid library.json structure');
  }

  // Find all manifest.json files in content buckets
  const manifestPaths = glob.sync(path.join(basePath, '*/manifest.json'));
  
  // Create a map of existing items by hashId for quick lookup
  const existingItemsMap = new Map<string, LibraryItem>();
  library.items.forEach((item: LibraryItem) => {
    existingItemsMap.set(item.hashId, item);
  });

  // Process each manifest
  const updatedItems: LibraryItem[] = [];
  
  for (const manifestPath of manifestPaths) {
    try {
      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let manifest: Manifest;
      
      try {
        manifest = ManifestSchema.parse(manifestData);
      } catch (error) {
        console.error(`Invalid manifest at ${manifestPath}:`, error);
        continue;
      }
      
      const { hashId } = manifest;
      const existingItem = existingItemsMap.get(hashId);
      
      // Extract required fields from manifest
      const libraryItem = extractLibraryItem(manifest, existingItem);
      
      updatedItems.push(libraryItem);
    } catch (error) {
      console.error(`Error processing manifest at ${manifestPath}:`, error);
    }
  }

  // Update the library object
  library.items = updatedItems;
  library.updatedAt = timestamp;

  // Write updated library
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2));
  console.log(`Library index updated with ${updatedItems.length} items`);
}

/**
 * Extracts presentation-level fields from a manifest to create a library item
 */
function extractLibraryItem(manifest: Manifest, existingItem?: LibraryItem): LibraryItem {
  const { hashId, metadata, fileManifest, tasks, createdAt } = manifest;

  // Get title from metadata or info.json
  let title = metadata.sourceUrl || '';
  
  // Find original media and other relevant files
  const originalMedia = fileManifest.find(item => item.type === FILE_TYPES.ORIGINAL_MEDIA);
  const infoJson = fileManifest.find(item => item.type === FILE_TYPES.INFO_JSON);
  const originalThumbnail = fileManifest.find(item => item.type === FILE_TYPES.ORIGINAL_THUMBNAIL);
  const topicTags = fileManifest.find(item => item.type === FILE_TYPES.TOPIC_TAGS_JSON);
  const richSummary = fileManifest.find(item => item.type === FILE_TYPES.SUMMARY_RICH_JSON);

  // Extract title from info.json if available
  if (infoJson && infoJson.state === 'ready' && infoJson.path) {
    try {
      const infoPath = path.join(process.cwd(), 'storage', 'content-studio', hashId, infoJson.path);
      if (fs.existsSync(infoPath)) {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        title = info.title || title;
      }
    } catch (error) {
      console.error(`Error reading info.json for ${hashId}:`, error);
    }
  }

  // Determine platform from URL or existing value
  const platform = existingItem?.platform || 
                   (metadata.sourceUrl ? getPlatformFromUrl(metadata.sourceUrl) : 'other');

  // Calculate total disk size
  const diskSize = calculateDiskSize(fileManifest, hashId);
  
  // Extract duration from original media metadata if available
  let duration = 0;
  if (originalMedia && originalMedia.metadata && typeof (originalMedia.metadata as any).duration === 'number') {
    duration = (originalMedia.metadata as any).duration;
  } else if (existingItem?.duration) {
    duration = existingItem.duration;
  }
  
  // Extract quality from original media metadata if available
  let quality: "best" | "1080p" | "720p" | "360p" = "best";
  if (originalMedia && originalMedia.metadata && typeof (originalMedia.metadata as any).quality === 'string') {
    const mediaQuality = (originalMedia.metadata as any).quality;
    if (mediaQuality === "best" || mediaQuality === "1080p" || mediaQuality === "720p" || mediaQuality === "360p") {
      quality = mediaQuality;
    }
  } else if (existingItem?.quality) {
    quality = existingItem.quality;
  }

  // Get thumbnail path
  const thumbnail = originalThumbnail?.path || '';

  // Extract or preserve tags
  const tags = extractTags(topicTags) || existingItem?.tags || [];

  // Extract or preserve summary
  let summary = '';
  if (richSummary && richSummary.state === 'ready' && richSummary.path) {
    try {
      const summaryPath = path.join(process.cwd(), 'storage', 'content-studio', hashId, richSummary.path);
      if (fs.existsSync(summaryPath)) {
        const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        if (summaryData.highlights && summaryData.highlights.length > 0) {
          summary = summaryData.highlights.join(' ');
        }
      }
    } catch (error) {
      console.error(`Error reading summary for ${hashId}:`, error);
    }
  }
  
  // Preserve existing summary if we couldn't extract a new one
  if (!summary && existingItem?.summary) {
    summary = existingItem.summary;
  }

  // Determine content state
  const state = determineContentState(tasks, fileManifest);
  
  // Check if original media exists
  const hasOriginalMedia = originalMedia?.state === 'ready' || originalMedia?.state === 'processing';

  return {
    hashId,
    title,
    platform,
    duration,
    quality,
    thumbnail,
    createdAt: existingItem?.createdAt || createdAt,
    tags,
    summary,
    state,
    diskSize,
    hasOriginalMedia
  };
}

/**
 * Extracts tags from topic_tags_json file
 */
function extractTags(topicTags?: FileItem): string[] | undefined {
  if (!topicTags || topicTags.state !== 'ready' || !topicTags.path) {
    return undefined;
  }

  try {
    const hashId = topicTags.metadata && typeof (topicTags.metadata as any).hashId === 'string' 
      ? (topicTags.metadata as any).hashId 
      : '';
    
    const tagsPath = path.join(
      process.cwd(), 
      'storage', 
      'content-studio', 
      hashId, 
      topicTags.path
    );
    
    if (fs.existsSync(tagsPath)) {
      const tagsData = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
      if (Array.isArray(tagsData.tags)) {
        return tagsData.tags;
      }
      
      // Handle different tag structures
      if (tagsData.categories) {
        const allTags: string[] = [];
        Object.values(tagsData.categories).forEach((categoryTags: any) => {
          if (Array.isArray(categoryTags)) {
            allTags.push(...categoryTags);
          }
        });
        return allTags;
      }
    }
  } catch (error) {
    console.error('Error extracting tags:', error);
  }
  
  return undefined;
}

/**
 * Calculates the total disk size of files in a content bucket
 */
function calculateDiskSize(fileManifest: FileItem[], hashId: string): number {
  let totalSize = 0;
  
  // Add up sizes from metadata where available
  for (const file of fileManifest) {
    if (file.metadata && typeof (file.metadata as any).diskSize === 'number') {
      totalSize += (file.metadata as any).diskSize;
    } else if (file.state === 'ready' && file.path) {
      try {
        const filePath = path.join(process.cwd(), 'storage', 'content-studio', hashId, file.path);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        }
      } catch (error) {
        // Silently continue if file can't be accessed
      }
    }
  }
  
  return totalSize;
}

/**
 * Determines the overall content state based on tasks and files
 */
function determineContentState(tasks: any[], fileManifest: FileItem[]): 'ingesting' | 'processing' | 'complete' | 'error' | 'purged' {
  // Check if all tasks are done
  const allTasksDone = tasks.every(task => task.state === 'done');
  const hasErrorTasks = tasks.some(task => task.state === 'error');
  
  // Check original media state
  const originalMedia = fileManifest.find(item => item.type === FILE_TYPES.ORIGINAL_MEDIA);
  
  if (originalMedia?.state === 'purged') {
    return 'purged';
  }
  
  if (hasErrorTasks) {
    return 'error';
  }
  
  if (allTasksDone) {
    return 'complete';
  }
  
  // If fetch_info task exists but no other tasks have started
  const fetchInfoTask = tasks.find(task => task.id === 'fetch_info_json');
  const otherTasksStarted = tasks.some(task => 
    task.id !== 'fetch_info_json' && task.state !== 'queued'
  );
  
  if (fetchInfoTask && !otherTasksStarted) {
    return 'ingesting';
  }
  
  return 'processing';
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
  updateLibrary()
    .then(() => console.log('Library update completed'))
    .catch(error => {
      console.error('Error updating library:', error);
      process.exit(1);
    });
} 