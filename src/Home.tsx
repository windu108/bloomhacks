import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const [image, setImage] = useState(null);
  const navigate = useNavigate();

  function handleImageChange(event) {
    const file = event.target.files[0];
    setImage(file);
  }

  function handleContinue() {
    if (image) {
      // Pass the image to the next page
      navigate("/upload", { state: { image } });
    } else {
      alert("Please upload an image first!");
    }
  }

  return (
    <div>
      {/*<input type="range" min="0" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} />
      
      <div className="sun-bar">
        <div className="sun" style={{ left: `calc(${percent}% - 25 px)` }}>
          <img src={sun} alt="Sun" className="sun-image" />
        </div>
      </div>*/}
      <h1>Upload an Image</h1>

      <input 
        type="file" 
        accept="image/*"
        onChange={handleImageChange}
      />

      {image && (
        <p>
          Selected: {image.name}
        </p>
      )}

      <button onClick={handleContinue}>
        Continue
      </button>

    </div>
  );
}

export default Home;