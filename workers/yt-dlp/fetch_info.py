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
import requests
import logging

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

def extract_and_save_subtitles(info: Dict, content_dir: str) -> Dict[str, str]:
    """Extract subtitle URLs from info.json and download them"""
    # Create logger
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("subtitle_extractor")
    
    transcript_paths = {}
    
    # Create transcripts directory if it doesn't exist
    transcripts_dir = os.path.join(content_dir, "transcripts")
    os.makedirs(transcripts_dir, exist_ok=True)
    
    video_id = info.get('id', 'unknown')
    subtitles = info.get('subtitles', {})
    automatic_captions = info.get('automatic_captions', {})
    
    # 遍历查找英文vtt字幕
    en_url = None
    en_lang_found = None  # 记录找到的实际语言代码
    en_source = None  # 记录字幕来源(手动/自动)
    
    # 首先检查手动字幕
    for lang in ['en', 'en-US', 'en-orig', 'en-GB']:
        if lang in subtitles and not en_url:
            formats = subtitles[lang]
            logger.info(f"找到手动{lang}语言字幕，包含{len(formats)}个格式")
            
            for format_info in formats:
                if format_info.get('ext') == 'vtt':
                    en_url = format_info.get('url')
                    en_lang_found = lang
                    en_source = 'subtitles'
                    logger.info(f"找到英文vtt手动字幕 (语言代码: {lang})")
                    break
    
    # 如果手动字幕中没找到，再检查自动字幕
    if not en_url:
        for lang in ['en', 'en-US', 'en-orig', 'en-GB']:
            if lang in automatic_captions and not en_url:
                formats = automatic_captions[lang]
                logger.info(f"找到自动{lang}语言字幕，包含{len(formats)}个格式")
                
                for format_info in formats:
                    if format_info.get('ext') == 'vtt':
                        en_url = format_info.get('url')
                        en_lang_found = lang
                        en_source = 'automatic_captions'
                        logger.info(f"找到英文vtt自动字幕 (语言代码: {lang})")
                        break
    
    # 遍历查找中文vtt字幕
    zh_url = None
    zh_lang_found = None  # 记录找到的实际语言代码
    zh_source = None  # 记录字幕来源(手动/自动)
    
    # 首先检查手动字幕
    for lang in ['zh', 'zh-Hans', 'zh-CN', 'zh-TW', 'zh-HK']:
        if lang in subtitles and not zh_url:
            formats = subtitles[lang]
            logger.info(f"找到手动{lang}语言字幕，包含{len(formats)}个格式")
            
            for format_info in formats:
                if format_info.get('ext') == 'vtt':
                    zh_url = format_info.get('url')
                    zh_lang_found = lang
                    zh_source = 'subtitles'
                    logger.info(f"找到中文vtt手动字幕 (语言代码: {lang})")
                    break
    
    # 如果手动字幕中没找到，再检查自动字幕
    if not zh_url:
        for lang in ['zh', 'zh-Hans', 'zh-CN', 'zh-TW', 'zh-HK']:
            if lang in automatic_captions and not zh_url:
                formats = automatic_captions[lang]
                logger.info(f"找到自动{lang}语言字幕，包含{len(formats)}个格式")
                
                for format_info in formats:
                    if format_info.get('ext') == 'vtt':
                        zh_url = format_info.get('url')
                        zh_lang_found = lang
                        zh_source = 'automatic_captions'
                        logger.info(f"找到中文vtt自动字幕 (语言代码: {lang})")
                        break
    
    if not en_url:
        logger.warning("未找到英文vtt字幕")
    else:
        # 下载英文字幕
        en_dest_path = os.path.join(transcripts_dir, "transcript_en.vtt")
        try:
            response = requests.get(en_url)
            response.raise_for_status()
            with open(en_dest_path, 'wb') as f:
                f.write(response.content)
            logger.info(f"成功下载英文字幕到 {en_dest_path}")
            transcript_paths[FILE_TYPE_TRANSCRIPT_EN_VTT] = os.path.join("transcripts", "transcript_en.vtt")
        except Exception as e:
            logger.error(f"下载英文字幕失败: {e}")
    
    if not zh_url:
        logger.warning("未找到中文vtt字幕")
    else:
        # 下载中文字幕
        zh_dest_path = os.path.join(transcripts_dir, "transcript_zh.vtt")
        try:
            response = requests.get(zh_url)
            response.raise_for_status()
            with open(zh_dest_path, 'wb') as f:
                f.write(response.content)
            logger.info(f"成功下载中文字幕到 {zh_dest_path}")
            transcript_paths[FILE_TYPE_TRANSCRIPT_ZH_VTT] = os.path.join("transcripts", "transcript_zh.vtt")
        except Exception as e:
            logger.error(f"下载中文字幕失败: {e}")
    
    # 输出找到的字幕信息摘要
    if en_url:
        logger.info(f"英文字幕源: {en_source} (语言代码: {en_lang_found})")
    if zh_url:
        logger.info(f"中文字幕源: {zh_source} (语言代码: {zh_lang_found})")
    
    return transcript_paths

def update_manifest(manifest_path: str, files_to_add: Dict[str, Dict[str, Any]], task_id: str) -> None:
    """Update the manifest.json with new file entries and update task state"""
    try:
        # If manifest doesn't exist, create a basic one
        if not os.path.exists(manifest_path):
            manifest = {
                "id": task_id,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                "fileManifest": [],
                "tasks": [
                    {
                        "id": task_id,
                        "state": TASK_RUNNING,
                        "percent": 0,
                        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
                    }
                ]
            }
        else:
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
        tasks_updated = False
        for task in manifest.get("tasks", []):
            if task.get("id") == task_id:
                task["state"] = TASK_DONE
                task["percent"] = 100
                task["updatedAt"] = current_time
                tasks_updated = True
                break
        
        # Add task if it doesn't exist
        if not tasks_updated:
            if "tasks" not in manifest:
                manifest["tasks"] = []
            manifest["tasks"].append({
                "id": task_id,
                "state": TASK_DONE,
                "percent": 100,
                "createdAt": current_time,
                "updatedAt": current_time
            })
        
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
        
        # Rename info.info.json to info.json if needed
        if not os.path.exists(info_json_path) and os.path.exists(os.path.join(content_dir, "info.info.json")):
            shutil.move(os.path.join(content_dir, "info.info.json"), info_json_path)
        
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
                "-o", os.path.join(original_dir, "media.%(ext)s"),
                url
            ], check=True)
            
            # Report progress after media download
            report_progress(60)
            
            # 从info.json提取并下载字幕
            transcript_paths = extract_and_save_subtitles(info, content_dir)
            
            # Report progress after subtitle extraction
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
                
                # Add transcript files to manifest
                for transcript_type, path in transcript_paths.items():
                    files_to_add[transcript_type] = {
                        "type": transcript_type,
                        "version": 1,
                        "path": path,
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
            # Create manifest if it doesn't exist
            if not os.path.exists(manifest_path):
                manifest = {
                    "id": hash_id,
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                    "fileManifest": [],
                    "tasks": []
                }
            else:
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    manifest = json.load(f)
            
            current_time = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            
            # Find task or create it
            task_found = False
            for task in manifest.get("tasks", []):
                if task.get("id") == task_id:
                    task["state"] = TASK_ERROR
                    task["error"] = str(e)
                    task["updatedAt"] = current_time
                    task_found = True
                    break
            
            if not task_found:
                if "tasks" not in manifest:
                    manifest["tasks"] = []
                manifest["tasks"].append({
                    "id": task_id,
                    "state": TASK_ERROR,
                    "error": str(e),
                    "createdAt": current_time,
                    "updatedAt": current_time
                })
            
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