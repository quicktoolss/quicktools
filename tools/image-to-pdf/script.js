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

let draggedIndex = null;
let dropIndicator = document.createElement("div");
dropIndicator.className = "drop-indicator";

function renderPreview() {
  preview.innerHTML = "";
  images.forEach((file, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-wrapper";
    wrapper.draggable = true;
    wrapper.dataset.index = i;

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    const label = document.createElement("p");
    label.className = "page-label";
    label.textContent = `Page ${i + 1}`;

    wrapper.appendChild(img);
    wrapper.appendChild(label);

    wrapper.addEventListener("dragstart", handleDragStart);
    wrapper.addEventListener("dragover", handleDragOver);
    wrapper.addEventListener("drop", handleDrop);
    wrapper.addEventListener("dragend", handleDragEnd);

    preview.appendChild(wrapper);
  });
}

function handleDragStart(e) {
  draggedIndex = e.target.dataset.index;
  e.dataTransfer.effectAllowed = "move";
  e.target.classList.add("dragging");
  setTimeout(() => (e.target.style.opacity = "0.5"), 0);
}

function handleDragOver(e) {
  e.preventDefault();
  const target = e.target.closest(".img-wrapper");
  if (!target || target.classList.contains("dragging")) return;

  const targetRect = target.getBoundingClientRect();
  const before = e.clientY < targetRect.top + targetRect.height / 2;

  preview.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
  preview.insertBefore(dropIndicator, before ? target : target.nextSibling);
}

function handleDrop(e) {
  e.preventDefault();
  const target = e.target.closest(".img-wrapper");
  if (!target) return;

  const targetIndex = parseInt(target.dataset.index);
  const draggedFile = images.splice(draggedIndex, 1)[0];

  const targetRect = target.getBoundingClientRect();
  const before = e.clientY < targetRect.top + targetRect.height / 2;

  const insertAt = before ? targetIndex : targetIndex + 1;
  images.splice(insertAt, 0, draggedFile);

  preview.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
  renderPreview();
}

function handleDragEnd(e) {
  e.target.style.opacity = "1";
  e.target.classList.remove("dragging");
  preview.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
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
