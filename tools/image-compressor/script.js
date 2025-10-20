const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");
const controls = document.getElementById("controls");
const globalQuality = document.getElementById("globalQuality");
const globalQualityValue = document.getElementById("globalQualityValue");
const compressAllBtn = document.getElementById("compressAllBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const targetSizeInput = document.getElementById("targetSize");

let images = [];

uploadArea.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFiles);
uploadArea.addEventListener("dragover", e => {
  e.preventDefault();
  uploadArea.style.background = "#f0f7ff";
});
uploadArea.addEventListener("dragleave", () => uploadArea.style.background = "white");
uploadArea.addEventListener("drop", e => {
  e.preventDefault();
  handleFiles({ target: { files: e.dataTransfer.files } });
  uploadArea.style.background = "white";
});

function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  controls.classList.remove("hidden");
  previewGrid.innerHTML = "";
  images = [];

  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = event => {
      const imgData = event.target.result;
      const imgEl = document.createElement("img");
      imgEl.src = imgData;

      const card = document.createElement("div");
      card.className = "image-card";
      card.innerHTML = `
        <p><strong>${file.name}</strong></p>
        <img src="${imgData}" alt="preview"/>
        <div class="progress"><div class="progress-bar" id="progress-${i}"></div></div>
        <p class="sizes" id="size-${i}">Original: ${(file.size / 1024).toFixed(1)} KB</p>
      `;
      previewGrid.appendChild(card);

      images.push({ file, imgData, element: card });
    };
    reader.readAsDataURL(file);
  });
}

globalQuality.addEventListener("input", () => {
  globalQualityValue.textContent = globalQuality.value;
});

async function compressImage(file, quality, targetKB, index) {
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  let finalBlob;
  let q = quality / 100;

  if (targetKB) {
    for (let i = 0; i < 10; i++) {
      const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", q));
      const sizeKB = blob.size / 1024;
      if (Math.abs(sizeKB - targetKB) < targetKB * 0.1) {
        finalBlob = blob;
        break;
      }
      q *= targetKB / sizeKB; // adjust proportionally
      q = Math.min(Math.max(q, 0.1), 1);
      finalBlob = blob;
    }
  } else {
    finalBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", q));
  }

  const bar = document.getElementById(`progress-${index}`);
  bar.style.width = "100%";

  const newName = file.name.replace(/\.(\w+)$/, "_compressed.jpg");
  const beforeKB = file.size / 1024;
  const afterKB = finalBlob.size / 1024;
  const percent = ((1 - afterKB / beforeKB) * 100).toFixed(1);

  document.getElementById(`size-${index}`).textContent =
    `Original: ${beforeKB.toFixed(1)} KB → Compressed: ${afterKB.toFixed(1)} KB (↓ ${percent}%)`;

  return { blob: finalBlob, name: newName };
}

compressAllBtn.addEventListener("click", async () => {
  const zip = new JSZip();
  const quality = parseInt(globalQuality.value);
  const targetKB = parseFloat(targetSizeInput.value);
  const compressedFiles = [];

  compressAllBtn.disabled = true;
  for (let i = 0; i < images.length; i++) {
    const { file } = images[i];
    const result = await compressImage(file, quality, targetKB, i);
    zip.file(result.name, result.blob);
    compressedFiles.push(result);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, "compressed_images.zip");
  compressAllBtn.disabled = false;
  downloadAllBtn.classList.remove("hidden");
});
