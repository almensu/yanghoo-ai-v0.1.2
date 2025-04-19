import { z } from 'zod';

// FileItem state enum
export const FileItemStateEnum = z.enum([
  'queued',
  'processing',
  'ready',
  'error',
  'purged'
]);
export type FileItemState = z.infer<typeof FileItemStateEnum>;

// Task state enum
export const TaskStateEnum = z.enum([
  'queued',
  'running',
  'done',
  'error'
]);
export type TaskState = z.infer<typeof TaskStateEnum>;

// Media Type enum
export const MediaTypeEnum = z.enum([
  'local',
  'iframe'
]);
export type MediaType = z.infer<typeof MediaTypeEnum>;

// Video Quality enum
export const VideoQualityEnum = z.enum([
  'best',
  '1080p',
  '720p',
  '360p'
]);
export type VideoQuality = z.infer<typeof VideoQualityEnum>;

// Screenshot Type enum
export const ScreenshotTypeEnum = z.enum([
  'interval',
  'uniform',
  'keyframe',
  'subtitle'
]);
export type ScreenshotType = z.infer<typeof ScreenshotTypeEnum>;

// Chat Type enum
export const ChatTypeEnum = z.enum([
  'text',
  'image'
]);
export type ChatType = z.infer<typeof ChatTypeEnum>;

// Base metadata schema
const BaseMetadataSchema = z.object({}).passthrough();

// Original media metadata
const OriginalMediaMetadataSchema = z.object({
  quality: VideoQualityEnum,
  mediaType: MediaTypeEnum,
  duration: z.number(),
  dimensions: z.object({
    width: z.number(),
    height: z.number()
  }),
  diskSize: z.number(),
  previousQualities: z.array(VideoQualityEnum).optional(),
  lastAccessed: z.string().optional(),
  // For purged media
  purgedAt: z.string().optional(),
  purgedReason: z.string().optional(),
  hasOriginalMedia: z.boolean().optional()
});

// Screenshot image metadata
const ScreenshotImageMetadataSchema = z.object({
  timestamp: z.number(),
  subtitleText: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
});

// Text chat history metadata
const TextChatHistoryMetadataSchema = z.object({
  model: z.string(),
  messageCount: z.number(),
  lastUpdated: z.string()
});

// Image chat history metadata
const ImageChatHistoryMetadataSchema = z.object({
  model: z.string(),
  messageCount: z.number(),
  lastUpdated: z.string()
});

// Chat collection metadata
const ChatCollectionMetadataSchema = z.object({
  chatCount: z.number(),
  lastUpdated: z.string()
});

// Summary rich metadata
const SummaryRichMetadataSchema = z.object({
  wordCount: z.number().optional(),
  estimatedReadingTime: z.number().optional()
});

// Text content metadata
const TextContentMetadataSchema = z.object({
  wordCount: z.number().optional(),
  estimatedReadingTime: z.number().optional()
});

// Speech summary metadata
const SpeechSummaryMetadataSchema = z.object({
  duration: z.number(),
  voiceId: z.string().optional()
});

// Extracted audio metadata
const ExtractedAudioMetadataSchema = z.object({
  duration: z.number(),
  sampleRate: z.number().optional(),
  diskSize: z.number().optional()
});

// Topic tags metadata
const TopicTagsMetadataSchema = z.object({
  tagCount: z.number(),
  categories: z.record(z.array(z.string())).optional()
});

// Article metadata
const ArticleMetadataSchema = z.object({
  wordCount: z.number().optional(),
  lastModified: z.string().optional(),
  author: z.string().optional()
});

// Transcript whisperx json metadata
const TranscriptWhisperXJsonMetadataSchema = z.object({
  modelName: z.string(),
  wordCount: z.number().optional(),
  segmentCount: z.number().optional()
});

// FileItem schema with metadata based on type
export const FileItemSchema = z.object({
  type: z.string(),
  version: z.number(),
  path: z.string(),
  state: FileItemStateEnum,
  generatedBy: z.string(),
  derivedFrom: z.array(z.string()),
  metadata: z.union([
    z.null(),
    BaseMetadataSchema,
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('original_media'), ...OriginalMediaMetadataSchema.shape }),
      z.object({ type: z.literal('screenshot_image'), ...ScreenshotImageMetadataSchema.shape }),
      z.object({ type: z.literal('text_chat_history_json'), ...TextChatHistoryMetadataSchema.shape }),
      z.object({ type: z.literal('image_chat_history_json'), ...ImageChatHistoryMetadataSchema.shape }),
      z.object({ type: z.literal('chat_collection_json'), ...ChatCollectionMetadataSchema.shape }),
      z.object({ type: z.literal('summary_rich_json'), ...SummaryRichMetadataSchema.shape }),
      z.object({ type: z.literal('text_content_md'), ...TextContentMetadataSchema.shape }),
      z.object({ type: z.literal('speech_summary_audio'), ...SpeechSummaryMetadataSchema.shape }),
      z.object({ type: z.literal('extracted_audio'), ...ExtractedAudioMetadataSchema.shape }),
      z.object({ type: z.literal('topic_tags_json'), ...TopicTagsMetadataSchema.shape }),
      z.object({ type: z.literal('article_md'), ...ArticleMetadataSchema.shape }),
      z.object({ type: z.literal('transcript_whisperx_json'), ...TranscriptWhisperXJsonMetadataSchema.shape })
    ]).optional()
  ])
});

export type FileItem = z.infer<typeof FileItemSchema>;

// Task schema
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  state: TaskStateEnum,
  percent: z.number().min(0).max(100),
  relatedOutput: z.string(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  error: z.string().nullable(),
  context: z.record(z.any()).nullable()
});

export type Task = z.infer<typeof TaskSchema>;

// Root manifest schema
export const ManifestSchema = z.object({
  id: z.string(),
  hashId: z.string(),
  metadata: z.record(z.any()),
  fileManifest: z.array(FileItemSchema),
  tasks: z.array(TaskSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.string()
});

export type Manifest = z.infer<typeof ManifestSchema>;

// Library item schema (for library.json)
export const LibraryItemSchema = z.object({
  hashId: z.string(),
  title: z.string(),
  platform: z.string(),
  duration: z.number(),
  quality: VideoQualityEnum,
  thumbnail: z.string(),
  createdAt: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  state: z.enum(['ingesting', 'processing', 'complete', 'error', 'purged']),
  diskSize: z.number(),
  hasOriginalMedia: z.boolean()
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;

// Library schema
export const LibrarySchema = z.object({
  schemaVersion: z.string(),
  updatedAt: z.string(),
  items: z.array(LibraryItemSchema)
});

export type Library = z.infer<typeof LibrarySchema>;

// Export canonical file types
export const FILE_TYPES = {
  // Originals
  ORIGINAL_MEDIA: 'original_media',
  ORIGINAL_THUMBNAIL: 'original_thumbnail',
  INFO_JSON: 'info_json',
  
  // Transcripts
  TRANSCRIPT_EN_VTT: 'transcript_en_vtt',
  TRANSCRIPT_ZH_VTT: 'transcript_zh_vtt',
  TRANSCRIPT_WHISPERX_JSON: 'transcript_whisperx_json',
  TRANSCRIPT_MERGED_VTT: 'transcript_merged_vtt',
  
  // Derived Text
  TEXT_CONTENT_MD: 'text_content_md',
  SUMMARY_MD: 'summary_md',
  SUMMARY_RICH_JSON: 'summary_rich_json',
  
  // Audio
  EXTRACTED_AUDIO: 'extracted_audio',
  SPEECH_SUMMARY_AUDIO: 'speech_summary_audio',
  
  // Images
  SCREENSHOT_COLLECTION_JSON: 'screenshot_collection_json',
  SCREENSHOT_IMAGE: 'screenshot_image',
  
  // AI Interactions
  TEXT_CHAT_HISTORY_JSON: 'text_chat_history_json',
  IMAGE_CHAT_HISTORY_JSON: 'image_chat_history_json',
  CHAT_COLLECTION_JSON: 'chat_collection_json',
  
  // Knowledge Units
  TOPIC_TAGS_JSON: 'topic_tags_json',
  
  // Articles / Notes
  ARTICLE_MD: 'article_md',
  
  // Misc
  LOG_TXT: 'log_txt'
} as const;

// Export canonical task IDs
export const TASK_IDS = {
  FETCH_INFO_JSON: 'fetch_info_json',
  DOWNLOAD_MEDIA: 'download_media',
  UPGRADE_MEDIA_QUALITY: 'upgrade_media_quality',
  EXTRACT_AUDIO: 'extract_audio',
  TRANSCRIBE_WHISPERX: 'transcribe_whisperx',
  MERGE_TRANSCRIPTS: 'merge_transcripts',
  EXTRACT_TEXT: 'extract_text',
  GENERATE_RICH_SUMMARY: 'generate_rich_summary',
  EXTRACT_TOPICS: 'extract_topics',
  GENERATE_SPEECH_SUMMARY: 'generate_speech_summary',
  EXTRACT_SCREENSHOTS: 'extract_screenshots',
  INITIALIZE_TEXT_CHAT: 'initialize_text_chat',
  INITIALIZE_IMAGE_CHAT: 'initialize_image_chat',
  PURGE_MEDIA: 'purge_media',
  MANAGE_CHATS: 'manage_chats'
} as const; 