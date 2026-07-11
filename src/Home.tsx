import { useState } from "react";
import { useNavigate } from "react-router-dom";

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