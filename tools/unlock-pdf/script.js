// Unlock PDF improved UX script
// Uses pdf.js to open passworded PDF and pdf-lib to create a new unprotected PDF (pages rasterized to images)

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const pickBtn = document.getElementById('pickBtn');

const passwordSection = document.getElementById('passwordSection');
const pwdInput = document.getElementById('pwdInput');
const openBtn = document.getElementById('openBtn');
const openStatus = document.getElementById('openStatus');

const pagesSection = document.getElementById('pagesSection');
const docNameEl = document.getElementById('docName');
const pageCountEl = document.getElementById('pageCount');
const thumbsEl = document.getElementById('thumbs');

const selectAllBtn = document.getElementById('selectAllBtn');
const invertBtn = document.getElementById('invertBtn');
const clearBtn = document.getElementById('clearBtn');

const scaleRange = document.getElementById('scaleRange');
const scaleVal = document.getElementById('scaleVal');
const qualityRange = document.getElementById('qualityRange');
const qualityVal = document.getElementById('qualityVal');

const createBtn = document.getElementById('createBtn');
const cancelBtn = document.getElementById('cancelBtn');

const progressWrap = document.getElementById('progressWrap');
const statusLabel = document.getElementById('statusLabel');
const progressBar = document.getElementById('progressBar');

const resultArea = document.getElementById('resultArea');
const downloadLink = document.getElementById('downloadLink');

let pdfData = null;
let pdfDoc = null;         // pdf.js loaded doc
let numPages = 0;
let filename = 'document.pdf';
let cancelled = false;

// pdf.js worker (use CDN worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// pick button behaviour
pickBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background = '#eef7ff'; });
dropZone.addEventListener('dragleave', () => dropZone.style.background = ''; );
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.background = '';
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) handleFile(f);
});

function handleFile(file){
  if (!file) return;
  if (file.type !== 'application/pdf') return alert('Please select a PDF file.');
  filename = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    pdfData = ev.target.result;
    // show password area
    passwordSection.classList.remove('hidden');
    pagesSection.classList.add('hidden');
    resultArea.classList.add('hidden');
    openStatus.textContent = '';
    dropZone.innerHTML = `✅ ${file.name} · ${(file.size/1024).toFixed(1)} KB`;
  };
  reader.readAsArrayBuffer(file);
}

openBtn.addEventListener('click', async () => {
  if (!pdfData) return alert('Choose a PDF first.');
  const pwd = pwdInput.value || undefined;
  openStatus.textContent = 'Opening PDF…';
  try {
    // load with pdf.js; pdf.js will ask for password if required
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, password: pwd });
    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;
    docNameEl.textContent = filename;
    pageCountEl.textContent = ` — ${numPages} page${numPages > 1 ? 's' : ''}`;
    openStatus.textContent = `Opened ${numPages} page${numPages>1?'s':''}. Rendering thumbnails...`;
    passwordSection.classList.add('hidden');
    pagesSection.classList.remove('hidden');
    // render thumbnails (low-res)
    renderThumbnails();
  } catch (err) {
    console.error('open error', err);
    if (err && err.name === 'PasswordException') {
      alert('Password required or incorrect password. Try again.');
    } else {
      alert('Failed to open PDF: ' + (err && err.message ? err.message : err));
    }
    openStatus.textContent = '';
  }
});

async function renderThumbnails(){
  thumbsEl.innerHTML = '';
  // render small thumbnails at scale 0.25 for speed
  const thumbScale = 0.25;
  for (let i=1;i<=numPages;i++){
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: thumbScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const wrapper = document.createElement('label');
    wrapper.className = 'thumb';
    wrapper.innerHTML = `
      <img src="${canvas.toDataURL('image/png')}" alt="page ${i}" />
      <div class="meta"><span>Page ${i}</span><input data-page="${i}" type="checkbox" checked /></div>
    `;
    thumbsEl.appendChild(wrapper);
  }
}

// selection helpers
selectAllBtn.addEventListener('click', ()=> setAllThumbs(true));
clearBtn.addEventListener('click', ()=> setAllThumbs(false));
invertBtn.addEventListener('click', ()=> {
  const inputs = thumbsEl.querySelectorAll('input[type=checkbox]');
  inputs.forEach(ch => ch.checked = !ch.checked);
});
function setAllThumbs(val){
  const inputs = thumbsEl.querySelectorAll('input[type=checkbox]');
  inputs.forEach(ch => ch.checked = val);
}

// update labels for sliders
scaleRange.addEventListener('input', ()=> scaleVal.textContent = scaleRange.value + 'x');
qualityRange.addEventListener('input', ()=> qualityVal.textContent = qualityRange.value + '%');

// create unlocked PDF
createBtn.addEventListener('click', async () => {
  if (!pdfDoc) return alert('Open a PDF first.');
  // collect selected pages
  const checked = [...thumbsEl.querySelectorAll('input[type=checkbox]')].filter(i=>i.checked).map(i=>parseInt(i.dataset.page));
  if (!checked.length) return alert('Select at least one page to create unlocked PDF.');
  cancelled = false;
  resultArea.classList.add('hidden');
  progressWrap.classList.remove('hidden');
  cancelBtn.classList.remove('hidden');
  setStatus('Preparing render', 0);

  try {
    const outPdf = await PDFLib.PDFDocument.create();
    const scale = parseFloat(scaleRange.value) || 1.5;
    const quality = parseInt(qualityRange.value) || 85;
    for (let idx=0; idx<checked.length; idx++){
      if (cancelled) throw new Error('Cancelled');
      const pageNum = checked[idx];
      setStatus(`Rendering page ${idx+1} of ${checked.length} (original page ${pageNum})`, Math.round((idx/checked.length)*70));
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      // draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      // convert to jpeg blob
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality/100));
      const arr = await blob.arrayBuffer();
      // embed
      const jpg = await outPdf.embedJpg(arr);
      const p = outPdf.addPage([jpg.width, jpg.height]);
      p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
      setProgress(Math.round(((idx+1)/checked.length)*85));
      // allow UI breath
      await new Promise(r => setTimeout(r, 50));
    }
    setStatus('Saving PDF...', 90);
    const bytes = await outPdf.save();
    setProgress(95);
    const outBlob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(outBlob);
    downloadLink.href = url;
    downloadLink.download = `unlocked_${filename}`;
    resultArea.classList.remove('hidden');
    setStatus('Unlocked PDF ready. Download below.', 100);
    setProgress(100);
    // cleanup UI
    cancelBtn.classList.add('hidden');
  } catch (err) {
    if (err && err.message === 'Cancelled') {
      setStatus('Operation canceled by user.', 0);
    } else {
      console.error(err);
      alert('Failed: ' + (err && err.message ? err.message : err));
      setStatus('Error during processing', 0);
    }
    cancelBtn.classList.add('hidden');
    setProgress(0);
  }
});

// cancel
cancelBtn.addEventListener('click', ()=> {
  cancelled = true;
  cancelBtn.disabled = true;
  setStatus('Canceling…', 0);
});

// helpers
function setStatus(txt, pct){
  statusLabel.textContent = txt || statusLabel.textContent;
  setProgress(pct||0);
}
function setProgress(pct){
  progressBar.style.width = `${pct}%`;
}
