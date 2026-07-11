"""
solar_vs_utility_sales_graph.py

Sales-presentation version of the 25-year solar vs. utility cumulative
cost comparison. Full system cost is financed (no tax credit applied),
with persuasive visual upgrades: crossover annotation, loan payoff
marker, profit-zone shading, and a summary stats box.
"""

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

plt.style.use("seaborn-v0_8-whitegrid")

# ---------------------------------------------------------------------------
# 1. HARDCODED VARIABLES - modify these to plug into a UI later
# ---------------------------------------------------------------------------
monthly_bill = 200              # Homeowner's current monthly utility bill ($)
utility_kwh_rate = 0.16         # Current cost per kWh in their area ($)
solar_kw_cost = 2300            # Base installed cost per kW of solar ($)
utility_inflation_rate = 0.04   # Annual utility price inflation (4%)
loan_interest_rate = 0.05       # Annual interest rate for solar loan (5%)
loan_term_years = 20            # Solar loan term (years)
solar_production_factor = 1350  # Avg annual kWh produced per 1 kW installed
timeline_years = 25             # Total comparison timeline


# ---------------------------------------------------------------------------
# 2. CORE CALCULATIONS
# ---------------------------------------------------------------------------
monthly_energy_usage_kwh = monthly_bill / utility_kwh_rate
annual_energy_usage_kwh = monthly_energy_usage_kwh * 12

required_solar_array_size_kw = annual_energy_usage_kwh / solar_production_factor
total_solar_system_cost = required_solar_array_size_kw * solar_kw_cost

financed_loan_principal = total_solar_system_cost


def calculate_annual_loan_payment(principal, annual_rate, term_years):
    """Standard fixed annual amortized loan payment. Handles 0% rate safely."""
    if annual_rate == 0:
        return principal / term_years
    return principal * (annual_rate * (1 + annual_rate) ** term_years) / (
        (1 + annual_rate) ** term_years - 1
    )


annual_loan_payment = calculate_annual_loan_payment(
    financed_loan_principal, loan_interest_rate, loan_term_years
)

# Console validation output
print(f"Required Solar Array Size: {required_solar_array_size_kw:.2f} kW")
print(f"Total Solar System Cost: ${total_solar_system_cost:,.2f}")
print(f"Fixed Annual Loan Payment (Years 1-{loan_term_years}): ${annual_loan_payment:,.2f}")


# ---------------------------------------------------------------------------
# 3. TIMELINE SIMULATION (Year 1 to Year 25)
# ---------------------------------------------------------------------------
years = list(range(1, timeline_years + 1))

utility_cumulative_costs = []
solar_cumulative_costs = []

running_utility_total = 0.0
running_solar_total = 0.0

base_annual_utility_cost = monthly_bill * 12

for year in years:
    # --- Utility baseline: compounds with inflation each year ---
    inflated_annual_utility_cost = base_annual_utility_cost * (
        (1 + utility_inflation_rate) ** (year - 1)
    )
    running_utility_total += inflated_annual_utility_cost
    utility_cumulative_costs.append(running_utility_total)

    # --- Solar: fixed loan payment during loan term, $0 after (100% offset assumed) ---
    annual_solar_cost = annual_loan_payment if year <= loan_term_years else 0.0
    running_solar_total += annual_solar_cost
    solar_cumulative_costs.append(running_solar_total)

net_25_year_savings = utility_cumulative_costs[-1] - solar_cumulative_costs[-1]


# ---------------------------------------------------------------------------
# 4. FIND CROSSOVER (BREAK-EVEN) YEAR
# ---------------------------------------------------------------------------
# First index where solar cumulative cost drops below utility cumulative cost
crossover_index = None
for i in range(len(years)):
    if solar_cumulative_costs[i] < utility_cumulative_costs[i]:
        crossover_index = i
        break

crossover_year = years[crossover_index] if crossover_index is not None else None
crossover_value = solar_cumulative_costs[crossover_index] if crossover_index is not None else None


# ---------------------------------------------------------------------------
# 5. GRAPH
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(14, 7.5))
plt.subplots_adjust(right=0.76)  # reserve a side margin for the assumptions panel

ax.plot(years, utility_cumulative_costs, linewidth=2.5, color="#D32F2F",
        label="Remaining with Utility", zorder=3)
ax.plot(years, solar_cumulative_costs, linewidth=3.0, color="#2E7D32",
        label="Switching to Solar", zorder=3)

# Shade the "profit zone" - only where solar has crossed below utility
if crossover_index is not None:
    shade_years = years[crossover_index:]
    shade_utility = utility_cumulative_costs[crossover_index:]
    shade_solar = solar_cumulative_costs[crossover_index:]
    ax.fill_between(shade_years, shade_solar, shade_utility,
                     color="#A5D6A7", alpha=0.3, zorder=1,
                     label="Cumulative Savings")

# Crossover / break-even marker
if crossover_index is not None:
    ax.scatter([crossover_year], [crossover_value], color="#1B5E20", s=110,
               zorder=4, edgecolor="white", linewidth=1.5)
    ax.annotate(
        "Break-Even Year",
        xy=(crossover_year, crossover_value),
        xytext=(crossover_year + 1.2, crossover_value - (max(utility_cumulative_costs) * 0.10)),
        fontsize=10, fontweight="bold", color="#1B5E20",
        arrowprops=dict(arrowstyle="->", color="#1B5E20", lw=1.5),
    )

# Year 20 - loan payoff marker
ax.axvline(x=loan_term_years, color="gray", linestyle="--", linewidth=1.5, zorder=2)
ax.text(
    loan_term_years + 0.3, max(utility_cumulative_costs) * 0.05,
    "Solar Loan\nFully Paid Off", fontsize=9, color="dimgray",
    ha="left", va="bottom", style="italic",
)

# Assumptions & Inputs panel - placed in the reserved right-hand margin
# (figure coordinates, not axes coordinates, so it can never overlap the lines)
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

# Summary stats box (lower-right corner of the plot area) - the outcome numbers
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

# Axis / title formatting
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
ax.set_xlabel("Years", fontsize=12)
ax.set_ylabel("Cumulative Cost ($)", fontsize=12)
ax.set_title("25-Year Cost Comparison: Utility vs. Solar", fontsize=15, fontweight="bold", pad=15)
ax.set_xlim(1, timeline_years)
ax.set_ylim(bottom=0)
ax.legend(loc="upper left", frameon=True, fontsize=10)

plt.show()

