import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function Upload() {
  const location = useLocation();
  const image = location.state?.image;

  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  // Handle Object URL creation and cleanup to prevent memory leaks
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url); // Cleanup on unmount
  }, [image]);

  useEffect(() => {
    if (!image) return;

    const run = async () => {
      setError("");
      setDescription("");

      try {
        // Efficiently convert File to Base64 using FileReader
        const toBase64 = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result.split(',')[1]); // Strip the data URL prefix
          reader.onerror = (error) => reject(error);
        });

        const imageB64 = await toBase64(image);

        const res = await fetch("http://localhost:5001/api/describe-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_b64: imageB64,
            mime_type: image.type || "image/jpeg",
          }),
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || `Request failed: ${res.status}`);
        }

        const json = await res.json();
        setDescription(json.description || "");
      } catch (e) {
        setError(e?.message || String(e));
      }
    };

    run();
  }, [image]);

  return (
    <div>
      <h1>Upload Complete!</h1>

      {image ? (
        <>
          <p>Your image:</p>
          {previewUrl && <img src={previewUrl} alt="Uploaded preview" width="300" />}
          <hr />

          <p><strong>Gemini description:</strong></p>
          {error ? <pre style={{ color: "#b00020" }}>{error}</pre> : null}
          {description ? <pre>{description}</pre> : <p>Loading description...</p>}
        </>
      ) : (
        <p>No image was uploaded.</p>
      )}
    </div>
  );
}

export default Upload;