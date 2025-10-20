(() => {
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = '[https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js)';

const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const browseBtn = document.getElementById('browseBtn');
const unlockBtn = document.getElementById('unlockBtn');
const clearBtn = document.getElementById('clearBtn');
const passwordInput = document.getElementById('password');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const previewArea = document.getElementById('previewArea');

let currentFile = null;

function setProgress(p, text) {
progressBar.style.width = Math.round(p * 100) + '%';
progressLabel.textContent = text || (Math.round(p * 100) + '%');
}

function reset() {
currentFile = null;
fileInput.value = null;
passwordInput.value = '';
unlockBtn.disabled = true;
previewArea.innerHTML = '';
setProgress(0, 'Idle');
}

dropArea.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', (e) => {
e.stopPropagation();
fileInput.click();
});

dropArea.addEventListener('dragover', (e) => {
e.preventDefault();
dropArea.classList.add('dragover');
});
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
dropArea.addEventListener('drop', (e) => {
e.preventDefault();
dropArea.classList.remove('dragover');
const f = e.dataTransfer.files && e.dataTransfer.files[0];
if (f) handleFile(f);
});

fileInput.addEventListener('change', (e) => {
const f = e.target.files && e.target.files[0];
if (f) handleFile(f);
});

clearBtn.addEventListener('click', () => reset());

function handleFile(file) {
if (file.type !== 'application/pdf') {
alert('Please provide a PDF file.');
return;
}
currentFile = file;
unlockBtn.disabled = false;
previewArea.innerHTML = `       <div class="thumb">         <div style="font-size:14px;font-weight:700">${escapeHtml(file.name)}</div>         <div style="font-size:12px;color:var(--muted);margin-top:6px">
          ${(file.size / 1024 / 1024).toFixed(2)} MB         </div>       </div>`;
setProgress(0, 'Ready');
}

unlockBtn.addEventListener('click', async () => {
if (!currentFile) return;
unlockBtn.disabled = true;
const password = passwordInput.value || undefined;

```
try {
  setProgress(0.02, 'Reading file');
  const arrayBuffer = await currentFile.arrayBuffer();

  setProgress(0.05, 'Loading PDF');
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password });

  loadingTask.onPassword = (updatePassword, reason) => {
    const msg =
      reason === loadingTask.PasswordResponses.NEED_PASSWORD
        ? 'Password required'
        : 'Incorrect password';
    const p = prompt(msg + '. Enter password:');
    if (p === null) {
      loadingTask.destroy();
      throw new Error('Password required');
    }
    updatePassword(p);
  };

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  setProgress(0.08, `Loaded — ${numPages} page(s)`);

  const canvases = [];
  for (let i = 1; i <= numPages; i++) {
    setProgress(0.08 + 0.7 * (i / numPages), `Rendering page ${i}/${numPages}`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const smallCanvas = document.createElement('canvas');
    const scalePreview = Math.min(300 / viewport.width, 1);
    smallCanvas.width = viewport.width * scalePreview;
    smallCanvas.height = viewport.height * scalePreview;
    smallCanvas.getContext('2d').drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
    thumb.appendChild(smallCanvas);

    const label = document.createElement('div');
    label.style.marginTop = '8px';
    label.style.fontSize = '12px';
    label.style.color = 'var(--muted)';
    label.textContent = 'Page ' + i;
    thumb.appendChild(label);
    previewArea.appendChild(thumb);
  }

  setProgress(0.82, 'Assembling unlocked PDF');
  const pdfLibDoc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < canvases.length; i++) {
    const imgDataUrl = canvases[i].toDataURL('image/jpeg', 0.92);
    const imgBytes = dataURLToUint8Array(imgDataUrl);
    const jpg = await pdfLibDoc.embedJpg(imgBytes);
    const page = pdfLibDoc.addPage([jpg.width, jpg.height]);
    page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
    setProgress(0.82 + 0.15 * ((i + 1) / canvases.length), `Embedding page ${i + 1}`);
  }

  const outBytes = await pdfLibDoc.save();
  setProgress(1, 'Done');

  const blob = new Blob([outBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const dl = document.createElement('a');
  dl.href = url;
  dl.download = currentFile.name.replace(/(\\.pdf)$/i, '') + '-unlocked.pdf';
  dl.textContent = 'Download unlocked PDF';
  dl.className = 'btn primary';
  dl.style.display = 'inline-block';
  dl.style.marginTop = '12px';
  previewArea.appendChild(dl);

  unlockBtn.disabled = false;
} catch (err) {
  console.error(err);
  alert('Failed to unlock PDF: ' + err.message);
  setProgress(0, 'Idle');
  unlockBtn.disabled = false;
}
```

});

function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, (c) => ({
'&': '&',
'<': '<',
'>': '>',
'"': '"',
"'": ''',
}[c]));
}

function dataURLToUint8Array(dataURL) {
const base64 = dataURL.split(',')[1];
const binary = atob(base64);
const len = binary.length;
const u8 = new Uint8Array(len);
for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
return u8;
}

reset();
})();
