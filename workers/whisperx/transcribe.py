#!/usr/bin/env python3
"""
WhisperX transcription worker for Yanghoo AI.
This script processes extracted audio files and generates word-level transcriptions.
Supports multiple model options: tiny.en, medium.en, and large-v3.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

def update_progress(percent):
    """Print progress update in JSON format for the orchestrator to parse"""
    print(json.dumps({"percent": percent}), flush=True)

def main():
    parser = argparse.ArgumentParser(description="WhisperX transcription worker")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    parser.add_argument("--hashId", required=True, help="Hash ID of the content bucket")
    parser.add_argument("--model", default="medium.en", choices=["tiny.en", "medium.en", "large-v3"], 
                        help="WhisperX model to use (default: medium.en)")
    args = parser.parse_args()
    
    manifest_path = args.manifest
    hash_id = args.hashId
    model_name = args.model
    
    # Load manifest
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"Error loading manifest: {str(e)}", file=sys.stderr)
        return 1
    
    # Find extracted audio file in the manifest
    audio_file = None
    for item in manifest['fileManifest']:
        if item['type'] == 'extracted_audio' and item['state'] == 'ready':
            audio_file = item
            break
    
    if not audio_file:
        print("No ready extracted_audio found in manifest", file=sys.stderr)
        return 1
    
    # Determine full path to audio file
    storage_root = Path(manifest_path).parent
    audio_path = storage_root / audio_file['path']
    
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        return 1
    
    # Create output directory
    output_dir = storage_root / "transcripts" / "whisperx"
    os.makedirs(output_dir, exist_ok=True)
    
    # Define output path
    output_path = output_dir / "transcript.json"
    
    # Update task status to running
    whisperx_task = None
    for task in manifest['tasks']:
        if task['id'] == 'transcribe_whisperx' and task['state'] == 'queued':
            task['state'] = 'running'
            task['startedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            whisperx_task = task
            break
    
    if not whisperx_task:
        print("No queued transcribe_whisperx task found in manifest", file=sys.stderr)
        return 1
    
    # Add whisperx transcript item to file manifest if not exists
    transcript_item = None
    for item in manifest['fileManifest']:
        if item['type'] == 'transcript_whisperx_json':
            transcript_item = item
            item['state'] = 'processing'
            break
    
    if not transcript_item:
        # Create new transcript item
        transcript_path = os.path.join("transcripts", "whisperx", "transcript.json")
        transcript_item = {
            "type": "transcript_whisperx_json",
            "version": 1,
            "path": transcript_path,
            "state": "processing",
            "generatedBy": f"whisperx@1.0.0-{model_name}",
            "derivedFrom": [audio_file['path']],
            "metadata": {
                "modelName": model_name
            }
        }
        manifest['fileManifest'].append(transcript_item)
    else:
        # Update metadata with model information
        if transcript_item['metadata'] is None:
            transcript_item['metadata'] = {}
        transcript_item['metadata']['modelName'] = model_name
        transcript_item['generatedBy'] = f"whisperx@1.0.0-{model_name}"
    
    # Save manifest with updated task status
    with open(manifest_path, 'w', encoding='utf-8') as f:
        manifest['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    # Initialize WhisperX and transcribe
    update_progress(5)
    
    try:
        import whisperx
        import torch
        
        # Set device to CPU for MacOS (can be made configurable for other platforms)
        device = "cpu"
        compute_type = "int8"
        
        # Load audio
        update_progress(10)
        print(f"Loading audio and using model: {model_name}...", file=sys.stderr)
        audio = whisperx.load_audio(str(audio_path))
        
        # Load model
        update_progress(20)
        print(f"Loading WhisperX model {model_name}...", file=sys.stderr)
        model = whisperx.load_model(model_name, device, compute_type=compute_type)
        
        # Transcribe
        update_progress(30)
        print("Transcribing audio...", file=sys.stderr)
        result = model.transcribe(audio, batch_size=1)
        
        # Get language
        detected_language = result["language"]
        print(f"Detected language: {detected_language}", file=sys.stderr)
        
        # Load alignment model
        update_progress(60)
        print("Loading alignment model...", file=sys.stderr)
        align_model, align_metadata = whisperx.load_align_model(
            language_code=detected_language,
            device=device
        )
        
        # Align
        update_progress(70)
        print("Performing word-level alignment...", file=sys.stderr)
        result = whisperx.align(
            result["segments"],
            align_model,
            align_metadata,
            audio,
            device,
            return_char_alignments=False
        )
        
        # Add model information to result
        result["model_info"] = {
            "name": model_name,
            "transcribed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        
        # Save result to output file
        update_progress(90)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
        
        # Print sample of transcription for debugging
        print("\nSample of transcription result:", file=sys.stderr)
        for segment in result["segments"][:2]:  # Show first 2 segments
            print(f"Segment {segment['id']}: {segment['text']}", file=sys.stderr)
            if 'words' in segment:
                print(f"  Word count: {len(segment['words'])}", file=sys.stderr)
                for word in segment['words'][:3]:  # Show first 3 words
                    print(f"  - '{word['word']}': {word['start']:.2f}s to {word['end']:.2f}s", file=sys.stderr)
        
        update_progress(95)
        
        # Update manifest with completed status
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        # Update task state
        for task in manifest['tasks']:
            if task['id'] == 'transcribe_whisperx':
                task['state'] = 'done'
                task['percent'] = 100
                task['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                # Add model info to task context
                if task['context'] is None:
                    task['context'] = {}
                task['context']['modelName'] = model_name
                break
        
        # Update file state
        for item in manifest['fileManifest']:
            if item['type'] == 'transcript_whisperx_json':
                item['state'] = 'ready'
                # Ensure metadata is updated
                if item['metadata'] is None:
                    item['metadata'] = {}
                item['metadata']['modelName'] = model_name
                item['metadata']['wordCount'] = sum(len(segment.get('words', [])) for segment in result['segments'])
                item['metadata']['segmentCount'] = len(result['segments'])
                break
        
        # Save updated manifest
        with open(manifest_path, 'w', encoding='utf-8') as f:
            manifest['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        update_progress(100)
        print(f"WhisperX transcription with model {model_name} completed successfully", file=sys.stderr)
        return 0
        
    except Exception as e:
        print(f"Error in WhisperX transcription: {str(e)}", file=sys.stderr)
        
        # Update manifest with error status
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        # Update task state
        for task in manifest['tasks']:
            if task['id'] == 'transcribe_whisperx':
                task['state'] = 'error'
                task['error'] = str(e)
                task['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                break
        
        # Update file state
        for item in manifest['fileManifest']:
            if item['type'] == 'transcript_whisperx_json':
                item['state'] = 'error'
                break
        
        # Save updated manifest
        with open(manifest_path, 'w', encoding='utf-8') as f:
            manifest['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 