import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell
} from 'recharts';

const COST_PER_WATT = 2.80;
const PANEL_DEGRADATION_RATE = 0.005;
const SIMULATION_YEARS = 25;
const LOAN_TERM_YEARS = 20;
const SOLAR_PRODUCTION_RATIO = 1.2;
const FEDERAL_ITC_RATE = 0.30;

const formatCurrency = (val: number) => `$${Number(val).toLocaleString()}`;

export default function CashFlowChart() {
  const [electricityPrice, setElectricityPrice] = useState(0.16);
  const [interestRate, setInterestRate] = useState(5.0);
  const [monthlyBill, setMonthlyBill] = useState(150);
  const [solarOffset, setSolarOffset] = useState(100);
  const [inflationRate, setInflationRate] = useState(4.0);

  const calculateMonthlyLoanPayment = (principal: number, annualRatePct: number, termMonths: number) => {
    const monthlyRate = (annualRatePct / 100) / 12;
    if (monthlyRate === 0) return principal / termMonths;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  const chartData = useMemo(() => {
    const annualUsageKwh = (monthlyBill / electricityPrice) * 12;
    const targetSolarProduction = annualUsageKwh * (solarOffset / 100);
    const systemSizeKw = targetSolarProduction / (1000 * SOLAR_PRODUCTION_RATIO);

    const grossSystemCost = systemSizeKw * 1000 * COST_PER_WATT;
    const netSystemCost = grossSystemCost * (1 - FEDERAL_ITC_RATE);

    const isFinanced = interestRate > 0;
    const monthlyPayment = calculateMonthlyLoanPayment(netSystemCost, interestRate, LOAN_TERM_YEARS * 12);
    const annualLoanPayment = monthlyPayment * 12;

    // Always start at -netSystemCost to show the initial investment
    const startingBalance = -netSystemCost;

    const data: Array<{ year: number; annualCashFlow: number; balance: number; profitZone: number; lossZone: number }> = [];
    let runningTotal = startingBalance;

    // Year 0: the upfront cost (negative)
    data.push({
      year: 0,
      annualCashFlow: Math.round(-netSystemCost),
      balance: Math.round(startingBalance),
      profitZone: 0,
      lossZone: Math.round(startingBalance),
    });

    for (let year = 1; year <= SIMULATION_YEARS; year++) {
      const degradedProduction = targetSolarProduction * Math.pow(1 - PANEL_DEGRADATION_RATE, year - 1);
      const inflatedPrice = electricityPrice * Math.pow(1 + (inflationRate / 100), year - 1);

      const utilityCostWithoutSolar = annualUsageKwh * inflatedPrice;
      const utilityCostWithSolar = Math.max(0, (annualUsageKwh - degradedProduction)) * inflatedPrice;
      const annualSavings = utilityCostWithoutSolar - utilityCostWithSolar;

      // If financed, subtract loan payments from savings
      const loanPaymentThisYear = (isFinanced && year <= LOAN_TERM_YEARS) ? annualLoanPayment : 0;
      const netAnnualCashFlow = annualSavings - loanPaymentThisYear;
      runningTotal += netAnnualCashFlow;

      data.push({
        year,
        annualCashFlow: Math.round(netAnnualCashFlow),
        balance: Math.round(runningTotal),
        profitZone: runningTotal >= 0 ? Math.round(runningTotal) : 0,
        lossZone: runningTotal < 0 ? Math.round(runningTotal) : 0,
      });
    }
    return data;
  }, [electricityPrice, interestRate, monthlyBill, solarOffset, inflationRate]);

  const netSavings = chartData[chartData.length - 1].balance;
  const breakEvenYear = chartData.find(d => d.balance >= 0)?.year || null;

  return (
    <div className="cashflow-chart">
      <div className="cashflow-header">
        <div>
          <p className="section-label">Solar Financial Model</p>
          <span className="cashflow-subtitle">
            Includes 30% Federal ITC &bull; 25-Year Projection
          </span>
        </div>
        <div className="cashflow-kpis">
          {breakEvenYear ? (
            <div className="cashflow-kpi">
              <span className="cashflow-kpi-label">BREAK-EVEN</span>
              <span className="cashflow-kpi-value positive">Year {breakEvenYear}</span>
            </div>
          ) : (
            <div className="cashflow-kpi">
              <span className="cashflow-kpi-label">BREAK-EVEN</span>
              <span className="cashflow-kpi-value negative">&gt; 25 Years</span>
            </div>
          )}
          <div className="cashflow-kpi">
            <span className="cashflow-kpi-label">{netSavings >= 0 ? 'NET 25-YR SAVINGS' : 'NET 25-YR LOSS'}</span>
            <span className={`cashflow-kpi-value ${netSavings >= 0 ? 'positive' : 'negative'}`}>
              {netSavings < 0 ? '-' : ''}{formatCurrency(Math.abs(netSavings))}
            </span>
          </div>
        </div>
      </div>

      {/* Cumulative wealth chart */}
      <div className="cashflow-canvas">
        <p className="cashflow-chart-title">Cumulative Wealth (Total Savings vs Expenses)</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
            <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} stroke="rgba(255,255,255,0.1)" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(year) => `Year ${year}`}
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc' }}
              labelStyle={{ color: '#fde68a' }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            <Area type="monotone" dataKey="profitZone" fill="url(#colorProfit)" stroke="none" name="Profit Zone" />
            <Area type="monotone" dataKey="lossZone" fill="url(#colorLoss)" stroke="none" name="Payback Zone" />
            <ReferenceLine y={0} stroke="#9E9E9E" />
            {breakEvenYear && (
              <ReferenceLine x={breakEvenYear} stroke="#4ade80" strokeDasharray="3 3" />
            )}
            <Line type="monotone" dataKey="balance" stroke="#4CAF50" strokeWidth={3} dot={false} name="Cumulative Balance" activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Annual cash flow bar chart */}
      <div className="cashflow-canvas cashflow-bars">
        <p className="cashflow-chart-title">Annual Cash Flow (Year-by-Year Net Profit)</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
            <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} stroke="rgba(255,255,255,0.1)" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(year) => `Year ${year}`}
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc' }}
              labelStyle={{ color: '#fde68a' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <ReferenceLine y={0} stroke="#9E9E9E" />
            <Bar dataKey="annualCashFlow" name="Net Cash Flow" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.annualCashFlow >= 0 ? '#66BB6A' : '#EF5350'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 5 sliders */}
      <div className="cashflow-sliders five-sliders">
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Monthly Bill</label>
            <span className="slider-value">${monthlyBill}</span>
          </div>
          <input type="range" min="50" max="500" step="10" value={monthlyBill} onChange={(e) => setMonthlyBill(Number(e.target.value))} />
        </div>
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Utility Price / kWh</label>
            <span className="slider-value">${electricityPrice.toFixed(2)}</span>
          </div>
          <input type="range" min="0.05" max="0.50" step="0.01" value={electricityPrice} onChange={(e) => setElectricityPrice(Number(e.target.value))} />
        </div>
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Solar Offset</label>
            <span className="slider-value">{solarOffset}%</span>
          </div>
          <input type="range" min="50" max="120" step="5" value={solarOffset} onChange={(e) => setSolarOffset(Number(e.target.value))} />
        </div>
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Utility Inflation</label>
            <span className="slider-value">{inflationRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="1.0" max="10.0" step="0.5" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} />
        </div>
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Loan Interest</label>
            <span className="slider-value">{interestRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="0.0" max="12.0" step="0.1" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
