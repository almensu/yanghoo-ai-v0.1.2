# AI Summary Worker

This worker generates rich structured summaries from content using the DeepSeek API.

## Features

- Generates a structured JSON summary with:
  - Key highlights (3-5 most important points)
  - Important topics (5-7 topics with descriptions)
  - Overview paragraph (concise summary)
- Also produces a formatted Markdown summary
- Updates the manifest with new summary files
- Reports progress via stdout JSON

## Usage

```bash
# Install dependencies
npm install

# Set the DeepSeek API key
export DEEPSEEK_API_KEY=your_api_key_here

# Run the worker on a content bucket
ts-node index.ts /path/to/storage/content-studio/<hashId>
```

## Output Files

- `summaries/rich_summary.json`: Structured summary in JSON format
- `summaries/summary.md`: Plain text summary in Markdown format

## Technical Implementation

This worker follows the Manifest Specification (v0.3.6) guidelines:

1. Uses OpenAI SDK with DeepSeek API
2. Creates both summary_rich_json and summary_md files
3. Updates the manifest with the new files and task status
4. Sets correct derivedFrom references to text_content_md

The worker completes step 9 of the processing pipeline.

## Example Output

Example JSON output in `example_rich_summary.json`
Example Markdown output in `example_summary.md` 