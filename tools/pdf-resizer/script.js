const pdfInput = document.getElementById("pdfInput");
const uploadBox = document.getElementById("uploadBox");
const options = document.querySelector(".options");
const compressBtn = document.getElementById("compressBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const downloadLink = document.getElementById("downloadLink");
const result = document.querySelector(".result");
const sizeInfo = document.getElementById("sizeInfo");
const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");
const targetSize = document.getElementById("targetSize");

let uploadedFile;

// Drag and drop
uploadBox.addEventListener("dragover", e => {
  e.preventDefault();
  uploadBox.classList.add("dragover");
});
uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("dragover"));
uploadBox.addEventListener("drop", e => {
  e.preventDefault();
  uploadBox.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});
pdfInput.addEventListener("change", e => handleFile(e.target.files[0]));

function handleFile(file) {
  if (file && file.type === "application/pdf") {
    uploadedFile = file;
    options.style.display = "block";
  } else {
    alert("Please upload a valid PDF file.");
  }
}

// Update range label
qualityRange.addEventListener("input", () => {
  qualityValue.textContent = Math.round(qualityRange.value * 100) + "%";
});

compressBtn.addEventListener("click", async () => {
  if (!uploadedFile) return alert("Please select a PDF first.");

  compressBtn.disabled = true;
  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  const fileArrayBuffer = await uploadedFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: fileArrayBuffer });
  const pdf = await loadingTask.promise;

  const newPdf = await PDFLib.PDFDocument.create();
  let totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    let quality = parseFloat(qualityRange.value);
    let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));

    // auto adjust quality if targetSize is set
    if (targetSize.value) {
      const targetBytes = parseInt(targetSize.value) * 1024;
      let step = 0.05;
      while (blob.size > targetBytes && quality > 0.2) {
        quality -= step;
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      }
    }

    const imgBytes = await blob.arrayBuffer();
    const img = await newPdf.embedJpg(imgBytes);
    const pdfPage = newPdf.addPage([img.width, img.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

    progressBar.style.width = `${(i / totalPages) * 100}%`;
  }

  const compressedBytes = await newPdf.save();
  const originalKB = (uploadedFile.size / 1024).toFixed(1);
  const newKB = (compressedBytes.byteLength / 1024).toFixed(1);
  const reduction = ((1 - newKB / originalKB) * 100).toFixed(1);

  sizeInfo.innerHTML = `Original: ${originalKB} KB → New: ${newKB} KB (↓ ${reduction}%)`;
  result.style.display = "block";

  const blob = new Blob([compressedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = "compressed.pdf";

  compressBtn.disabled = false;
});
