import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import sun from "./assets/sun.png";
import "./Upload.css";
import "./index.css"

// 1. Define an interface for what we expect to find inside React Router's memory state.
// This tells TypeScript that 'location.state' might contain an 'image' which is a standard web File object.
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
  // Use a TypeScript type assertion ('as') to tell the router to expect our specific state interface
  const location = useLocation() as { state: LocationState | null };
  const image = location.state?.image;
  const address = location.state?.address ?? "";
  const electricBill = location.state?.electricBill ?? "";

  // 2. Strongly type your state variables
  const [reasoningText, setReasoningText] = useState<string>("");
  const [recommendationText, setRecommendationText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextValues, setContextValues] = useState<ContextValues>({
    address: address || null,
    monthly_electric_bill: electricBill || null,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // Effect 1: Handle Object URL creation and memory cleanup
  useEffect(() => {
    if (!image) return;

    const url: string = URL.createObjectURL(image);
    setPreviewUrl(url);

    // Cleanup to prevent browser memory leaks
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const analyzeImage = async () => {
    if (!image) return;

    setError("");
    setDescription("");
    setIsRegenerating(true);
    const run = async () => {
      setError("");
      setReasoningText("");
      setRecommendationText("");
      setScanProgress(0);

    try {
      // 3. Strongly typed Base64 converter.
      //Accepts a 'File' and promises to eventually resolve into a 'string'
      const toBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.readAsDataURL(file);

          reader.onload = () => {
            if (typeof reader.result === "string") {
              //Split off the metadata prefix (e.g., "data:image/jpeg;base64,") and return just the Base64 string
              resolve(reader.result.split(',')[1]);
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
        // 5. Explicitly type cast the incoming JSON structure from Flask
        const json = (await res.json()) as {
          description?: string;
          analysis?: Record<string, unknown>;
          evaluation?: { score?: number; reasoning?: string };
          summary?: string;
          next_steps?: string;
        };

        const reasoning = json.evaluation?.reasoning?.trim() || "";
        const score = typeof json.evaluation?.score === "number" ? json.evaluation.score : 0;
        const nextSteps = json.next_steps?.trim() || "";

        console.log("Frontend received evaluation score:", score);
        console.log("Frontend received reasoning:", reasoning);
        console.log("Frontend received next steps:", nextSteps);

        setReasoningText(reasoning || "Loading solar score justification...");
        setRecommendationText(nextSteps || "Loading recommendations from Gemini...");
        setScanProgress(Math.max(0, Math.min(100, score)));

      } catch (e: unknown) {
        // TypeScript enforces that errors caught in a try/catch are typed as 'unknown' 
        // because anything can technically be thrown in JavaScript. We safely extract the message here:
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError(String(e));
        }
      }

      const json = (await res.json()) as { description?: string; context_values?: ContextValues };
      setDescription(json.description || "");

      if (json.context_values) {
        setContextValues((current) => ({ ...current, ...json.context_values }));
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError(String(e));
      }
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

  const populatedContextPreview = contextFields.filter((field) => {
    const value = contextValues[field];
    return typeof value === "string" && value.trim().length > 0;
  });

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
            <div className="preview-card">
              <p className="section-label">Your image</p>
              {previewUrl && (
                <div className="preview-frame">
                  <img src={previewUrl} alt="Uploaded preview" className="preview-image" />
                </div>
              )}
            </div>

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
                {error ? <pre className="error-block">{error}</pre> : null}
                {reasoningText ? (
                  <pre className="description-block">{reasoningText}</pre>
                ) : (
                  <p className="loading-text">Loading solar score justification...</p>
                )}
              </div>

              <div className="result-panel full-width-panel">
                <p className="section-label">Recommended next steps</p>
                {recommendationText ? (
                  <pre className="description-block">{recommendationText}</pre>
                ) : (
                  <p className="loading-text">Loading recommendations from Gemini...</p>
                )}
              </div>

              <div className="context-panel">
                <button className="context-toggle" onClick={() => setShowContextEditor((value) => !value)}>
                  {showContextEditor ? "Hide values" : "Change Values"}
                </button>

                {showContextEditor ? (
                  <div className="context-editor">
                    {populatedContextPreview.length > 0 ? (
                      <div className="context-preview">
                        <p className="section-label">Current values</p>
                        <ul>
                          {populatedContextPreview.map((field) => (
                            <li key={field}>
                              <strong>{contextFieldLabels[field]}:</strong> {contextValues[field]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

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
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-state">No image was uploaded.</p>
        )}

        {/*<div className="context-card">
          <p className="section-label">Optional context</p>
          <p>
            <strong>Address:</strong> {address || "Not provided"}
          </p>
          <p>
            <strong>Monthly electric bill:</strong> {electricBill || "Not provided"}
          </p>
        </div>*/}
      </div>
    </div>
  );
}

export default Upload;