const fileInput = document.getElementById("fileInput");
const gridSlider = document.getElementById("gridSize");
const output = document.getElementById("output");
const ctxOut = output.getContext("2d");

const hidden = document.createElement("canvas");
const ctxHidden = hidden.getContext("2d");

let img = null;

fileInput.addEventListener("change", handleImage);
gridSlider.addEventListener("input", () => img && render());

function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    img = new Image();
    img.onload = () => render();
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function render() {
  const baseGrid = parseInt(gridSlider.value);

  hidden.width = img.width;
  hidden.height = img.height;
  ctxHidden.drawImage(img, 0, 0);

  output.width = img.width;
  output.height = img.height;

  ctxOut.fillStyle = "#fff";
  ctxOut.fillRect(0, 0, output.width, output.height);

  const data = ctxHidden.getImageData(0, 0, img.width, img.height).data;

  // aspect ratio
  const aspect = img.width / img.height;

  // calculate grid dimensions that preserve aspect AND use square cells
  let cols, rows;

  if (aspect >= 1) {
    // landscape image: width dominates
    cols = baseGrid;
    rows = Math.round(baseGrid / aspect);
  } else {
    // portrait image: height dominates
    rows = baseGrid;
    cols = Math.round(baseGrid * aspect);
  }

  // now compute cell size so the mosaic fits inside the image fully
  const cellSize = Math.min(img.width / cols, img.height / rows);

  // center mosaic inside the image
  const mosaicW = cols * cellSize;
  const mosaicH = rows * cellSize;

  const offsetX = (img.width - mosaicW) / 2;
  const offsetY = (img.height - mosaicH) / 2;

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
          const idx = (y * img.width + x) * 4;
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
