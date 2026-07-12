import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';

const ANNUAL_POWER_USAGE_KWH = 10000;
const SYSTEM_SIZE_KW = 8.3;
const COST_PER_WATT = 2.80;
const GROSS_SYSTEM_COST = SYSTEM_SIZE_KW * 1000 * COST_PER_WATT;
const UTILITY_INFLATION_RATE = 0.03;
const PANEL_DEGRADATION_RATE = 0.005;
const SIMULATION_YEARS = 25;
const LOAN_TERM_YEARS = 20;

export default function CashFlowChart() {
  const [electricityPrice, setElectricityPrice] = useState(0.16);
  const [interestRate, setInterestRate] = useState(5.0);

  const calculateMonthlyLoanPayment = (principal: number, annualRatePct: number, termMonths: number) => {
    const monthlyRate = (annualRatePct / 100) / 12;
    if (monthlyRate === 0) return principal / termMonths;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  const chartData = useMemo(() => {
    const isFinanced = interestRate > 0;
    const monthlyPayment = calculateMonthlyLoanPayment(GROSS_SYSTEM_COST, interestRate, LOAN_TERM_YEARS * 12);
    const annualLoanPayment = monthlyPayment * 12;
    const startingBalance = isFinanced ? 0 : -GROSS_SYSTEM_COST;

    const data = [{ year: 0, balance: startingBalance, profit: Math.max(0, startingBalance), loss: Math.min(0, startingBalance) }];
    let runningTotal = startingBalance;

    for (let year = 1; year <= SIMULATION_YEARS; year++) {
      const degradedOutputFactor = Math.pow(1 - PANEL_DEGRADATION_RATE, year - 1);
      const inflatedPrice = electricityPrice * Math.pow(1 + UTILITY_INFLATION_RATE, year - 1);
      const annualSavings = ANNUAL_POWER_USAGE_KWH * degradedOutputFactor * inflatedPrice;

      const loanPaymentThisYear = (isFinanced && year <= LOAN_TERM_YEARS) ? annualLoanPayment : 0;
      runningTotal += (annualSavings - loanPaymentThisYear);

      data.push({
        year,
        balance: Math.round(runningTotal),
        profit: runningTotal >= 0 ? Math.round(runningTotal) : 0,
        loss: runningTotal < 0 ? Math.round(runningTotal) : 0,
      });
    }
    return data;
  }, [electricityPrice, interestRate]);

  const netSavings = chartData[chartData.length - 1].balance;
  const formatCurrency = (val: number) => `$${Number(val).toLocaleString()}`;

  return (
    <div className="cashflow-chart">
      <div className="cashflow-header">
        <div>
          <p className="section-label">25-Year Solar Cash Flow</p>
          <span className="cashflow-subtitle">
            {interestRate > 0 ? `Financed: ${interestRate.toFixed(1)}% / 20-yr loan` : 'Cash Purchase'}
          </span>
        </div>
        <div className="cashflow-kpi">
          <span className="cashflow-kpi-label">NET 25-YR SAVINGS</span>
          <span className={`cashflow-kpi-value ${netSavings >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(netSavings)}
          </span>
        </div>
      </div>

      <div className="cashflow-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="rgba(255,255,255,0.1)" />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} width={65} stroke="rgba(255,255,255,0.1)" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(year) => `Year ${year}`}
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc' }}
              labelStyle={{ color: '#fde68a' }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            <Area type="monotone" dataKey="profit" fill="#4CAF50" stroke="none" fillOpacity={0.2} name="Profit Zone" />
            <Area type="monotone" dataKey="loss" fill="#ef4444" stroke="none" fillOpacity={0.15} name="Payback Zone" />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="balance" stroke="#4CAF50" strokeWidth={3} dot={false} name="Cumulative Balance" activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="cashflow-sliders">
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Electricity Price</label>
            <span className="slider-value green">${electricityPrice.toFixed(2)} / kWh</span>
          </div>
          <input
            type="range" min="0.05" max="0.50" step="0.01"
            value={electricityPrice}
            onChange={(e) => setElectricityPrice(parseFloat(e.target.value))}
          />
        </div>
        <div className="cashflow-slider">
          <div className="slider-header">
            <label>Loan Interest Rate</label>
            <span className="slider-value red">{interestRate.toFixed(1)}%</span>
          </div>
          <input
            type="range" min="0.0" max="15.0" step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
