const SECRET_NICKNAME = "meanie";

const lockScreen = document.getElementById('lock-screen');
const passInput = document.getElementById('passcode-input');
const unlockBtn = document.getElementById('unlock-btn');
const lockError = document.getElementById('lock-error');

const video = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const countdownEl = document.getElementById('countdown-overlay');
const canvas = document.getElementById('photo-canvas');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('result-modal');
const stripContainer = document.getElementById('strip-container');
const downloadBtn = document.getElementById('download-btn');
const retakeBtn = document.getElementById('retake-btn');
const themeSelect = document.getElementById('theme-select');

let capturedPhotos = [];

unlockBtn.addEventListener('click', checkPasscode);
passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPasscode(); });

function checkPasscode() {
  const enteredCode = passInput.value.trim().toLowerCase();
  if (enteredCode === SECRET_NICKNAME) {
    lockScreen.style.display = 'none';
    initWebcam();
  } else {
    lockError.classList.remove('hidden');
    passInput.value = '';
    passInput.style.borderColor = '#ff4d6d';
    setTimeout(() => { passInput.style.borderColor = '#333'; }, 1000);
  }
}

async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert("Please allow camera access!");
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  capturedPhotos = [];

  // Take 3 photos for the strip
  for (let i = 0; i < 3; i++) {
    await runCountdown(3);
    takePhoto();
  }

  await buildPhotoStrip();
  startBtn.disabled = false;
});

function runCountdown(seconds) {
  return new Promise((resolve) => {
    countdownEl.classList.remove('hidden');
    let count = seconds;
    countdownEl.innerText = count;

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.innerText = count;
      } else {
        clearInterval(timer);
        countdownEl.classList.add('hidden');
        resolve();
      }
    }, 1000);
  });
}

function takePhoto() {
  const tempCanvas = document.createElement('canvas');
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Mirror camera view horizontally
  tempCtx.translate(w, 0);
  tempCtx.scale(-1, 1);
  tempCtx.drawImage(video, 0, 0, w, h);

  capturedPhotos.push(tempCanvas.toDataURL('image/png'));
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

themeSelect.addEventListener('change', () => {
  if (capturedPhotos.length > 0) buildPhotoStrip();
});

async function buildPhotoStrip() {
  const selectedTheme = themeSelect.value;

  canvas.width = 600;
  canvas.height = 1800;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. DRAW CAMERA PHOTOS ON BOTTOM LAYER
  const slots = [
    { x: 60, y: 160, w: 480, h: 360 },
    { x: 60, y: 640, w: 480, h: 360 },
    { x: 60, y: 1120, w: 480, h: 360 }
  ];

  for (let i = 0; i < capturedPhotos.length; i++) {
    const photo = await loadImage(capturedPhotos[i]);
    if (photo && slots[i]) {
      ctx.drawImage(photo, slots[i].x, slots[i].y, slots[i].w, slots[i].h);
    }
  }

  // 2. PROCESS FRAME TEMPLATE TO MAKE BLACK & WHITE BOXES TRANSPARENT
  const frameImg = await loadImage(`${selectedTheme}.png`);
  if (frameImg) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    
    // Convert near-black AND pure-white photo slots to transparent pixels
    const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isBlack = (r < 35 && g < 35 && b < 35);
      const isPureWhite = (r > 245 && g > 245 && b > 245);

      if (isBlack || isPureWhite) {
        data[i + 3] = 0; // Set alpha to zero (transparent)
      }
    }
    tempCtx.putImageData(imgData, 0, 0);

    // Overlay transparent frame over photos
    ctx.drawImage(tempCanvas, 0, 0);
  }

  // 3. RENDER RESULT IN MODAL
  const finalDataUrl = canvas.toDataURL('image/png');

  stripContainer.innerHTML = '';
  const finalImage = new Image();
  finalImage.src = finalDataUrl;
  finalImage.style.width = '100%';
  finalImage.style.maxHeight = '450px';
  finalImage.style.objectFit = 'contain';
  finalImage.style.border = '2px solid #333';
  finalImage.style.borderRadius = '6px';
  stripContainer.appendChild(finalImage);

  modal.classList.remove('hidden');
}

downloadBtn.addEventListener('click', () => {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'kawaii-photobooth-strip.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

retakeBtn.addEventListener('click', () => { modal.classList.add('hidden'); });
