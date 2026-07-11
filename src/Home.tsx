import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import sun from "./assets/sun.png";
import "./Home.css";

function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [address, setAddress] = useState<string>("");
  const [electricBill, setElectricBill] = useState<string>("");
  const navigate = useNavigate();

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImage(file);
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
        <div className="insight">✨ AI image insight</div>
        <h1 style={{ marginTop: "25px" }}>Upload an Image</h1>
        <p className="subtitle">
          Drop a photo and let the experience turn it into something beautifully explained.
        </p>

        <label className="upload-zone" htmlFor="image-upload">
          <span className="upload-icon">⬆</span>
          <span className="upload-title">{image ? "Image ready to analyze" : "Choose an image"}</span>
          <span className="upload-subtitle">
            {image ? image.name : "PNG, JPG, or WEBP"}
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
            <span>Address (optional)</span>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. 123 Main St, Austin, TX"
            />
          </label>

          <label className="field">
            <span>Monthly electric bill (optional)</span>
            <input
              type="text"
              value={electricBill}
              onChange={(event) => setElectricBill(event.target.value)}
              placeholder="$150"
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