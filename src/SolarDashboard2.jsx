import React, { useState, useMemo } from 'react';
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

// --- FIXED MATH CONSTANTS FROM PYTHON PROTOTYPE ---
const ANNUAL_POWER_USAGE_KWH = 10000;
const SYSTEM_SIZE_KW = 8.3;
const COST_PER_WATT = 2.80;
const GROSS_SYSTEM_COST = SYSTEM_SIZE_KW * 1000 * COST_PER_WATT; // $23,240
const UTILITY_INFLATION_RATE = 0.03;
const PANEL_DEGRADATION_RATE = 0.005;
const SIMULATION_YEARS = 25;
const LOAN_TERM_YEARS = 20;

export default function SolarDashboard() {
  // --- USER CONTROLS STATE ---
  const [electricityPrice, setElectricityPrice] = useState(0.16);
  const [interestRate, setInterestRate] = useState(5.0);

  // --- AMORTIZATION LOAN FORMULA ---
  const calculateMonthlyLoanPayment = (principal, annualRatePct, termMonths) => {
    const monthlyRate = (annualRatePct / 100) / 12;
    if (monthlyRate === 0) return principal / termMonths;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) / 
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  // --- RUN 25-YEAR CASH FLOW SIMULATION SIMULTANEOUSLY ON SLIDER CHANGE ---
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
  const formatCurrency = (val) => `$${Number(val).toLocaleString()}`;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '24px', maxWidth: '100%', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      
      {/* KPI Stats Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#222', fontSize: '20px', fontWeight: '700' }}>25-Year Solar Cash Flow</h3>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
            {interestRate > 0 ? `Financed: ${interestRate}% / 20-yr loan` : 'Cash Purchase'}
          </p>
        </div>
        <div style={{ background: '#f9f9f9', padding: '10px 16px', borderRadius: '6px', border: '1px solid #eee' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#777', display: 'block', letterSpacing: '0.5px' }}>NET 25-YEAR SAVINGS</span>
          <span style={{ fontSize: '22px', fontWeight: 'bold', color: netSavings >= 0 ? '#2E7D32' : '#C62828' }}>
            {formatCurrency(netSavings)}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ width: '100%', height: '320px', marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={65} />
            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(year) => `Year ${year}`} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px' }} />
            
            {/* Conditional Area Shading */}
            <Area 
              type="monotone" 
              dataKey="profit" 
              fill="#4CAF50" 
              stroke="none" 
              fillOpacity={0.15} 
              name="Profit Zone" 
            />
            <Area 
              type="monotone" 
              dataKey="loss" 
              fill="#C62828" 
              stroke="none" 
              fillOpacity={0.1} 
              name="Payback Zone" 
            />
            
            {/* Zero-Line Break-Even Reference */}
            <ReferenceLine y={0} stroke="#C62828" strokeDasharray="4 4" />
            
            {/* Cumulative Cash Flow Trend Line */}
            <Line 
              type="monotone" 
              dataKey="balance" 
              stroke="#2E7D32" 
              strokeWidth={3} 
              dot={false} 
              name="Cumulative Balance" 
              activeDot={{ r: 5 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Control Sliders Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', background: '#fafafa', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#1B5E20' }}>
            <label>Electricity Price</label>
            <span>${electricityPrice.toFixed(2)} / kWh</span>
          </div>
          <input 
            type="range" min="0.05" max="0.50" step="0.01" 
            value={electricityPrice} 
            onChange={(e) => setElectricityPrice(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#1B5E20', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#B71C1C' }}>
            <label>Loan Interest Rate</label>
            <span>{interestRate.toFixed(1)}%</span>
          </div>
          <input 
            type="range" min="0.0" max="15.0" step="0.1" 
            value={interestRate} 
            onChange={(e) => setInterestRate(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#B71C1C', cursor: 'pointer' }}
          />
        </div>
      </div>

    </div>
  );
}
