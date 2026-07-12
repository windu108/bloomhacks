import { useEffect, useRef, useState, type FormEvent } from 'react';
import SolarViewer, { getViewerControls } from './SolarViewer';
import './SolarPlanner.css';

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

async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text) {
    throw new Error('The server returned an empty response.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned an invalid JSON response.');
  }
}

interface SolarPlannerProps {
  initialAddress?: string;
  autoLoad?: boolean;
  showAddressInput?: boolean;
}

export default function SolarPlanner({ initialAddress = '', autoLoad = false, showAddressInput = true }: SolarPlannerProps) {
  const [address, setAddress] = useState(initialAddress);
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

  useEffect(() => {
    setAddress(initialAddress);
  }, [initialAddress]);

  useEffect(() => {
    if (autoLoad && initialAddress.trim()) {
      void handleSubmit(undefined, initialAddress);
    }
  }, [autoLoad, initialAddress]);

  function showStatus(msg: string, err = false) {
    setStatus(msg);
    setIsError(err);
  }

  async function handleSubmit(e?: FormEvent | null, submittedAddress?: string) {
    const resolvedAddress = (submittedAddress ?? address).trim();
    if (!resolvedAddress) return;
    setAddress(resolvedAddress);
    e?.preventDefault();
    setLoading(true);
    setGeo(null);
    setSatImgUrl(null);
    setSolarData(null);
    setReasoning('');
    setPanelCount(0);
    setKwhEstimate(0);

    try {
      // Geocode
      showStatus('Looking up address...');
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(resolvedAddress)}`);
      const geoData = await readJsonResponse<{ lat: number; lon: number; formattedAddress: string }>(geoRes);
      if (!geoRes.ok) throw new Error((geoData as { error?: string }).error || 'Geocoding failed');
      setGeo(geoData);

      // Load satellite + solar in parallel
      showStatus('Loading satellite image + solar data...');
      const satUrl = `/api/satellite/image?lat=${geoData.lat}&lon=${geoData.lon}`;
      setSatImgUrl(satUrl);

      const solarRes = await fetch(`/api/solar?lat=${geoData.lat}&lon=${geoData.lon}`);
      const solar = await readJsonResponse<SolarData>(solarRes);
      if (!solarRes.ok) throw new Error((solar as { error?: string }).error || 'Solar fetch failed');

      setSolarData(solar);
      showStatus('');
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setLoading(false);
    }
  }

  function handleStatsChange(count: number, kwh: number) {
    setPanelCount(count);
    setKwhEstimate(kwh);
  }

  async function handleRecommend() {
    if (!geo || !solarData) return;
    setAiLoading(true);
    setReasoning('AI is analyzing your roof, satellite imagery, and solar data...');
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
      const data = await readJsonResponse<{ reasoning?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Recommendation failed');
      setReasoning(data.reasoning || 'No recommendation returned.');
    } catch (err: any) {
      setReasoning(`Recommendation failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  function handlePlaceAll() {
    const controls = getViewerControls(viewerRef);
    controls?.placeAll();
  }

  function handleClear() {
    const controls = getViewerControls(viewerRef);
    controls?.clearPlaced();
  }

  return (
    <div className="solar-planner">
      <section className="address-section">
        {showAddressInput ? (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="address-form">
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield, IL"
              autoComplete="street-address"
              required
              className="address-input"
            />
            <button type="submit" disabled={loading} className="go-btn">
              {loading ? '...' : 'Go'}
            </button>
          </form>
        ) : (
          <div className="address-actions">
            <p>Using the address above to load the roof map.</p>
            <button type="button" onClick={() => { void handleSubmit(undefined, address); }} disabled={loading} className="go-btn">
              {loading ? '...' : 'Load roof map'}
            </button>
          </div>
        )}
        {status && <div className={`status ${isError ? 'error' : ''}`}>{status}</div>}
      </section>

      {geo && (
        <section className="result-section">
          <div className="geocode-result">
            <strong>{geo.formattedAddress}</strong> &nbsp; {geo.lat.toFixed(6)}, {geo.lon.toFixed(6)}
          </div>

          {satImgUrl && (
            <div className="satellite-section">
              <h2>Satellite View</h2>
              <div className="image-container">
                <img src={satImgUrl} width={640} height={640} alt="Satellite view" />
              </div>
            </div>
          )}

          {solarData && (
            <div className="viewer-section">
              <h2>3D Roof Model <span className="compass-label">&#9650; N</span></h2>

              <div className="three-container" ref={viewerRef}>
                <SolarViewer
                  lat={geo.lat}
                  lon={geo.lon}
                  solarData={solarData}
                  onStatsChange={handleStatsChange}
                />
              </div>

              <div className="panel-controls">
                <div className="solar-stats-bar">
                  <span className="solar-stat">Roof: <strong>{solarData.stats.roofAreaM2?.toFixed(0)} m²</strong></span>
                  <span className="solar-stat">Max slots: <strong>{solarData.stats.maxPanels}</strong></span>
                  <span className="solar-stat">Peak sun: <strong>{solarData.stats.maxSunshineHours?.toFixed(0)} hr/yr</strong></span>
                </div>

                <div className="panel-buttons">
                  <button className="recommended-btn" onClick={handleRecommend} disabled={aiLoading}>
                    {aiLoading ? 'Analyzing...' : 'AI Recommend'}
                  </button>
                  <button className="fill-btn" onClick={handlePlaceAll}>Place All</button>
                  <button className="clear-btn" onClick={handleClear}>Clear</button>
                </div>

                <div className="panel-stats">
                  <span>{panelCount} panel{panelCount !== 1 ? 's' : ''} placed</span>
                  {kwhEstimate > 0 && (
                    <span className="kwh-estimate">~{Math.round(kwhEstimate).toLocaleString()} kWh/year</span>
                  )}
                </div>

                {reasoning && (
                  <div className="ai-reasoning">
                    <div className="ai-summary">{reasoning}</div>
                  </div>
                )}

                <p className="meta">Click a slot to place a panel &bull; Click a placed panel to remove it</p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
