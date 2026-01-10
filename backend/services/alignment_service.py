"""Montreal Forced Aligner service for word-level audio alignment."""
import os
import shutil
import tempfile
import uuid
from typing import Dict
from utils.text_utils import split_text_into_words, clean_text_for_alignment
from utils.docker_utils import execute_in_container


def align_text_with_mfa(audio_path: str, text: str, mfa_container: str = "mfa_aligner") -> Dict:
    """Use Montreal Forced Aligner to align text with audio and get timestamps.
    
    Args:
        audio_path: Path to the audio file
        text: Text to align with audio
        mfa_container: Name of the MFA container
        
    Returns:
        Dictionary with word-level timestamps:
        {
            "words": ["word1", "word2", ...],
            "timestamps": [
                {"word": "word1", "start": 0.0, "end": 0.5},
                ...
            ]
        }
    """
    try:
        # Create working directories in shared volume
        workdir = "/mfa_workdir"
        os.makedirs(workdir, exist_ok=True)
        
        # Create unique subdirectories for this job
        job_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(workdir, f"mfa_input_{job_id}")
        output_dir = os.path.join(workdir, f"mfa_output_{job_id}")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Copy audio to input directory
            audio_name = "audio.wav"
            audio_in_container = os.path.join(input_dir, audio_name)
            shutil.copy(audio_path, audio_in_container)
            
            # Clean text for alignment
            clean_text = clean_text_for_alignment(text)
            
            # Create transcript file in input directory
            transcript_file = os.path.join(input_dir, "audio.txt")
            with open(transcript_file, 'w') as f:
                f.write(clean_text)
            
            # Run MFA alignment using Docker
            output_textgrid = os.path.join(output_dir, "audio.TextGrid")
            cmd = f"mfa align_one {audio_in_container} {transcript_file} english_us_arpa english_us_arpa {output_textgrid}"
            
            exit_code, output = execute_in_container(mfa_container, cmd)
            
            if exit_code != 0:
                print(f"MFA alignment error: {output.decode()}")
                return {"words": [], "timestamps": []}
            
            # Parse the resulting TextGrid file
            textgrid_file = os.path.join(output_dir, "audio.TextGrid")
            
            if os.path.exists(textgrid_file):
                timestamps = _parse_textgrid(textgrid_file, clean_text)
                return timestamps
            else:
                print("TextGrid file not found after alignment")
                return {"words": [], "timestamps": []}
                
        finally:
            # Clean up working directories
            for dir_path in [input_dir, output_dir]:
                try:
                    shutil.rmtree(dir_path, ignore_errors=True)
                except:
                    pass
            
    except Exception as e:
        print(f"Error in MFA alignment: {str(e)}")
        return {"words": [], "timestamps": []}


def _parse_textgrid(textgrid_path: str, original_text: str) -> Dict:
    """Parse TextGrid file and extract word-level timestamps.
    
    Args:
        textgrid_path: Path to the TextGrid file from MFA
        original_text: Original text for reference
        
    Returns:
        Dictionary with words and timestamps
    """
    try:
        words = split_text_into_words(original_text)
        timestamps = []
        
        # Read TextGrid file
        with open(textgrid_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Find xmin and xmax of the file
        file_xmin = None
        file_xmax = None
        
        for line in lines[:50]:
            if line.strip().startswith('xmin'):
                file_xmin = float(line.split('=')[1].strip())
            elif line.strip().startswith('xmax'):
                file_xmax = float(line.split('=')[1].strip())
        
        print(f"TextGrid time range: {file_xmin} to {file_xmax}")
        
        # Find words tier and parse intervals
        in_words_tier = False
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            # Detect tier markers
            if line.startswith('item ['):
                if i + 1 < len(lines):
                    for j in range(i + 1, min(i + 5, len(lines))):
                        check_line = lines[j].strip()
                        if 'name = "words"' in check_line or 'name = "word"' in check_line:
                            in_words_tier = True
                            break
                        elif check_line.startswith('item ['):
                            in_words_tier = False
                            break
                    if 'name' not in ''.join(lines[i+1:min(i+5, len(lines))]):
                        in_words_tier = False
            
            # Parse intervals in words tier only
            if in_words_tier and 'intervals [' in line:
                try:
                    start_time = None
                    end_time = None
                    word_text = None
                    
                    # Look ahead for xmin, xmax, text
                    j = i
                    while j < len(lines) and j < i + 5:
                        curr = lines[j].strip()
                        if 'xmin' in curr and '=' in curr:
                            start_time = float(curr.split('=')[1].strip())
                        elif 'xmax' in curr and '=' in curr:
                            end_time = float(curr.split('=')[1].strip())
                        elif 'text' in curr and '=' in curr:
                            if '"' in curr:
                                parts = curr.split('"')
                                if len(parts) >= 2:
                                    word_text = parts[1]
                            break
                        j += 1
                    
                    # Only add non-empty words
                    if (word_text and word_text.strip() and 
                        word_text not in ['sil', '<SIL>'] and 
                        start_time is not None and end_time is not None):
                        timestamps.append({
                            "word": word_text,
                            "start": round(start_time, 3),
                            "end": round(end_time, 3)
                        })
                except (ValueError, IndexError) as e:
                    print(f"Error parsing interval: {e}")
                    pass
            
            # Exit when we hit next tier
            if in_words_tier and line.startswith('item [') and 'name = "words"' not in ''.join(lines[i:min(i+4, len(lines))]):
                in_words_tier = False
            
            i += 1
        
        print(f"Parsed {len(timestamps)} words from TextGrid")
        
        if timestamps:
            return {
                "words": [ts["word"] for ts in timestamps],
                "timestamps": timestamps
            }
        else:
            print("No timestamps found in TextGrid")
            return {"words": [], "timestamps": []}
        
    except Exception as e:
        print(f"Error parsing TextGrid: {str(e)}")
        return {"words": [], "timestamps": []}
