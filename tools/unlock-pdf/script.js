// Unlock PDF Tool — Browser-Based
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
let pdfDoc = null;
let numPages = 0;
let filename = 'document.pdf';
let cancelled = false;

// pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// --- Upload Handling ---
pickBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background = '#eef7ff'; });
dropZone.addEventListener('dragleave', () => dropZone.style.background = ''); 
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.background = '';
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) handleFile(f);
});
fileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(f) handleFile(f);
});

function handleFile(file){
  if (!file) return;
  if (file.type !== 'application/pdf') return alert('Please select a PDF file.');
  filename = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    pdfData = ev.target.result;
    passwordSection.classList.remove('hidden');
    pagesSection.classList.add('hidden');
    resultArea.classList.add('hidden');
    openStatus.textContent = '';
    dropZone.innerHTML = `✅ ${file.name} · ${(file.size/1024).toFixed(1)} KB`;
    console.log('PDF loaded');
  };
  reader.readAsArrayBuffer(file);
}

// --- Open PDF ---
openBtn.addEventListener('click', async () => {
  if(!pdfData) return alert('Please select a PDF first.');
  const pwd = pwdInput.value || undefined;
  openStatus.textContent = 'Opening PDF…';
  try {
    const loadingTask = pdfjsLib.getDocument({data: pdfData, password: pwd});
    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;
    docNameEl.textContent = filename;
    pageCountEl.textContent = ` — ${numPages} page${numPages>1?'s':''}`;
    passwordSection.classList.add('hidden');
    pagesSection.classList.remove('hidden');
    openStatus.textContent = '';
    renderThumbnails();
  } catch(err) {
    console.error(err);
    alert('Failed to open PDF. Check password or file.');
  }
});

// --- Render Thumbnails ---
async function renderThumbnails(){
  thumbsEl.innerHTML = '';
  const thumbScale = 0.25;
  for(let i=1;i<=numPages;i++){
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({scale: thumbScale});
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
    const wrapper = document.createElement('label');
    wrapper.className = 'thumb';
    wrapper.innerHTML = `
      <img src="${canvas.toDataURL('image/png')}" alt="Page ${i}">
      <div class="meta"><span>Page ${i}</span><input type="checkbox" data-page="${i}" checked></div>
    `;
    thumbsEl.appendChild(wrapper);
  }
}

// --- Page Selection Controls ---
selectAllBtn.addEventListener('click', ()=> setAllThumbs(true));
clearBtn.addEventListener('click', ()=> setAllThumbs(false));
invertBtn.addEventListener('click', ()=> {
  const boxes = thumbsEl.querySelectorAll('input[type=checkbox]');
  boxes.forEach(b => b.checked = !b.checked);
});
function setAllThumbs(val){
  const boxes = thumbsEl.querySelectorAll('input[type=checkbox]');
  boxes.forEach(b => b.checked = val);
}

// --- Slider Labels ---
scaleRange.addEventListener('input', ()=> scaleVal.textContent = scaleRange.value + 'x');
qualityRange.addEventListener('input', ()=> qualityVal.textContent = qualityRange.value + '%');

// --- Create Unlocked PDF ---
createBtn.addEventListener('click', async () => {
  if(!pdfDoc) return;
  const checkedPages = [...thumbsEl.querySelectorAll('input[type=checkbox]')].filter(i=>i.checked).map(i=>parseInt(i.dataset.page));
  if(!checkedPages.length) return alert('Select at least one page.');
  cancelled = false;
  progressWrap.classList.remove('hidden');
  cancelBtn.classList.remove('hidden');
  resultArea.classList.add('hidden');
  setStatus('Preparing…', 0);

  try {
    const outPdf = await PDFLib.PDFDocument.create();
    const scale = parseFloat(scaleRange.value);
    const quality = parseInt(qualityRange.value);
    for(let i=0;i<checkedPages.length;i++){
      if(cancelled) throw new Error('Cancelled');
      const pageNum = checkedPages[i];
      setStatus(`Rendering page ${i+1} of ${checkedPages.length}`, Math.round((i/checkedPages.length)*80));
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({scale});
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality/100));
      const arr = await blob.arrayBuffer();
      const jpg = await outPdf.embedJpg(arr);
      const p = outPdf.addPage([jpg.width, jpg.height]);
      p.drawImage(jpg, {x:0, y:0, width:jpg.width, height:jpg.height});
      await new Promise(r => setTimeout(r, 20));
    }
    setStatus('Saving PDF…', 90);
    const bytes = await outPdf.save();
    setProgress(100);
    const blob = new Blob([bytes], {type:'application/pdf'});
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `unlocked_${filename}`;
    resultArea.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
    setStatus('Unlocked PDF ready.', 100);
  } catch(err){
    if(err.message==='Cancelled'){
      setStatus('Operation cancelled', 0);
    } else {
      console.error(err);
      alert('Failed: '+err.message);
      setStatus('Error',0);
    }
    cancelBtn.classList.add('hidden');
    setProgress(0);
  }
});

// --- Cancel ---
cancelBtn.addEventListener('click', ()=>{
  cancelled = true;
  cancelBtn.disabled = true;
  setStatus('Cancelling…',0);
});

// --- Helpers ---
function setStatus(msg,pct){
  statusLabel.textContent = msg;
  setProgress(pct);
}
function setProgress(pct){
  progressBar.style.width = `${pct}%`;
}
