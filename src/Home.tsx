import { useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import sun from "./assets/sun.png";
import SolarPlanner from "./SolarPlanner";
import "./Home.css";

function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [address, setAddress] = useState<string>("");
  const [electricBill, setElectricBill] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

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
      // Pass the image to the next page
      navigate("/upload", { state: { image, address, electricBill } });
    } else {
      alert("Please upload an image first!");
    }
  }

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

      <div className="card">
        {/*<input type="range" min="0" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} />
        
        <div className="sun-bar">
          <div className="sun" style={{ left: `calc(${percent}% - 25 px)` }}>
            <img src={sun} alt="Sun" className="sun-image" />
          </div>
        </div>*/}
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
          <span className="upload-icon">⬆</span>
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
            <span>Property address</span>
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

      <div className="solar-planner-section">
        <SolarPlanner initialAddress={address} autoLoad={false} showAddressInput={false} />
      </div>
    </div>
  );
}

export default Home;