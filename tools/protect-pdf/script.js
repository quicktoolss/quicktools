const uploadBox = document.getElementById("uploadBox");
const pdfInput = document.getElementById("pdfInput");
const controls = document.getElementById("controls");
const protectBtn = document.getElementById("protectBtn");
const passwordInput = document.getElementById("passwordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const progressBar = document.getElementById("progressBar");
const downloadLink = document.getElementById("downloadLink");

let selectedFile = null;

uploadBox.addEventListener("click", () => pdfInput.click());
pdfInput.addEventListener("change", handleFile);

uploadBox.addEventListener("dragover", e => {
  e.preventDefault();
  uploadBox.style.background = "#e7f1ff";
});
uploadBox.addEventListener("dragleave", () => uploadBox.style.background = "");
uploadBox.addEventListener("drop", e => {
  e.preventDefault();
  selectedFile = e.dataTransfer.files[0];
  if (selectedFile.type === "application/pdf") showControls();
});

function handleFile(e) {
  selectedFile = e.target.files[0];
  if (selectedFile.type === "application/pdf") showControls();
}

function showControls() {
  uploadBox.innerHTML = `✅ ${selectedFile.name}`;
  controls.style.display = "flex";
}

protectBtn.addEventListener("click", async () => {
  const pass = passwordInput.value.trim();
  const confirm = confirmPasswordInput.value.trim();
  if (!pass) return alert("Enter a password");
  if (pass !== confirm) return alert("Passwords do not match");

  progressBar.style.width = "25%";
  const arrayBuffer = await selectedFile.arrayBuffer();
  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

  progressBar.style.width = "50%";
  // 🔒 Encrypt with AES-256
  await pdfDoc.encrypt({
    userPassword: pass,
    ownerPassword: pass,
    permissions: {
      printing: false,
      modifying: false,
      copying: false,
    },
  });

  progressBar.style.width = "75%";
  const encryptedBytes = await pdfDoc.save();

  const blob = new Blob([encryptedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  downloadLink.href = url;
  downloadLink.download = "protected.pdf";
  downloadLink.classList.remove("hidden");

  progressBar.style.width = "100%";
});
