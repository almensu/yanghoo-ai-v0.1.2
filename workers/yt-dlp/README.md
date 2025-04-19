# yt-dlp Worker

This worker uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to fetch video information, download media files, and extract subtitles.

## Features

- Fetches video metadata using yt-dlp `-J` flag
- Downloads media files in specified quality (best, 1080p, 720p, 360p)
- Extracts and processes auto-generated subtitles
- Updates manifest.json with appropriate file entries
- Supports both downloadable and iframe-only videos
- Enables quality override (replacing lower quality with higher quality)
- Tracks video quality history
- Reports progress during processing

## Requirements

- Python 3.8+
- yt-dlp (`pip install yt-dlp`)

## Usage

```bash
python fetch_info.py --url <URL> --quality <QUALITY> --content-dir <CONTENT_DIR> --hash-id <HASH_ID> --task-id <TASK_ID>
```

### Parameters

- `--url`: URL of the video to download (required)
- `--quality`: Quality to download (best, 1080p, 720p, 360p), defaults to "best"
- `--content-dir`: Path to content directory (required)
- `--hash-id`: Hash ID for the content bucket (required)
- `--task-id`: Task ID to update in manifest (required)

### Example

```bash
python fetch_info.py --url "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --quality "720p" --content-dir "/path/to/storage/content-studio/4d51ac10-7163-43d9-b0a7-885452386f78" --hash-id "4d51ac10-7163-43d9-b0a7-885452386f78" --task-id "download_media"
```

## Output

The worker creates or updates the following files in the content directory:

- `info.json`: Video information from yt-dlp
- `original/media.*`: Downloaded media file
- `original/thumbnail.*`: Video thumbnail
- `transcript_en.vtt`: English subtitles (if available)
- `transcript_zh.vtt`: Chinese subtitles (if available)

It also updates the manifest.json file with the new file entries and sets the task state to "done". 