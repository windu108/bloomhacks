# ---------------------------------------------------------
# 1. IMPORTS & SETUP
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()  # This loads the variables from your .env file!

import os        # Lets Python read your computer's environment variables (like PORT)
import base64    # Used to decode the text-based image back into raw binary file data
import json      # Used to parse structured JSON returned by Gemini
import sys       # Lets us modify how Python looks for other files in your project
from pathlib import Path

from flask import Flask, request, jsonify  # The core tools to build a web server
from flask_cors import CORS                # The security bouncer that lets React in

# Ensure local modules can be imported when the server is run from the backend directory.
sys.path.append(os.path.dirname(__file__))

# Now that Python knows where to look, we can import your custom Gemini functions
from gemini import (
    describe_image_bytes,
    evaluate_and_split_solar_data,
    generate_next_steps_for_solar_context,
    get_estimated_energy_price,
)
from solar_brain import normalize_context_payload, save_user_inputs, solar_context

# Initialize the Flask application. '__name__' just tells Flask where this file lives.
app = Flask(__name__)

# Apply CORS (Cross-Origin Resource Sharing) to your app. 
# Without this, web browsers will block your React app (Port 5173/3000) from talking 
# to this Flask app (Port 5001) because they are considered different "origins".
CORS(app)  


# ---------------------------------------------------------
# 2. ROUTES (The URLs your server listens to)
# ---------------------------------------------------------

# The @ symbol is a "decorator". It tells Flask: "When someone visits 
# http://localhost:5001/health via a GET request, run the function directly below this."
@app.get("/health")
def health():
    # This is a standard practice called a "health check". 
    # It just returns a simple JSON response so you can ping it to see if the server is alive.
    return {"ok": True}


# This is your main heavy lifter. It listens for POST requests, which are used when 
# the client (React) is sending a large amount of data (like an image) to the server.
@app.post("/api/describe-image")
def describe_image():
    # 1. Catch the data sent by React. 'silent=True' means if React sends badly 
    # formatted JSON, Flask won't crash; it just returns None, which we turn into {}.
    data = request.get_json(silent=True) or {}
    
    # 2. Extract the specific pieces of data using the dictionary keys we defined in React.
    image_b64 = data.get("image_b64")
    mime_type = data.get("mime_type")  # Will be None if React didn't provide it
    address = data.get("address")
    monthly_electric_bill = data.get("monthly_electric_bill")
    context_values = normalize_context_payload(data.get("context_values") or {})

    # 3. Validation: If the request didn't include the image data, stop immediately.
    # Return a 400 Bad Request HTTP status code so the frontend knows it messed up.
    if not image_b64:
        return jsonify({"error": "Missing image_b64"}), 400

    # 4. Translation: React sent the image as a giant string of text (Base64).
    # We must convert it back into raw computer bytes so the Gemini SDK can read it.
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        # If the string was corrupted and can't be decoded, catch the error gracefully.
        return jsonify({"error": "Invalid base64"}), 400

    # 5. Save the optional user context to the solar brain helper.
    save_user_inputs(address, monthly_electric_bill)

    if context_values:
        if context_values.get("address") is not None:
            solar_context.set_value("user_inputs", {"address": context_values.get("address")})
        if context_values.get("monthly_electric_bill") is not None:
            solar_context.set_value("user_inputs", {"monthly_electric_bill": context_values.get("monthly_electric_bill")})

        ai_analysis_updates = {}
        for field in ["roof_material", "roof_quality", "roof_tilting", "obstructions", "surface_area", "sunlight_hours", "sunlight_intensity"]:
            if context_values.get(field) is not None:
                ai_analysis_updates[field] = context_values.get(field)

        if ai_analysis_updates:
            solar_context.set_value("ai_image_analysis", ai_analysis_updates)

    # 6. AI Execution: Pass the raw bytes to your custom Gemini function.
    # The code will pause on this line and wait for Google's servers to respond.
    analysis_payload = describe_image_bytes(
        image_bytes,
        mime_type=mime_type,
        address=address,
        monthly_electric_bill=monthly_electric_bill,
        context_values=context_values,
    )

    # 7. Parse the image-analysis JSON and save it into the solar context.
    if isinstance(analysis_payload, dict):
        description = str(analysis_payload.get("description", ""))
        analysis = analysis_payload.get("analysis") or {
            "roof_material": None,
            "roof_quality": None,
            "roof_tilting": None,
            "obstructions": [],
        }
        context_values_out = analysis_payload.get("context_values") or {}
    else:
        description = str(analysis_payload or "")
        try:
            analysis = json.loads(description)
        except (json.JSONDecodeError, TypeError):
            analysis = {
                "roof_material": None,
                "roof_quality": None,
                "roof_tilting": None,
                "obstructions": [],
            }
        context_values_out = {}

    solar_context.set_value("ai_image_analysis", analysis)

    # 8. Ask Gemini for the likely current electricity price for the provided address.
    estimated_energy_price = get_estimated_energy_price(address)
    solar_context.set_value("energy_price", {"estimated_price": estimated_energy_price})
    print("=== ENERGY PRICE DEBUG ===")
    print(estimated_energy_price)

    # 9. Build the summary for the second Gemini evaluation and print it.
    ai_summary = solar_context.compile_summary_for_ai()
    print("=== AI SUMMARY FOR SOLAR EVALUATION ===")
    print(ai_summary)

    # 10. Ask Gemini to evaluate the full solar context and return the score/reasoning.
    score, reasoning = evaluate_and_split_solar_data(ai_summary)
    solar_context.set_value("compatibility_score", {"score": score})
    print(f"=== COMPATIBILITY SCORE DEBUG ===")
    print(f"score={score}")
    print(f"reasoning={reasoning}")

    next_steps = generate_next_steps_for_solar_context(ai_summary, score)
    print("=== NEXT STEPS DEBUG ===")
    print(next_steps)

    # 11. Response: Package the results into a JSON object and ship it back to React.
    return jsonify({
        "description": description,
        "analysis": analysis,
        "summary": ai_summary,
        "estimated_energy_price": estimated_energy_price,
        "evaluation": {
            "score": score,
            "reasoning": reasoning,
        },
        "next_steps": next_steps,
        "context_values": context_values_out,
        "context": solar_context.get_full_context(),
    })


# ---------------------------------------------------------
# 3. SERVER EXECUTION
# ---------------------------------------------------------

# This if-statement is Python's way of asking: "Was this file run directly in the 
# terminal?" (as opposed to being imported by another file).
if __name__ == "__main__":
    # Check if the computer set a specific PORT environment variable. 
    # If not, default to 5001.
    port = int(os.environ.get("PORT", "5001"))
    
    # Start the server! 
    # host="0.0.0.0" means "listen on all network interfaces" (so devices on your local Wi-Fi could reach it).
    # debug=True means the server will auto-restart if you save changes to this file.
    app.run(host="0.0.0.0", port=port, debug=True)