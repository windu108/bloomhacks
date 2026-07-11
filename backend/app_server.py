# ---------------------------------------------------------
# 1. IMPORTS & SETUP
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()  # This loads the variables from your .env file!

import os        # Lets Python read your computer's environment variables (like PORT)
import base64    # Used to decode the text-based image back into raw binary file data
import json      # Used to parse structured JSON returned by Gemini
import sys       # Lets us modify how Python looks for other files in your project

from flask import Flask, request, jsonify  # The core tools to build a web server
from flask_cors import CORS                # The security bouncer that lets React in

# Ensure local modules can be imported when the server is run from the backend directory.
sys.path.append(os.path.dirname(__file__))

# Now that Python knows where to look, we can import your custom Gemini functions
from gemini import describe_image_bytes, evaluate_and_split_solar_data
from solar_brain import SolarContext

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

    # 5. AI Execution: Pass the raw bytes to your custom Gemini function.
    # The code will pause on this line and wait for Google's servers to respond.
    description = describe_image_bytes(image_bytes, mime_type=mime_type)

    # 6. Parse the AI's structured JSON response into a dictionary.
    try:
        analysis = json.loads(description)
    except (json.JSONDecodeError, TypeError):
        analysis = {
            "roof_material": None,
            "roof_quality": None,
            "roof_tilting": None,
            "obstructions": [],
        }

    # 7. Populate the SolarContext with image-analysis data.
    context = SolarContext()
    context.set_value("ai_image_analysis", analysis)

    # 8. Optionally merge any user-supplied inputs into the context when present.
    for category in ("user_inputs", "satelite_data", "sunlight_data"):
        if category in data:
            context.set_value(category, data[category])

    # 9. Build the text summary for the second Gemini evaluation and print it.
    ai_summary = context.compile_summary_for_ai()
    print("=== AI SUMMARY FOR SOLAR EVALUATION ===")
    print(ai_summary)

    # 10. Ask Gemini to evaluate the full solar context and return the score/reasoning.
    score, reasoning = evaluate_and_split_solar_data(ai_summary)
    context.set_value("compatibility_score", {"score": score})

    # 11. Response: Package the results into a JSON object for the frontend.
    return jsonify({
        "description": description,
        "analysis": analysis,
        "summary": ai_summary,
        "evaluation": {
            "score": score,
            "reasoning": reasoning,
        },
        "context": context.get_full_context(),
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