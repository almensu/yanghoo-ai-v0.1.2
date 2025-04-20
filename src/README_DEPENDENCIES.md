# Task Dependencies System

This module implements automatic task triggering based on file states in the manifest. It follows the dependency graph specified in the Manifest Specification.

## How It Works

1. After any task completes successfully, the system checks the current state of all files in the manifest
2. It then evaluates a set of predefined trigger conditions for each possible task
3. When a condition is met, a new task is automatically added to the manifest
4. The task scheduler will pick up these new tasks on its next run

## Key Dependencies Implemented

| When | Trigger |
|------|---------|
| `fetch_info_json` completes | Queue `download_media` |
| `original_media` ready | Queue `extract_audio` |
| `extracted_audio` ready | Queue `transcribe_whisperx` |
| Both language VTTs ready | Queue `merge_transcripts` |
| `transcript_merged_vtt` ready | Queue `extract_text` |
| `text_content_md` ready | Queue `generate_rich_summary` and `initialize_text_chat` |
| `summary_rich_json` ready | Queue `extract_topics` |
| `summary_md` ready | Queue `generate_speech_summary` |

## Manual Tasks

The system also supports creating manual tasks:

- `createUpgradeMediaQualityTask()`: For upgrading video quality
- `createPurgeMediaTask()`: For deleting media files while preserving metadata
- `createExtractScreenshotsTask()`: For extracting screenshots from video
- `createInitializeImageChatTask()`: For initializing AI chat about screenshots
- `createManageChatsTask()`: For organizing all chats into a collection

## Usage Example

```typescript
// Check for and trigger new tasks based on manifest state
const updatedManifest = updateTaskDependencies(manifest);

// Write back the manifest if it was updated
if (updatedManifest !== manifest) {
  await writeManifest(updatedManifest);
}

// Create a manual task
const purgeTask = createPurgeMediaTask(manifest, {
  keepResults: true,
  keepThumbnail: true,
  reason: 'disk_space'
});

// Add manual task to manifest
manifest.tasks.push(purgeTask);
``` 