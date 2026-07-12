import { useState, useRef, useEffect } from 'react';
import type { AppState } from './App';
import SolarViewer, { getViewerControls } from './SolarViewer';
import './ModelView.css';

interface SolarData {
  stats: {
    maxPanels: number;
    roofAreaM2: number;
    maxSunshineHours: number;
    carbonKgPerMwh: number;
  };
  panels: any[];
  segments: any[];
  recommendedCount: number;
  buildingBbox: any;
}

interface ModelViewProps {
  appState: AppState;
}

export default function ModelView({ appState }: ModelViewProps) {
  const [address, setAddress] = useState(appState.address || '');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [geo, setGeo] = useState<{ lat: number; lon: number; formattedAddress: string } | null>(null);
  const [satImgUrl, setSatImgUrl] = useState<string | null>(null);
  const [solarData, setSolarData] = useState<SolarData | null>(null);

  const [panelCount, setPanelCount] = useState(0);
  const [kwhEstimate, setKwhEstimate] = useState(0);
  const [reasoning, setReasoning] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);

  // Auto-load if address is available from app state
  useEffect(() => {
    if (appState.address && !geo && !loading) {
      setAddress(appState.address);
      loadModel(appState.address);
    }
  }, []);

  async function loadModel(addr: string) {
    if (!addr.trim()) return;
    setLoading(true);
    setGeo(null);
    setSatImgUrl(null);
    setSolarData(null);
    setReasoning('');
    setStatus('Looking up address...');
    setIsError(false);

    try {
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
      const geoData = await geoRes.json();
      if (!geoRes.ok) throw new Error(geoData.error || 'Geocoding failed');
      setGeo(geoData);

      setStatus('Loading satellite image + solar data...');
      setSatImgUrl(`/api/satellite/image?lat=${geoData.lat}&lon=${geoData.lon}`);

      const solarRes = await fetch(`/api/solar?lat=${geoData.lat}&lon=${geoData.lon}`);
      const solar = await solarRes.json();
      if (!solarRes.ok) throw new Error(solar.error || 'Solar fetch failed');

      setSolarData(solar);
      setStatus('');
    } catch (err: any) {
      setStatus(err.message);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadModel(address);
  }

  async function handleRecommend() {
    if (!geo || !solarData) return;
    setAiLoading(true);
    setReasoning('AI is analyzing your roof...');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: geo.lat, lon: geo.lon,
          panels: solarData.panels,
          segments: solarData.segments,
          stats: solarData.stats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recommendation failed');
      setReasoning(data.reasoning);
    } catch (err: any) {
      setReasoning(`Failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="model-view">
      <div className="model-header">
        <h1>3D Roof Model</h1>
        <form onSubmit={handleSubmit} className="model-address-form">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Enter address to load 3D model"
            required
            className="model-address-input"
          />
          <button type="submit" disabled={loading} className="model-go-btn">
            {loading ? '...' : 'Load'}
          </button>
        </form>
        {status && <div className={`model-status ${isError ? 'error' : ''}`}>{status}</div>}
      </div>

      {geo && (
        <div className="model-result">
          <div className="model-geocode">
            <strong>{geo.formattedAddress}</strong> &nbsp; {geo.lat.toFixed(6)}, {geo.lon.toFixed(6)}
          </div>

          <div className="model-columns">
            {satImgUrl && (
              <div className="model-satellite">
                <h2>Satellite View</h2>
                <div className="model-img-container">
                  <img src={satImgUrl} width={400} height={400} alt="Satellite" />
                </div>
              </div>
            )}

            {solarData && (
              <div className="model-3d">
                <h2>3D View <span className="compass-label">&#9650; N</span></h2>
                <div className="model-three-container" ref={viewerRef}>
                  <SolarViewer
                    lat={geo.lat}
                    lon={geo.lon}
                    solarData={solarData}
                    onStatsChange={(c, k) => { setPanelCount(c); setKwhEstimate(k); }}
                  />
                </div>
              </div>
            )}
          </div>

          {solarData && (
            <div className="model-controls">
              <div className="model-stats-bar">
                <span className="model-stat">Roof: <strong>{solarData.stats.roofAreaM2?.toFixed(0)} m²</strong></span>
                <span className="model-stat">Max slots: <strong>{solarData.stats.maxPanels}</strong></span>
                <span className="model-stat">Peak sun: <strong>{solarData.stats.maxSunshineHours?.toFixed(0)} hr/yr</strong></span>
              </div>

              <div className="model-buttons">
                <button className="model-recommend-btn" onClick={handleRecommend} disabled={aiLoading}>
                  {aiLoading ? 'Analyzing...' : 'AI Recommend'}
                </button>
                <button className="model-fill-btn" onClick={() => getViewerControls(viewerRef)?.placeAll()}>
                  Place All
                </button>
                <button className="model-clear-btn" onClick={() => getViewerControls(viewerRef)?.clearPlaced()}>
                  Clear
                </button>
              </div>

              <div className="model-panel-stats">
                <span>{panelCount} panel{panelCount !== 1 ? 's' : ''} placed</span>
                {kwhEstimate > 0 && (
                  <span className="model-kwh">~{Math.round(kwhEstimate).toLocaleString()} kWh/year</span>
                )}
              </div>

              {reasoning && (
                <div className="model-reasoning">
                  <div className="model-reasoning-text">{reasoning}</div>
                </div>
              )}

              <p className="model-hint">Click a slot to place a panel. Click a placed panel to remove it.</p>
            </div>
          )}
        </div>
      )}

      {!geo && !loading && (
        <div className="model-empty">
          <span className="empty-icon">🏠</span>
          <p>{appState.address ? 'Loading your 3D model...' : 'Enter an address above to generate a 3D model of your roof'}</p>
        </div>
      )}
    </div>
  );
}
