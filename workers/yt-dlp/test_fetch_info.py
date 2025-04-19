#!/usr/bin/env python3
"""
Test script for fetch_info.py worker
"""

import os
import json
import argparse
import tempfile
import shutil
import uuid

# Create a simple test manifest
SAMPLE_MANIFEST = {
    "id": "test-id",
    "hashId": "test-hashid",
    "metadata": {},
    "fileManifest": [],
    "tasks": [
        {
            "id": "download_media",
            "title": "Download Media",
            "state": "queued",
            "percent": 0,
            "relatedOutput": "original_media",
            "startedAt": None,
            "updatedAt": None,
            "error": None,
            "context": None
        }
    ],
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "schemaVersion": "0.3.5"
}

def run_test(url, quality="best"):
    """Run a test of the fetch_info.py worker"""
    # Create temp directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Generate a test hash ID
        hash_id = str(uuid.uuid4())
        
        # Create manifest file
        manifest_path = os.path.join(temp_dir, "manifest.json")
        with open(manifest_path, 'w') as f:
            json.dump(SAMPLE_MANIFEST, f, indent=2)
        
        # Run the fetch_info.py script
        cmd = (
            f'python3 fetch_info.py '
            f'--url "{url}" '
            f'--quality "{quality}" '
            f'--content-dir "{temp_dir}" '
            f'--hash-id "{hash_id}" '
            f'--task-id "download_media"'
        )
        
        print(f"Running command: {cmd}")
        exit_code = os.system(cmd)
        
        if exit_code != 0:
            print(f"Error: Command failed with exit code {exit_code}")
            return False
        
        # Check if manifest was updated
        with open(manifest_path, 'r') as f:
            updated_manifest = json.load(f)
        
        # Check if task was updated to done
        for task in updated_manifest.get("tasks", []):
            if task.get("id") == "download_media":
                if task.get("state") == "done":
                    print("✅ Task updated to 'done' successfully")
                else:
                    print(f"❌ Task state is {task.get('state')}, expected 'done'")
                    return False
        
        # Check for file entries in manifest
        file_manifest = updated_manifest.get("fileManifest", [])
        if not file_manifest:
            print("❌ No files added to manifest")
            return False
        
        # Check for info.json file
        info_json_found = False
        for file_item in file_manifest:
            if file_item.get("type") == "info_json":
                info_json_found = True
                print("✅ info_json found in manifest")
                break
        
        if not info_json_found:
            print("❌ info_json not found in manifest")
            return False
        
        # Check if info.json file was created
        if not os.path.exists(os.path.join(temp_dir, "info.json")):
            print("❌ info.json file not created")
            return False
        
        print("✅ info.json file created")
        
        # Check for media file or handle iframe-only case
        media_type = None
        for file_item in file_manifest:
            if file_item.get("type") == "original_media":
                media_type = file_item.get("metadata", {}).get("mediaType")
                
                if media_type == "local":
                    media_path = file_item.get("path")
                    if not os.path.exists(os.path.join(temp_dir, media_path)):
                        print(f"❌ Media file not found at {media_path}")
                        return False
                    print(f"✅ Media file downloaded: {media_path}")
                else:
                    print(f"✅ Video identified as iframe-only, no media download expected")
                
                break
        
        if media_type is None:
            print("❌ No media type information found in manifest")
            return False
        
        # Check for transcripts if media was downloaded
        if media_type == "local":
            transcripts_found = False
            for file_item in file_manifest:
                if file_item.get("type") in ["transcript_en_vtt", "transcript_zh_vtt"]:
                    transcripts_found = True
                    transcript_path = file_item.get("path")
                    if os.path.exists(os.path.join(temp_dir, transcript_path)):
                        print(f"✅ Transcript found: {transcript_path}")
                    else:
                        print(f"⚠️ Transcript listed in manifest but file not found: {transcript_path}")
            
            if not transcripts_found:
                print("⚠️ No transcripts found in manifest (may be normal if video has no subtitles)")
        
        print("\n✅ Test completed successfully!")
        return True
        
    finally:
        # Clean up temp directory
        print(f"\nTemporary test files at: {temp_dir}")
        print("Do you want to keep the test files? (y/n)")
        response = input().lower()
        if response != 'y':
            shutil.rmtree(temp_dir)
            print(f"Removed temporary directory: {temp_dir}")
        else:
            print(f"Test files kept at: {temp_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the fetch_info.py worker")
    parser.add_argument("--url", default="https://www.youtube.com/watch?v=dQw4w9WgXcQ", 
                        help="URL of the video to download for testing")
    parser.add_argument("--quality", default="360p", 
                       choices=["best", "1080p", "720p", "360p"], 
                       help="Quality to download")
    
    args = parser.parse_args()
    
    run_test(args.url, args.quality) 