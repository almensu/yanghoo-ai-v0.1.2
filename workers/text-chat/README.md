# Text Chat Worker

This worker initializes an AI dialogue system for text content, creating a structured chat history JSON file that can be used for content-based conversations.

## Features

- Creates initial chat history structure with system context and welcome message
- Designs prebuilt templates for common Q&A patterns (summarize, explain, analyze, etc.)
- Uses DeepSeek API for AI responses (via OpenAI SDK)
- Updates manifest with the new text_chat_history_json file
- Supports exporting conversations to Markdown
- Sets proper file metadata and task tracking

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

- `chats/text_chat.json`: Initial chat history with system prompt and templates

## Technical Implementation

This worker follows the Manifest Specification (v0.3.6) guidelines:

1. Uses OpenAI SDK with DeepSeek API
2. Creates text_chat_history_json file with required metadata
3. Updates the manifest with the new file and task status
4. Sets correct derivedFrom references to text_content_md

The worker completes step 11 of the processing pipeline.

## Chat History Format

The text_chat_history_json format includes:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "System context message",
      "timestamp": "2023-05-01T12:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Welcome message",
      "timestamp": "2023-05-01T12:00:00.000Z"
    }
  ],
  "model": "deepseek-chat",
  "title": "Chat about: [Content Title]",
  "templates": {
    "summarize": {
      "title": "Summarize the content",
      "prompt": "Please summarize the main points of this content."
    },
    // Additional templates...
  }
}
```

## Testing

Use the test script to test the worker:

```bash
chmod +x test.sh
./test.sh <content-path>
``` 