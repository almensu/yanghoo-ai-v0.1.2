# Task Scheduler (run_task.ts)

This module provides a simple task scheduler for the Content Studio pipeline. It reads manifest files, finds tasks with state="queued", executes the appropriate worker, and updates the manifest and library.json.

## Features

- Automatically runs queued tasks in manifests
- Updates task and file states in real-time
- Syncs library.json after each task
- Captures progress updates from worker stdout
- Proper error handling and state management

## Usage

```bash
# Run all tasks for a specific content bucket
npm run run-task run <hashId>

# Run only the next queued task for a specific bucket
npm run run-task next <hashId>

# Process all buckets in the library
npm run process-all
```

## Task Worker Map

The task scheduler maps task IDs to worker implementations:

- `fetch_info_json`: Fetches info.json using yt-dlp
- `download_media`: Downloads media using yt-dlp with quality options
- `extract_audio`: Extracts audio using ffmpeg
- `transcribe_whisperx`: Transcribes audio using WhisperX
- `merge_transcripts`: Merges VTT subtitles
- `extract_text`: Converts VTT to Markdown
- `generate_rich_summary`: Generates summaries using AI
- `extract_topics`: Extracts topics using AI
- `initialize_text_chat`: Sets up text chat for content

## Developer Info

Task workers should output JSON progress updates in the format `{"percent": 50}` to stdout for progress tracking. The scheduler will automatically update the manifest and related file items based on task completion. 