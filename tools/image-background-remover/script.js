const fileInput = document.getElementById("fileInput");
const previewContainer = document.getElementById("preview-container");
const bgColorInput = document.getElementById("bgColor");
const toleranceInput = document.getElementById("tolerance");

let images = [];

fileInput.addEventListener("change", (e)=>{
  images = [];
  previewContainer.innerHTML = "";
  const files = e.target.files;
  for(let file of files){
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.src = ev.target.result;
      img.onload = ()=>{
        addPreview(img, file.name);
        images.push(img);
      };
    };
    reader.readAsDataURL(file);
  }
});

// Add preview canvas and download button
function addPreview(img, name){
  const container = document.createElement("div");
  container.className = "preview-item";

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img,0,0);

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "Remove BG";
  removeBtn.onclick = ()=>removeBackground(canvas, img);

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download";
  downloadBtn.onclick = ()=>downloadCanvas(canvas, name);

  container.appendChild(canvas);
  container.appendChild(removeBtn);
  container.appendChild(downloadBtn);
  previewContainer.appendChild(container);
}

// Remove background based on selected color and tolerance
function removeBackground(canvas, img){
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img,0,0);
  const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const data = imageData.data;
  const bgColor = hexToRgb(bgColorInput.value);
  const tol = parseInt(toleranceInput.value);

  for(let i=0;i<data.length;i+=4){
    if(colorDistance({r:data[i],g:data[i+1],b:data[i+2]}, bgColor)<=tol){
      data[i+3]=0; // transparent
    }
  }
  ctx.putImageData(imageData,0,0);
}

// Download canvas as PNG
function downloadCanvas(canvas, name){
  const link = document.createElement("a");
  link.download = "bg_removed_" + name;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Convert hex to RGB
function hexToRgb(hex){
  const bigint = parseInt(hex.replace("#",""),16);
  return { r:(bigint>>16)&255, g:(bigint>>8)&255, b: bigint&255};
}

// Euclidean distance
function colorDistance(c1,c2){
  return Math.sqrt((c1.r-c2.r)**2 + (c1.g-c2.g)**2 + (c1.b-c2.b)**2);
}

// Live update when user changes color or tolerance
bgColorInput.addEventListener("input", updateAll);
toleranceInput.addEventListener("input", updateAll);

function updateAll(){
  const items = document.querySelectorAll(".preview-item canvas");
  images.forEach((img,i)=>{
    removeBackground(items[i], img);
  });
}

const downloadAllBtn = document.getElementById("downloadAllBtn");

downloadAllBtn.addEventListener("click", async ()=>{
  const zip = new JSZip();
  const items = document.querySelectorAll(".preview-item canvas");

  items.forEach((canvas, idx)=>{
    const dataURL = canvas.toDataURL("image/png");
    const base64 = dataURL.split(',')[1];
    zip.file(`bg_removed_${idx+1}.png`, base64, {base64:true});
  });

  const content = await zip.generateAsync({type:"blob"});
  saveAs(content, "bg_removed_images.zip");
});
