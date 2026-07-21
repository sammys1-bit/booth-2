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

// AUTOMATICALLY DETECTS CUTOUT BOXES FROM ANY STRIP IMAGE
function detectSlotsFromImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);

  const imgData = cx.getImageData(0, 0, c.width, c.height);
  const data = imgData.data;

  let rowHighlights = [];
  const stepY = Math.max(1, Math.floor(c.height / 400));
  const stepX = Math.max(1, Math.floor(c.width / 50));

  // Scan rows to find transparent or pure white window regions vertically
  for (let y = 0; y < c.height; y += stepY) {
    let transparentCount = 0;
    let totalInRow = 0;
    for (let x = Math.floor(c.width * 0.15); x < Math.floor(c.width * 0.85); x += stepX) {
      const idx = (y * c.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
      if (a < 50 || (r > 240 && g > 240 && b > 240)) {
        transparentCount++;
      }
      totalInRow++;
    }
    rowHighlights.push({ y, isOpen: (transparentCount / totalInRow) > 0.6 });
  }

  // Group continuous open rows into distinct photo slots
  let slots = [];
  let inSlot = false;
  let startY = 0;

  for (let i = 0; i < rowHighlights.length; i++) {
    if (rowHighlights[i].isOpen && !inSlot) {
      inSlot = true;
      startY = rowHighlights[i].y;
    } else if (!rowHighlights[i].isOpen && inSlot) {
      inSlot = false;
      let height = rowHighlights[i].y - startY;
      if (height > c.height * 0.08) { // Minimum height threshold to qualify as a photo box
        slots.push({ startY, height });
      }
    }
  }

  // Find horizontal bounds (left & right edges of the windows)
  let minX = c.width * 0.4, maxX = c.width * 0.6;
  if (slots.length > 0) {
    let sampleY = slots[0].startY + Math.floor(slots[0].height / 2);
    let leftEdge = null, rightEdge = null;
    for (let x = 0; x < c.width; x++) {
      const idx = (sampleY * c.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
      if (a < 50 || (r > 240 && g > 240 && b > 240)) {
        if (leftEdge === null) leftEdge = x;
        rightEdge = x;
      }
    }
    if (leftEdge !== null && rightEdge !== null) {
      minX = leftEdge;
      maxX = rightEdge;
    }
  }

  // Map into exact slot objects {x, y, w, h}, defaulting to 3 slots if needed
  let finalSlots = slots.slice(0, 3).map(s => ({
    x: minX + 4,
    y: s.startY + 4,
    w: (maxX - minX) - 8,
    h: s.height - 8
  }));

  // Fallback if automatic detection fails on a unique graphic
  if (finalSlots.length === 0) {
    const defaultH = Math.floor(c.height * 0.25);
    finalSlots = [
      { x: Math.floor(c.width * 0.1), y: Math.floor(c.height * 0.08), w: Math.floor(c.width * 0.8), h: defaultH },
      { x: Math.floor(c.width * 0.1), y: Math.floor(c.height * 0.38), w: Math.floor(c.width * 0.8), h: defaultH },
      { x: Math.floor(c.width * 0.1), y: Math.floor(c.height * 0.68), w: Math.floor(c.width * 0.8), h: defaultH }
    ];
  }

  return { width: c.width, height: c.height, slots: finalSlots };
}

async function buildPhotoStrip() {
  const selectedTheme = themeSelect ? themeSelect.value : 'template1';
  
  // Load the frame image first to read its natural dimensions
  const frameImg = await loadImage(`${selectedTheme}.png`);
  if (!frameImg) {
    alert("Could not load template image!");
    return;
  }

  // Automatically compute canvas size and slots based on the uploaded image file
  const config = detectSlotsFromImage(frameImg);

  canvas.width = config.width;
  canvas.height = config.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw photos into the auto-detected slots
  for (let i = 0; i < capturedPhotos.length; i++) {
    const photo = await loadImage(capturedPhotos[i]);
    if (photo && config.slots[i]) {
      const slot = config.slots[i];
      drawCoverImage(ctx, photo, slot.x, slot.y, slot.w, slot.h);
    }
  }

  // Draw the frame overlay on top
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
