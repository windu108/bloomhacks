"""Quick test to verify Gemini API connectivity with gemini-3.1-flash-lite model."""
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY", "")
if not api_key:
    print("❌ No GEMINI_API_KEY found in .env file")
    sys.exit(1)

print(f"✅ API Key found: {api_key[:8]}...{api_key[-4:]}")

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)

print("🧪 Testing model: gemini-3.1-flash-lite")
print("Sending test prompt...\n")

try:
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents="Say exactly: 'Hello from Gemini 3.1 flash lite API is working!' and nothing else.",
        config=types.GenerateContentConfig(
            response_mime_type="text/plain"
        ),
    )
    text = getattr(response, "text", "") or ""
    print(f"✅ RESPONSE: {text}")
    print("\n🎉 API connection successful! Model 'gemini-3.1-flash-lite' is working.")
except Exception as e:
    error_str = str(e)
    print(f"❌ ERROR: {error_str}")
    
    # Check for model not found error
    if "not found" in error_str.lower() or "model" in error_str.lower() or "404" in error_str:
        print("\n⚠️  The model 'gemini-3.1-flash-lite' might not exist.")
        print("   Let's try alternative model names...")
        
        models_to_try = [
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash",
            "gemini-1.5-flash-lite",
            "gemini-1.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
        ]
        
        for model_name in models_to_try:
            print(f"\nTrying: {model_name}")
            try:
                r = client.models.generate_content(
                    model=model_name,
                    contents="Say 'OK' and nothing else.",
                )
                print(f"   ✅ SUCCESS with {model_name}: {getattr(r, 'text', '')}")
                break
            except Exception as e2:
                print(f"   ❌ Failed: {str(e2)[:100]}")
    else:
        print(f"\n⚠️  Error type: {type(e).__name__}")

