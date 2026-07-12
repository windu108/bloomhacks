import { useEffect, useMemo, useState } from 'react';
import type { AppState, AnalysisResult } from './App';
import sun from './assets/sun.png';
import './Dashboard.css';

interface ContextValues {
  address?: string | null;
  monthly_electric_bill?: string | null;
  roof_material?: string | null;
  roof_quality?: string | null;
  roof_tilting?: string | null;
  obstructions?: string | null;
  surface_area?: string | null;
  sunlight_hours?: string | null;
  sunlight_intensity?: string | null;
}

const contextFieldLabels: Record<keyof ContextValues, string> = {
  address: "Address",
  monthly_electric_bill: "Energy consumption",
  roof_material: "Roof material",
  roof_quality: "Roof quality",
  roof_tilting: "Roof tilting",
  obstructions: "Obstructions",
  surface_area: "Surface area",
  sunlight_hours: "Sunlight hours",
  sunlight_intensity: "Sunlight intensity",
};

interface DashboardProps {
  appState: AppState;
  onAnalysisComplete: (result: AnalysisResult) => void;
  navigateTo: (tab: 'upload' | 'dashboard' | 'model' | 'summary') => void;
  onUploadClick?: () => void;
}

export default function Dashboard({ appState, onAnalysisComplete, navigateTo, onUploadClick }: DashboardProps) {
  const { image, address, electricBill } = appState;

  const [reasoningText, setReasoningText] = useState<string>('');
  const [recommendationText, setRecommendationText] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextValues, setContextValues] = useState<ContextValues>({
    address: address || null,
    monthly_electric_bill: electricBill || null,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);

  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const mergeContextValues = (incoming?: Partial<ContextValues>) => {
    if (!incoming) return;
    setContextValues((current) => {
      const merged = { ...current };
      (Object.keys(incoming) as Array<keyof ContextValues>).forEach((field) => {
        const incomingValue = incoming[field];
        const currentValue = current[field];
        if (typeof incomingValue === 'string' && incomingValue.trim().length > 0) {
          const hasExisting = typeof currentValue === 'string' && currentValue.trim().length > 0;
          if (!hasExisting) merged[field] = incomingValue;
        }
      });
      return merged;
    });
  };

  const analyzeImage = async () => {
    if (!image) return;
    setReasoningText('');
    setRecommendationText('');
    setScanProgress(0);
    setIsRegenerating(true);

    try {
      const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
            else reject(new Error('Failed to process image.'));
          };
          reader.onerror = (err) => reject(err);
        });

      const imageB64 = await toBase64(image);
      const res = await fetch('/api/describe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_b64: imageB64,
          mime_type: image.type || 'image/jpeg',
          address: contextValues.address || address,
          monthly_electric_bill: contextValues.monthly_electric_bill || electricBill,
          context_values: contextValues,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      const reasoning = typeof json.evaluation?.reasoning === 'string' ? json.evaluation.reasoning.trim() : '';
      const score = typeof json.evaluation?.score === 'number' ? json.evaluation.score : 0;
      const nextSteps = typeof json.next_steps === 'string' ? json.next_steps.trim() : '';

      setReasoningText(reasoning || 'Loading solar score justification...');
      setRecommendationText(nextSteps || 'Loading recommendations...');
      setScanProgress(Math.max(0, Math.min(100, score)));

      if (json.context_values) mergeContextValues(json.context_values);

      onAnalysisComplete({
        score,
        reasoning,
        nextSteps,
        contextValues: json.context_values || {},
      });
    } catch {
      setReasoningText('We could not refresh the analysis right now.');
    } finally {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (!image) return;
    analyzeImage();
  }, [image]);

  const contextFields = useMemo(() => Object.keys(contextFieldLabels) as Array<keyof ContextValues>, []);

  const updateContextField = (field: keyof ContextValues, value: string) => {
    setContextValues((current) => ({ ...current, [field]: value }));
  };

  if (!image) {
    return (
      <div className="dashboard-empty">
        <div className="empty-card">
          <h2>Upload Photo to access dashboard</h2>
          <p>Upload a photo of your home to get your solar compatibility analysis</p>
          <button className="primary-button" onClick={onUploadClick}>
            Upload Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="insight">Analysis complete</div>
      </div>

      <div className="dashboard-grid">
        {/* Left column */}
        <div className="dash-left">
          <div className="dash-card preview-card">
            <p className="section-label">Your image</p>
            {previewUrl && (
              <div className="preview-frame">
                <img src={previewUrl} alt="Uploaded preview" className="preview-image" />
              </div>
            )}
          </div>

          <button className="context-toggle" onClick={() => setShowContextEditor(v => !v)}>
            {showContextEditor ? 'Hide values' : 'Change Values'}
          </button>

          {showContextEditor && (
            <div className="dash-card" style={{ marginTop: '0.5rem' }}>
              <p className="section-label">Change values</p>
              <div className="context-editor">
                {contextFields.map((field) => (
                  <label key={field} className="context-field">
                    <span>{contextFieldLabels[field]}</span>
                    <input
                      value={contextValues[field] ?? ''}
                      onChange={(e) => updateContextField(field, e.target.value)}
                      placeholder="Not provided"
                    />
                  </label>
                ))}
                <button className="regenerate-button" onClick={analyzeImage} disabled={isRegenerating}>
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="dash-card quick-actions">
            <p className="section-label">Quick actions</p>
            <button className="action-btn model-btn" onClick={() => navigateTo('model')}>
              View 3D Model
            </button>
            <button className="action-btn summary-btn" onClick={() => navigateTo('summary')}>
              View Summary
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="dash-right">
          <div className="dash-card">
            <div className="progress-card">
              <div className="progress-meta">
                <span>Solar compatibility</span>
                <strong>{scanProgress}%</strong>
              </div>
              <div className="sun-bar">
                <div className="sunlight" style={{ width: `${scanProgress}%` }} />
                <img src={sun} alt="Sun" className="sun-icon" style={{ left: `calc(${scanProgress}% - 22px)` }} />
              </div>
            </div>

            <div className="result-panel">
              <p className="section-label">Solar score justification</p>
              {reasoningText ? (
                <div className="description-block">{reasoningText}</div>
              ) : (
                <p className="loading-text">Loading solar score justification...</p>
              )}
            </div>

            <div className="recommendations-section">
              <p className="section-label">Recommended next steps</p>
              {recommendationText ? (
                <div className="description-block">{recommendationText}</div>
              ) : (
                <p className="loading-text">Loading recommendations...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
