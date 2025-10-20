const pdfFile = document.getElementById("pdfFile");
const splitBtn = document.getElementById("splitBtn");
const rangeInput = document.getElementById("rangeInput");
const everyInput = document.getElementById("everyInput");
const output = document.getElementById("output");
const progressBar = document.getElementById("progressBar");
const progress = document.querySelector(".progress");

splitBtn.addEventListener("click", async () => {
  if (!pdfFile.files.length) return alert("Please upload a PDF first.");
  const file = pdfFile.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();
  const mode = document.querySelector('input[name="splitMode"]:checked').value;
  progressBar.style.display = "block";
  progress.style.width = "0%";
  output.innerHTML = "";

  const zip = new JSZip();
  let parts = [];

  if (mode === "range") {
    const ranges = parseRanges(rangeInput.value, totalPages);
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i];
      const newPdf = await PDFLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, [...Array(end - start + 1).keys()].map(j => j + start - 1));
      pages.forEach(p => newPdf.addPage(p));
      const pdfBytes = await newPdf.save();
      zip.file(`Split_${i + 1}.pdf`, pdfBytes);
      progress.style.width = `${((i + 1) / ranges.length) * 100}%`;
    }
  } else {
    const n = parseInt(everyInput.value);
    if (!n || n < 1) return alert("Please enter a valid number of pages per split.");
    let part = 1;
    for (let i = 0; i < totalPages; i += n) {
      const newPdf = await PDFLib.PDFDocument.create();
      const end = Math.min(i + n, totalPages);
      const pages = await newPdf.copyPages(pdfDoc, [...Array(end - i).keys()].map(j => j + i));
      pages.forEach(p => newPdf.addPage(p));
      const pdfBytes = await newPdf.save();
      zip.file(`Split_${part++}.pdf`, pdfBytes);
      progress.style.width = `${(end / totalPages) * 100}%`;
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, "Split_PDFs.zip");
  progress.style.width = "100%";
  output.innerHTML = "<p>✅ Splitting complete! Downloaded all files as ZIP.</p>";
});

function parseRanges(input, totalPages) {
  const parts = input.split(",");
  const ranges = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (start >= 1 && end <= totalPages && start <= end) ranges.push([start, end]);
    } else {
      const num = Number(part);
      if (num >= 1 && num <= totalPages) ranges.push([num, num]);
    }
  }
  return ranges;
}
