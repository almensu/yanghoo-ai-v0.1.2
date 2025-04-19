# Extract Audio Worker

This worker extracts audio from video files using ffmpeg and saves it as a WAV file (16 kHz mono).

## Requirements

- Node.js v18+
- ffmpeg installed on the system path
- fluent-ffmpeg NPM package

## Installation

```bash
# Install dependencies
npm install
```

## Usage

```bash
# Run the worker with a manifest file path
npm start -- /path/to/manifest.json
```

Or directly:

```bash
ts-node index.ts /path/to/manifest.json
```

## Output

The worker:

1. Creates an `audio` directory in the content folder
2. Extracts audio as WAV file (16 kHz mono) to `audio/audio.wav`
3. Updates the manifest with the new file entry (type: `extracted_audio`)
4. Updates the task state to `done`
5. Logs progress as JSON to stdout: `{"percent": value}`

## Error Handling

If an error occurs, the worker:

1. Updates the task state to `error`
2. Sets the error message in the task
3. Logs the error to stderr
4. Exits with code 1 


To run this worker:
Navigate to the worker directory: cd workers/extract-audio
Install dependencies: npm install
Run the worker: ts-node index.ts /path/to/manifest.json
Or use the test script: ts-node test.ts <hashId> which will automatically set up and run the worker for a specific content folder.