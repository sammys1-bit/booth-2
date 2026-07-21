const SECRET_NICKNAME = "meanie";

const lockScreen = document.getElementById('lock-screen');
const passInput = document.getElementById('passcode-input');
const unlockBtn = document.getElementById('unlock-btn');
const lockError = document.getElementById('lock-error');

const video = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const countdownEl = document.getElementById('countdown-overlay');
const liveThumbnails = document.getElementById('live-thumbnails');
const statusText = document.getElementById('screen-status-text');

const canvas = document.getElementById('photo-canvas');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('result-modal');
const stripContainer = document.getElementById('strip-container');
const downloadBtn = document.getElementById('download-btn');
const retakeBtn = document.getElementById('retake-btn');
const themeSelect = document.getElementById('theme-select');

let capturedPhotos = [];

// Template-specific dimensions and precise slot coordinates
const TEMPLATE_CONFIGS = {
  template1: {
    width: 600,
    height: 1800,
    slots: [
      { x: 30, y: 120, w: 540, h: 480 },
      { x: 30, y: 580, w: 540, h: 480 },
      { x: 30, y: 1040, w: 540, h: 480 }
    ]
  },
  template2: {
    width: 600,
    height: 1800,
    slots: [
      { x: 30, y: 120, w: 540, h: 480 },
      { x: 30, y: 580, w: 540, h: 480 },
      { x: 30, y: 1040, w: 540, h: 480 }
    ]
  },
  template3: {
    width: 600,
    height: 1800,
    slots: [
      { x: 50, y: 120, w: 500, h: 500 },
      { x: 50, y: 550, w: 500, h: 500 },
      { x: 50, y: 1000, w: 500, h: 500 }
    ]
  },
  template4: {
    width: 600,
    height: 1800,
    slots: [
      { x: 100, y: 300, w: 400, h: 400 },
      { x: 100, y: 680, w: 400, h: 400 },
      { x: 100, y: 1050, w: 400, h: 400 }
    ]
  },
  template5: {
    width: 600,
    height: 1800,
    slots: [
      { x: 30, y: 120, w: 540, h: 480 },
      { x: 30, y: 580, w: 540, h: 480 },
      { x: 30, y: 1040, w: 540, h: 480 }
    ]
  },
  template6: { // Red Teddy Scrapbook
    width: 600,
    height: 1600,
    slots: [
      { x: 65, y: 75, w: 470, h: 405 },
      { x: 65, y: 505, w: 470, h: 405 },
      { x: 65, y: 935, w: 470, h: 405 }
    ]
  },
  template7: { // Pink Gingham Ribbon
    width: 600,
    height: 1750,
    slots: [
      { x: 60, y: 65, w: 480, h: 510 },
      { x: 60, y: 645, w: 480, h: 510 },
      { x: 60, y: 1225, w: 480, h: 510 }
    ]
  }
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
    passInput.style.borderColor = '#000';
    setTimeout(() => { passInput.style.borderColor = '#000'; }, 1000);
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
    if (liveThumbnails) liveThumbnails.innerHTML = '';
    if (statusText) statusText.innerText = 'GET READY! 📸';

    for (let i = 0; i < 3; i++) {
      await runCountdown(3);
      takePhoto();
    }

    if (statusText) statusText.innerText = 'PROCESSING STRIP... ✨';
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

  const dataUrl = tempCanvas.toDataURL('image/png');
  capturedPhotos.push(dataUrl);

  if (liveThumbnails) {
    const img = document.createElement('img');
    img.src = dataUrl;
    liveThumbnails.appendChild(img);
  }
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
  const config = TEMPLATE_CONFIGS[selectedTheme] || TEMPLATE_CONFIGS.template1;

  canvas.width = config.width;
  canvas.height = config.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < capturedPhotos.length; i++) {
    const photo = await loadImage(capturedPhotos[i]);
    if (photo && config.slots[i]) {
      const slot = config.slots[i];
      drawCoverImage(ctx, photo, slot.x, slot.y, slot.w, slot.h);
    }
  }

  const frameImg = await loadImage(`${selectedTheme}.png`);
  if (frameImg) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    
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

  const finalDataUrl = canvas.toDataURL('image/png');

  if (stripContainer) {
    stripContainer.innerHTML = '';
    const finalImage = new Image();
    finalImage.src = finalDataUrl;
    finalImage.style.width = '100%';
    finalImage.style.maxHeight = '450px';
    finalImage.style.objectFit = 'contain';
    finalImage.style.border = '2px solid #000';
    finalImage.style.borderRadius = '6px';
    stripContainer.appendChild(finalImage);
  }

  if (modal) modal.classList.remove('hidden');
}

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
    if (statusText) statusText.innerText = 'SMILE! 📸';
    if (liveThumbnails) liveThumbnails.innerHTML = '';
  });
}
