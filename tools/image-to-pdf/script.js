const { jsPDF } = window.jspdf;
const input = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const convertBtn = document.getElementById("convertBtn");
const downloadLink = document.getElementById("downloadLink");

let images = [];

input.addEventListener("change", (e) => {
  images = Array.from(e.target.files);
  preview.innerHTML = "";
  if (images.length === 0) {
    convertBtn.disabled = true;
    return;
  }
  images.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
  convertBtn.disabled = false;
});

convertBtn.addEventListener("click", async () => {
  if (images.length === 0) return;
  statusEl.textContent = "Converting images to PDF...";
  convertBtn.disabled = true;

  const pdf = new jsPDF();
  for (let i = 0; i < images.length; i++) {
    const imgData = await readFileAsDataURL(images[i]);
    const img = new Image();
    img.src = imgData;
    await new Promise(res => img.onload = res);

    const width = pdf.internal.pageSize.getWidth();
    const height = (img.height * width) / img.width;

    if (i > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, width, height);

    statusEl.textContent = `Processing ${i + 1} of ${images.length}...`;
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = "merged.pdf";
  downloadLink.style.display = "inline-block";
  downloadLink.textContent = "⬇️ Download PDF";

  statusEl.textContent = "✅ Conversion complete!";
  convertBtn.disabled = false;
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
