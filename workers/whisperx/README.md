# WhisperX Transcription Worker

This worker processes audio files using WhisperX to generate word-level transcriptions with accurate time alignments.

## Features

- Processes WAV audio files (16kHz) extracted from videos
- Generates word-level time-aligned transcriptions
- Supports multiple model options: tiny.en, medium.en, and large-v3
- Detects language automatically
- Updates manifest.json with task status and results
- Reports progress to orchestrator during processing

## Files

- `transcribe.py` - Main worker script that integrates with the manifest system
- `test.py` - Test script to verify WhisperX installation and functionality

## Usage

### Prerequisites

Install the required packages:

```bash
pip3 install whisperx torch
```

### Testing Installation

Run the test script to verify WhisperX is working correctly:

```bash
# Test with default tiny.en model (fastest, but less accurate)
python3 workers/whisperx/test.py

# Test with specific model
python3 workers/whisperx/test.py --model medium.en
python3 workers/whisperx/test.py --model large-v3
```

### Running the Worker

The worker is designed to be called by the orchestrator with the following parameters:

```bash
# Run with default medium.en model
python3 workers/whisperx/transcribe.py --manifest /path/to/manifest.json --hashId <content-bucket-id>

# Run with specific model
python3 workers/whisperx/transcribe.py --manifest /path/to/manifest.json --hashId <content-bucket-id> --model tiny.en
python3 workers/whisperx/transcribe.py --manifest /path/to/manifest.json --hashId <content-bucket-id> --model large-v3
```

## Model Selection

| Model | Description | Recommended Use |
|-------|-------------|-----------------|
| tiny.en | Smallest English-only model | Quick testing, low-resource environments |
| medium.en | Mid-sized English-only model (default) | Production use, good balance of speed/accuracy |
| large-v3 | Largest multilingual model | Highest accuracy, multiple languages |

## Output

The worker generates:

1. A `transcript.json` file in the `transcripts/whisperx/` directory with word-level alignments
2. Updates the manifest:
   - Sets the `transcript_whisperx_json` file state to `ready`
   - Updates the `transcribe_whisperx` task state to `done`
   - Adds progress information
   - Includes model metadata in both the file item and task context

## Manifest Integration

This worker follows the Manifest Specification v0.3.5 and:

- Reads the `extracted_audio` file path from the manifest
- Creates or updates the `transcript_whisperx_json` entry in the fileManifest
- Updates the `transcribe_whisperx` task status
- Sets the correct `derivedFrom` to reference the audio file
- Includes model information in the metadata and generatedBy fields

## Troubleshooting

- Ensure the audio file exists and is in the correct format (16kHz WAV)
- Check the import of WhisperX and torch
- Verify adequate disk space for model downloads (large-v3 requires more space)
- For MacOS, the worker uses CPU mode (can be modified for GPU systems)
- If memory constraints are an issue, use the tiny.en model 