# ---------------------------------------------------------
# 1. IMPORTS & COMPATIBILITY
# ---------------------------------------------------------
# This special import ensures Python handles modern type hints correctly, 
# allowing us to use clean syntax like 'str | None' even on slightly older Python versions.
from __future__ import annotations 

import json  # Used to parse JSON strings from the Gemini API into Python dictionaries
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

    # Targeted architectural extraction prompt
    prompt = """
    You are an expert satellite and aerial imagery analysis engine for solar installations.
    Analyze this image of a residential property roof and extract the required parameters.

    EXTRACTION RULES:
    1. roof_material: Identify the material (e.g., 'Asphalt Shingle', 'Standing-Seam Metal', 'Clay Tile', 'Concrete Tile', 'Slate', 'Flat Tar'). If unknown, use null.
    2. roof_quality: Assess the structural condition based on visible weathering (e.g., 'Excellent', 'Good', 'Weathered / Aged', 'Needs Repair'). If unknown, use null.
    3. roof_tilting: Estimate the roof slope or pitch layout (e.g., 'Flat', '15 degrees', '25 degrees', 'Steep'). If unknown, use null.
    4. obstructions: List any physical objects blocking clear sunlight exposure (e.g., 'tree overhang', 'large chimney', 'skylight', 'plumbing vents'). Return an empty array [] if clear.

    You MUST return your response strictly as a JSON object matching this exact structure. Do not wrap it in markdown code blocks:
    {
        "roof_material": "Asphalt Shingle",
        "roof_quality": "Good",
        "roof_tilting": "25 degrees",
        "obstructions": ["large chimney", "tree overhang"]
    }
    """

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
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"  # Forces the engine to return a raw JSON string
        )
    )

    # We drill down specifically into '.text' to extract the AI's JSON structured string.
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

    # Completely realistic, installer-grade screening prompt
    prompt = f"""
    You are a friendly, consultative solar support expert. Your primary goal is to look at a property's data and determine if switching to solar is a genuinely cost-effective, high-return investment for the homeowner.

    PROPERTY DATA:
    {ai_summary}

    FACTOR WEIGHTING GUIDE (How to calculate the score):
    1. CRITICAL FINANCIAL & SAFETY LIMITATIONS (Weight: Highest - Overrides everything else):
       - The Space Deficit (High Bill + Tiny Roof): If a homeowner has a high electric bill (over $200) but a small roof surface area (under 400 sq ft), the score MUST be capped below 55. You must realize that a high bill requires a massive solar system. If they only have 280 sq ft, they physically cannot fit enough panels to offset a bill that large. Do NOT let a high bill inflate the score if they don't have the space to install panels!
       - Roof Age & Condition: If the roof is 'Weathered', 'Aged', or 'Needs Repair', cap the score below 50. Advise fixing the roof first because detaching and reinstalling panels later costs thousands.
       - Tiny Electric Bill: If their monthly bill is exceptionally low (under $50), cap the score below 50. Upfront equipment costs will take decades to break even.

    2. EFFICIENCY DRIVERS (Weight: Medium-High):
       - Heavy Shade / Obstructions: Large trees or massive building shadows that block major parts of the roof drastically lower system efficiency.
       - Poor Sun Hours: Low regional sunlight availability slows down their return on investment.

    3. MINOR ADJUSTMENTS (Weight: Low - Minimal deductions):
       - Small tilt variations or single minor obstructions (like a plumbing vent or a single small chimney) are normal and should only cause tiny deductions.

TONE & STYLE INSTRUCTIONS:
    - Act like an honest, supportive human adviser who genuinely cares about the homeowner's wallet. Avoid rigid, dry, robotic language.
    - Be clear about physical or economic constraints.
    - CONDITIONAL ACTIONABLE ADVICE RULE:
      * IF NOT SUITABLE FOR SOLAR (Score is under 60): Do not push solar on them. Instead, use your final bullets to give them alternative, highly practical advice for reducing their home energy usage instead (e.g., switching to a smart thermostat, upgrading attic insulation, upgrading old appliances, or checking for window air leaks).
      * IF COMPATIBLE WITH SOLAR (Score is 60 or above): Teach them exactly how to get started on their solar journey (e.g., gathering 12 months of consecutive electric bills, checking local net-metering policies, and finding a reputable local installer who offers production guarantees).
    - Write the 'reasoning' section using clean, plain-English bullet points.

    You MUST return your response strictly as a JSON object matching this exact structure. Do not wrap it in markdown code blocks:
    {{
        "score": 50,
        "reasoning": "- [Friendly bullet point highlighting their roof suitability or major constraints]\\n- [Bullet point breaking down the financial logic of their bill vs available spacing or weather]\\n- [Actionable bullet point: If unsuitable, alternative energy-saving tips. If compatible, how to get started with solar]"
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
    # It prints a reminder that this file is a module meant to be driven by app_server.py,
    # rather than acting as a standalone program.
    print("Run via backend/app_server.py")