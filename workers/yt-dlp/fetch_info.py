#!/usr/bin/env python3
"""
yt-dlp worker for fetching video info, downloading media and subtitles
"""

import os
import sys
import json
import argparse
import subprocess
import shutil
import time
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# Constants for quality selection
QUALITY_BEST = "best"
QUALITY_1080P = "1080p"
QUALITY_720P = "720p"
QUALITY_360P = "360p"

# Constants for file types
FILE_TYPE_ORIGINAL_MEDIA = "original_media"
FILE_TYPE_ORIGINAL_THUMBNAIL = "original_thumbnail"
FILE_TYPE_INFO_JSON = "info_json"
FILE_TYPE_TRANSCRIPT_EN_VTT = "transcript_en_vtt"
FILE_TYPE_TRANSCRIPT_ZH_VTT = "transcript_zh_vtt"

# Manifest file states
STATE_QUEUED = "queued"
STATE_PROCESSING = "processing"
STATE_READY = "ready"
STATE_ERROR = "error"

# Task states
TASK_QUEUED = "queued"
TASK_RUNNING = "running"
TASK_DONE = "done"
TASK_ERROR = "error"

def report_progress(percent: int) -> None:
    """Print progress as JSON to stdout for parent process to parse"""
    sys.stdout.write(json.dumps({"percent": percent}) + "\n")
    sys.stdout.flush()

def get_video_format_for_quality(quality: str) -> str:
    """Get the yt-dlp format string for the specified quality"""
    if quality == QUALITY_BEST:
        return "bestvideo+bestaudio/best"
    elif quality == QUALITY_1080P:
        return "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
    elif quality == QUALITY_720P:
        return "bestvideo[height<=720]+bestaudio/best[height<=720]"
    elif quality == QUALITY_360P:
        return "bestvideo[height<=360]+bestaudio/best[height<=360]"
    else:
        return "best"  # Default to best quality

def get_video_dimensions(info_json_path: str) -> Dict[str, int]:
    """Extract video dimensions from info.json"""
    try:
        with open(info_json_path, 'r', encoding='utf-8') as f:
            info = json.load(f)
            return {
                "width": info.get("width", 0),
                "height": info.get("height", 0)
            }
    except Exception as e:
        print(f"Error getting video dimensions: {e}", file=sys.stderr)
        return {"width": 0, "height": 0}

def get_file_size(file_path: str) -> int:
    """Get file size in bytes"""
    try:
        return os.path.getsize(file_path)
    except Exception:
        return 0

def get_video_duration(info_json_path: str) -> float:
    """Extract video duration from info.json in seconds"""
    try:
        with open(info_json_path, 'r', encoding='utf-8') as f:
            info = json.load(f)
            return info.get("duration", 0)
    except Exception as e:
        print(f"Error getting video duration: {e}", file=sys.stderr)
        return 0

def is_iframe_only_video(info_json_path: str) -> bool:
    """Determine if video is iframe-only or can be downloaded"""
    try:
        with open(info_json_path, 'r', encoding='utf-8') as f:
            info = json.load(f)
            # If no direct formats available or only iframe embedding is available
            return len(info.get("formats", [])) == 0 or info.get("is_live", False)
    except Exception as e:
        print(f"Error determining video type: {e}", file=sys.stderr)
        return False

def convert_subtitles_to_vtt(video_id: str, content_dir: str) -> Dict[str, str]:
    """Convert subtitles to VTT format and determine languages"""
    transcript_paths = {}
    subtitles_dir = os.path.join(content_dir, "original")
    
    for file in os.listdir(subtitles_dir):
        if file.endswith('.vtt') and video_id in file:
            full_path = os.path.join(subtitles_dir, file)
            
            # Try to detect language from filename
            lang_match = re.search(r'\.([a-z]{2})\.vtt$', file)
            if lang_match:
                lang = lang_match.group(1)
                
                # Create appropriate file type based on language
                if lang == "en":
                    dest_path = os.path.join(content_dir, "transcript_en.vtt")
                    transcript_paths[FILE_TYPE_TRANSCRIPT_EN_VTT] = dest_path
                elif lang == "zh":
                    dest_path = os.path.join(content_dir, "transcript_zh.vtt")
                    transcript_paths[FILE_TYPE_TRANSCRIPT_ZH_VTT] = dest_path
                else:
                    # For other languages, still save as English if no English found
                    if FILE_TYPE_TRANSCRIPT_EN_VTT not in transcript_paths:
                        dest_path = os.path.join(content_dir, "transcript_en.vtt")
                        transcript_paths[FILE_TYPE_TRANSCRIPT_EN_VTT] = dest_path
                
                # Copy the subtitle file to its destination
                shutil.copy2(full_path, dest_path)
    
    return transcript_paths

def update_manifest(manifest_path: str, files_to_add: Dict[str, Dict[str, Any]], task_id: str) -> None:
    """Update the manifest.json with new file entries and update task state"""
    try:
        # Read existing manifest
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        # Get current timestamp in ISO format
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        
        # Update manifest fields
        manifest["updatedAt"] = current_time
        
        # Check if files already exist in manifest and update or add as needed
        file_manifest = manifest.get("fileManifest", [])
        for file_item in file_manifest:
            file_type = file_item.get("type")
            if file_type in files_to_add:
                # Update existing entry
                old_state = file_item.get("state")
                file_item.update(files_to_add[file_type])
                # Keep metadata.previousQualities if updating original_media
                if file_type == FILE_TYPE_ORIGINAL_MEDIA and "metadata" in file_item and "previousQualities" in file_item["metadata"]:
                    if "quality" in file_item["metadata"]:
                        # Add previous quality to history if quality changed
                        old_quality = file_item["metadata"]["quality"]
                        new_quality = files_to_add[file_type]["metadata"]["quality"]
                        if old_quality != new_quality and old_state == STATE_READY:
                            if "previousQualities" not in files_to_add[file_type]["metadata"]:
                                files_to_add[file_type]["metadata"]["previousQualities"] = []
                            if old_quality not in files_to_add[file_type]["metadata"]["previousQualities"]:
                                files_to_add[file_type]["metadata"]["previousQualities"].append(old_quality)
                
                files_to_add.pop(file_type)
        
        # Add new files that didn't exist before
        for file_type, file_data in files_to_add.items():
            file_manifest.append(file_data)
        
        manifest["fileManifest"] = file_manifest
        
        # Update task state
        for task in manifest.get("tasks", []):
            if task.get("id") == task_id:
                task["state"] = TASK_DONE
                task["percent"] = 100
                task["updatedAt"] = current_time
                break
        
        # Write updated manifest back to file
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
            
    except Exception as e:
        print(f"Error updating manifest: {e}", file=sys.stderr)
        sys.exit(1)

def fetch_video_info(url: str, quality: str, content_dir: str, hash_id: str, task_id: str) -> None:
    """Main function to fetch video info, download media and update manifest"""
    # Create directories if they don't exist
    original_dir = os.path.join(content_dir, "original")
    os.makedirs(original_dir, exist_ok=True)
    
    manifest_path = os.path.join(content_dir, "manifest.json")
    
    # Report starting progress
    report_progress(0)
    
    try:
        # First, get info JSON to determine video type and availability
        info_json_path = os.path.join(content_dir, "info.json")
        subprocess.run([
            "yt-dlp", 
            "--write-info-json", 
            "--skip-download", 
            "-o", os.path.join(content_dir, "info"),
            url
        ], check=True)
        
        # Load info to get video ID and check if downloadable
        with open(info_json_path, 'r', encoding='utf-8') as f:
            info = json.load(f)
        
        video_id = info.get("id", "unknown")
        media_type = "iframe" if is_iframe_only_video(info_json_path) else "local"
        
        # Report progress after fetching info
        report_progress(20)
        
        files_to_add = {
            FILE_TYPE_INFO_JSON: {
                "type": FILE_TYPE_INFO_JSON,
                "version": 1,
                "path": f"info.json",
                "state": STATE_READY,
                "generatedBy": "yt-dlp",
                "derivedFrom": [],
                "metadata": None
            }
        }
        
        # If media is downloadable, proceed with download
        if media_type == "local":
            # Download thumbnail
            subprocess.run([
                "yt-dlp",
                "--write-thumbnail",
                "--skip-download",
                "--convert-thumbnails", "jpg",
                "-o", os.path.join(original_dir, "thumbnail"),
                url
            ], check=True)
            
            # Find thumbnail file
            thumbnail_path = None
            for file in os.listdir(original_dir):
                if file.startswith("thumbnail") and (file.endswith(".jpg") or file.endswith(".webp")):
                    thumbnail_path = os.path.join("original", file)
                    break
            
            if thumbnail_path:
                files_to_add[FILE_TYPE_ORIGINAL_THUMBNAIL] = {
                    "type": FILE_TYPE_ORIGINAL_THUMBNAIL,
                    "version": 1,
                    "path": thumbnail_path,
                    "state": STATE_READY,
                    "generatedBy": "yt-dlp",
                    "derivedFrom": [],
                    "metadata": None
                }
            
            # Report progress after thumbnail download
            report_progress(30)
            
            # Download media with selected quality
            format_string = get_video_format_for_quality(quality)
            subprocess.run([
                "yt-dlp",
                "-f", format_string,
                "--write-auto-sub",
                "--sub-lang", "en,zh",
                "--convert-subs", "vtt",
                "-o", os.path.join(original_dir, "media.%(ext)s"),
                url
            ], check=True)
            
            # Report progress after media download
            report_progress(80)
            
            # Find media file
            media_path = None
            for file in os.listdir(original_dir):
                if file.startswith("media."):
                    media_path = os.path.join("original", file)
                    break
            
            if media_path:
                # Get video metadata
                dimensions = get_video_dimensions(info_json_path)
                duration = get_video_duration(info_json_path)
                disk_size = get_file_size(os.path.join(content_dir, media_path))
                
                files_to_add[FILE_TYPE_ORIGINAL_MEDIA] = {
                    "type": FILE_TYPE_ORIGINAL_MEDIA,
                    "version": 1,
                    "path": media_path,
                    "state": STATE_READY,
                    "generatedBy": "yt-dlp",
                    "derivedFrom": [],
                    "metadata": {
                        "type": FILE_TYPE_ORIGINAL_MEDIA,
                        "quality": quality,
                        "mediaType": media_type,
                        "duration": duration,
                        "dimensions": dimensions,
                        "diskSize": disk_size,
                        "previousQualities": []
                    }
                }
                
                # Convert and organize subtitles
                transcript_paths = convert_subtitles_to_vtt(video_id, content_dir)
                
                # Add transcript files to manifest
                for transcript_type, path in transcript_paths.items():
                    rel_path = os.path.basename(path)
                    files_to_add[transcript_type] = {
                        "type": transcript_type,
                        "version": 1,
                        "path": rel_path,
                        "state": STATE_READY,
                        "generatedBy": "yt-dlp",
                        "derivedFrom": [FILE_TYPE_ORIGINAL_MEDIA],
                        "metadata": None
                    }
        else:
            # For iframe-only videos, just add the info.json
            # We could potentially add a thumbnail if available from info
            if "thumbnail" in info:
                # Try to download the thumbnail separately
                try:
                    thumbnail_url = info.get("thumbnail")
                    thumbnail_path = os.path.join(original_dir, "thumbnail.jpg")
                    
                    # Use subprocess to download thumbnail
                    subprocess.run([
                        "curl", "-L", thumbnail_url, "-o", thumbnail_path
                    ], check=True)
                    
                    if os.path.exists(thumbnail_path):
                        files_to_add[FILE_TYPE_ORIGINAL_THUMBNAIL] = {
                            "type": FILE_TYPE_ORIGINAL_THUMBNAIL,
                            "version": 1,
                            "path": "original/thumbnail.jpg",
                            "state": STATE_READY,
                            "generatedBy": "yt-dlp",
                            "derivedFrom": [],
                            "metadata": None
                        }
                except Exception as e:
                    print(f"Error downloading thumbnail: {e}", file=sys.stderr)
        
        # Report end progress
        report_progress(100)
        
        # Update manifest with new files and task status
        update_manifest(manifest_path, files_to_add, task_id)
        
    except Exception as e:
        print(f"Error processing video: {e}", file=sys.stderr)
        # Update task state to error in manifest
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            
            current_time = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            
            for task in manifest.get("tasks", []):
                if task.get("id") == task_id:
                    task["state"] = TASK_ERROR
                    task["error"] = str(e)
                    task["updatedAt"] = current_time
                    break
            
            with open(manifest_path, 'w', encoding='utf-8') as f:
                json.dump(manifest, f, indent=2)
        except Exception as inner_e:
            print(f"Error updating manifest with error state: {inner_e}", file=sys.stderr)
        
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch video info and download media using yt-dlp")
    parser.add_argument("--url", required=True, help="URL of the video to download")
    parser.add_argument("--quality", default=QUALITY_BEST, choices=[QUALITY_BEST, QUALITY_1080P, QUALITY_720P, QUALITY_360P], help="Video quality to download")
    parser.add_argument("--content-dir", required=True, help="Content directory path")
    parser.add_argument("--hash-id", required=True, help="Hash ID for the content bucket")
    parser.add_argument("--task-id", required=True, help="Task ID to update in manifest")
    
    args = parser.parse_args()
    
    fetch_video_info(args.url, args.quality, args.content_dir, args.hash_id, args.task_id) 