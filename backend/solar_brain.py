

class SolarContext:
    def __init__(self):
        # This dictionary will hold all the factors that influence solar panel compatibility score.
        # Everything starts as None or empty because all factors are optional!
        self.data = {
            "user_inputs": {
                "monthly_electric_bill": None,
                "address": None,
            },
            "ai_image_analysis": {
                "roof_material": None,     
                "roof_quality": None,   
                "roof_tilting": None,    
                "obstructions": [],        
            },
            "satelite_data": {
                "surface_area": None, 
            },
            "sunlight_data": {
                "sunlight_hours": None,  
                "sunlight_intensity": None,
            },
            "compatibility_score": {
                "score": None,
            }
        }

    # ---------------------------------------------------------
    # WRITE / UPDATE METHODS
    # ---------------------------------------------------------
    def set_value(self, category: str, updates: dict):
        """Allows any program to update a specific category safely."""
        if category in self.data:
            self.data[category].update(updates)

    # ---------------------------------------------------------
    # NEW: READ / VALUE METHODS
    # ---------------------------------------------------------
    def get_value(self, category: str, key: str, default=None):
        """
        Safely reads a single value. If the category or key doesn't exist yet, 
        it returns your default (None) instead of crashing the program.
        """
        return self.data.get(category, {}).get(key, default)

    def get_full_context(self) -> dict:
        """
        Returns the entire clipboard dictionary. 
        Incredibly useful for sending the current state back to your React frontend!
        """
        return self.data

    # ---------------------------------------------------------
    # COMPILING METHODS
    # ---------------------------------------------------------
    def compile_summary_for_ai(self) -> str:
        """Converts the clipboard into a clean, text-based summary for Gemini."""
        summary_lines = []
        
        for category, factors in self.data.items():
            summary_lines.append(f"=== {category.upper().replace('_', ' ')} ===")
            
            for key, value in factors.items():
                friendly_name = key.replace('_', ' ').title()
                if value is not None and value != []:
                    summary_lines.append(f"- {friendly_name}: {value}")
                else:
                    summary_lines.append(f"- {friendly_name}: Not Provided")
            summary_lines.append("") # blank line for spacing
            
        return "\n".join(summary_lines)