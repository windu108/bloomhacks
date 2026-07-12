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
    analysisResult: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAppState(prev => ({ ...prev, image: file }));
    }
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
            onClick={() => fileInputRef.current?.click()}
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
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            appState={appState}
            onAnalysisComplete={handleAnalysisComplete}
            navigateTo={navigateTo}
            onUploadClick={() => fileInputRef.current?.click()}
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
