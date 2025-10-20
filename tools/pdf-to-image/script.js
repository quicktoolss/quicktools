const pdfInput = document.getElementById("pdfInput");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

// Add a Download All button dynamically
const downloadAllBtn = document.createElement("button");
downloadAllBtn.textContent = "⬇️ Download All Pages as ZIP";
downloadAllBtn.style.display = "none";
downloadAllBtn.style.marginTop = "20px";
downloadAllBtn.style.padding = "10px 20px";
downloadAllBtn.style.borderRadius = "6px";
downloadAllBtn.style.background = "#0078ff";
downloadAllBtn.style.color = "white";
downloadAllBtn.style.fontWeight = "600";
downloadAllBtn.style.cursor = "pointer";
document.querySelector("main").appendChild(downloadAllBtn);

pdfInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusEl.textContent = "Loading PDF...";
  outputEl.innerHTML = "";
  downloadAllBtn.style.display = "none";
  progressContainer.style.display = "block";
  progressText.style.display = "block";
  progressBar.style.width = "0%";
  progressText.textContent = "Progress: 0%";

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    statusEl.textContent = `Loaded ${pdf.numPages} page(s). Converting...`;

    const imageUrls = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      imageUrls.push({ name: `page-${i}.jpg`, data: imgData });

      const img = document.createElement("img");
      img.src = imgData;
      outputEl.appendChild(img);

      const link = document.createElement("a");
      link.href = imgData;
      link.download = `page-${i}.jpg`;
      link.textContent = `Download Page ${i}`;
      link.style.display = "block";
      link.style.marginBottom = "15px";
      outputEl.appendChild(link);

      // Update progress
      const percent = Math.round((i / pdf.numPages) * 100);
      progressBar.style.width = percent + "%";
      progressText.textContent = `Progress: ${percent}%`;
    }

    statusEl.textContent = "✅ Conversion complete!";
    progressBar.style.width = "100%";
    progressText.textContent = "Progress: 100%";
    downloadAllBtn.style.display = "inline-block";

    // Handle "Download All" ZIP creation
    downloadAllBtn.onclick = async () => {
      statusEl.textContent = "Zipping all pages...";
      const zip = new JSZip();
      imageUrls.forEach(img => {
        zip.file(img.name, img.data.split(",")[1], { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "pdf-images.zip";
      link.click();

      URL.revokeObjectURL(url);
      statusEl.textContent = "✅ All pages downloaded!";
    };
  };
  fileReader.readAsArrayBuffer(file);
});
