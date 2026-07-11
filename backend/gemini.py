# ---------------------------------------------------------
# 1. IMPORTS & COMPATIBILITY
# ---------------------------------------------------------
# This special import ensures Python handles modern type hints correctly, 
# allowing us to use clean syntax like 'str | None' even on slightly older Python versions.
from __future__ import annotations 

import os    # Used to look up environment variables from your operating system
import json  # Used to parse JSON strings from the Gemini API into Python dictionaries

# The official Google GenAI library. 'genai' contains the core client tools,
# and 'types' provides rigid data structures required by Google's API.
from google import genai
from google.genai import types  

# ---------------------------------------------------------
# 2. THE VISION FUNCTION
# ---------------------------------------------------------
# This function expects 'image_bytes' (raw binary data). 
# The '*' forces 'mime_type' to be a named argument when called, preventing typos.
# '-> str' tells anyone reading the code that this function promises to return text.
def describe_image_bytes(image_bytes: bytes, *, mime_type: str | None = None) -> str:
    """Describe an image using Gemini and return the text."""

    # This searches your computer for a variable named 'GEMINI_API_KEY'.
    api_key = os.environ.get("GEMINI_API_KEY", "")
    print(f"Using GEMINI_API_KEY: {api_key[:4]}...{api_key[-4:]}")  # Only show the first and last 4 chars for safety

    # Safety check: If both the system variable and the fallback are missing, halt execution.
    if not api_key:
        raise RuntimeError(
            "Missing GEMINI_API_KEY env var. Set it before running the backend."
        )

    # Initialize the official Gemini connection engine using your credential key.
    client = genai.Client(api_key=api_key)
    
    # Fallback safety: If React didn't tell us what file type it was, assume it's a standard JPEG.
    mt = mime_type or "image/jpeg"

    # client.models.generate_content is a synchronous network request. 
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",  # Tells Google exactly which AI engine brain to use
        contents=[
            # Helper tool that neatly wraps raw binary bytes and pairs them with a mime_type (e.g. 'image/png')
            types.Part.from_bytes(data=image_bytes, mime_type=mt),
            # The context/instruction prompt telling the model what we want it to do with the image.
            "Describe this image in a few sentences. Focus on what is shown."
        ],
    )

    # We drill down specifically into '.text' to extract just the AI's written words.
    return response.text


# ---------------------------------------------------------
# 3. THE SOLAR EVALUATION FUNCTION
# ---------------------------------------------------------
# This function accepts the compiled text block from your SolarContext class.
# It returns a tuple containing an int (compatibility score) and a str (reasoning).
def evaluate_and_split_solar_data(ai_summary: str) -> tuple[int, str]:
    """Analyze compiled property summary data and return (score, reasoning)."""
    
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "Missing GEMINI_API_KEY env var. Set it before running the backend."
        )

    # Initialize connection engine
    client = genai.Client(api_key=api_key)

    # Format our structured prompt, demanding strict JSON back from Gemini
    prompt = f"""
    You are an expert solar engineering assessment engine. 
    Analyze the following property data and determine its solar sustainability compatibility.

    PROPERTY DATA:
    {ai_summary}

    INSTRUCTIONS:
    1. Calculate a solar compatibility score between 0 and 100 based strictly on the metrics provided.
    2. Provide a detailed description of your reasoning explaining why you gave that score.

    You MUST return your response strictly as a JSON object matching this exact structure. Do not wrap it in markdown formatting:
    {{
        "score": 85,
        "reasoning": "The detailed breakdown of your analysis goes here..."
    }}
    """

    # Request the generation with an explicit JSON response configuration
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"  # Forces raw JSON format output
        )
    )

    try:
        # Parse the text response into a standard Python dictionary
        result_data = json.loads(response.text)
        
        # Extract individual components and cast them securely to their true types
        compatibility = int(result_data.get("score", 0))
        description = str(result_data.get("reasoning", "No reasoning analysis provided."))
        
        return compatibility, description

    except (json.JSONDecodeError, ValueError, TypeError):
        # Graceful fallback safety net if JSON structure or integer conversion fails
        return 0, "Error parsing or processing the solar evaluation response profile layout."


# ---------------------------------------------------------
# 4. RUNTIME GUARD
# ---------------------------------------------------------
if __name__ == "__main__":
    # If you run `python gemini.py` directly in your terminal, this block fires.
    print("Run via backend/app_server.py")