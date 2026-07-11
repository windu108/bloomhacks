import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import sun from "./assets/sun.png";
import "./Upload.css";
import "./index.css"

// 1. Define an interface for what we expect to find inside React Router's memory state.
// This tells TypeScript that 'location.state' might contain an 'image' which is a standard web File object.
interface LocationState {
  image?: File;
}

function Upload() {
  // Use a TypeScript type assertion ('as') to tell the router to expect our specific state interface
  const location = useLocation() as { state: LocationState | null };
  const image = location.state?.image;

  // 2. Strongly type your state variables
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
          }),
        });

        // Error checking the HTTP response status
        if (!res.ok) {
          const msg: string = await res.text();
          throw new Error(msg || `Request failed: ${res.status}`);
        }

        // 5. Explicitly type cast the incoming JSON structure from Flask
        const json = (await res.json()) as { description?: string };
        setDescription(json.description || "");

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
    <div className="container" style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Upload Complete!</h1>

      {image ? (
        <>
          <p>Your image:</p>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Uploaded preview"
              style={{ width: "300px", borderRadius: "8px", display: "block", marginBottom: "15px" }}
            />
          )}
          <hr />
          <div>
            <div className="sun-bar">
              <div className="sunlight" style={{width: `${55}%`}}/>
              <img src={sun} alt="Sun" className="sun" style={{ left: `calc(${55}% - 25px)` }} />
            </div>
          </div>

          <h2>{55}%</h2>
          <p><strong>Gemini description:</strong></p>
          {error ? <pre style={{ color: "#b00020", background: "#fbebe8", padding: "10px", borderRadius: "4px" }}>{error}</pre> : null}
          {description ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f5f5f5", padding: "15px", borderRadius: "4px" }}>
              {description}
            </pre>
          ) : (
            <p style={{ color: "#666", fontStyle: "italic" }}>Loading description from Gemini...</p>
          )}
        </>
      ) : (
        <p style={{ color: "#666" }}>No image was uploaded.</p>
      )}

    </div>
    </div>
  );
}

export default Upload;