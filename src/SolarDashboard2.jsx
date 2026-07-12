import React, { useState, useMemo } from 'react';
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

// --- SYSTEM CONSTANTS ---
const COST_PER_WATT = 2.80;
const PANEL_DEGRADATION_RATE = 0.005;
const SIMULATION_YEARS = 25;
const LOAN_TERM_YEARS = 20;
const SOLAR_PRODUCTION_RATIO = 1.2; // 1 kW of panels produces ~1200 kWh/year
const FEDERAL_ITC_RATE = 0.30; // 30% Tax Credit

// --- UTILITY FORMATTER ---
const formatCurrency = (val) => `$${Number(val).toLocaleString()}`;

// --- CUSTOM STYLED TOOLTIP (Moved outside to optimize performance) ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Year {label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px', margin: '4px 0', color: entry.color }}>
            <span>{entry.name}:</span>
            <span style={{ fontWeight: '600' }}>{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- MAIN COMPONENT ---
export default function SolarDashboard({ className = '', style = {} }) {
  // --- THE "PERFECT 5" SLIDER STATES ---
  const [electricityPrice, setElectricityPrice] = useState(0.16);
  const [interestRate, setInterestRate] = useState(5.0);
  const [monthlyBill, setMonthlyBill] = useState(150);
  const [solarOffset, setSolarOffset] = useState(100); // % of bill covered
  const [inflationRate, setInflationRate] = useState(4.0); // %

  // --- AMORTIZATION LOAN FORMULA ---
  const calculateMonthlyLoanPayment = (principal, annualRatePct, termMonths) => {
    const monthlyRate = (annualRatePct / 100) / 12;
    if (monthlyRate === 0) return principal / termMonths;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  // --- RUN 25-YEAR CASH FLOW SIMULATION ---
  const chartData = useMemo(() => {
    // 1. Calculate dynamic system size based on user's bill and offset
    const annualUsageKwh = (monthlyBill / electricityPrice) * 12;
    const targetSolarProduction = annualUsageKwh * (solarOffset / 100);
    const systemSizeKw = targetSolarProduction / (1000 * SOLAR_PRODUCTION_RATIO);
    
    // 2. Calculate Costs (Assuming 30% ITC is applied to lower loan principal for simplicity)
    const grossSystemCost = systemSizeKw * 1000 * COST_PER_WATT;
    const netSystemCost = grossSystemCost * (1 - FEDERAL_ITC_RATE);

    const isFinanced = interestRate > 0;
    const monthlyPayment = calculateMonthlyLoanPayment(netSystemCost, interestRate, LOAN_TERM_YEARS * 12);
    const annualLoanPayment = monthlyPayment * 12;
    const startingBalance = isFinanced ? 0 : -netSystemCost;

    const data = [];
    let runningTotal = startingBalance;

    for (let year = 1; year <= SIMULATION_YEARS; year++) {
      // Degrade solar production over time
      const degradedProduction = targetSolarProduction * Math.pow(1 - PANEL_DEGRADATION_RATE, year - 1);
      
      // Calculate utility costs with compounded inflation
      const inflatedPrice = electricityPrice * Math.pow(1 + (inflationRate / 100), year - 1);
      
      // Annual savings = What they would have paid minus what they still buy from utility
      const utilityCostWithoutSolar = annualUsageKwh * inflatedPrice;
      const utilityCostWithSolar = Math.max(0, (annualUsageKwh - degradedProduction)) * inflatedPrice;
      const annualSavings = utilityCostWithoutSolar - utilityCostWithSolar;

      const loanPaymentThisYear = (isFinanced && year <= LOAN_TERM_YEARS) ? annualLoanPayment : 0;
      
      // The net cash flow for this specific year
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
    <div 
      className={className} 
      style={{ 
        fontFamily: 'sans-serif', 
        padding: '24px', 
        width: '100%', 
        background: '#fff', 
        borderRadius: '8px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
        boxSizing: 'border-box',
        ...style 
      }}
    >
      
      {/* Header & KPI Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#111', fontSize: '24px', fontWeight: '800' }}>Solar Financial Model</h2>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
            Includes 30% Federal ITC • 25-Year Projection
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {breakEvenYear ? (
            <div style={{ background: '#E3F2FD', padding: '10px 16px', borderRadius: '6px', border: '1px solid #BBDEFB' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1565C0', display: 'block' }}>BREAK-EVEN</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0D47A1' }}>Year {breakEvenYear}</span>
            </div>
          ) : (
            <div style={{ background: '#FFF3E0', padding: '10px 16px', borderRadius: '6px', border: '1px solid #FFE0B2' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#E65100', display: 'block' }}>BREAK-EVEN</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#E65100', lineHeight: '28px' }}>&gt; 25 Years</span>
            </div>
          )}
          <div style={{ background: netSavings >= 0 ? '#E8F5E9' : '#FFEBEE', padding: '10px 16px', borderRadius: '6px', border: `1px solid ${netSavings >= 0 ? '#C8E6C9' : '#FFCDD2'}` }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: netSavings >= 0 ? '#2E7D32' : '#C62828', display: 'block' }}>
              {netSavings >= 0 ? 'NET 25-YR SAVINGS' : 'NET 25-YR LOSS'}
            </span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: netSavings >= 0 ? '#1B5E20' : '#B71C1C' }}>
              {netSavings < 0 ? '-' : ''}{formatCurrency(Math.abs(netSavings))}
            </span>
          </div>
        </div>
      </div>

      {/* Main Graphs Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        
        {/* Graph 1: Macro Cumulative Wealth */}
        <div style={{ width: '100%', height: '280px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#555', fontWeight: '600' }}>Cumulative Wealth (Total Savings vs Expenses)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C62828" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#C62828" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{ fontSize: 11 }} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              
              <Area type="monotone" dataKey="profitZone" fill="url(#colorProfit)" stroke="none" name="Profit Zone" />
              <Area type="monotone" dataKey="lossZone" fill="url(#colorLoss)" stroke="none" name="Payback Zone" />
              
              <ReferenceLine y={0} stroke="#9E9E9E" />
              {breakEvenYear && (
                <ReferenceLine x={breakEvenYear} stroke="#2E7D32" strokeDasharray="3 3" label={{ value: 'Break-Even', fill: '#2E7D32', position: 'top', fontSize: 11 }} />
              )}
              
              <Line type="monotone" dataKey="balance" stroke="#2E7D32" strokeWidth={3} dot={false} name="Cumulative Balance" activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Graph 2: Micro Annual Cash Flow */}
        <div style={{ width: '100%', height: '180px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#555', fontWeight: '600' }}>Annual Cash Flow (Year-by-Year Net Profit)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11 }} width={55} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: '#f5f5f5'}} />
              <ReferenceLine y={0} stroke="#9E9E9E" />
              <Bar dataKey="annualCashFlow" name="Net Cash Flow" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.annualCashFlow >= 0 ? '#66BB6A' : '#EF5350'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The "Perfect 5" Sliders Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', background: '#fafafa', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
        
        {/* 1. Monthly Bill */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
            <label>Current Monthly Bill</label>
            <span>${monthlyBill}</span>
          </div>
          <input type="range" min="50" max="500" step="10" value={monthlyBill} onChange={(e) => setMonthlyBill(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
        </div>

        {/* 2. Electricity Price */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
            <label>Utility Price / kWh</label>
            <span>${electricityPrice.toFixed(2)}</span>
          </div>
          <input type="range" min="0.05" max="0.50" step="0.01" value={electricityPrice} onChange={(e) => setElectricityPrice(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
        </div>

        {/* 3. Solar Offset */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
            <label>Solar Offset</label>
            <span>{solarOffset}%</span>
          </div>
          <input type="range" min="50" max="120" step="5" value={solarOffset} onChange={(e) => setSolarOffset(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
        </div>

        {/* 4. Utility Inflation */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
            <label>Utility Inflation</label>
            <span>{inflationRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="1.0" max="10.0" step="0.5" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
        </div>

        {/* 5. Loan Interest Rate */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
            <label>Loan Interest Rate</label>
            <span>{interestRate.toFixed(1)}%</span>
          </div>
          <input type="range" min="0.0" max="12.0" step="0.1" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
        </div>

      </div>
    </div>
  );
}