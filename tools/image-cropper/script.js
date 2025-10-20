const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const cropContainer = document.getElementById('cropContainer');
const image = document.getElementById('image');
const aspectSelect = document.getElementById('aspectSelect');
const circleCrop = document.getElementById('circleCrop');
const zoomRange = document.getElementById('zoomRange');
const previewCanvas = document.getElementById('previewCanvas');
const dimensions = document.getElementById('dimensions');
const downloadBtn = document.getElementById('downloadBtn');

let cropper;

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.background = '#eef7ff'; });
uploadArea.addEventListener('dragleave', () => uploadArea.style.background = 'white');
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.style.background = 'white';
  const file = e.dataTransfer.files[0];
  if (file) loadImage(file);
});
fileInput.addEventListener('change', e => loadImage(e.target.files[0]));

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    image.src = e.target.result;
    uploadArea.classList.add('hidden');
    cropContainer.classList.remove('hidden');
    initCropper();
  };
  reader.readAsDataURL(file);
}

function initCropper() {
  if (cropper) cropper.destroy();
  cropper = new Cropper(image, {
    viewMode: 1,
    background: false,
    autoCropArea: 1,
    ready() {
      updatePreview();
    },
    crop() {
      updatePreview();
    }
  });
}

aspectSelect.addEventListener('change', () => {
  const val = aspectSelect.value;
  if (val === 'free') cropper.setAspectRatio(NaN);
  else {
    const [w, h] = val.split(':').map(Number);
    cropper.setAspectRatio(w / h);
  }
});

zoomRange.addEventListener('input', e => {
  cropper.zoomTo(parseFloat(e.target.value));
});

circleCrop.addEventListener('change', updatePreview);

function updatePreview() {
  const canvas = cropper.getCroppedCanvas();
  if (!canvas) return;
  const ctx = previewCanvas.getContext('2d');
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;

  if (circleCrop.checked) {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(canvas, 0, 0);
  dimensions.textContent = `${canvas.width} × ${canvas.height}px`;
}

downloadBtn.addEventListener('click', () => {
  const canvas = cropper.getCroppedCanvas();
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = circleCrop.checked ? 'cropped_circle.png' : 'cropped.png';
  link.href = previewCanvas.toDataURL('image/png');
  link.click();
});
