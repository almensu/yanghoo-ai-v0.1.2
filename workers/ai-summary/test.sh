#!/bin/bash

# This script helps test the AI summary worker

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

# Run the worker
echo "Running AI summary worker on: $CONTENT_PATH"
ts-node index.ts "$CONTENT_PATH"

# Check the result
if [ $? -eq 0 ]; then
  echo "Worker completed successfully"
  # Display the generated files if they exist
  SUMMARY_MD="$CONTENT_PATH/summaries/summary.md"
  SUMMARY_JSON="$CONTENT_PATH/summaries/rich_summary.json"
  
  if [ -f "$SUMMARY_MD" ]; then
    echo "Generated Markdown summary:"
    echo "------------------------"
    head -n 10 "$SUMMARY_MD"
    echo "... (truncated)"
  fi
  
  if [ -f "$SUMMARY_JSON" ]; then
    echo "Generated JSON summary exists at: $SUMMARY_JSON"
  fi
else
  echo "Worker failed with error code: $?"
fi 