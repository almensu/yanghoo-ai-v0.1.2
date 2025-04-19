# VTT to Markdown Worker

This worker converts a merged WebVTT subtitle file into a Markdown document with appropriate timestamps and formatting.

## Features

- Converts WebVTT subtitles to Markdown format
- Preserves appropriate timestamp references 
- Maintains paragraph structure and formatting
- Updates task status in the manifest file
- Adds metadata including word count and estimated reading time

## Usage

The worker is executed automatically by the task scheduler based on manifest task state.

To run manually:

```bash
cd workers/vtt-to-md
npm install
npm start -- /path/to/manifest.json
```

## Output

- A Markdown file (text_content_md) containing the transcript text with timestamps
- Updated manifest with word count and estimated reading time metadata
- Task status updated to 'done' 