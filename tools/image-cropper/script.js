const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const cropContainer = document.getElementById('cropContainer');
const image = document.getElementById('image');
const aspectSelect = document.getElementById('aspectSelect');
const circleMode = document.getElementById('circleMode');
const resetBtn = document.getElementById('resetBtn');
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
    autoCropArea: 1,
    background: false,
    zoomable: true,
    ready() {
      document.querySelector('.cropper-container').classList.remove('circle');
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

circleMode.addEventListener('change', () => {
  const container = document.querySelector('.cropper-container');
  if (circleMode.checked) container.classList.add('circle');
  else container.classList.remove('circle');
});

resetBtn.addEventListener('click', () => cropper.reset());

downloadBtn.addEventListener('click', () => {
  const canvas = cropper.getCroppedCanvas();
  if (!canvas) return;
  const downloadCanvas = document.createElement('canvas');
  const size = Math.min(canvas.width, canvas.height);
  downloadCanvas.width = size;
  downloadCanvas.height = size;
  const ctx = downloadCanvas.getContext('2d');

  if (circleMode.checked) {
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(canvas, (canvas.width - size)/2, (canvas.height - size)/2, size, size, 0, 0, size, size);
  const link = document.createElement('a');
  link.download = circleMode.checked ? 'cropped_circle.png' : 'cropped.png';
  link.href = downloadCanvas.toDataURL('image/png');
  link.click();
});
