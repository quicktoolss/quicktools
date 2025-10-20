// script.js — experimental encryption using pdf-lib-plus-encrypt UMD build
// Exposes global: PDFLib (from the UMD bundle). It mirrors pdf-lib API plus encrypt() in this fork.

const pdfInput = document.getElementById('pdfInput');
const uploadBox = document.getElementById('uploadBox');
const controls = document.getElementById('controls');
const passwordInput = document.getElementById('passwordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const protectBtn = document.getElementById('protectBtn');
const fallbackZipBtn = document.getElementById('fallbackZipBtn');
const progressBar = document.getElementById('progressBar');
const downloadLink = document.getElementById('downloadLink');
const status = document.getElementById('status');

let selectedFile = null;

// drag & drop UX
uploadBox.addEventListener('click', () => pdfInput.click());
uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.style.background = '#eaf4ff'; });
uploadBox.addEventListener('dragleave', () => { uploadBox.style.background = ''; });
uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});

pdfInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});

function handleFile(file) {
  selectedFile = file;
  uploadBox.innerHTML = `✅ ${file.name} · ${(file.size/1024).toFixed(1)} KB`;
  controls.classList.remove('hidden');
  status.textContent = '';
  downloadLink.classList.add('hidden');
  progressBar.style.width = '0%';
}

// helper: update progress visual
function setProgress(pct) {
  progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

// Main protect handler — uses experimental encrypt API from the patched pdf-lib fork
protectBtn.addEventListener('click', async () => {
  if (!selectedFile) return alert('Please pick a PDF first.');
  const pass = (passwordInput.value || '').trim();
  const confirm = (confirmPasswordInput.value || '').trim();
  if (!pass) return alert('Enter a password to protect the PDF.');
  if (pass !== confirm) return alert('Passwords do not match.');

  setProgress(10);
  status.textContent = 'Loading file...';

  try {
    const ab = await selectedFile.arrayBuffer();
    setProgress(25);
    status.textContent = 'Parsing PDF...';

    // PDFLib is the global exposed by the experimental UMD bundle
    const { PDFDocument } = window.PDFLib || {};

    if (!PDFDocument) {
      throw new Error('Encryption-capable PDF library not loaded.');
    }

    // load existing doc
    const pdfDoc = await PDFDocument.load(ab);
    setProgress(45);
    status.textContent = 'Applying encryption (experimental)...';

    // Many forks expose an encrypt() method similar to server-side examples.
    // We'll call encrypt with userPassword / ownerPassword and permissions.
    // This API is experimental and may throw on some PDFs.
    if (typeof pdfDoc.encrypt !== 'function') {
      throw new Error('This PDF-lib build does not support encrypt().');
    }

    // call encrypt (may be synchronous or async depending on fork)
    await pdfDoc.encrypt({
      userPassword: pass,
      ownerPassword: pass,
      // permissions: follow the fork API — keep restrictive by default
      permissions: {
        printing: false,
        modifying: false,
        copying: false,
        annotating: false,
      },
    });

    setProgress(70);
    status.textContent = 'Saving encrypted PDF...';

    // save the encrypted bytes
    const encryptedBytes = await pdfDoc.save();
    setProgress(90);
    status.textContent = 'Finalizing...';

    const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = `protected_${selectedFile.name}`;
    downloadLink.classList.remove('hidden');
    status.textContent = '✅ Done — download below. Note: This encryption is experimental.';
    setProgress(100);
  } catch (err) {
    console.error('Encryption failed:', err);
    setProgress(0);
    status.textContent = `❌ Encryption failed: ${err.message || err}. Offering fallback (ZIP).`;
  }
});

// Fallback: make a password-protected ZIP using JSZip + a simple ZIP password routine
// We'll use the "zipcrypto" AES-less password protection via zip libs isn't standard in-browser.
// As a pragmatic fallback we will create a ZIP (no native password in pure JS Zip), then
// offer the user a downloadable ZIP and show instructions to password with their OS tools.
// Alternatively we can offer to encrypt bytes with WebCrypto then save as .bin with an instruction.
// For now we implement a minimal WebCrypto AES-GCM wrapper as fallback (file will be encrypted blob, not a standard PDF password).
fallbackZipBtn.addEventListener('click', async () => {
  if (!selectedFile) return alert('Please pick a PDF first.');
  const pass = (passwordInput.value || '').trim();
  if (!pass) return alert('Enter a password to secure the download.');

  setProgress(10);
  status.textContent = 'Preparing fallback encrypted file (AES-GCM)...';

  try {
    const ab = await selectedFile.arrayBuffer();
    // derive key from pass using PBKDF2
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt']
    );
    // encrypt data
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ab);

    // pack salt + iv + cipher into a blob (so we can decrypt later if we provide a small tool)
    const packed = new Blob([salt, iv, new Uint8Array(cipher)], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(packed);
    downloadLink.href = blobUrl;
    downloadLink.download = `${selectedFile.name}.encrypted.bin`;
    downloadLink.classList.remove('hidden');

    status.textContent = 'Fallback created. This is AES-GCM encrypted binary — to decrypt you need the password and a compatible tool.';
    setProgress(100);
  } catch (e) {
    console.error(e);
    status.textContent = 'Fallback encryption failed: ' + (e.message || e);
    setProgress(0);
  }
});
