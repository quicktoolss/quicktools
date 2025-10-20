const fileInput = document.getElementById("pdfInput");
const uploadBox = document.getElementById("uploadBox");
const fileList = document.getElementById("fileList");
const mergeBtn = document.getElementById("mergeBtn");
const downloadLink = document.getElementById("downloadLink");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const reorderHint = document.getElementById("reorderHint");

let files = [];

// Drag and drop upload
uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.classList.add("dragover");
});
uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("dragover"));
uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

function handleFiles(selectedFiles) {
  for (const file of selectedFiles) {
    if (file.type === "application/pdf") {
      files.push(file);
    }
  }
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = "";
  files.forEach((file, i) => {
    const li = document.createElement("li");
    li.classList.add("file-item");
    li.setAttribute("draggable", "true");
    li.dataset.index = i;
    li.innerHTML = `<span>${i + 1}. ${file.name}</span>`;
    fileList.appendChild(li);
  });

  enableReordering();
  reorderHint.style.display = files.length > 1 ? "block" : "none";
  mergeBtn.disabled = files.length < 2;
}

// --- Drag to reorder logic ---
function enableReordering() {
  const items = document.querySelectorAll(".file-item");
  let dragSrc = null;

  items.forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      dragSrc = item;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      const siblings = [...fileList.querySelectorAll(".file-item:not(.dragging)")];
      const nextSibling = siblings.find((sibling) => {
        return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
      });
      fileList.insertBefore(dragging, nextSibling);
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      updateFileOrder();
    });
  });
}

function updateFileOrder() {
  const items = document.querySelectorAll(".file-item");
  const newFiles = [];
  items.forEach((item) => {
    const index = item.dataset.index;
    newFiles.push(files[index]);
  });
  files = newFiles;
  renderFileList();
}

// --- Merge PDFs ---
mergeBtn.addEventListener("click", async () => {
  if (files.length < 2) return alert("Add at least 2 PDFs to merge.");

  mergeBtn.disabled = true;
  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const arrayBuffer = await files[i].arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      progressBar.style.width = `${((i + 1) / files.length) * 100}%`;
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = "merged.pdf";
    downloadLink.style.display = "inline-block";
  } catch (err) {
    alert("Error merging PDFs: " + err.message);
  } finally {
    mergeBtn.disabled = false;
  }
});
