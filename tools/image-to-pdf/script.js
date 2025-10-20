const { jsPDF } = window.jspdf;
const input = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const convertBtn = document.getElementById("convertBtn");
const downloadLink = document.getElementById("downloadLink");

let images = [];

// --- handle file selection ---
input.addEventListener("change", (e) => {
  images = Array.from(e.target.files);
  renderPreview();
  convertBtn.disabled = images.length === 0;
});

// --- render image thumbnails with drag/drop ---
function renderPreview() {
  preview.innerHTML = "";
  images.forEach((file, i) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.draggable = true;
    img.dataset.index = i;
    img.title = "Drag to reorder";

    img.addEventListener("dragstart", handleDragStart);
    img.addEventListener("dragover", handleDragOver);
    img.addEventListener("drop", handleDrop);

    preview.appendChild(img);
  });
}

let draggedIndex = null;
function handleDragStart(e) {
  draggedIndex = e.target.dataset.index;
  e.dataTransfer.effectAllowed = "move";
  e.target.style.opacity = "0.5";
}
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}
function handleDrop(e) {
  e.preventDefault();
  const targetIndex = e.target.dataset.index;
  if (draggedIndex === null || targetIndex === undefined) return;

  const draggedFile = images[draggedIndex];
  images.splice(draggedIndex, 1);
  images.splice(targetIndex, 0, draggedFile);
  renderPreview();
  draggedIndex = null;
}

// --- conversion logic ---
convertBtn.addEventListener("click", async () => {
  if (images.length === 0) return;

  statusEl.textContent = "Converting images to PDF...";
  convertBtn.disabled = true;
  downloadLink.style.display = "none";

  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  const pdf = new jsPDF();
  for (let i = 0; i < images.length; i++) {
    const imgData = await readFileAsDataURL(images[i]);
    const img = new Image();
    img.src = imgData;
    await new Promise((res) => (img.onload = res));

    const width = pdf.internal.pageSize.getWidth();
    const height = (img.height * width) / img.width;
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, width, height);

    const percent = Math.round(((i + 1) / images.length) * 100);
    progressBar.style.width = percent + "%";
    progressText.textContent = percent + "%";
    statusEl.textContent = `Processing ${i + 1} of ${images.length}...`;
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = "merged.pdf";
  downloadLink.style.display = "inline-block";
  statusEl.textContent = "✅ Conversion complete!";
  convertBtn.disabled = false;
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
