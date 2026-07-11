# ---------------------------------------------------------
# 1. IMPORTS & COMPATIBILITY
# ---------------------------------------------------------
# This special import ensures Python handles modern type hints correctly, 
# allowing us to use clean syntax like 'str | None' even on slightly older Python versions.
from __future__ import annotations 

import os  # Used to look up environment variables from your operating system

# The official Google GenAI library. 'genai' contains the core client tools,
# and 'types' provides rigid data structures required by Google's API.
from google import genai
from google.genai import types  


# ---------------------------------------------------------
# 2. THE AI FUNCTION
# ---------------------------------------------------------
# This function expects 'image_bytes' (raw binary data). 
# The '*' forces 'mime_type' to be a named argument when called, preventing typos.
# '-> str' tells anyone reading the code that this function promises to return text.
def describe_image_bytes(image_bytes: bytes, *, mime_type: str | None = None, address: str | None = None, monthly_electric_bill: str | None = None,) -> str:
    """Describe an image using Gemini and return the text."""

    # This searches your computer for a variable named 'GEMINI_API_KEY'.
    # If it can't find one, it falls back to the hardcoded string provided as the second argument.
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

    # ---------------------------------------------------------
    # 3. TALKING TO THE AI MODEL
    # ---------------------------------------------------------
    prompt_parts = ["Describe this image in a few sentences. Focus on what is shown."]
    if address:
        prompt_parts.append(f"User address: {address}.")
    if monthly_electric_bill:
        prompt_parts.append(f"Estimated monthly electricity bill: {monthly_electric_bill}.")

    # client.models.generate_content is a synchronous network request. 
    # Python will halt completely on this block until Google sends a response back.
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",  # Tells Google exactly which AI engine brain to use
        
        # 'contents' is an array because Gemini handles multi-turn conversations and multi-modal inputs.
        # We are handing it two distinct items simultaneously: an image object and a text instruction.
        contents=[
            # Helper tool that neatly wraps raw binary bytes and pairs them with a mime_type (e.g. 'image/png')
            # so the model knows how to unpack and decode the image file layout.
            types.Part.from_bytes(data=image_bytes, mime_type=mt),
            
            # The context/instruction prompt telling the model what we want it to do with the image.
            " ".join(prompt_parts)
        ],
    )

    # The 'response' object contains metadata (like safety flags and tokens used).
    # We drill down specifically into '.text' to extract just the AI's written words.
    return response.text


# ---------------------------------------------------------
# 4. RUNTIME GUARD
# ---------------------------------------------------------
if __name__ == "__main__":
    # If you run `python gemini.py` directly in your terminal, this block fires.
    # It prints a reminder that this file is a module meant to be driven by app_server.py,
    # rather than acting as a standalone program.
    print("Run via backend/app_server.py")