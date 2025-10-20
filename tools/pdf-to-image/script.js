const pdfInput = document.getElementById("pdfInput");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

pdfInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusEl.textContent = "Loading PDF...";
  outputEl.innerHTML = "";

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    statusEl.textContent = `Loaded ${pdf.numPages} page(s). Converting...`;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/jpeg", 1.0);
      outputEl.appendChild(img);

      // Download link
      const link = document.createElement("a");
      link.href = img.src;
      link.download = `page-${i}.jpg`;
      link.textContent = `Download Page ${i}`;
      link.style.display = "block";
      link.style.marginBottom = "15px";
      outputEl.appendChild(link);
    }

    statusEl.textContent = "✅ Conversion complete!";
  };
  fileReader.readAsArrayBuffer(file);
});
