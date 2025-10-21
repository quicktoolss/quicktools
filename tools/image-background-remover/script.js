const fileInput = document.getElementById("fileInput");
const inputImage = document.getElementById("inputImage");
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

// Load DeepLab model
async function loadModel() {
  if (!model) {
    progressContainer.classList.remove("hidden");
    updateProgress(10, "Loading AI model...");
    model = await deeplab.load({base: 'mobilenetv2', quantizationBytes: 2});
    updateProgress(30, "Model loaded");
  }
  return model;
}

// Render mask to canvas
function renderCanvasWithMask(mask, whiteBg = false) {
  const canvas = outputCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = inputImage.width;
  canvas.height = inputImage.height;

  // Clear or fill white background
  if (whiteBg) ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const mY = Math.floor((y / canvas.height) * mask.length);
      const mX = Math.floor((x / canvas.width) * mask[0].length);
      const val = mask[mY][mX] === 15 ? 255 : 0; // 15 = person class in DeepLab
      if (!whiteBg) imageData.data[i + 3] = val;
      else imageData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Handle image upload
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    inputImage.src = ev.target.result;
    previewContainer.classList.remove("hidden");
    progressContainer.classList.remove("hidden");
    updateProgress(40, "Preparing image...");

    inputImage.onload = async () => {
      const model = await loadModel();

      updateProgress(60, "Running AI...");
      const segmentation = await model.segment(inputImage);
      const mask = segmentation.segmentationMap;

      updateProgress(80, "Rendering...");
      renderCanvasWithMask(mask, bgToggle.checked);

      updateProgress(100, "Done!");
      setTimeout(() => progressContainer.classList.add("hidden"), 500);

      // Update toggle in real-time
      bgToggle.addEventListener("change", () => {
        renderCanvasWithMask(mask, bgToggle.checked);
      });
    };
  };
  reader.readAsDataURL(file);
});

// Download button
downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "background_removed.png";
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
});
