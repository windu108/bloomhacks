import { useState, type ChangeEvent, type DragEvent } from "react";
import "./Home.css";

interface HomeProps {
  onUploadComplete: (image: File, address: string, electricBill: string) => void;
}

function Home({ onUploadComplete }: HomeProps) {
  const [image, setImage] = useState<File | null>(null);
  const [address, setAddress] = useState<string>("");
  const [electricBill, setElectricBill] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImage(file);
    setIsDragging(false);
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      setImage(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    setImage(file);
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setIsDragging(false);
  }

  function handleContinue() {
    if (image) {
      onUploadComplete(image, address, electricBill);
    } else {
      alert("Please upload an image first!");
    }
  }

  return (
    <div className="upload-page">
      <div className="card">
        <h1 style={{ marginTop: "25px" }}>Upload an Image</h1>
        <p className="subtitle">
          Drop a photo of your house facing forward and we will use it to determine solar-compatability.
        </p>

        <label
          className={`upload-zone${isDragging ? " drag-active" : ""}`}
          htmlFor="image-upload"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="upload-icon">&#11014;</span>
          <span className="upload-title">
            {image ? "Image ready to analyze" : isDragging ? "Drop your image here" : "Choose an image"}
          </span>
          <span className="upload-subtitle">
            {image ? image.name : isDragging ? "Release to upload" : "PNG, JPG, or WEBP"}
          </span>
          <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} />
        </label>

        {image && (
          <div className="selected-pill">
            <span>Selected</span>
            <strong>{image.name}</strong>
          </div>
        )}

        <div className="optional-fields">
          <label className="field">
            <span>Monthly electric bill (optional)</span>
            <input
              type="text"
              value={electricBill}
              onChange={(event) => setElectricBill(event.target.value)}
              placeholder="$150"
            />
          </label>
          <label className="field">
            <span>Address (optional)</span>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. 123 Main St, Austin, TX"
            />
          </label>
        </div>

        <button className="primary-button" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default Home;
