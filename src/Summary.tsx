import type { AppState } from './App';
import CashFlowChart from './CashFlowChart';
import './Summary.css';

interface SummaryProps {
  appState: AppState;
  navigateTo: (tab: 'upload' | 'dashboard' | 'model' | 'summary') => void;
}

export default function Summary({ appState, navigateTo }: SummaryProps) {
  const { analysisResult, address, electricBill } = appState;

  if (!analysisResult) {
    return (
      <div className="summary-empty">
        <div className="empty-card">
          <span className="empty-icon">📋</span>
          <h2>No analysis yet</h2>
          <p>Upload a photo and complete the analysis to see your solar summary</p>
          <button className="primary-button" onClick={() => navigateTo('upload')}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  const { score, reasoning, nextSteps, contextValues } = analysisResult;

  return (
    <div className="summary-page">
      <h1>Solar Assessment Summary</h1>

      <div className="summary-grid">
        {/* Score card */}
        <div className="summary-card score-card">
          <div className="score-circle">
            <span className="score-number">{score}</span>
            <span className="score-label">/ 100</span>
          </div>
          <p className="score-title">Solar Compatibility Score</p>
        </div>

        {/* Property info */}
        <div className="summary-card">
          <h3>Property Details</h3>
          <div className="detail-list">
            {address && (
              <div className="detail-row">
                <span className="detail-key">Address</span>
                <span className="detail-val">{address}</span>
              </div>
            )}
            {electricBill && (
              <div className="detail-row">
                <span className="detail-key">Monthly Bill</span>
                <span className="detail-val">{electricBill}</span>
              </div>
            )}
            {contextValues.roof_material && (
              <div className="detail-row">
                <span className="detail-key">Roof Material</span>
                <span className="detail-val">{contextValues.roof_material}</span>
              </div>
            )}
            {contextValues.roof_quality && (
              <div className="detail-row">
                <span className="detail-key">Roof Quality</span>
                <span className="detail-val">{contextValues.roof_quality}</span>
              </div>
            )}
            {contextValues.surface_area && (
              <div className="detail-row">
                <span className="detail-key">Surface Area</span>
                <span className="detail-val">{contextValues.surface_area}</span>
              </div>
            )}
            {contextValues.sunlight_hours && (
              <div className="detail-row">
                <span className="detail-key">Sunlight Hours</span>
                <span className="detail-val">{contextValues.sunlight_hours}</span>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        <div className="summary-card full-width">
          <h3>Solar Score Justification</h3>
          <p className="summary-text">{reasoning || 'No justification available.'}</p>
        </div>

        {/* Next steps */}
        <div className="summary-card full-width">
          <h3>Recommended Next Steps</h3>
          <p className="summary-text">{nextSteps || 'No recommendations available.'}</p>
        </div>

        {/* Cash flow chart */}
        <div className="summary-card full-width">
          <CashFlowChart />
        </div>

        {/* Actions */}
        <div className="summary-card full-width summary-actions">
          <button className="action-btn model-btn" onClick={() => navigateTo('model')}>
            View 3D Model
          </button>
          <button className="action-btn dash-btn" onClick={() => navigateTo('dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
