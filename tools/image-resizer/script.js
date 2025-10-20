/* Enhanced Image Resizer — script.js
   Features:
   - drag-drop & choose files
   - thumbnail preview with metadata
   - drag-to-reorder with drop indicator
   - live before/after slider for selected image
   - batch resize (presets / aspect / fit modes)
   - quality + target-size binary search (JPG/WEBP)
   - individual download + download-all ZIP
   - toasts & progress bar
*/

const fileInput = document.getElementById('fileInput');
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

const livePreviewCard = document.getElementById('livePreview');
const lpBefore = document.getElementById('lpBefore');
const lpAfter = document.getElementById('lpAfter');
const lpSlider = document.getElementById('lpSlider');
const lpInfo = document.getElementById('lpInfo');
const applySingle = document.getElementById('applySingle');
const downloadSingle = document.getElementById('downloadSingle');

const toasts = document.getElementById('toasts');

let files = []; // {file, id}
let processed = []; // results
let selectedIndex = null;

// setup
chooseBtn.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', e => handleFiles(e.target.files));

// drag/drop interactions
['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e => { const dt = e.dataTransfer; if(dt && dt.files) handleFiles(dt.files); });

// presets & quality display
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', ()=> {
  const w = b.dataset.w; const h = b.dataset.h;
  widthInput.value = w || '';
  heightInput.value = h || '';
}));
quality.addEventListener('input', ()=> qualityVal.textContent = quality.value);

// helper utilities
function uid(){ return Math.random().toString(36).slice(2,9); }
function showToast(msg, type='default', timeout=3000){
  const el = document.createElement('div'); el.className = 'toast' + (type==='success' ? ' success' : '');
  el.textContent = msg; toasts.appendChild(el);
  setTimeout(()=> { el.style.opacity=0; el.style.transform='translateY(8px)'; setTimeout(()=> el.remove(),300); }, timeout);
}

// read files
function handleFiles(fileList){
  const arr = Array.from(fileList).filter(f => f.type && f.type.startsWith('image/'));
  if(arr.length === 0){ showToast('No images detected', 'default'); return; }
  arr.forEach(f => files.push({file: f, id: uid()}));
  renderPreview();
  showToast(`${arr.length} image(s) added`);
}

// preview rendering + drag reorder
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
    label.textContent = `${i+1}. ${truncate(entry.file.name, 22)}`;

    const meta = document.createElement('div');
    meta.className = 'img-meta';
    meta.textContent = `${entry.file.type.split('/')[1].toUpperCase()} • ${formatBytes(entry.file.size)}`;

    const actions = document.createElement('div');
    actions.className = 'img-actions';
    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Preview';
    selectBtn.className = 'ghost';
    selectBtn.onclick = ()=> { openLivePreview(i); };
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'ghost';
    removeBtn.onclick = ()=> { URL.revokeObjectURL(img.src); files.splice(i,1); renderPreview(); };

    actions.appendChild(selectBtn);
    actions.appendChild(removeBtn);

    wrapper.appendChild(img);
    wrapper.appendChild(label);
    wrapper.appendChild(meta);
    wrapper.appendChild(actions);

    // drag handlers & drop indicator
    wrapper.addEventListener('dragstart', handleDragStart);
    wrapper.addEventListener('dragover', handleDragOver);
    wrapper.addEventListener('drop', handleDrop);
    wrapper.addEventListener('dragend', handleDragEnd);

    preview.appendChild(wrapper);
  });
  // reset live preview if needed
  if(selectedIndex !== null && (selectedIndex >= files.length)) { closeLivePreview(); }
}

// drag reorder
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

/* ---------- Live preview (before/after slider) ---------- */
function openLivePreview(index){
  selectedIndex = index;
  const entry = files[index];
  if(!entry) return;
  // build before (original) and after (resized preview) images
  lpBefore.innerHTML = '';
  lpAfter.innerHTML = '';
  lpInfo.textContent = `${truncate(entry.file.name, 30)} • ${formatBytes(entry.file.size)}`;
  const imgBefore = document.createElement('img'); imgBefore.src = URL.createObjectURL(entry.file);
  lpBefore.appendChild(imgBefore);

  // create a resized preview immediately (without saving)
  const options = currentOptions();
  processImageFilePreview(entry.file, options).then(resultDataUrl => {
    const imgAfter = document.createElement('img'); imgAfter.src = resultDataUrl;
    lpAfter.appendChild(imgAfter);
    livePreviewCard.style.display = 'flex';
    downloadSingle.style.display = 'none';
    // set info about dims if available
    imgAfter.onload = ()=> { lpInfo.textContent = `${truncate(entry.file.name, 30)} • ${imgBefore.naturalWidth}×${imgBefore.naturalHeight} → ${imgAfter.naturalWidth}×${imgAfter.naturalHeight}`; };
    // set slider to middle
    setSliderPosition(50);
  }).catch(err => {
    showToast('Preview failed: '+err, 'default', 3000);
  });
}

function closeLivePreview(){
  livePreviewCard.style.display = 'none';
  lpBefore.innerHTML = ''; lpAfter.innerHTML = ''; selectedIndex = null;
}

// slider logic
let sliderDown = false;
function setSliderPosition(percent){
  // percent 0-100: set width of after overlay
  const lpw = livePreviewCard.querySelector('.lp-canvas-wrap');
  const rect = lpw.getBoundingClientRect();
  const px = Math.round((percent/100) * rect.width);
  lpAfter.style.clip = `rect(0px, ${px}px, ${rect.height}px, 0px)`;
  lpSlider.style.left = `${percent}%`;
}
function startSliderDrag(e){
  sliderDown = true;
}
function stopSliderDrag(e){
  sliderDown = false;
}
function sliderMove(e){
  if(!sliderDown) return;
  const wrap = livePreviewCard.querySelector('.lp-canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
  let pct = Math.round(((clientX - rect.left) / rect.width) * 100);
  pct = Math.max(0, Math.min(100, pct));
  setSliderPosition(pct);
}
lpSlider.addEventListener('mousedown', startSliderDrag);
window.addEventListener('mouseup', stopSliderDrag);
window.addEventListener('mousemove', sliderMove);
// touch
lpSlider.addEventListener('touchstart', startSliderDrag, {passive:true});
window.addEventListener('touchend', stopSliderDrag);
window.addEventListener('touchmove', sliderMove, {passive:true});

// apply single conversion (download)
applySingle.addEventListener('click', async ()=>{
  if(selectedIndex === null) return;
  const entry = files[selectedIndex];
  const options = currentOptions();
  try{
    const info = await processImageFile(entry.file, options);
    const url = URL.createObjectURL(info.blob);
    downloadSingle.href = url;
    downloadSingle.download = info.name;
    downloadSingle.style.display = 'inline-block';
    showToast('Single image processed', 'success');
  }catch(err){
    showToast('Error: '+err, 'default');
  }
});
downloadSingle.addEventListener('click', ()=> { /* downloading handled by link */ });

/* ---------- Resizing core ---------- */
function readFileAsDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function processImageFilePreview(file, options){
  // lighter preview: returns dataURL (no binary search)
  const dataUrl = await readFileAsDataURL(file);
  const img = new Image();
  img.src = dataUrl;
  await new Promise(r => img.onload = r);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // compute dims similar to main function (fit modes simplified)
  const origW = img.width, origH = img.height;
  let targetW = parseInt(options.width) || null;
  let targetH = parseInt(options.height) || null;
  const scalePerc = parseFloat(options.scale) || null;
  if(scalePerc){ targetW = Math.round(origW * (scalePerc/100)); targetH = Math.round(origH * (scalePerc/100)); }
  if(!targetW && !targetH){ targetW = origW; targetH = origH; }
  else if(targetW && !targetH){ targetH = options.keepAspect ? Math.round((targetW / origW) * origH) : origH; }
  else if(!targetW && targetH){ targetW = options.keepAspect ? Math.round((targetH / origH) * origW) : origW; }
  // Fit mode: implement 'fit' as default (centered)
  if(options.fitMode === 'fit'){
    canvas.width = targetW; canvas.height = targetH;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const ratio = Math.min(targetW / origW, targetH / origH);
    const dw = Math.round(origW * ratio), dh = Math.round(origH * ratio);
    const x = Math.round((canvas.width - dw)/2), y = Math.round((canvas.height - dh)/2);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, dw, dh);
  } else if(options.fitMode === 'fill'){
    canvas.width = targetW; canvas.height = targetH;
    const ratio = Math.max(targetW / origW, targetH / origH);
    const sw = Math.round(targetW / ratio), sh = Math.round(targetH / ratio);
    const sx = Math.round((origW - sw)/2), sy = Math.round((origH - sh)/2);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  } else if(options.fitMode === 'stretch'){
    canvas.width = targetW; canvas.height = targetH;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else { // center
    canvas.width = Math.max(origW, targetW); canvas.height = Math.max(origH, targetH);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const x = Math.round((canvas.width - origW)/2), y = Math.round((canvas.height - origH)/2);
    ctx.drawImage(img, x, y);
  }
  // output as dataURL
  const mime = options.format || 'image/jpeg';
  const q = Math.max(0.01, Math.min(1, (options.quality||85)/100));
  return canvas.toDataURL(mime, q);
}

async function processImageFile(file, options){
  // returns { name, blob, size }
  const dataUrl = await readFileAsDataURL(file);
  const img = new Image(); img.src = dataUrl; await new Promise(r=>img.onload=r);
  const origW = img.width, origH = img.height;
  // compute target dims
  let targetW = parseInt(options.width) || null;
  let targetH = parseInt(options.height) || null;
  const scalePerc = parseFloat(options.scale) || null;
  if(scalePerc){ targetW = Math.round(origW * (scalePerc/100)); targetH = Math.round(origH * (scalePerc/100)); }
  if(!targetW && !targetH){ targetW = origW; targetH = origH; }
  else if(targetW && !targetH){ targetH = options.keepAspect ? Math.round((targetW / origW) * origH) : origH; }
  else if(!targetW && targetH){ targetW = options.keepAspect ? Math.round((targetH / origH) * origW) : origW; }
  else if(options.keepAspect){
    const ratio = origW / origH;
    if(targetW / targetH > ratio) targetW = Math.round(targetH * ratio); else targetH = Math.round(targetW / ratio);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if(options.fitMode === 'fit'){
    canvas.width = targetW; canvas.height = targetH;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const ratio = Math.min(targetW / origW, targetH / origH);
    const dw = Math.round(origW * ratio), dh = Math.round(origH * ratio);
    const x = Math.round((canvas.width - dw)/2), y = Math.round((canvas.height - dh)/2);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, dw, dh);
  } else if(options.fitMode === 'fill'){
    canvas.width = targetW; canvas.height = targetH;
    const ratio = Math.max(targetW / origW, targetH / origH);
    const sw = Math.round(targetW / ratio), sh = Math.round(targetH / ratio);
    const sx = Math.round((origW - sw)/2), sy = Math.round((origH - sh)/2);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  } else if(options.fitMode === 'stretch'){
    canvas.width = targetW; canvas.height = targetH;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else { // center
    canvas.width = Math.max(origW, targetW); canvas.height = Math.max(origH, targetH);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const x = Math.round((canvas.width - origW)/2), y = Math.round((canvas.height - origH)/2);
    ctx.drawImage(img, x, y);
  }

  const outType = options.format || 'image/jpeg';
  const qualityVal = Math.max(0.01, Math.min(1, (options.quality||85)/100));

  // if target size requested and format supports compression -> binary search
  if(options.targetSize && options.targetSize > 0 && (outType === 'image/jpeg' || outType === 'image/webp')){
    const kbTarget = options.targetSize;
    let low = 0.05, high = qualityVal, best = null;
    for(let iter=0; iter<8; iter++){
      const mid = (low + high)/2;
      const blob = await canvasToBlob(canvas, outType, mid);
      const sizeKB = blob.size / 1024;
      if(sizeKB > kbTarget) high = mid;
      else { best = blob; low = mid; }
    }
    if(best) return { name: filenameWithSuffix(file.name, '-resized.'+mimeToExt(outType)), blob: best, size: best.size };
    const fallback = await canvasToBlob(canvas, outType, qualityVal);
    return { name: filenameWithSuffix(file.name, '-resized.'+mimeToExt(outType)), blob: fallback, size: fallback.size };
  } else {
    // normal export (if PNG and target requested -> convert to jpeg to compress)
    if(options.targetSize && options.targetSize > 0 && outType === 'image/png'){
      const blob = await canvasToBlob(canvas, 'image/jpeg', qualityVal);
      return { name: filenameWithSuffix(file.name, '-resized.jpg'), blob, size: blob.size };
    }
    const blob = await canvasToBlob(canvas, outType, qualityVal);
    return { name: filenameWithSuffix(file.name, '-resized.'+mimeToExt(outType)), blob, size: blob.size };
  }
}

function canvasToBlob(canvas, mime, q){ return new Promise(res => canvas.toBlob(b => res(b), mime, q)); }
function mimeToExt(mime){ if(mime==='image/jpeg') return 'jpg'; if(mime==='image/png') return 'png'; if(mime==='image/webp') return 'webp'; return 'jpg'; }
function filenameWithSuffix(filename, suffix){ const i = filename.lastIndexOf('.'); if(i===-1) return filename + suffix; return filename.slice(0,i) + suffix; }

/* ---------- Batch processing & UI ---------- */
function currentOptions(){
  return {
    width: parseInt(widthInput.value) || null,
    height: parseInt(heightInput.value) || null,
    scale: parseFloat(scaleInput.value) || null,
    keepAspect: keepAspect.checked,
    fitMode: fitMode.value,
    format: outputFormat.value,
    quality: parseInt(quality.value),
    targetSize: parseInt(targetSize.value) || null
  };
}

processAllBtn.addEventListener('click', async ()=>{
  if(files.length === 0){ showToast('Add images first'); return; }
  processed = []; progressWrap.style.display = 'block'; progressBar.style.width = '0%'; progressText.textContent = '0%'; downloadZip.style.display = 'none';
  const options = currentOptions();
  for(let i=0;i<files.length;i++){
    const entry = files[i];
    try{
      const res = await processImageFile(entry.file, options);
      processed.push(res);
      showProcessedResult(i, res);
    }catch(err){
      console.error(err); showToast('Error processing '+entry.file.name, 'default');
    }
    const pct = Math.round(((i+1)/files.length)*100);
    progressBar.style.width = pct + '%'; progressText.textContent = pct + '%';
  }
  if(processed.length>0){
    downloadZip.style.display = 'inline-block';
    downloadZip.onclick = ()=> downloadAllZip(processed);
    showToast(`${processed.length} image(s) processed`, 'success');
  } else showToast('No images processed', 'default');
});

clearAllBtn.addEventListener('click', ()=> { files=[]; processed=[]; preview.innerHTML=''; progressWrap.style.display='none'; downloadZip.style.display='none'; closeLivePreview(); });

function showProcessedResult(index, info){
  const wrappers = preview.querySelectorAll('.img-wrapper');
  const wrapper = wrappers[index];
  if(!wrapper) return;
  let link = wrapper.querySelector('.download-link');
  if(!link){
    link = document.createElement('a'); link.className = 'download-link'; link.style.marginTop='8px';
    link.style.display='inline-block'; link.style.background='#00b341'; link.style.color='white'; link.style.padding='6px 10px';
    link.style.borderRadius='6px'; link.style.textDecoration='none'; link.style.fontWeight='600';
    wrapper.appendChild(link);
  }
  const url = URL.createObjectURL(info.blob);
  link.href = url; link.download = info.name; link.textContent = '⬇️ Download';
  // also show small size
  let sizeEl = wrapper.querySelector('.size-after');
  if(!sizeEl){ sizeEl = document.createElement('div'); sizeEl.className='img-meta size-after'; wrapper.appendChild(sizeEl); }
  sizeEl.textContent = `Resized • ${formatBytes(info.size)}`;
}

async function downloadAllZip(list){
  const zip = new JSZip();
  list.forEach(item=> zip.file(item.name, item.blob));
  const content = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(content);
  const a = document.createElement('a'); a.href = url; a.download = 'resized-images.zip'; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- helpers ---------- */
function formatBytes(bytes, decimals=2){
  if(bytes === 0) return '0 B';
  const k = 1024; const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(dm)) + ' ' + sizes[i];
}
function truncate(s, n){ return s.length>n ? s.slice(0,n-1)+'…' : s; }

/* ---------- keyboard & resize interactions for slider ---------- */
// make live preview responsive: when window resizes, recalc clipping
window.addEventListener('resize', ()=> {
  if(livePreviewCard.style.display !== 'none') setSliderPositionPercent(50);
});
function setSliderPositionPercent(pct){
  const wrap = livePreviewCard.querySelector('.lp-canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  const px = Math.round((pct/100) * rect.width);
  lpAfter.style.clip = `rect(0px, ${px}px, ${rect.height}px, 0px)`;
  lpSlider.style.left = `${pct}%`;
}
function setSliderPosition(pct){ setSliderPositionPercent(pct); }

// enable dragging anywhere in wrap as well
const wrap = document.querySelector('.lp-canvas-wrap');
if(wrap){
  wrap.addEventListener('mousedown', e => { sliderDown=true; sliderMove(e); });
  wrap.addEventListener('touchstart', e => { sliderDown=true; sliderMove(e); }, {passive:true});
}

// toast example ready
// show initial tips
showToast('Image Resizer ready — drag images or click Choose files', 'default', 3000);
