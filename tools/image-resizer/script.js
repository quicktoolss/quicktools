/* Image Resizer — full-featured, client-side */
const fileInput = document.getElementById('fileInput') || createHiddenFileInput();
const chooseBtn = document.getElementById('chooseBtn');
const dropzone = document.getElementById('dropzone');
const preview = document.getElementById('preview');

const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const scaleInput = document.getElementById('scaleInput');
const keepAspect = document.getElementById('keepAspect');
const fitMode = document.getElementById('fitMode');
const outputFormat = document.getElementById('outputFormat');
const quality = document.getElementById('quality');
const qualityVal = document.getElementById('qualityVal');
const targetSize = document.getElementById('targetSize');

const processAllBtn = document.getElementById('processAll');
const clearAllBtn = document.getElementById('clearAll');
const downloadZip = document.getElementById('downloadZip');

const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

let files = []; // {file, id}
let processed = [];

chooseBtn && chooseBtn.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', e => handleFiles(e.target.files));

;['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
;['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e => { const dt = e.dataTransfer; if(dt && dt.files) handleFiles(dt.files); });

document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', ()=> {
  const w = b.dataset.w; const h = b.dataset.h;
  widthInput.value = w || '';
  heightInput.value = h || '';
}));

quality.addEventListener('input', ()=> qualityVal.textContent = quality.value);

function uid(){ return Math.random().toString(36).slice(2,9); }

function handleFiles(fileList){
  const arr = Array.from(fileList).filter(f => f.type && f.type.startsWith('image/'));
  arr.forEach(f => files.push({file: f, id: uid()}));
  renderPreview();
}

function renderPreview(){
  preview.innerHTML = '';
  files.forEach((entry, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'img-wrapper';
    wrapper.draggable = true;
    wrapper.dataset.index = i;

    const img = document.createElement('img');
    img.src = URL.createObjectURL(entry.file);
    img.alt = entry.file.name;

    const label = document.createElement('div');
    label.className = 'page-label';
    label.textContent = `${i+1}. ${entry.file.name.split('.').slice(0,-1).join('.') || entry.file.name}`;

    const actions = document.createElement('div');
    actions.style.marginTop = '8px';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'ghost';
    removeBtn.onclick = ()=> { URL.revokeObjectURL(img.src); files = files.filter((_, idx)=> idx !== i); renderPreview(); };

    actions.appendChild(removeBtn);

    wrapper.appendChild(img);
    wrapper.appendChild(label);
    wrapper.appendChild(actions);

    // drag handlers & drop indicator
    wrapper.addEventListener('dragstart', handleDragStart);
    wrapper.addEventListener('dragover', handleDragOver);
    wrapper.addEventListener('drop', handleDrop);
    wrapper.addEventListener('dragend', handleDragEnd);

    preview.appendChild(wrapper);
  });
}

let draggedIndex = null;
let dropIndicator = (() => { const el = document.createElement('div'); el.className = 'drop-indicator'; return el; })();

function handleDragStart(e){
  draggedIndex = parseInt(e.currentTarget.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
  setTimeout(()=> e.currentTarget.style.opacity = '0.5', 0);
}
function handleDragOver(e){
  e.preventDefault();
  const target = e.currentTarget;
  if(target.classList.contains('dragging')) return;
  const rect = target.getBoundingClientRect();
  const before = (e.clientY < rect.top + rect.height/2);
  // remove existing
  preview.querySelectorAll('.drop-indicator').forEach(n => n.remove());
  preview.insertBefore(dropIndicator, before ? target : target.nextSibling);
}
function handleDrop(e){
  e.preventDefault();
  const target = e.currentTarget;
  const targetIndex = parseInt(target.dataset.index);
  if(Number.isNaN(draggedIndex) || Number.isNaN(targetIndex)) return;
  const draggedFile = files.splice(draggedIndex,1)[0];
  const rect = target.getBoundingClientRect();
  const before = (e.clientY < rect.top + rect.height/2);
  const insertAt = before ? targetIndex : targetIndex + 1;
  files.splice(insertAt, 0, draggedFile);
  preview.querySelectorAll('.drop-indicator').forEach(n => n.remove());
  renderPreview();
  draggedIndex = null;
}
function handleDragEnd(e){
  e.currentTarget.style.opacity = '1';
  e.currentTarget.classList.remove('dragging');
  preview.querySelectorAll('.drop-indicator').forEach(n => n.remove());
}

/* ---------------- resizing logic ---------------- */

function readFileAsDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function processImageFile(file, options){
  // returns {name, blob, size}
  const dataUrl = await readFileAsDataURL(file);
  const img = new Image();
  img.src = dataUrl;
  await new Promise(r => img.onload = r);

  // determine target dimensions
  const origW = img.width, origH = img.height;
  let targetW = parseInt(options.width) || null;
  let targetH = parseInt(options.height) || null;
  const scalePerc = parseFloat(options.scale) || null;

  if(scalePerc){
    targetW = Math.round(origW * (scalePerc/100));
    targetH = Math.round(origH * (scalePerc/100));
  }

  if(!targetW && !targetH){
    // keep original (or will be handled by fit mode)
    targetW = origW; targetH = origH;
  } else if(targetW && !targetH){
    targetH = options.keepAspect ? Math.round((targetW / origW) * origH) : targetH || origH;
  } else if(!targetW && targetH){
    targetW = options.keepAspect ? Math.round((targetH / origH) * origW) : targetW || origW;
  } else {
    // both present: if keepAspect, adjust one to maintain
    if(options.keepAspect){
      const ratio = origW / origH;
      if(targetW / targetH > ratio){
        targetW = Math.round(targetH * ratio);
      } else {
        targetH = Math.round(targetW / ratio);
      }
    }
  }

  // canvas creation
  const canvas = document.createElement('canvas');
  let dw = targetW, dh = targetH;

  // fit modes logic
  if(options.fitMode === 'fit'){ // contain
    const ratio = Math.min(targetW / origW, targetH / origH);
    dw = Math.round(origW * ratio); dh = Math.round(origH * ratio);
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const x = Math.round((canvas.width - dw)/2);
    const y = Math.round((canvas.height - dh)/2);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, dw, dh);
  } else if(options.fitMode === 'fill'){ // cover (may crop)
    const ratio = Math.max(targetW / origW, targetH / origH);
    dw = Math.round(origW * ratio); dh = Math.round(origH * ratio);
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    const sx = Math.round((dw - targetW)/2 / ratio);
    const sy = Math.round((dh - targetH)/2 / ratio);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // simpler: draw scaled center-cropped
    const scale = ratio;
    const sw = Math.round(targetW / scale);
    const sh = Math.round(targetH / scale);
    const sx0 = Math.round((origW - sw)/2);
    const sy0 = Math.round((origH - sh)/2);
    ctx.drawImage(img, sx0, sy0, sw, sh, 0, 0, targetW, targetH);
  } else if(options.fitMode === 'stretch'){
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else if(options.fitMode === 'center') {
    canvas.width = Math.max(origW, targetW); canvas.height = Math.max(origH, targetH);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const x = Math.round((canvas.width - origW)/2);
    const y = Math.round((canvas.height - origH)/2);
    ctx.drawImage(img, x, y);
  }

  // export handling
  const outType = options.format || 'image/jpeg';
  const qualityVal = Math.max(0.01, Math.min(1, (options.quality||85)/100));

  // if targetSize specified -> try to binary-search quality for JPG/WEBP
  if(options.targetSize && options.targetSize > 0 && (outType === 'image/jpeg' || outType === 'image/webp')){
    const kbTarget = options.targetSize;
    // binary search quality between 0.05 - qualityVal (caps)
    let low = 0.05, high = qualityVal, bestBlob = null;
    for(let iter=0; iter<8; iter++){
      const mid = (low + high)/2;
      const blob = await canvasToBlob(canvas, outType, mid);
      const sizeKB = blob.size / 1024;
      if(sizeKB > kbTarget){
        // need smaller -> reduce quality
        high = mid;
      } else {
        bestBlob = blob;
        low = mid;
      }
    }
    if(bestBlob){
      return { name: filenameWithSuffix(file.name, '-resized.' + mimeToExt(outType)), blob: bestBlob, size: bestBlob.size };
    } else {
      // as fallback return default quality
      const blob = await canvasToBlob(canvas, outType, qualityVal);
      return { name: filenameWithSuffix(file.name, '-resized.' + mimeToExt(outType)), blob, size: blob.size };
    }
  } else {
    // normal export
    // if outType is PNG and targetSize requested, we convert to JPEG to allow compression
    if(options.targetSize && options.targetSize > 0 && outType === 'image/png'){
      const blob = await canvasToBlob(canvas, 'image/jpeg', qualityVal);
      return { name: filenameWithSuffix(file.name, '-resized.jpg'), blob, size: blob.size };
    }
    const blob = await canvasToBlob(canvas, outType, qualityVal);
    return { name: filenameWithSuffix(file.name, '-resized.' + mimeToExt(outType)), blob, size: blob.size };
  }
}

function canvasToBlob(canvas, mime, q){
  return new Promise(res => canvas.toBlob(b => res(b), mime, q));
}
function mimeToExt(mime){
  if(mime === 'image/jpeg') return 'jpg';
  if(mime === 'image/png') return 'png';
  if(mime === 'image/webp') return 'webp';
  return 'jpg';
}
function filenameWithSuffix(filename, suffix){
  const i = filename.lastIndexOf('.');
  if(i === -1) return filename + suffix;
  return filename.slice(0,i) + suffix;
}

/* ---------------- batch processing & UI ---------------- */

processAllBtn.addEventListener('click', async () => {
  if(files.length === 0) { alert('Add images first'); return; }
  processed = [];
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  downloadZip.style.display = 'none';

  const options = {
    width: parseInt(widthInput.value) || null,
    height: parseInt(heightInput.value) || null,
    scale: parseFloat(scaleInput.value) || null,
    keepAspect: keepAspect.checked,
    fitMode: fitMode.value,
    format: outputFormat.value,
    quality: parseInt(quality.value),
    targetSize: parseInt(targetSize.value) || null
  };

  for(let i=0; i<files.length; i++){
    const entry = files[i];
    try{
      const info = await processImageFile(entry.file, options);
      processed.push(info);
      // show individual download in place
      showProcessedResult(i, info);
    }catch(err){
      console.error('Error processing', entry.file.name, err);
      alert('Error processing ' + entry.file.name + ': ' + (err.message || err));
    }
    const pct = Math.round(((i+1)/files.length)*100);
    progressBar.style.width = pct + '%';
    progressText.textContent = pct + '%';
  }

  // enable download zip
  if(processed.length > 0){
    downloadZip.style.display = 'inline-block';
    downloadZip.onclick = () => downloadAllZip(processed);
    alert(`${processed.length} images processed`);
  } else {
    alert('No images were processed');
  }
});

clearAllBtn.addEventListener('click', ()=> {
  files = []; processed = []; preview.innerHTML = ''; progressWrap.style.display = 'none'; downloadZip.style.display = 'none';
});

function showProcessedResult(index, info){
  // append small download button near corresponding input preview if exists
  const wrappers = preview.querySelectorAll('.img-wrapper');
  const wrapper = wrappers[index];
  if(wrapper){
    let link = wrapper.querySelector('.download-link');
    if(!link){
      link = document.createElement('a');
      link.className = 'download-link';
      link.style.marginTop = '8px';
      link.style.display = 'inline-block';
      link.style.background = '#00b341';
      link.style.color = 'white';
      link.style.padding = '6px 10px';
      link.style.borderRadius = '6px';
      link.style.textDecoration = 'none';
      link.style.fontWeight = '600';
      wrapper.appendChild(link);
    }
    const url = URL.createObjectURL(info.blob);
    link.href = url;
    link.download = info.name;
    link.textContent = '⬇️ Download';
  }
}

async function downloadAllZip(list){
  const zip = new JSZip();
  list.forEach(item => {
    const extless = item.name;
    zip.file(item.name, item.blob);
  });
  const content = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = 'resized-images.zip'; a.click();
  URL.revokeObjectURL(url);
}

/* helper to create file input if not present (compat) */
function createHiddenFileInput(){
  // if HTML had fileInput, return it; else create one
  const el = document.createElement('input');
  el.type = 'file'; el.accept = 'image/*'; el.multiple = true;
  document.body.appendChild(el); el.style.display = 'none';
  el.addEventListener('change', e => handleFiles(e.target.files));
  return el;
}
