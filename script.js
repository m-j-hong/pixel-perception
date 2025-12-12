// ================================
//         ELEMENTS & GLOBALS
// ================================
const fileInput = document.getElementById("fileInput");
const gridSlider = document.getElementById("gridSize");
const output = document.getElementById("output");
const ctxOut = output.getContext("2d");

const video = document.getElementById("video");
const camModeBtn = document.getElementById("camMode");

const monoToggle = document.getElementById("monoToggle");
const monoColor = document.getElementById("monoColor");

const shapeSelect = document.getElementById("shapeSelect");
const shapeSizeSlider = document.getElementById("shapeSize");

const hiddenCanvas = document.createElement("canvas");
const ctxHidden = hiddenCanvas.getContext("2d");

let img = null;
let usingCam = true;
let streaming = false;
let lastFrameTime = 0;
const fps = 12;

// handle gradual redraw
let gradualTimeout = null;

// ================================
//         EVENT LISTENERS
// ================================
fileInput.addEventListener("change", (e) => {
  if (camMode) switchMode(false);
  handleImage(e)
});

gridSlider.addEventListener("input", () => redrawOrGradual());

camModeBtn.addEventListener("click", () => switchMode(true));

monoToggle.addEventListener("change", () => {
  monoColor.style.display = monoToggle.checked ? "inline-block" : "none";
  redrawOrGradual();
});
monoColor.addEventListener("input", redrawOrGradual);

shapeSelect.addEventListener("change", redrawOrGradual);
shapeSizeSlider.addEventListener("input", redrawOrGradual);

// ================================
//         MODE FUNCTIONS
// ================================
function switchMode(camMode) {
  usingCam = camMode;

  // toggle button visual state
  document.getElementById("camMode").classList.toggle("active", camMode);
  document.getElementById("fileModeBtn").classList.toggle("active", !camMode);

  cancelGradual();
  clearCanvas();

  if (camMode) initCam();
  else stopCam();
}


function initCam() {
  if (streaming) return;
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    streaming = true;
    requestAnimationFrame(loopCam);
  });
}

function stopCam() {
  if (!video.srcObject) return;
  video.srcObject.getTracks().forEach(track => track.stop());
  streaming = false;
}

// ================================
//         FILE IMAGE FUNCTIONS
// ================================
function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  cancelGradual();
  clearCanvas();

  const reader = new FileReader();
  reader.onload = () => {
    img = new Image();
    img.onload = () => renderImage();
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ================================
//         RENDER FUNCTIONS
// ================================
function loopCam(ts) {
  if (!streaming || !usingCam) return;
  if (ts - lastFrameTime > 1000 / fps) {
    renderVideo();
    lastFrameTime = ts;
  }
  requestAnimationFrame(loopCam);
}

function renderVideo() {
  if (!video.videoWidth || !video.videoHeight) return;

  cancelGradual();

  const { w, h } = fitToScreenDims(video.videoWidth, video.videoHeight);

  hiddenCanvas.width = w;
  hiddenCanvas.height = h;

  ctxHidden.drawImage(video, 0, 0, w, h);

  drawGrid(w, h, false);
}


function renderImage() {
  if (!img) return;

  cancelGradual();

  const { w, h } = fitToScreenDims(img.width, img.height);

  hiddenCanvas.width = w;
  hiddenCanvas.height = h;

  ctxHidden.drawImage(img, 0, 0, w, h);

  gradualRedraw();
}


// ================================
//         DRAW GRID CORE
// ================================
function drawGrid(origW, origH, gradual=false) {
  cancelGradual();

  const baseGrid = parseInt(gridSlider.value);
  const aspect = origW / origH;

  const cols = aspect >= 1 ? baseGrid : Math.round(baseGrid * aspect);
  const rows = aspect >= 1 ? Math.round(baseGrid / aspect) : baseGrid;
  const cellSize = Math.min(origW / cols, origH / rows);
  const offsetX = (origW - cols*cellSize)/2;
  const offsetY = (origH - rows*cellSize)/2;

  output.width = origW;
  output.height = origH;
  ctxOut.fillStyle = "#fff";
  ctxOut.fillRect(0, 0, origW, origH);

  const monocolor = monoToggle.checked;
  const monoRGB = hexToRGB(monoColor.value);
  const shape = shapeSelect.value;
  const shapeMult = parseFloat(shapeSizeSlider.value);

  const data = ctxHidden.getImageData(0,0,origW,origH).data;

  const cells = [];
  for (let gy=0; gy<rows; gy++)
    for (let gx=0; gx<cols; gx++)
      cells.push({gx, gy});

  if (gradual && !usingCam) {
    shuffleArray(cells);
    const totalDuration = 1000; // 1s
    const tickInterval = 16; // ~60fps
    const cellsPerTick = Math.ceil(cells.length / (totalDuration / tickInterval));
    let idx = 0;

    function drawNext() {
      if (idx >= cells.length) return;
      const end = Math.min(idx + cellsPerTick, cells.length);
      for (let i=idx; i<end; i++) {
        drawCell(cells[i], origW, origH, cellSize, offsetX, offsetY, data, monocolor, monoRGB, shape, shapeMult);
      }
      idx = end;
      gradualTimeout = setTimeout(drawNext, tickInterval);
    }
    drawNext();
  } else {
    cells.forEach(cell => drawCell(cell, origW, origH, cellSize, offsetX, offsetY, data, monocolor, monoRGB, shape, shapeMult));
  }
}

// -------------------- DRAW SINGLE CELL --------------------
function drawCell({gx, gy}, origW, origH, cellSize, offsetX, offsetY, data, monocolor, monoRGB, shape, shapeMult) {
  let sumR=0, sumG=0, sumB=0, count=0;

  const startX = Math.floor(gx*cellSize);
  const startY = Math.floor(gy*cellSize);
  const endX = Math.floor((gx+1)*cellSize);
  const endY = Math.floor((gy+1)*cellSize);

  for (let y=startY; y<endY; y++)
    for (let x=startX; x<endX; x++){
      const idx = (y*origW+x)*4;
      sumR+=data[idx]; sumG+=data[idx+1]; sumB+=data[idx+2];
      count++;
    }

  const avgR=sumR/count, avgG=sumG/count, avgB=sumB/count;
  const brightness=(avgR+avgG+avgB)/3;
  const size=(1-brightness/255)*cellSize*shapeMult;

  const cx=offsetX+gx*cellSize+cellSize/2;
  const cy=offsetY+gy*cellSize+cellSize/2;

  ctxOut.fillStyle = monocolor ? `rgb(${monoRGB.r},${monoRGB.g},${monoRGB.b})` : `rgb(${avgR},${avgG},${avgB})`;
  ctxOut.beginPath();

  if (shape==="square") ctxOut.fillRect(cx-size/2, cy-size/2, size, size);
  else if (shape==="circle") { ctxOut.arc(cx, cy, size/2, 0, 2*Math.PI); ctxOut.fill(); }
  else if (shape==="diamond") {
    ctxOut.moveTo(cx, cy-size/2);
    ctxOut.lineTo(cx+size/2, cy);
    ctxOut.lineTo(cx, cy+size/2);
    ctxOut.lineTo(cx-size/2, cy);
    ctxOut.closePath();
    ctxOut.fill();
  }
}

// ================================
//         GRADUAL REDRAW UTILS
// ================================
function gradualRedraw() {
  if (!img || usingCam) return;
  drawGrid(hiddenCanvas.width, hiddenCanvas.height, true);
}

function cancelGradual() {
  if (gradualTimeout) {
    clearTimeout(gradualTimeout);
    gradualTimeout = null;
  }
}

// ================================
//         HELPER FUNCTIONS
// ================================
function hexToRGB(hex) {
  return {r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16)};
}

function shuffleArray(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
}

function clearCanvas() {
  ctxOut.clearRect(0,0,output.width,output.height);
}

function redrawOrGradual() {
  if (!img) return;
  if (usingCam) renderVideo();
  else gradualRedraw();
}

function fitToScreenDims(w, h) {
  const targetH = window.innerHeight - 120; // adjust padding
  const scale = targetH / h;
  return {
    w: Math.round(w * scale),
    h: Math.round(h * scale)
  };
}

// ================================
//         INIT
// ================================
switchMode(true)
