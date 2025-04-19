# Merge VTT Worker

This worker is responsible for merging English and Chinese VTT subtitle files into a combined VTT format with both languages displayed together.

## Features

- Merges English and Chinese subtitles with time alignment
- Handles misaligned subtitles by finding closest time match
- Updates manifest with merged VTT file
- Supports manual subtitle uploads to replace auto-generated subtitles

## Usage

```bash
cd workers/merge-vtt
npm install
ts-node index.ts /path/to/manifest.json
```

## Input

- `manifest.json` containing references to:
  - `transcript_en_vtt` - English VTT subtitles
  - `transcript_zh_vtt` - Chinese VTT subtitles

## Output

- Creates `transcripts/merged/transcript.vtt` with both languages
- Updates manifest with `transcript_merged_vtt` entry
- Updates the task state for `merge_transcripts` to `done`

## Task Progress

The worker reports progress as JSON output (`{"percent": 50}`) to be consumed by the task scheduler. 