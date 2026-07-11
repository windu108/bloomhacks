# test_solar.py
import os
from dotenv import load_dotenv

# Import your context manager and your new AI evaluation function
from solar_brain import SolarContext
from gemini import evaluate_and_split_solar_data

# Load environment variables (like GEMINI_API_KEY) before running the test
load_dotenv()

def run_solar_brain_test():
    print("🚀 Starting SolarContext Sandbox Test (using set_value)...\n")
    
    testcase = SolarContext()

    # 1. Populate 'user_inputs' using set_value
    testcase.set_value("user_inputs", {
        "monthly_electric_bill": 185.50,
        "address": "1234 Sunshine Way, Orlando, FL 32816"
    })

    # 2. Populate 'ai_image_analysis' using set_value
    testcase.set_value("ai_image_analysis", {
        "roof_material": "Asphalt Shingle",
        "roof_quality": "Good",
        "roof_tilting": "25 degrees",
        "obstructions": ["small chimney", "minimal tree shade over north side"]
    })

    # 3. Populate 'satelite_data' using set_value
    testcase.set_value("satelite_data", {
        "surface_area": 1450.0  
    })

    # 4. Populate 'sunlight_data' using set_value
    testcase.set_value("sunlight_data", {
        "sunlight_hours": 5.4,
        "sunlight_intensity": "High"
    })

    # ---------------------------------------------------------
    # VERIFY DATA READING
    # ---------------------------------------------------------
    print("--- 🔍 Testing Read / Getter Methods ---")
    address = testcase.get_value("user_inputs", "address")
    print(f"Read Address: {address}\n")

    print("--- 📋 Testing Compiled AI Summary Output ---")
    ai_summary = testcase.compile_summary_for_ai()
    print(ai_summary)
    
    # ---------------------------------------------------------
    # LIVE GEMINI EVALUATION TEST
    # ---------------------------------------------------------
    print("--- 🧠 Sending to Gemini for Final Evaluation ---")
    print("Waiting for AI response...\n")
    
    try:
        # Pass the compiled text into your new Gemini function
        score, reasoning = evaluate_and_split_solar_data(ai_summary)
        
        # Print the successfully split variables!
        print(f"✅ Final Compatibility Score: {score} / 100")
        print(f"✅ AI Reasoning Breakdown:\n{reasoning}\n")
        
        print("✨ Test complete! Full pipeline is working perfectly.")
        
    except Exception as e:
        print(f"❌ Something went wrong calling Gemini: {e}")

if __name__ == "__main__":
    run_solar_brain_test()