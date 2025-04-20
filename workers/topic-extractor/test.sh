#!/bin/bash

# Exit on error
set -e

# Check if content path is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <content-path>"
  echo "Example: $0 ../../storage/content-studio/12345678-90ab-cdef-1234-567890abcdef"
  exit 1
fi

CONTENT_PATH="$1"

# Check if the content path exists
if [ ! -d "$CONTENT_PATH" ]; then
  echo "Error: Content path does not exist: $CONTENT_PATH"
  exit 1
fi

# Check if manifest.json exists in the content path
if [ ! -f "$CONTENT_PATH/manifest.json" ]; then
  echo "Error: manifest.json not found in $CONTENT_PATH"
  exit 1
fi

# Check if summary_rich_json exists
SUMMARY_PATH=$(jq -r '.fileManifest[] | select(.type == "summary_rich_json" and .state == "ready") | .path' "$CONTENT_PATH/manifest.json")
if [ -z "$SUMMARY_PATH" ] || [ "$SUMMARY_PATH" == "null" ]; then
  echo "Error: No ready summary_rich_json found in manifest"
  exit 1
fi

# Run the topic extractor
echo "Running topic extractor on $CONTENT_PATH..."
ts-node index.ts "$CONTENT_PATH"

# Check if topic_tags.json was created
if [ -f "$CONTENT_PATH/knowledge/topic_tags.json" ]; then
  echo "Success: topic_tags.json created"
  echo "Content:"
  cat "$CONTENT_PATH/knowledge/topic_tags.json"
else
  echo "Error: topic_tags.json was not created"
  exit 1
fi

# Check if manifest was updated
if grep -q "topic_tags_json" "$CONTENT_PATH/manifest.json"; then
  echo "Success: manifest.json was updated with topic_tags_json"
else
  echo "Error: manifest.json was not updated with topic_tags_json"
  exit 1
fi

echo "Test completed successfully!" 