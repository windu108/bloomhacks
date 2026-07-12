import { useState, useRef } from 'react';
import './App.css';
import Dashboard from './Dashboard';
import ModelView from './ModelView';
import Summary from './Summary';
import sun from './assets/sun.png';

export interface AppState {
  image: File | null;
  address: string;
  electricBill: string;
  surfaceArea: number | null;
  analysisResult: AnalysisResult | null;
}

export interface AnalysisResult {
  score: number;
  reasoning: string;
  nextSteps: string;
  contextValues: Record<string, string | null>;
}

type Tab = 'dashboard' | 'model' | 'summary';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [appState, setAppState] = useState<AppState>({
    image: null,
    address: '',
    electricBill: '',
    surfaceArea: null,
    analysisResult: null,
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalAddress, setModalAddress] = useState('');
  const [modalBill, setModalBill] = useState('');
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalPreview, setModalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleModalFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setModalFile(file);
      setModalPreview(URL.createObjectURL(file));
    }
  }

  async function handleUploadSubmit() {
    if (!modalFile || !modalAddress.trim()) return;

    // Fetch surface area from Solar API via geocode → solar
    let surfaceArea: number | null = null;
    try {
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(modalAddress)}`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        const solarRes = await fetch(`/api/solar?lat=${geo.lat}&lon=${geo.lon}`);
        if (solarRes.ok) {
          const solar = await solarRes.json();
          surfaceArea = solar.stats?.roofAreaM2 ?? null;
        }
      }
    } catch { /* proceed without surface area */ }

    setAppState(prev => ({
      ...prev,
      image: modalFile,
      address: modalAddress.trim(),
      electricBill: modalBill.trim(),
      surfaceArea,
    }));

    setShowUploadModal(false);
    setModalFile(null);
    setModalPreview(null);
    setModalAddress('');
    setModalBill('');
    setActiveTab('dashboard');
  }

  function handleAnalysisComplete(result: AnalysisResult) {
    setAppState(prev => ({ ...prev, analysisResult: result }));
  }

  function navigateTo(tab: Tab) {
    setActiveTab(tab);
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <img src={sun} alt="SimplySolar" className="sidebar-logo" />
          <span className="sidebar-title">SimplySolar</span>
        </div>

        <div className="sidebar-nav">
          <button
            className="nav-item upload-nav"
            onClick={() => setShowUploadModal(true)}
          >
            Upload Photo
          </button>
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-item ${activeTab === 'model' ? 'active' : ''}`}
            onClick={() => navigateTo('model')}
          >
            3D Model
          </button>
          <button
            className={`nav-item ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => navigateTo('summary')}
          >
            Summary
          </button>
        </div>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleModalFileChange}
        style={{ display: 'none' }}
      />

      {showUploadModal && (
        <div className="upload-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <h2>Upload your roof photo</h2>

            <div
              className="modal-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              {modalPreview ? (
                <img src={modalPreview} alt="Preview" className="modal-preview-img" />
              ) : (
                <p>Click to select a photo</p>
              )}
            </div>

            <label className="modal-field">
              <span>Property address</span>
              <input
                type="text"
                value={modalAddress}
                onChange={e => setModalAddress(e.target.value)}
                placeholder="e.g. 1600 Amphitheatre Pkwy, Mountain View, CA"
              />
            </label>

            <label className="modal-field">
              <span>Monthly electric bill</span>
              <input
                type="text"
                value={modalBill}
                onChange={e => setModalBill(e.target.value)}
                placeholder="e.g. $150"
              />
            </label>

            <button
              className="modal-submit"
              onClick={handleUploadSubmit}
              disabled={!modalFile || !modalAddress.trim()}
            >
              Analyze
            </button>
          </div>
        </div>
      )}

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            appState={appState}
            onAnalysisComplete={handleAnalysisComplete}
            navigateTo={navigateTo}
            onUploadClick={() => setShowUploadModal(true)}
          />
        )}
        {activeTab === 'model' && (
          <ModelView appState={appState} />
        )}
        {activeTab === 'summary' && (
          <Summary appState={appState} navigateTo={navigateTo} />
        )}
      </main>
    </div>
  );
}

export default App;
