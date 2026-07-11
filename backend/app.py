"""
app.py

Simplest possible way to get this matplotlib chart onto a webpage:
one Flask route that builds the chart and returns it as a base64 PNG.
The React frontend just fetches this endpoint and drops the result
into an <img> tag - no other moving parts.

Run with:
    pip install flask matplotlib
    python app.py
Then visit http://127.0.0.1:5000/api/chart directly in a browser to
confirm it returns JSON with a chart_base64 field, or point the React
component at it.
"""

import base64
import io

import matplotlib
matplotlib.use("Agg")  # required so matplotlib doesn't try to open a GUI window
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from flask import Flask, jsonify

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    """Allows the React dev server (different port) to call this API."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


def build_chart():
    """Your original script's logic, unchanged, wrapped in a function."""
    plt.style.use("seaborn-v0_8-whitegrid")

    # --- Hardcoded variables ---
    monthly_bill = 200
    utility_kwh_rate = 0.16
    solar_kw_cost = 2300
    utility_inflation_rate = 0.04
    loan_interest_rate = 0.05
    loan_term_years = 20
    solar_production_factor = 1350
    timeline_years = 25

    # --- Core calculations ---
    monthly_energy_usage_kwh = monthly_bill / utility_kwh_rate
    annual_energy_usage_kwh = monthly_energy_usage_kwh * 12
    required_solar_array_size_kw = annual_energy_usage_kwh / solar_production_factor
    total_solar_system_cost = required_solar_array_size_kw * solar_kw_cost
    financed_loan_principal = total_solar_system_cost

    def calculate_annual_loan_payment(principal, annual_rate, term_years):
        if annual_rate == 0:
            return principal / term_years
        return principal * (annual_rate * (1 + annual_rate) ** term_years) / (
            (1 + annual_rate) ** term_years - 1
        )

    annual_loan_payment = calculate_annual_loan_payment(
        financed_loan_principal, loan_interest_rate, loan_term_years
    )

    # --- Timeline simulation ---
    years = list(range(1, timeline_years + 1))
    utility_cumulative_costs = []
    solar_cumulative_costs = []
    running_utility_total = 0.0
    running_solar_total = 0.0
    base_annual_utility_cost = monthly_bill * 12

    for year in years:
        inflated_annual_utility_cost = base_annual_utility_cost * (
            (1 + utility_inflation_rate) ** (year - 1)
        )
        running_utility_total += inflated_annual_utility_cost
        utility_cumulative_costs.append(running_utility_total)

        annual_solar_cost = annual_loan_payment if year <= loan_term_years else 0.0
        running_solar_total += annual_solar_cost
        solar_cumulative_costs.append(running_solar_total)

    net_25_year_savings = utility_cumulative_costs[-1] - solar_cumulative_costs[-1]

    # --- Find crossover (break-even) year ---
    crossover_index = None
    for i in range(len(years)):
        if solar_cumulative_costs[i] < utility_cumulative_costs[i]:
            crossover_index = i
            break

    crossover_year = years[crossover_index] if crossover_index is not None else None
    crossover_value = solar_cumulative_costs[crossover_index] if crossover_index is not None else None

    # --- Graph ---
    fig, ax = plt.subplots(figsize=(14, 7.5))
    plt.subplots_adjust(right=0.76)

    ax.plot(years, utility_cumulative_costs, linewidth=2.5, color="#D32F2F",
            label="Remaining with Utility", zorder=3)
    ax.plot(years, solar_cumulative_costs, linewidth=3.0, color="#2E7D32",
            label="Switching to Solar", zorder=3)

    if crossover_index is not None:
        shade_years = years[crossover_index:]
        shade_utility = utility_cumulative_costs[crossover_index:]
        shade_solar = solar_cumulative_costs[crossover_index:]
        ax.fill_between(shade_years, shade_solar, shade_utility,
                         color="#A5D6A7", alpha=0.3, zorder=1,
                         label="Cumulative Savings")

        ax.scatter([crossover_year], [crossover_value], color="#1B5E20", s=110,
                   zorder=4, edgecolor="white", linewidth=1.5)
        ax.annotate(
            "Break-Even Year",
            xy=(crossover_year, crossover_value),
            xytext=(crossover_year + 1.2, crossover_value - (max(utility_cumulative_costs) * 0.10)),
            fontsize=10, fontweight="bold", color="#1B5E20",
            arrowprops=dict(arrowstyle="->", color="#1B5E20", lw=1.5),
        )

    ax.axvline(x=loan_term_years, color="gray", linestyle="--", linewidth=1.5, zorder=2)
    ax.text(
        loan_term_years + 0.3, max(utility_cumulative_costs) * 0.05,
        "Solar Loan\nFully Paid Off", fontsize=9, color="dimgray",
        ha="left", va="bottom", style="italic",
    )

    assumptions_text = (
        "ASSUMPTIONS & INPUTS\n"
        "─────────────────────\n\n"
        f"Monthly Utility Bill:\n  ${monthly_bill:,.0f}\n\n"
        f"Utility Rate:\n  ${utility_kwh_rate:.2f}/kWh\n\n"
        f"Solar Cost:\n  ${solar_kw_cost:,.0f}/kW\n\n"
        f"Solar Production Factor:\n  {solar_production_factor:,.0f} kWh/kW/yr\n\n"
        f"Utility Inflation:\n  {utility_inflation_rate * 100:.1f}%/yr\n\n"
        f"Loan Interest Rate:\n  {loan_interest_rate * 100:.1f}%\n\n"
        f"Loan Term:\n  {loan_term_years} years\n\n"
        f"Array Size (calculated):\n  {required_solar_array_size_kw:.2f} kW"
    )
    fig.text(
        0.985, 0.94, assumptions_text,
        fontsize=9.5, ha="right", va="top", linespacing=1.7,
        bbox=dict(boxstyle="round,pad=0.7", facecolor="#FAFAFA", edgecolor="#BDBDBD", alpha=0.95),
    )

    stats_text = (
        "RESULTS\n"
        "─────────────────────\n"
        f"Total Cost of System: ${total_solar_system_cost:,.0f}\n"
        f"Fixed Annual Loan Payment: ${annual_loan_payment:,.0f}\n"
        f"Net 25-Year Savings: ${net_25_year_savings:,.0f}"
    )
    ax.text(
        0.97, 0.03, stats_text,
        transform=ax.transAxes, fontsize=10.5, fontweight="medium",
        ha="right", va="bottom", linespacing=1.6,
        bbox=dict(boxstyle="round,pad=0.6", facecolor="white", edgecolor="#BDBDBD", alpha=0.9),
        zorder=5,
    )

    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    ax.set_xlabel("Years", fontsize=12)
    ax.set_ylabel("Cumulative Cost ($)", fontsize=12)
    ax.set_title("25-Year Cost Comparison: Utility vs. Solar", fontsize=15, fontweight="bold", pad=15)
    ax.set_xlim(1, timeline_years)
    ax.set_ylim(bottom=0)
    ax.legend(loc="upper left", frameon=True, fontsize=10)

    # --- Encode as base64 instead of plt.show() ---
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


@app.route("/api/chart", methods=["GET"])
def get_chart():
    return jsonify({"chart_base64": build_chart()})


if __name__ == "__main__":
    app.run(debug=True)