import { useEffect, useState } from "react";
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

function Upload() {
  // Use a TypeScript type assertion ('as') to tell the router to expect our specific state interface
  const location = useLocation() as { state: LocationState | null };
  const image = location.state?.image;
  const address = location.state?.address ?? "";
  const electricBill = location.state?.electricBill ?? "";

  // 2. Strongly type your state variables
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // Effect 1: Handle Object URL creation and memory cleanup
  useEffect(() => {
    if (!image) return;

    const url: string = URL.createObjectURL(image);
    setPreviewUrl(url);

    // Cleanup to prevent browser memory leaks
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // Effect 2: Convert file to base64 and hit your Flask server
  useEffect(() => {
    if (!image) return;

    const run = async () => {
      setError("");
      setDescription("");
      setScanProgress(0);

      try {
        // 3. Strongly typed Base64 converter. 
        // It accepts a 'File' and promises to eventually resolve into a 'string'.
        const toBase64 = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.readAsDataURL(file);

            reader.onload = () => {
              if (typeof reader.result === "string") {
                // Split off the metadata prefix (e.g., "data:image/png;base64,")
                resolve(reader.result.split(',')[1]);
              } else {
                reject(new Error("Failed to process image file layout."));
              }
            };

            reader.onerror = (err) => reject(err);
          });
        };

        const imageB64: string = await toBase64(image);

        // 4. Send the payload to your Flask server (running on port 5001)
        const res = await fetch("http://localhost:5001/api/describe-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_b64: imageB64,
            mime_type: image.type || "image/jpeg", // Safely fallback to jpeg if type is missing
            address,
            monthly_electric_bill: electricBill,
          }),
        });

        // Error checking the HTTP response status
        if (!res.ok) {
          const msg: string = await res.text();
          throw new Error(msg || `Request failed: ${res.status}`);
        }

        // 5. Explicitly type cast the incoming JSON structure from Flask
        const json = (await res.json()) as {
          description?: string;
          analysis?: Record<string, unknown>;
          evaluation?: { score?: number; reasoning?: string };
          summary?: string;
        };

        const reasoning = json.evaluation?.reasoning?.trim() || "";
        const score = typeof json.evaluation?.score === "number" ? json.evaluation.score : 0;

        console.log("Frontend received evaluation score:", score);
        console.log("Frontend received reasoning:", reasoning);

        setDescription(reasoning || "No solar evaluation was returned by Gemini.");
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
    };

    run();
  }, [image]);

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
        <h1>Upload Complete!</h1>

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
                <p className="section-label">Gemini reasoning</p>
                {error ? <pre className="error-block">{error}</pre> : null}
                {description ? (
                  <pre className="description-block">{description}</pre>
                ) : (
                  <p className="loading-text">Loading description from Gemini...</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-state">No image was uploaded.</p>
        )}

        <div className="context-card">
          <p className="section-label">Optional context</p>
          <p>
            <strong>Address:</strong> {address || "Not provided"}
          </p>
          <p>
            <strong>Monthly electric bill:</strong> {electricBill || "Not provided"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Upload;