const fileInput = document.getElementById("fileInput");
const inputImage = document.getElementById("inputImage");
const outputCanvas = document.getElementById("outputCanvas");
const previewContainer = document.getElementById("preview-container");
const loading = document.getElementById("loading");
const downloadBtn = document.getElementById("downloadBtn");

let model;

// 🧠 Load TensorFlow model
async function loadModel() {
  if (!model) {
    loading.classList.remove("hidden");
    model = await tf.loadGraphModel(
      "https://quicktoolss.github.io/models/u2net-tfjs/model.json"
    );
    loading.classList.add("hidden");
  }
  return model;
}

// 📤 Handle Image Upload
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (ev) {
    inputImage.src = ev.target.result;
    previewContainer.classList.remove("hidden");
    loading.classList.remove("hidden");

    inputImage.onload = async () => {
      const model = await loadModel();
      const tensor = tf.browser
        .fromPixels(inputImage)
        .resizeBilinear([320, 320])
        .toFloat()
        .div(255.0)
        .expandDims(0);

      const output = await model.executeAsync(tensor);
      const mask = tf.squeeze(output).arraySync();

      const canvas = outputCanvas;
      const ctx = canvas.getContext("2d");
      canvas.width = inputImage.width;
      canvas.height = inputImage.height;

      ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Apply alpha mask
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const mY = Math.floor((y / canvas.height) * 320);
          const mX = Math.floor((x / canvas.width) * 320);
          const val = mask[mY][mX];
          imageData.data[i + 3] = val * 255; // Alpha channel
        }
      }
      ctx.putImageData(imageData, 0, 0);

      loading.classList.add("hidden");
    };
  };
  reader.readAsDataURL(file);
});

// 💾 Download
downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "background_removed.png";
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
});
