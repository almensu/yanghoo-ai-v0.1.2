#!/bin/bash

# This script helps test the text chat worker

# Check if a content path was provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 <content-path>"
  echo "Example: $0 /path/to/storage/content-studio/<hashId>"
  exit 1
fi

CONTENT_PATH=$1

# Check if DeepSeek API key is set
if [ -z "$DEEPSEEK_API_KEY" ]; then
  # Try to load from .deepseek_api_key file
  if [ -f "../../.deepseek_api_key" ]; then
    export DEEPSEEK_API_KEY=$(cat ../../.deepseek_api_key)
    echo "Loaded API key from .deepseek_api_key file"
  else
    echo "Error: DEEPSEEK_API_KEY environment variable not set"
    echo "Please set it with: export DEEPSEEK_API_KEY=your_api_key_here"
    echo "Or create a .deepseek_api_key file in the project root"
    exit 1
  fi
fi

# Check if text_content_md exists and is ready
MANIFEST_FILE="$CONTENT_PATH/manifest.json"
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Error: Manifest file not found at $MANIFEST_FILE"
  exit 1
fi

# Check if the text content exists
if ! grep -q "\"type\":\"text_content_md\"" "$MANIFEST_FILE"; then
  echo "Warning: No text_content_md found in manifest. The worker may fail."
  echo "Do you want to continue anyway? (y/n)"
  read -r answer
  if [ "$answer" != "y" ]; then
    echo "Aborting."
    exit 1
  fi
fi

# Run the worker
echo "Running text chat worker on: $CONTENT_PATH"
ts-node index.ts "$CONTENT_PATH"

# Check the result
if [ $? -eq 0 ]; then
  echo "Worker completed successfully"
  # Display the generated file if it exists
  CHAT_JSON="$CONTENT_PATH/chats/text_chat.json"
  
  if [ -f "$CHAT_JSON" ]; then
    echo "Generated text chat history:"
    echo "------------------------"
    jq -r '.title' "$CHAT_JSON"
    echo "Messages: $(jq '.messages | length' "$CHAT_JSON")"
    echo "Templates: $(jq '.templates | length' "$CHAT_JSON")"
    echo "------------------------"
    echo "Full chat history is available at: $CHAT_JSON"
  else
    echo "Error: Chat history file not created"
    exit 1
  fi

  # Check if manifest was updated
  if grep -q "\"type\":\"text_chat_history_json\"" "$MANIFEST_FILE"; then
    echo "Manifest successfully updated with text_chat_history_json"
  else
    echo "Error: Manifest not updated with text_chat_history_json"
    exit 1
  fi
else
  echo "Worker failed with error code: $?"
  exit 1
fi 