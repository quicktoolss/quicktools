const fileInput = document.getElementById("fileInput");
const outputCanvas = document.getElementById("outputCanvas");
const previewContainer = document.getElementById("preview-container");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const downloadBtn = document.getElementById("downloadBtn");
const bgToggle = document.getElementById("bgToggle");

let model;

// Update progress bar
function updateProgress(percent, text) {
  progressBar.style.width = percent + "%";
  progressText.textContent = text;
}

// Load U²-Net TFJS model
async function loadModel() {
  if (!model) {
    updateProgress(10, "Loading AI model...");
    model = await tf.loadGraphModel("model/model.json"); // place your u2netp tfjs model in model/ folder
    updateProgress(30, "Model loaded");
  }
  return model;
}

// Resize image to model input
function preprocessImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const size = 320; // u2netp input
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  let tensor = tf.browser.fromPixels(canvas).toFloat();
  tensor = tensor.div(255.0).expandDims(0); // [1,320,320,3]
  return tensor;
}

// Render mask to original image size
async function renderMask(img, maskTensor, whiteBg=false) {
  const canvas = outputCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;

  const mask = await maskTensor.squeeze().array();
  const imageData = ctx.createImageData(img.width, img.height);

  for (let y=0; y<img.height; y++) {
    const maskY = Math.floor(y * mask.length / img.height);
    for (let x=0; x<img.width; x++) {
      const maskX = Math.floor(x * mask[0].length / img.width);
      const alpha = mask[maskY][maskX]; // 0..1
      const i = (y*img.width + x)*4;
      // Draw original pixel
      imageData.data[i] = imgData.data[i];
      imageData.data[i+1] = imgData.data[i+1];
      imageData.data[i+2] = imgData.data[i+2];
      imageData.data[i+3] = whiteBg ? 255 : Math.floor(alpha*255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  previewContainer.classList.remove("hidden");
  progressContainer.classList.remove("hidden");
  updateProgress(20, "Loading image...");

  img.onload = async () => {
    const model = await loadModel();
    updateProgress(50, "Processing...");

    const tensor = preprocessImage(img);
    const mask = model.predict(tensor); // [1,320,320,1]
    updateProgress(80, "Rendering result...");

    // Draw original image to get pixel data
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.width; tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img,0,0);
    window.imgData = tempCtx.getImageData(0,0,img.width,img.height);

    renderMask(img, mask, bgToggle.checked);
    updateProgress(100, "Done!");
    setTimeout(()=>progressContainer.classList.add("hidden"), 500);

    bgToggle.addEventListener("change", ()=>renderMask(img, mask, bgToggle.checked));
  };
});

downloadBtn.addEventListener("click", ()=>{
  const link = document.createElement("a");
  link.download = "background_removed.png";
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
});
