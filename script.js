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

// Exact window placement coordinates per template
const THEME_SLOTS = {
  template1: [
    { x: 75, y: 190, w: 450, h: 340 },
    { x: 75, y: 680, w: 450, h: 340 },
    { x: 75, y: 1170, w: 450, h: 340 }
  ],
  template2: [
    { x: 80, y: 200, w: 440, h: 330 },
    { x: 80, y: 690, w: 440, h: 330 },
    { x: 80, y: 1180, w: 440, h: 330 }
  ],
  template3: [ // Gingham Cat Scrapbook
    { x: 190, y: 220, w: 230, h: 320 },
    { x: 260, y: 690, w: 230, h: 320 },
    { x: 180, y: 1160, w: 250, h: 180 }
  ],
  template4: [ // Strawberry Cat Ribbons
    { x: 200, y: 390, w: 200, h: 250 },
    { x: 200, y: 770, w: 200, h: 250 },
    { x: 200, y: 1150, w: 200, h: 250 }
  ],
  template5: [
    { x: 70, y: 180, w: 460, h: 350 },
    { x: 70, y: 670, w: 460, h: 350 },
    { x: 70, y: 1160, w: 460, h: 350 }
  ]
};

if (unlockBtn) unlockBtn.addEventListener('click', checkPasscode);
if (passInput) passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPasscode(); });

function checkPasscode() {
  const enteredCode = passInput.value.trim().toLowerCase();
  if (enteredCode === SECRET_NICKNAME) {
    if (lockScreen) lockScreen.style.display = 'none';
    initWebcam();
  } else {
    if (lockError) lockError.classList.remove('hidden');
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

if (startBtn) {
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    capturedPhotos = [];

    for (let i = 0; i < 3; i++) {
      await runCountdown(3);
      takePhoto();
    }

    await buildPhotoStrip();
    startBtn.disabled = false;
  });
}

function runCountdown(seconds) {
  return new Promise((resolve) => {
    if (!countdownEl) return resolve();
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

if (themeSelect) {
  themeSelect.addEventListener('change', () => {
    if (capturedPhotos.length > 0) buildPhotoStrip();
  });
}

async function buildPhotoStrip() {
  const selectedTheme = themeSelect ? themeSelect.value : 'template1';

  canvas.width = 600;
  canvas.height = 1800;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. GET SPECIFIC SLOTS FOR THIS THEME
  const slots = THEME_SLOTS[selectedTheme] || THEME_SLOTS.template1;

  for (let i = 0; i < capturedPhotos.length; i++) {
    const photo = await loadImage(capturedPhotos[i]);
    if (photo && slots[i]) {
      // Center and crop photo to fit without squishing
      drawCoverImage(ctx, photo, slots[i].x, slots[i].y, slots[i].w, slots[i].h);
    }
  }

  // 2. OVERLAY FRAME TEMPLATE
  const frameImg = await loadImage(`${selectedTheme}.png`);
  if (frameImg) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    
    // Clear black and pure white frame holes
    const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isBlack = (r < 35 && g < 35 && b < 35);
      const isPureWhite = (r > 245 && g > 245 && b > 245);

      if (isBlack || isPureWhite) {
        data[i + 3] = 0;
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  }

  // 3. RENDER RESULT
  const finalDataUrl = canvas.toDataURL('image/png');

  if (stripContainer) {
    stripContainer.innerHTML = '';
    const finalImage = new Image();
    finalImage.src = finalDataUrl;
    finalImage.style.width = '100%';
    finalImage.style.maxHeight = '450px';
    finalImage.style.objectFit = 'contain';
    finalImage.style.border = '2px solid #333';
    finalImage.style.borderRadius = '6px';
    stripContainer.appendChild(finalImage);
  }

  if (modal) modal.classList.remove('hidden');
}

// Helper to center and crop photos so faces aren't sliced in half
function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = img.width / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'kawaii-photobooth-strip.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

if (retakeBtn) {
  retakeBtn.addEventListener('click', () => { 
    if (modal) modal.classList.add('hidden'); 
  });
}
