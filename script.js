const fileInput = document.getElementById("fileInput");
const gridSlider = document.getElementById("gridSize");
const output = document.getElementById("output");
const ctxOut = output.getContext("2d");

const video = document.getElementById("video");
const camModeBtn = document.getElementById("camMode");
const fileModeBtn = document.getElementById("fileMode");

const hidden = document.createElement("canvas");
const ctxHidden = hidden.getContext("2d");

let img = null;
let usingCam = true;
let streaming = false;

// ---- event wiring ----
fileInput.addEventListener("change", handleImage);
gridSlider.addEventListener("input", () => usingCam ? null : (img && renderImage()));

camModeBtn.addEventListener("click", startCamMode);
fileModeBtn.addEventListener("click", startFileMode);

// default = camera mode
startCamMode();

function startCamMode() {
  usingCam = true;
  fileInput.style.display = "none";

  if (!streaming) initCam();
}

function startFileMode() {
  usingCam = false;
  fileInput.style.display = "block";
  stopCam();
}

function initCam() {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    streaming = true;
    requestAnimationFrame(loopCam);
  });
}

function stopCam() {
  if (video.srcObject) {
    for (const t of video.srcObject.getTracks()) t.stop();
  }
  streaming = false;
}

// ---- file image mode ----
function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    img = new Image();
    img.onload = () => renderImage();
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ---- main webcam loop ----
let lastFrameTime = 0;
const fps = 12;

function loopCam(ts) {
  if (!streaming || !usingCam) return;

  const delta = ts - lastFrameTime;
  if (delta > 1000 / fps) {
    renderVideo();
    lastFrameTime = ts;
  }

  requestAnimationFrame(loopCam);
}

// ---- render from webcam ----
function renderVideo() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;

  hidden.width = w;
  hidden.height = h;
  ctxHidden.drawImage(video, 0, 0, w, h);

  renderFromCanvas(w, h);
}

// ---- render from static image ----
function renderImage() {
  hidden.width = img.width;
  hidden.height = img.height;
  ctxHidden.drawImage(img, 0, 0);

  renderFromCanvas(img.width, img.height);
}

// ---- core mosaic logic (unchanged except dimensions passed in) ----
function renderFromCanvas(origW, origH) {
  const baseGrid = parseInt(gridSlider.value);

  const data = ctxHidden.getImageData(0, 0, origW, origH).data;

  // same logic as before
  const aspect = origW / origH;
  let cols, rows;

  if (aspect >= 1) {
    cols = baseGrid;
    rows = Math.round(baseGrid / aspect);
  } else {
    rows = baseGrid;
    cols = Math.round(baseGrid * aspect);
  }

  const cellSize = Math.min(origW / cols, origH / rows);

  const mosaicW = cols * cellSize;
  const mosaicH = rows * cellSize;

  const offsetX = (origW - mosaicW) / 2;
  const offsetY = (origH - mosaicH) / 2;

  output.width = origW;
  output.height = origH;

  ctxOut.fillStyle = "#fff";
  ctxOut.fillRect(0, 0, origW, origH);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {

      let sum = 0;
      let count = 0;

      const startX = Math.floor(gx * cellSize);
      const startY = Math.floor(gy * cellSize);
      const endX = Math.floor((gx + 1) * cellSize);
      const endY = Math.floor((gy + 1) * cellSize);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * origW + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          sum += (r + g + b) / 3;
          count++;
        }
      }

      const avg = sum / count;
      const darkness = 1 - avg / 255;
      const sq = darkness * cellSize;

      const cx = offsetX + gx * cellSize + cellSize / 2;
      const cy = offsetY + gy * cellSize + cellSize / 2;

      ctxOut.fillStyle = "#000";
      ctxOut.fillRect(cx - sq / 2, cy - sq / 2, sq, sq);
    }
  }
}
