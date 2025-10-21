/* global PDFLib, pdfjsLib, JSZip */
/*
  script.js
  - Uses pdf.js to render thumbnails (preview)
  - Uses pdf-lib to split and create new PDF blobs
  - Uses JSZip to zip results for download
*/

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const pdfInput = document.getElementById('pdfInput');
const previewPanel = document.getElementById('previewPanel');
const fileGrid = document.getElementById('fileGrid');
const options = document.getElementById('options');
const modeSelect = document.getElementById('modeSelect');
const modeControls = document.getElementById('modeControls');
const startSplitBtn = document.getElementById('startSplit');
const resultsPanel = document.getElementById('resultsPanel');
const resultsList = document.getElementById('resultsList');
const downloadZipBtn = document.getElementById('downloadZip');
const estimateEl = document.getElementById('estimate');
const removeAllBtn = document.getElementById('removeAll');
const clearResultsBtn = document.getElementById('clearResults');

let fileEntries = []; // {file, arrayBuffer, pdfDoc (pdf-lib doc), pdfjsDoc, pages, thumbnail canvases, id}
let zip = null;

// Utilities
function makeId(len=8){
  return Math.random().toString(36).slice(2,2+len);
}

function humanBytes(n){ return (n/1024/1024).toFixed(2) + ' MB'; }

// Handle file input
pdfInput.addEventListener('change', async (e)=>{
  const files = Array.from(e.target.files || []);
  if(files.length === 0) return;
  await addFiles(files);
});

async function addFiles(files){
  for(const file of files){
    if(file.type !== 'application/pdf') continue;
    const id = makeId();
    const arrayBuffer = await file.arrayBuffer();
    // pdf-lib load (for manipulation)
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer).catch(()=>null);
    // pdf.js load (for rendering)
    const pdfjsDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise.catch(()=>null);
    const entry = {id, file, arrayBuffer, pdfLibDoc, pdfjsDoc, pages: pdfjsDoc?pdfjsDoc.numPages: (pdfLibDoc?pdfLibDoc.getPageCount():0)};
    fileEntries.push(entry);
    renderFileCard(entry);
  }
  updateUIState();
  updateModeControls();
  updateEstimate();
}

function renderFileCard(entry){
  previewPanel.classList.remove('hidden');
  fileGrid.innerHTML = fileGrid.innerHTML; // keep
  const card = document.createElement('div');
  card.className = 'file-card';
  card.dataset.id = entry.id;

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'thumb-wrap';

  const thumbBox = document.createElement('div');
  thumbBox.className = 'thumb';
  thumbWrap.appendChild(thumbBox);

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  meta.innerHTML = `<div class="name">${entry.file.name}</div>
                    <div class="details">${entry.pages} page(s) • ${humanBytes(entry.arrayBuffer.byteLength)}</div>`;

  const actions = document.createElement('div');
  actions.className = 'file-actions';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'small-btn';
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = ()=> removeFile(entry.id);

  const previewBtn = document.createElement('button');
  previewBtn.className = 'small-btn';
  previewBtn.textContent = 'Preview pages';
  previewBtn.onclick = ()=> toggleThumbnails(entry.id);

  actions.appendChild(previewBtn);
  actions.appendChild(removeBtn);

  card.appendChild(thumbWrap);
  card.appendChild(meta);
  card.appendChild(actions);

  fileGrid.appendChild(card);

  // render first page thumbnail immediately (if available)
  if(entry.pdfjsDoc && entry.pdfjsDoc.numPages > 0){
    entry.pdfjsDoc.getPage(1).then(page=>{
      const viewport = page.getViewport({scale: 0.5});
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({canvasContext: ctx, viewport}).promise.then(()=>{
        thumbBox.innerHTML = '';
        thumbBox.appendChild(canvas);
        // save a reference so toggling can reuse
        entry._thumbCanvas = canvas;
      }).catch(()=>{ /* ignore */ });
    }).catch(()=>{/* ignore */});
  } else {
    thumbBox.innerHTML = `<div style="padding:8px;color:var(--muted);font-size:12px">No preview</div>`;
  }
}

function toggleThumbnails(id){
  const entry = fileEntries.find(f=>f.id === id);
  if(!entry || !entry.pdfjsDoc) return;
  const card = document.querySelector(`.file-card[data-id="${id}"]`);
  const existing = card.querySelector('.thumb-list');
  if(existing){
    existing.remove();
    return;
  }
  const list = document.createElement('div');
  list.className = 'thumb-list';
  list.style.display='grid';
  list.style.gridTemplateColumns='repeat(auto-fill,minmax(80px,1fr))';
  list.style.gap='8px';
  list.style.marginTop='12px';
  card.appendChild(list);

  // render first up to 8 pages
  const pagesToRender = Math.min(entry.pdfjsDoc.numPages, 12);
  (async ()=>{
    for(let i=1;i<=pagesToRender;i++){
      try{
        const page = await entry.pdfjsDoc.getPage(i);
        const vp = page.getViewport({scale:0.35});
        const cv = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
        list.appendChild(cv);
      } catch(err){
        const placeholder = document.createElement('div');
        placeholder.style.height='80px'; placeholder.textContent='—';
        list.appendChild(placeholder);
      }
    }
    if(entry.pdfjsDoc.numPages > pagesToRender){
      const more = document.createElement('div');
      more.style.padding='6px'; more.style.fontSize='12px'; more.style.color='var(--muted)';
      more.textContent = `+ ${entry.pdfjsDoc.numPages - pagesToRender} more pages`;
      list.appendChild(more);
    }
  })();
}

function removeFile(id){
  fileEntries = fileEntries.filter(f=>f.id !== id);
  const el = document.querySelector(`.file-card[data-id="${id}"]`);
  if(el) el.remove();
  if(fileEntries.length === 0){
    previewPanel.classList.add('hidden');
    options.classList.add('hidden');
  }
  updateUIState();
  updateEstimate();
}

removeAllBtn.addEventListener('click', ()=>{
  fileEntries = [];
  fileGrid.innerHTML = '';
  previewPanel.classList.add('hidden');
  options.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  updateUIState();
});

// UI state updates
function updateUIState(){
  const hasFiles = fileEntries.length > 0;
  removeAllBtn.disabled = !hasFiles;
  startSplitBtn.disabled = !hasFiles;
  clearResultsBtn.disabled = resultsList.children.length === 0;
  if(hasFiles) options.classList.remove('hidden'); else options.classList.add('hidden');
}

// Mode controls
function updateModeControls(){
  modeControls.innerHTML = '';
  const mode = modeSelect.value;
  if(mode === 'nPages'){
    modeControls.innerHTML = `
      <div>
        <label>Pages per split</label>
        <input id="nPages" type="number" min="1" value="2" />
      </div>
    `;
    document.getElementById('nPages').addEventListener('input', updateEstimate);
  } else if(mode === 'fileSize'){
    modeControls.innerHTML = `
      <div>
        <label>Max file size (MB)</label>
        <input id="sizeMB" type="number" min="0.1" step="0.1" value="1" />
      </div>
    `;
    document.getElementById('sizeMB').addEventListener('input', updateEstimate);
  } else if(mode === 'range'){
    modeControls.innerHTML = `
      <div>
        <label>Range (e.g. 2-5)</label>
        <input id="range" type="text" placeholder="e.g. 1-3" />
      </div>
    `;
  } else if(mode === 'multiRange'){
    modeControls.innerHTML = `
      <div style="grid-column:1/-1">
        <label>Ranges (comma-separated, e.g. 1-3,5,7-9)</label>
        <input id="ranges" type="text" placeholder="1-3,5,7-9" />
      </div>
    `;
  } else {
    modeControls.innerHTML = `<div class="muted">No additional settings for this mode.</div>`;
  }
  updateUIState();
}

modeSelect.addEventListener('change', ()=>{
  updateModeControls();
  updateEstimate();
});

// Estimate function (simple approximations)
async function updateEstimate(){
  estimateEl.textContent = '';
  if(fileEntries.length === 0) return;
  const mode = modeSelect.value;
  if(mode === 'nPages'){
    const n = Math.max(1, parseInt(document.getElementById('nPages')?.value || 2));
    const est = fileEntries.map(f => `${f.file.name}: ~${Math.ceil(f.pages / n)} file(s)`).join(' • ');
    estimateEl.textContent = 'Estimate: ' + est;
  } else if(mode === 'fileSize'){
    const mb = Math.max(0.1, parseFloat(document.getElementById('sizeMB')?.value || 1));
    const est = fileEntries.map(f => {
      const totalMB = f.arrayBuffer.byteLength / (1024*1024);
      const parts = Math.max(1, Math.ceil(totalMB / mb));
      return `${f.file.name}: ~${parts} file(s)`;
    }).join(' • ');
    estimateEl.textContent = 'Estimate: ' + est;
  } else if(mode === 'range'){
    estimateEl.textContent = 'Estimate: 1 file per specified range';
  } else if(mode === 'multiRange'){
    estimateEl.textContent = 'Estimate: one file per range in list';
  } else if(mode === 'allPages'){
    const est = fileEntries.map(f => `${f.file.name}: ${f.pages} file(s)`).join(' • ');
    estimateEl.textContent = 'Estimate: ' + est;
  } else {
    estimateEl.textContent = '';
  }
}

// Parsing ranges helper
function parseRanges(text){
  // returns array of [startPageZeroBased, endPageZeroBased]
  const parts = text.split(',').map(s=>s.trim()).filter(Boolean);
  const ranges = [];
  for(const p of parts){
    if(p.includes('-')){
      const [a,b] = p.split('-').map(x=>parseInt(x,10));
      if(Number.isFinite(a) && Number.isFinite(b)){
        const s = Math.max(1, a);
        const e = Math.max(1, b);
        if(e >= s) ranges.push([s-1, e-1]);
      }
    } else {
      const v = parseInt(p,10);
      if(Number.isFinite(v)) ranges.push([v-1, v-1]);
    }
  }
  return ranges;
}

// Core splitting logic
startSplitBtn.addEventListener('click', async ()=>{
  if(fileEntries.length === 0) return;
  startSplitBtn.disabled = true;
  startSplitBtn.textContent = 'Working...';
  resultsPanel.classList.remove('hidden');
  resultsList.innerHTML = '';
  zip = new JSZip();

  // For each file, process according to mode
  for(const entry of fileEntries){
    const itemEl = document.createElement('div');
    itemEl.className = 'result-item';
    itemEl.innerHTML = `<div style="flex:1"><strong>${entry.file.name}</strong><div class="meta">Processing…</div></div>`;
    resultsList.appendChild(itemEl);

    try{
      const chunks = await splitPdfEntry(entry);
      // For each chunk, create download link and add to zip
      for(const c of chunks){
        const blob = new Blob([c.bytes], {type: 'application/pdf'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = c.name;
        link.textContent = c.name;
        const row = document.createElement('div');
        row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
        const left = document.createElement('div'); left.appendChild(link);
        const right = document.createElement('div'); right.className='meta'; right.textContent = humanBytes(c.bytes.byteLength);
        row.appendChild(left); row.appendChild(right);
        resultsList.appendChild(row);

        // add to zip
        zip.file(c.name, c.bytes);
      }

      // update item meta
      const meta = itemEl.querySelector('.meta');
      meta.textContent = `${chunks.length} file(s) created`;
    } catch(err){
      const meta = itemEl.querySelector('.meta');
      meta.textContent = `Error: ${err.message || err}`;
    }
    // small pause to let browser breathe and update UI
    await new Promise(r=>setTimeout(r,60));
  }

  // show zip button
  downloadZipBtn.style.display = 'inline-block';
  startSplitBtn.disabled = false;
  startSplitBtn.textContent = 'Start Split';
  clearResultsBtn.disabled = false;
});

// Splitting a single file entry according to selected mode
async function splitPdfEntry(entry){
  const mode = modeSelect.value;
  const arrayBuffer = entry.arrayBuffer;
  const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const total = pdfLibDoc.getPageCount();
  const chunks = [];

  if(mode === 'nPages'){
    const n = Math.max(1, parseInt(document.getElementById('nPages')?.value || 2));
    for(let i=0;i<total;i+=n){
      const length = Math.min(n, total - i);
      const newDoc = await PDFLib.PDFDocument.create();
      const pages = await newDoc.copyPages(pdfLibDoc, Array.from({length}, (_,k)=>i+k));
      pages.forEach(p => newDoc.addPage(p));
      const bytes = await newDoc.save();
      chunks.push({name: `${stripExt(entry.file.name)}_part${Math.floor(i/n)+1}.pdf`, bytes});
    }
  } else if(mode === 'fileSize'){
    const maxMB = Math.max(0.1, parseFloat(document.getElementById('sizeMB')?.value || 1));
    const maxBytes = Math.floor(maxMB * 1024 * 1024);

    // Greedy approach: accumulate pages into a chunk until size exceeds limit
    let start = 0;
    let part = 1;
    while(start < total){
      let end = start; // inclusive index for pages in this chunk
      let lastGoodBytes = null;
      while(end < total){
        const newDoc = await PDFLib.PDFDocument.create();
        const pages = await newDoc.copyPages(pdfLibDoc, Array.from({length: end - start + 1}, (_,k)=>start+k));
        pages.forEach(p=> newDoc.addPage(p));
        const bytes = await newDoc.save();
        if(bytes.byteLength > maxBytes){
          break;
        } else {
          lastGoodBytes = bytes;
          end++;
        }
        // safety guard
        if((end - start) > 60){ break; } // avoid huge loops on enormous PDFs
      }

      // if we never fit even a single page (page > maxBytes), force at least one page
      if(lastGoodBytes === null){
        const newDoc = await PDFLib.PDFDocument.create();
        const pages = await newDoc.copyPages(pdfLibDoc, [start]);
        pages.forEach(p=> newDoc.addPage(p));
        const bytes = await newDoc.save();
        chunks.push({name: `${stripExt(entry.file.name)}_part${part}.pdf`, bytes});
        start = start + 1;
        part++;
      } else {
        chunks.push({name: `${stripExt(entry.file.name)}_part${part}.pdf`, bytes: lastGoodBytes});
        start = end;
        part++;
      }
      await new Promise(r=>setTimeout(r,10)); // let UI breathe
    }
  } else if(mode === 'range'){
    const txt = (document.getElementById('range')?.value || '').trim();
    const r = parseRanges(txt);
    if(r.length === 0) throw new Error('Invalid range');
    const [s,e] = r[0];
    const start = Math.max(0, s);
    const end = Math.min(total - 1, e);
    if(start > end) throw new Error('Invalid range bounds');
    const newDoc = await PDFLib.PDFDocument.create();
    const pages = await newDoc.copyPages(pdfLibDoc, Array.from({length: end-start+1}, (_,k)=>start+k));
    pages.forEach(p=> newDoc.addPage(p));
    const bytes = await newDoc.save();
    chunks.push({name: `${stripExt(entry.file.name)}_pages${start+1}-${end+1}.pdf`, bytes});
  } else if(mode === 'multiRange'){
    const txt = (document.getElementById('ranges')?.value || '').trim();
    const ranges = parseRanges(txt);
    if(ranges.length === 0) throw new Error('Invalid ranges');
    let idx = 1;
    for(const [s,e] of ranges){
      const start = Math.max(0, s);
      const end = Math.min(total - 1, e);
      if(start > end) continue;
      const newDoc = await PDFLib.PDFDocument.create();
      const pages = await newDoc.copyPages(pdfLibDoc, Array.from({length: end-start+1}, (_,k)=>start+k));
      pages.forEach(p=> newDoc.addPage(p));
      const bytes = await newDoc.save();
      chunks.push({name: `${stripExt(entry.file.name)}_r${idx}_${start+1}-${end+1}.pdf`, bytes});
      idx++;
      await new Promise(r=>setTimeout(r,10));
    }
  } else if(mode === 'allPages'){
    for(let i=0;i<total;i++){
      const newDoc = await PDFLib.PDFDocument.create();
      const [p] = await newDoc.copyPages(pdfLibDoc, [i]);
      newDoc.addPage(p);
      const bytes = await newDoc.save();
      chunks.push({name: `${stripExt(entry.file.name)}_page${i+1}.pdf`, bytes});
      await new Promise(r=>setTimeout(r,5));
    }
  } else { // none - keep original
    const bytes = await pdfLibDoc.save();
    chunks.push({name: entry.file.name, bytes});
  }

  return chunks;
}

function stripExt(name){
  return name.replace(/\.[^.]+$/, '');
}

// Download zip
downloadZipBtn.addEventListener('click', async ()=>{
  if(!zip) return;
  downloadZipBtn.disabled = true;
  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'split_results.zip';
  document.body.appendChild(a); a.click(); a.remove();
  downloadZipBtn.disabled = false;
});

// Clear results
clearResultsBtn.addEventListener('click', ()=>{
  resultsList.innerHTML = '';
  resultsPanel.classList.add('hidden');
  downloadZipBtn.style.display = 'none';
  zip = null;
  clearResultsBtn.disabled = true;
});

// initialize
updateModeControls();
updateUIState();
updateEstimate();

// make drag & drop for whole page
window.addEventListener('dragover', (e)=>{ e.preventDefault(); });
window.addEventListener('drop', (e)=>{
  e.preventDefault();
  if(e.dataTransfer && e.dataTransfer.files) {
    const files = Array.from(e.dataTransfer.files).filter(f=>f.type === 'application/pdf');
    if(files.length) addFiles(files);
  }
});
