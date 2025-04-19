#!/usr/bin/env python3
"""
Test script to verify WhisperX installation and functionality.
This script should be run to check if WhisperX is properly installed
and can transcribe audio files with word-level alignment.
Supports testing models: tiny.en, medium.en, and large-v3.
"""

import os
import sys
import json
import argparse
from pathlib import Path

def test_whisperx(model_name="tiny.en"):
    """Test WhisperX functionality with specified model"""
    print(f"Testing WhisperX installation and functionality with model: {model_name}...")
    
    try:
        import whisperx
        import torch
        print("✅ Successfully imported WhisperX and torch")
    except ImportError as e:
        print(f"❌ Failed to import required packages: {e}")
        print("Please install necessary packages:")
        print("pip3 install whisperx torch")
        return False
    
    # Check if a test audio file exists
    test_audio = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                            'test_data', 'test_audio.wav')
    
    if not os.path.exists(test_audio):
        # Try to find any WAV file in the storage directory
        storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                               'storage', 'content-studio')
        
        audio_found = False
        if os.path.exists(storage_dir):
            for root, dirs, files in os.walk(storage_dir):
                for file in files:
                    if file.endswith('.wav'):
                        test_audio = os.path.join(root, file)
                        audio_found = True
                        break
                if audio_found:
                    break
    
    if not os.path.exists(test_audio):
        print("❌ No test audio file found.")
        print("Please ensure there is a WAV file available for testing.")
        return False
    
    print(f"Using test audio file: {test_audio}")
    
    try:
        # Set device to CPU for MacOS
        device = "cpu"
        compute_type = "int8"
        
        # Load audio
        print("Loading audio...")
        audio = whisperx.load_audio(test_audio)
        
        # Load model with specified name
        print(f"Loading WhisperX model ({model_name} for testing)...")
        model = whisperx.load_model(model_name, device, compute_type=compute_type)
        
        # Transcribe
        print("Transcribing audio...")
        result = model.transcribe(audio, batch_size=1)
        
        # Get language
        detected_language = result["language"]
        print(f"Detected language: {detected_language}")
        
        # Load alignment model
        print("Loading alignment model...")
        align_model, align_metadata = whisperx.load_align_model(
            language_code=detected_language,
            device=device
        )
        
        # Align
        print("Performing word-level alignment...")
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
            "test_run": True
        }
        
        # Save result to test output
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                'test_data')
        os.makedirs(output_dir, exist_ok=True)
        
        output_file = os.path.join(output_dir, f'test_whisperx_{model_name.replace("-", "_")}_output.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
        
        print(f"✅ WhisperX test with model {model_name} successful! Output saved to: {output_file}")
        print("\nSample of transcription result:")
        for segment in result["segments"][:2]:  # Show first 2 segments
            print(f"Segment {segment['id']}: {segment['text']}")
            if 'words' in segment:
                print(f"  Word count: {len(segment['words'])}")
                for word in segment['words'][:3]:  # Show first 3 words
                    print(f"  - '{word['word']}': {word['start']:.2f}s to {word['end']:.2f}s")
        
        return True
        
    except Exception as e:
        print(f"❌ WhisperX test failed: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test WhisperX functionality")
    parser.add_argument("--model", default="tiny.en", choices=["tiny.en", "medium.en", "large-v3"],
                        help="WhisperX model to test (default: tiny.en)")
    args = parser.parse_args()
    
    success = test_whisperx(args.model)
    sys.exit(0 if success else 1) 