#!/bin/bash

# Check if content path is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <content-path>"
  echo "Example: $0 ../../storage/content-studio/12345678-90ab-cdef-1234-567890abcdef"
  exit 1
fi

CONTENT_PATH="$1"

# Check if DEEPSEEK_API_KEY is set
if [ -z "$DEEPSEEK_API_KEY" ]; then
  if [ -f "../../.deepseek_api_key" ]; then
    export DEEPSEEK_API_KEY=$(cat ../../.deepseek_api_key)
  else
    echo "Error: DEEPSEEK_API_KEY environment variable not set"
    echo "Either set it manually or create a .deepseek_api_key file in the project root"
    exit 1
  fi
fi

# Execute the worker
ts-node index.ts "$CONTENT_PATH" 