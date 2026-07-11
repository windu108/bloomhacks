# test_case.py
import os
import time
from dotenv import load_dotenv

from solar_brain import SolarContext
from gemini import evaluate_and_split_solar_data

load_dotenv()

def run_stress_tests():
    print("🚀 Starting Installer-Grade Solar AI Stress Test Suite...\n")
    
    scenarios = [
        {
            "name": "1. THE AGING ROOF DILEMMA",
            "desc": "Perfect financial profile (huge bill, great sun), but the roof is 18 years old and weathered. (Should be a cautious ~50-60 score, advising roof replacement first).",
            "inputs": {"monthly_electric_bill": 290.00, "address": "Orlando, FL"},
            "vision": {"roof_material": "Asphalt Shingle", "roof_quality": "Weathered / Aged (15+ years old)", "roof_tilting": "25 degrees", "obstructions": []},
            "sat": {"surface_area": 1800.0},
            "sun": {"sunlight_hours": 5.4, "sunlight_intensity": "High"}
        },
        {
            "name": "2. THE SPACE DEFICIT",
            "desc": "High power user ($320 bill) with great sun, but a tiny townhome roof layout. (Should be ~45-55 score because they can't fit enough panels to clear their bill).",
            "inputs": {"monthly_electric_bill": 320.00, "address": "Phoenix, AZ"},
            "vision": {"roof_material": "Asphalt Shingle", "roof_quality": "Good", "roof_tilting": "15 degrees", "obstructions": []},
            "sat": {"surface_area": 280.0}, # Way too small for a $320 footprint
            "sun": {"sunlight_hours": 6.2, "sunlight_intensity": "Very High"}
        },
        {
            "name": "3. THE PARTIAL BLIND SPOT (MISSING DATA)",
            "desc": "Great asphalt roof and good sun, but the user skipped entering their electric bill and address. (Should trigger a neutral ~50 'Uncertain' score, demanding bill history).",
            "inputs": {"monthly_electric_bill": None, "address": "Unknown Location"},
            "vision": {"roof_material": "Asphalt Shingle", "roof_quality": "Excellent", "roof_tilting": "20 degrees", "obstructions": []},
            "sat": {"surface_area": 1500.0},
            "sun": {"sunlight_hours": 4.8, "sunlight_intensity": "Medium"}
        },
        {
            "name": "4. THE CLAY TILE & SHADE COMBO",
            "desc": "High electric bill, but it's a brittle Clay Tile roof (expensive install) with moderate tree shade blockages. (Should hover around ~50 due to high installation overhead vs reduced output).",
            "inputs": {"monthly_electric_bill": 220.00, "address": "Miami, FL"},
            "vision": {"roof_material": "Clay Tile", "roof_quality": "Good", "roof_tilting": "30 degrees", "obstructions": ["Mature oak trees shading west side", "Large chimney block"]},
            "sat": {"surface_area": 1600.0},
            "sun": {"sunlight_hours": 5.1, "sunlight_intensity": "High"}
        },
        {
            "name": "5. THE LOW-BILL ECO-ENTHUSIAST",
            "desc": "Structurally flawless roof, massive surface area, and endless sun. But their bill is only $45 a month. (Should be ~40-50 because the equipment will take 20 years to pay itself off).",
            "inputs": {"monthly_electric_bill": 45.00, "address": "Las Vegas, NV"},
            "vision": {"roof_material": "Standing-Seam Metal", "roof_quality": "Excellent", "roof_tilting": "10 degrees", "obstructions": []},
            "sat": {"surface_area": 2200.0},
            "sun": {"sunlight_hours": 5.8, "sunlight_intensity": "Very High"}
        }
    ]

    for index, scenario in enumerate(scenarios):
        print(f"==================================================")
        print(f"🧪 RUNNING TEST {index + 1}: {scenario['name']}")
        print(f"Expected Line: {scenario['desc']}")
        print(f"==================================================")
        
        testcase = SolarContext()
        
        testcase.set_value("user_inputs", scenario["inputs"])
        testcase.set_value("ai_image_analysis", scenario["vision"])
        testcase.set_value("satelite_data", scenario["sat"])
        testcase.set_value("sunlight_data", scenario["sun"])
        
        ai_summary = testcase.compile_summary_for_ai()
        
        try:
            score, reasoning = evaluate_and_split_solar_data(ai_summary)
            print(f"📊 AI SCORE: {score} / 100")
            print(f"💬 AI SUPPORT REASONING:\n{reasoning}\n")
        except Exception as e:
            print(f"❌ FAILED TO GET GENERATION: {e}\n")
            
        print("Waiting 4 seconds to protect API rate-limits...\n")
        time.sleep(4)

    print("🏁 ALL BORDERLINE STRESS TESTS COMPLETE!")

if __name__ == "__main__":
    run_stress_tests()