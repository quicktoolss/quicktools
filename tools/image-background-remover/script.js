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

function renderCanvasWithMask(segmentation, whiteBg = false) {
  const canvas = outputCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = inputImage.width;
  canvas.height = inputImage.height;

  // Draw input image first
  ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maskData = segmentation.data; // Flat Int32Array
  const maskWidth = segmentation.width;
  const maskHeight = segmentation.height;

  for (let y = 0; y < canvas.height; y++) {
    const maskY = Math.floor(y * maskHeight / canvas.height);
    for (let x = 0; x < canvas.width; x++) {
      const maskX = Math.floor(x * maskWidth / canvas.width);
      const maskIndex = maskY * maskWidth + maskX;
      const isForeground = maskData[maskIndex] !== 0; // 0 = background, non-zero = foreground

      const i = (y * canvas.width + x) * 4;
      if (!whiteBg) {
        imageData.data[i + 3] = isForeground ? 255 : 0; // alpha channel
      } else {
        imageData.data[i + 3] = 255; // fully opaque for white background
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}


fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    inputImage.src = ev.target.result;
    previewContainer.classList.remove("hidden");
    progressContainer.classList.remove("hidden");
    updateProgress(10, "Loading image...");

    inputImage.onload = async () => {
      const model = await loadModel();
      updateProgress(50, "Running AI segmentation...");

      const segmentation = await model.segment(inputImage);

      updateProgress(80, "Rendering result...");
      renderCanvasWithMask(segmentation, bgToggle.checked);

      updateProgress(100, "Done!");
      setTimeout(() => progressContainer.classList.add("hidden"), 500);

      // Re-render when toggle changes
      bgToggle.addEventListener("change", () => {
        renderCanvasWithMask(segmentation, bgToggle.checked);
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
