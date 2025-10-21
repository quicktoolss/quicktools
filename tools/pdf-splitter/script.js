const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const startSplit = document.getElementById('startSplit');
const downloadAll = document.getElementById('downloadAll');
const modeSelect = document.getElementById('modeSelect');
const modeSettings = document.getElementById('modeSettings');
const previewSplits = document.getElementById('previewSplits');

let files = [];
let zip = new JSZip();

// Handle drag & drop
uploadArea.addEventListener('dragover', (e)=>{
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', ()=> uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e)=>{
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e)=>{
  handleFiles(e.target.files);
});

function handleFiles(selectedFiles){
  for(let file of selectedFiles){
    if(file.type==='application/pdf'){
      files.push(file);
      addFileToList(file);
    }
  }
  updatePreview();
}

function addFileToList(file){
  const div = document.createElement('div');
  div.className = 'file-item';
  div.innerHTML = `<span>${file.name}</span><div class="progress-bar"><div class="progress-fill"></div></div>`;
  fileList.appendChild(div);
  file.element = div;
}

// Dynamic mode settings
function updateModeSettings(){
  modeSettings.innerHTML = '';
  const mode = modeSelect.value;
  if(mode==='nPages'){
    modeSettings.innerHTML = `<label>Pages per split:</label> <input type="number" id="nPagesInput" value="2" min="1">`;
  } else if(mode==='fileSize'){
    modeSettings.innerHTML = `<label>Max size per file (MB):</label> <input type="number" id="fileSizeInput" value="1" min="0.1" step="0.1">`;
  } else if(mode==='range'){
    modeSettings.innerHTML = `<label>Start Page:</label> <input type="number" id="startPage" value="1" min="1">
                              <label>End Page:</label> <input type="number" id="endPage" value="1" min="1">`;
  } else {
    modeSettings.innerHTML = `<p>No extra settings for this mode.</p>`;
  }
  updatePreview();
}

modeSelect.addEventListener('change', updateModeSettings);
updateModeSettings();

// Update live preview (for File Size mode)
async function updatePreview(){
  if(files.length===0){
    previewSplits.textContent='';
    return;
  }
  if(modeSelect.value==='fileSize'){
    const maxSizeMB = parseFloat(document.getElementById('fileSizeInput')?.value || 1);
    let previews=[];
    for(let file of files){
      const arrayBuffer = await file.arrayBuffer();
      const totalMB = arrayBuffer.byteLength / (1024*1024);
      const estimatedSplits = Math.ceil(totalMB / maxSizeMB);
      previews.push(`${file.name}: ~${estimatedSplits} file(s)`);
    }
    previewSplits.textContent = "Estimated Splits: " + previews.join(", ");
  } else {
    previewSplits.textContent='';
  }
}

modeSettings.addEventListener('input', updatePreview);

// Split PDFs
startSplit.addEventListener('click', async ()=>{
  if(files.length===0) return alert('Upload PDFs first');
  zip = new JSZip();
  for(let file of files){
    await processPDF(file);
  }
  downloadAll.style.display = 'inline-block';
});

async function processPDF(file){
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();
  let chunks = [];

  const mode = modeSelect.value;

  if(mode==='nPages'){
    const n = parseInt(document.getElementById('nPagesInput').value);
    for(let i=0; i<totalPages; i+=n){
      const newPdf = await PDFLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, Array.from({length: Math.min(n,totalPages-i)}, (_,k)=>i+k));
      pages.forEach(p=> newPdf.addPage(p));
      const pdfBytes = await newPdf.save();
      chunks.push({name:`${file.name.replace('.pdf','')}_part${i/n+1}.pdf`, data:pdfBytes});
    }
  } else if(mode==='fileSize'){
    const maxSizeMB = parseFloat(document.getElementById('fileSizeInput').value);
    let start=0;
    while(start<totalPages){
      let end = totalPages;
      for(let e=start+1;e<=totalPages;e++){
        const newPdf = await PDFLib.PDFDocument.create();
        const pages = await newPdf.copyPages(pdfDoc, Array.from({length:e-start}, (_,k)=>start+k));
        pages.forEach(p=> newPdf.addPage(p));
        const pdfBytes = await newPdf.save();
        const sizeMB = pdfBytes.byteLength/(1024*1024);
        if(sizeMB>maxSizeMB){
          end = e-1;
          break;
        }
      }
      if(end<=start) end=start+1;
      const newPdf = await PDFLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, Array.from({length:end-start}, (_,k)=>start+k));
      pages.forEach(p=> newPdf.addPage(p));
      const pdfBytes = await newPdf.save();
      chunks.push({name:`${file.name.replace('.pdf','')}_part${chunks.length+1}.pdf`, data:pdfBytes});
      start=end;
    }
  } else if(mode==='allPages'){
    for(let i=0;i<totalPages;i++){
      const newPdf = await PDFLib.PDFDocument.create();
      const [page] = await newPdf.copyPages(pdfDoc,[i]);
      newPdf.addPage(page);
      const pdfBytes = await newPdf.save();
      chunks.push({name:`${file.name.replace('.pdf','')}_page${i+1}.pdf`, data:pdfBytes});
    }
  } else if(mode==='range'){
    let start = parseInt(document.getElementById('startPage').value)-1;
    let end = parseInt(document.getElementById('endPage').value)-1;
    if(start<0) start=0;
    if(end>=totalPages) end=totalPages-1;
    const newPdf = await PDFLib.PDFDocument.create();
    const pages = await newPdf.copyPages(pdfDoc, Array.from({length:end-start+1}, (_,k)=>k+start));
    pages.forEach(p=> newPdf.addPage(p));
    const pdfBytes = await newPdf.save();
    chunks.push({name:`${file.name.replace('.pdf','')}_pages${start+1}-${end+1}.pdf`, data:pdfBytes});
  } else {
    const pdfBytes = await pdfDoc.save();
    chunks.push({name:file.name, data:pdfBytes});
  }

  const container = file.element;
  const progressFill = container.querySelector('.progress-fill');
  for(let i=0;i<chunks.length;i++){
    zip.file(chunks[i].name, chunks[i].data);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([chunks[i].data], {type:'application/pdf'}));
    a.download = chunks[i].name;
    a.textContent = `Download ${chunks[i].name}`;
    a.style.display='block';
    container.appendChild(a);
    progressFill.style.width = `${Math.round(((i+1)/chunks.length)*100)}%`;
    await new Promise(r=>setTimeout(r,50));
  }
}

// Download all as ZIP
downloadAll.addEventListener('click', async ()=>{
  const content = await zip.generateAsync({type:"blob"});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = "split_pdfs.zip";
  link.click();
});
