import base64
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

import app_server


class AppServerFlowTest(unittest.TestCase):
    def setUp(self):
        self.client = app_server.app.test_client()

    @patch("app_server.evaluate_and_split_solar_data", return_value=(84, "Great fit"))
    @patch("app_server.get_estimated_energy_price", return_value=0.18)
    @patch("app_server.calculate_solar_savings_summary", return_value={"estimated_annual_savings": 2500.0, "total_power_price": 2400.0, "hourly_energy_cost": 0.12, "break_even_year": 7})
    @patch(
        "app_server.describe_image_bytes",
        return_value='{"roof_material": "Asphalt Shingle", "roof_quality": "Good", "roof_tilting": "15 degrees", "obstructions": []}',
    )
    def test_describe_image_endpoint_builds_solar_context(self, describe_mock, evaluate_mock, savings_mock, price_mock):
        image_b64 = base64.b64encode(b"fake-image").decode("ascii")

        response = self.client.post(
            "/api/describe-image",
            json={"image_b64": image_b64, "mime_type": "image/jpeg"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()

        self.assertEqual(payload["analysis"]["roof_material"], "Asphalt Shingle")
        self.assertEqual(payload["evaluation"]["score"], 84)
        self.assertEqual(payload["evaluation"]["reasoning"], "Great fit")
        self.assertEqual(payload["estimated_energy_price"], 0.18)
        self.assertEqual(payload["solar_savings"]["estimated_annual_savings"], 2500.0)
        self.assertEqual(payload["solar_savings"]["total_power_price"], 2400.0)
        self.assertEqual(payload["context"]["energy_price"]["estimated_price"], 0.18)
        self.assertIn("=== AI IMAGE ANALYSIS ===", payload["summary"])

        describe_mock.assert_called_once()
        evaluate_mock.assert_called_once()
        savings_mock.assert_called_once()
        price_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
