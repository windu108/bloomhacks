"""Utilities for calculating solar savings and rendering the related chart."""

from __future__ import annotations

from typing import Any

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

plt.style.use("seaborn-v0_8-whitegrid")

DEFAULT_MONTHLY_BILL = 200
DEFAULT_UTILITY_KWH_RATE = 0.16
DEFAULT_SOLAR_KW_COST = 2300
DEFAULT_UTILITY_INFLATION_RATE = 0.04
DEFAULT_LOAN_INTEREST_RATE = 0.05
DEFAULT_LOAN_TERM_YEARS = 20
DEFAULT_SOLAR_PRODUCTION_FACTOR = 1350
DEFAULT_TIMELINE_YEARS = 25


def calculate_annual_loan_payment(principal: float, annual_rate: float, term_years: int) -> float:
    """Standard fixed annual amortized loan payment. Handles 0% rate safely."""
    if annual_rate == 0:
        return principal / term_years
    return principal * (annual_rate * (1 + annual_rate) ** term_years) / (
        (1 + annual_rate) ** term_years - 1
    )


def calculate_solar_savings_summary(
    monthly_bill: float | int | str = DEFAULT_MONTHLY_BILL,
    utility_kwh_rate: float | int | str = DEFAULT_UTILITY_KWH_RATE,
    solar_kw_cost: float | int = DEFAULT_SOLAR_KW_COST,
    utility_inflation_rate: float | int = DEFAULT_UTILITY_INFLATION_RATE,
    loan_interest_rate: float | int = DEFAULT_LOAN_INTEREST_RATE,
    loan_term_years: int = DEFAULT_LOAN_TERM_YEARS,
    solar_production_factor: float | int = DEFAULT_SOLAR_PRODUCTION_FACTOR,
    timeline_years: int = DEFAULT_TIMELINE_YEARS,
) -> dict[str, Any]:
    """Return the key savings metrics needed by the upload page."""
    monthly_bill_value = float(monthly_bill)
    utility_kwh_rate_value = float(utility_kwh_rate)

    monthly_energy_usage_kwh = monthly_bill_value / utility_kwh_rate_value
    annual_energy_usage_kwh = monthly_energy_usage_kwh * 12

    required_solar_array_size_kw = annual_energy_usage_kwh / float(solar_production_factor)
    total_solar_system_cost = required_solar_array_size_kw * float(solar_kw_cost)
    financed_loan_principal = total_solar_system_cost
    annual_loan_payment = calculate_annual_loan_payment(
        financed_loan_principal,
        float(loan_interest_rate),
        int(loan_term_years),
    )

    years = list(range(1, int(timeline_years) + 1))
    utility_cumulative_costs: list[float] = []
    solar_cumulative_costs: list[float] = []

    running_utility_total = 0.0
    running_solar_total = 0.0
    base_annual_utility_cost = monthly_bill_value * 12

    for year in years:
        inflated_annual_utility_cost = base_annual_utility_cost * (
            (1 + float(utility_inflation_rate)) ** (year - 1)
        )
        running_utility_total += inflated_annual_utility_cost
        utility_cumulative_costs.append(running_utility_total)

        annual_solar_cost = annual_loan_payment if year <= int(loan_term_years) else 0.0
        running_solar_total += annual_solar_cost
        solar_cumulative_costs.append(running_solar_total)

    net_25_year_savings = utility_cumulative_costs[-1] - solar_cumulative_costs[-1]

    crossover_index = None
    for i in range(len(years)):
        if solar_cumulative_costs[i] < utility_cumulative_costs[i]:
            crossover_index = i
            break

    crossover_year = years[crossover_index] if crossover_index is not None else None

    monthly_cost_without_solar = monthly_bill_value
    monthly_cost_with_solar = annual_loan_payment / 12.0
    estimated_annual_savings = max(0.0, (monthly_cost_without_solar - monthly_cost_with_solar) * 12.0)
    total_power_price = monthly_bill_value * 12.0
    hourly_energy_cost = utility_kwh_rate_value

    return {
        "monthly_bill": monthly_bill_value,
        "utility_kwh_rate": utility_kwh_rate_value,
        "required_solar_array_size_kw": required_solar_array_size_kw,
        "total_solar_system_cost": total_solar_system_cost,
        "annual_loan_payment": annual_loan_payment,
        "net_25_year_savings": net_25_year_savings,
        "break_even_year": crossover_year,
        "estimated_annual_savings": estimated_annual_savings,
        "total_power_price": total_power_price,
        "hourly_energy_cost": hourly_energy_cost,
    }


def build_solar_chart(
    monthly_bill: float | int | str = DEFAULT_MONTHLY_BILL,
    utility_kwh_rate: float | int | str = DEFAULT_UTILITY_KWH_RATE,
):
    """Render the line chart for the solar savings comparison."""
    summary = calculate_solar_savings_summary(
        monthly_bill=monthly_bill,
        utility_kwh_rate=utility_kwh_rate,
    )
    years = list(range(1, DEFAULT_TIMELINE_YEARS + 1))
    utility_cumulative_costs: list[float] = []
    solar_cumulative_costs: list[float] = []

    running_utility_total = 0.0
    running_solar_total = 0.0
    base_annual_utility_cost = float(monthly_bill) * 12

    for year in years:
        inflated_annual_utility_cost = base_annual_utility_cost * (
            (1 + DEFAULT_UTILITY_INFLATION_RATE) ** (year - 1)
        )
        running_utility_total += inflated_annual_utility_cost
        utility_cumulative_costs.append(running_utility_total)

        annual_solar_cost = summary["annual_loan_payment"] if year <= DEFAULT_LOAN_TERM_YEARS else 0.0
        running_solar_total += annual_solar_cost
        solar_cumulative_costs.append(running_solar_total)

    crossover_index = None
    for i in range(len(years)):
        if solar_cumulative_costs[i] < utility_cumulative_costs[i]:
            crossover_index = i
            break

    crossover_year = years[crossover_index] if crossover_index is not None else None
    crossover_value = solar_cumulative_costs[crossover_index] if crossover_index is not None else None

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

    ax.axvline(x=DEFAULT_LOAN_TERM_YEARS, color="gray", linestyle="--", linewidth=1.5, zorder=2)
    ax.text(
        DEFAULT_LOAN_TERM_YEARS + 0.3, max(utility_cumulative_costs) * 0.05,
        "Solar Loan\nFully Paid Off", fontsize=9, color="dimgray",
        ha="left", va="bottom", style="italic",
    )

    assumptions_text = (
        "ASSUMPTIONS & INPUTS\n"
        "─────────────────────\n\n"
        f"Monthly Utility Bill:\n  ${float(monthly_bill):,.0f}\n\n"
        f"Utility Rate:\n  ${float(utility_kwh_rate):.2f}/kWh\n\n"
        f"Solar Cost:\n  ${DEFAULT_SOLAR_KW_COST:,.0f}/kW\n\n"
        f"Solar Production Factor:\n  {DEFAULT_SOLAR_PRODUCTION_FACTOR:,.0f} kWh/kW/yr\n\n"
        f"Utility Inflation:\n  {DEFAULT_UTILITY_INFLATION_RATE * 100:.1f}%/yr\n\n"
        f"Loan Interest Rate:\n  {DEFAULT_LOAN_INTEREST_RATE * 100:.1f}%\n\n"
        f"Loan Term:\n  {DEFAULT_LOAN_TERM_YEARS} years\n\n"
        f"Array Size (calculated):\n  {summary['required_solar_array_size_kw']:.2f} kW"
    )
    fig.text(
        0.985, 0.94, assumptions_text,
        fontsize=9.5, ha="right", va="top", linespacing=1.7,
        bbox=dict(boxstyle="round,pad=0.7", facecolor="#FAFAFA", edgecolor="#BDBDBD", alpha=0.95),
    )

    stats_text = (
        "RESULTS\n"
        "─────────────────────\n"
        f"Total Cost of System: ${summary['total_solar_system_cost']:,.0f}\n"
        f"Fixed Annual Loan Payment: ${summary['annual_loan_payment']:,.0f}\n"
        f"Net 25-Year Savings: ${summary['net_25_year_savings']:,.0f}"
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
    ax.set_xlim(1, DEFAULT_TIMELINE_YEARS)
    ax.set_ylim(bottom=0)
    ax.legend(loc="upper left", frameon=True, fontsize=10)

    plt.show()


if __name__ == "__main__":
    build_solar_chart()
