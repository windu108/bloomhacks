import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import sun from "./assets/sun.png";
import "./Upload.css";
import "./index.css";

// 1. Define an interface for what we expect to find inside React Router's memory state.
interface LocationState {
  image?: File;
  address?: string;
  electricBill?: string;
}

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

function Upload() {
  const location = useLocation() as { state: LocationState | null };
  const image = location.state?.image;
  const address = location.state?.address ?? "";
  const electricBill = location.state?.electricBill ?? "";

  // 2. Strongly type your state variables
  const [reasoningText, setReasoningText] = useState<string>("");
  const [recommendationText, setRecommendationText] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextValues, setContextValues] = useState<ContextValues>({
    address: address || null,
    monthly_electric_bill: electricBill || null,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);

  useEffect(() => {
    setContextValues((current) => ({
      ...current,
      address: current.address && current.address.trim().length > 0 ? current.address : address || null,
      monthly_electric_bill:
        current.monthly_electric_bill && current.monthly_electric_bill.trim().length > 0
          ? current.monthly_electric_bill
          : electricBill || null,
    }));
  }, [address, electricBill]);

  // Effect 1: Handle Object URL creation and memory cleanup
  useEffect(() => {
    if (!image) return;

    const url: string = URL.createObjectURL(image);
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

        if (typeof incomingValue === "string" && incomingValue.trim().length > 0) {
          const hasExistingValue = typeof currentValue === "string" && currentValue.trim().length > 0;
          if (!hasExistingValue) {
            merged[field] = incomingValue;
          }
        }
      });

      return merged;
    });
  };

  const analyzeImage = async () => {
    if (!image) return;

    setReasoningText("");
    setRecommendationText("");
    setScanProgress(0);
    setIsRegenerating(true);

    try {
      const toBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result.split(",")[1]);
            } else {
              reject(new Error("Failed to process image file layout."));
            }
          };
          reader.onerror = (err) => reject(err);
        });
      };

      const imageB64: string = await toBase64(image);
      const res = await fetch("http://localhost:5001/api/describe-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_b64: imageB64,
          mime_type: image.type || "image/jpeg",
          address: contextValues.address || address,
          monthly_electric_bill: contextValues.monthly_electric_bill || electricBill,
          context_values: contextValues,
        }),
      });

      if (!res.ok) {
        const msg: string = await res.text();
        throw new Error(msg || `Request failed: ${res.status}`);
      }

      const json = (await res.json()) as {
        description?: string;
        analysis?: Record<string, unknown>;
        evaluation?: { score?: number; reasoning?: string };
        summary?: string;
        next_steps?: string;
        context_values?: ContextValues;
      };

      const reasoning = typeof json.evaluation?.reasoning === "string" ? json.evaluation.reasoning.trim() : "";
      const score = typeof json.evaluation?.score === "number" ? json.evaluation.score : 0;
      const nextSteps = typeof json.next_steps === "string" ? json.next_steps.trim() : "";

      setReasoningText(reasoning || "Loading solar score justification...");
      setRecommendationText(nextSteps || "Loading recommendations from Gemini...");
      setScanProgress(Math.max(0, Math.min(100, score)));

      if (json.context_values) {
        mergeContextValues(json.context_values);
      }
    } catch {
      setReasoningText("We could not refresh the analysis right now.");
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

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand-block">
          <img src={sun} alt="SimplySolar logo" className="brand-logo" />
          <div>
            <h2 className="brand-title">SimplySolar</h2>
            <p className="brand-subtitle">Your guide to navigating the complex solar industry</p>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="insight">✨ Analysis complete</div>

        {image ? (
          <div className="result-shell">
            
            {/* Left Column containing Preview and the Button + Editor underneath */}
            <div className="left-column">
              <div className="preview-card">
                <p className="section-label">Your image</p>
                {previewUrl && (
                  <div className="preview-frame">
                    <img src={previewUrl} alt="Uploaded preview" className="preview-image" />
                  </div>
                )}
              </div>
              
              <button className="context-toggle" onClick={() => setShowContextEditor((value) => !value)}>
                {showContextEditor ? "Hide values" : "Change Values"}
              </button>

              {/* FIX: Context Editor now loads directly BELOW the button instead of the far right */}
              {showContextEditor && (
                <div className="context-editor-card" style={{ marginTop: "1rem" }}>
                  <p className="section-label">Change values</p>
                  <div className="context-editor">
                    {contextFields.map((field) => (
                      <label key={field} className="context-field">
                        <span>{contextFieldLabels[field]}</span>
                        <input
                          value={contextValues[field] ?? ""}
                          onChange={(event) => updateContextField(field, event.target.value)}
                          placeholder="Not provided"
                        />
                      </label>
                    ))}

                    <button className="regenerate-button" onClick={analyzeImage} disabled={isRegenerating}>
                      {isRegenerating ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis card container */}
            <div className="analysis-card">
              <div className="progress-card">
                <div className="progress-meta">
                  <span>Solar compatibility</span>
                  <strong>{scanProgress}%</strong>
                </div>
                <div className="sun-bar">
                  <div className="sunlight" style={{ width: `${scanProgress}%` }} />
                  <img src={sun} alt="Sun" className="sun" style={{ left: `calc(${scanProgress}% - 22px)` }} />
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

              {/* FIX: Recommendation section is now safely UNDER the solar reasoning details inside the main card container */}
              <div className="recommendations-card" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color, #eee)", paddingTop: "1.5rem" }}>
                <p className="section-label">Recommended next steps</p>
                {recommendationText ? (
                  <div className="description-block">{recommendationText}</div>
                ) : (
                  <p className="loading-text">Loading recommendations from Gemini...</p>
                )}
              </div>
            </div>

          </div>
        ) : (
          <p className="empty-state">No image was uploaded.</p>
        )}
      </div>
    </div>
  );
}

export default Upload;