# Topic Extractor Worker

This worker extracts key topics from the content's rich summary and generates a structured `topic_tags.json` file.

## Features

- Extracts concise topic tags from rich summary data
- Organizes topics into categories
- Updates manifest with the new topic tags file
- Updates library.json with the extracted topics for easy filtering

## Input

- Rich summary JSON file (`summary_rich_json`)

## Output

- Topic tags JSON file (`topic_tags_json`)
- Updated manifest with the new file entry
- Updated library.json with tags for the content

## Usage

```bash
ts-node index.ts <content-path>
```

Where `<content-path>` is the path to the content bucket directory containing the manifest.json file.

## Example Output

```json
{
  "topics": [
    "AI", 
    "Machine Learning", 
    "Neural Networks", 
    "Data Science", 
    "Deep Learning", 
    "Ethics"
  ],
  "categories": {
    "Technology": ["AI", "Machine Learning", "Neural Networks"],
    "Science": ["Data Science", "Deep Learning"],
    "Philosophy": ["Ethics"]
  }
}
```

## Development

### Requirements

- Node.js 18+
- TypeScript
- OpenAI SDK (for DeepSeek API access)

### Testing

Use the test script to test the worker:

```bash
chmod +x test.sh
./test.sh <content-path>
```

### Environment Variables

- `DEEPSEEK_API_KEY`: API key for DeepSeek API

## Integration

This worker is designed to be triggered after `summary_rich_json` is ready. It produces:

1. A `topic_tags_json` file in the `knowledge/` directory
2. Updates the manifest with the new file's information
3. Sets the `extract_topics` task to `done`
4. Updates library.json with the tags for easier content discovery

The output is used by the UI to display topic tags and enable content filtering by topic. 