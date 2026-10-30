const fileInput = document.getElementById('statsFile');
const promptInput = document.getElementById('statsPrompt');
const form = document.getElementById('statsForm');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const stage = document.getElementById('canvasStage');
const selectionBox = document.getElementById('selectionBox');
const video = document.getElementById('sourceVideo');
const messages = document.getElementById('statsMessages');
const chatScroll = document.getElementById('statsChatScroll');
const exportButton = document.getElementById('exportButton');
const playButton = document.getElementById('playButton');
const clearButton = document.getElementById('clearButton');
const editList = document.getElementById('editList');
const editItems = document.getElementById('editItems');
let media = null;
let image = null;
let objectUrl = null;
let originalPixels = null;
let selection = null;
let edits = [];
let dragStart = null;
let videoFrameLoop = 0;
let exporting = false;
let audioGraph = null;

function message(text, kind = 'assistant') {
  const row = document.createElement('div');
  row.className = `stat-message ${kind}`;
  row.textContent = text;
  messages.append(row);
  chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
}

function formatSize(bytes) { return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
function paintSource() {
  if (!media) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(media.kind === 'image' ? image : video, 0, 0, canvas.width, canvas.height);
}
function sampleBase() {
  paintSource();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
function colorAt(data, x, y) {
  const i = (clamp(y, 0, canvas.height - 1) * canvas.width + clamp(x, 0, canvas.width - 1)) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}
function luminance(rgb) { return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; }

function paintEdit(edit, sourceData) {
  const { x, y, w, h } = edit.box;
  const pixels = sourceData.data;
  // Reconstruct only the selected text area from the pixels immediately beside it.
  // The rest of the uploaded frame is copied without modification.
  const patch = ctx.createImageData(w, h);
  let brightness = 0;
  for (let row = 0; row < h; row++) {
    const left = colorAt(pixels, x - 2, y + row);
    const right = colorAt(pixels, x + w + 1, y + row);
    brightness += (luminance(left) + luminance(right)) / 2;
    for (let col = 0; col < w; col++) {
      const p = (row * w + col) * 4;
      const t = w <= 1 ? .5 : col / (w - 1);
      for (let channel = 0; channel < 3; channel++) patch.data[p + channel] = left[channel] * (1 - t) + right[channel] * t;
      patch.data[p + 3] = 255;
    }
  }
  ctx.putImageData(patch, x, y);
  const brightBackground = brightness / h > 185;
  const fontSize = Math.max(9, Math.round(h * .85));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
  const measured = ctx.measureText(edit.text).width;
  const scale = Math.min(1, (w * .96) / Math.max(1, measured));
  ctx.translate(x + w / 2, y + h / 2 + fontSize * .025);
  ctx.scale(scale, 1);
  ctx.fillStyle = brightBackground ? '#727982' : '#fff';
  ctx.fillText(edit.text, 0, 0);
  ctx.restore();
}

function renderFrame() {
  if (!media) return;
  const source = media.kind === 'image' ? originalPixels : sampleBase();
  if (media.kind === 'image') ctx.putImageData(originalPixels, 0, 0);
  for (const edit of edits) paintEdit(edit, source);
}

function videoLoop() {
  if (!media || media.kind !== 'video' || video.paused) return;
  renderFrame();
  videoFrameLoop = requestAnimationFrame(videoLoop);
}

function updateSelectionBox() {
  if (!selection) { selectionBox.hidden = true; return; }
  const bounds = canvas.getBoundingClientRect();
  const parent = stage.getBoundingClientRect();
  selectionBox.hidden = false;
  selectionBox.style.left = `${bounds.left - parent.left + selection.x / canvas.width * bounds.width}px`;
  selectionBox.style.top = `${bounds.top - parent.top + selection.y / canvas.height * bounds.height}px`;
  selectionBox.style.width = `${selection.w / canvas.width * bounds.width}px`;
  selectionBox.style.height = `${selection.h / canvas.height * bounds.height}px`;
  document.getElementById('selectionInfo').textContent = `Selected ${selection.w} × ${selection.h} pixels · type a new value below.`;
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: clamp(Math.round((event.clientX - bounds.left) / bounds.width * canvas.width), 0, canvas.width), y: clamp(Math.round((event.clientY - bounds.top) / bounds.height * canvas.height), 0, canvas.height) };
}
canvas.addEventListener('pointerdown', event => {
  if (!media || exporting) return;
  canvas.setPointerCapture(event.pointerId);
  dragStart = canvasPoint(event);
  selection = null;
  updateSelectionBox();
});
canvas.addEventListener('pointermove', event => {
  if (!dragStart) return;
  const end = canvasPoint(event);
  selection = { x: Math.min(dragStart.x, end.x), y: Math.min(dragStart.y, end.y), w: Math.abs(end.x - dragStart.x), h: Math.abs(end.y - dragStart.y) };
  updateSelectionBox();
});
canvas.addEventListener('pointerup', event => {
  if (!dragStart) return;
  const end = canvasPoint(event);
  selection = { x: Math.min(dragStart.x, end.x), y: Math.min(dragStart.y, end.y), w: Math.abs(end.x - dragStart.x), h: Math.abs(end.y - dragStart.y) };
  dragStart = null;
  if (selection.w < 4 || selection.h < 4) { selection = null; message('Drag a box around the whole number, including a little background.'); }
  else promptInput.focus();
  updateSelectionBox();
});
window.addEventListener('resize', updateSelectionBox);

function refreshEditList() {
  editItems.replaceChildren();
  editList.hidden = edits.length === 0;
  edits.forEach((edit, index) => {
    const item = document.createElement('div'); item.className = 'edit-item';
    const label = document.createElement('span'); label.textContent = `${index + 1}. ${edit.text}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'REMOVE';
    remove.addEventListener('click', () => { edits.splice(index, 1); refreshEditList(); renderFrame(); });
    item.append(label, remove); editItems.append(item);
  });
  clearButton.disabled = edits.length === 0;
  exportButton.disabled = edits.length === 0;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!media) { message('Upload an image or video first.'); return; }
  if (!selection) { message('Drag around the value you want to change, then type the replacement.'); return; }
  if (!/^\d{1,6}(?:[.,]\d{1,3})?\s*(?:%|x|×)?$/i.test(text)) { message('Type a value such as 30%, 3.3x, or 536.'); return; }
  edits.push({ box: { ...selection }, text });
  message(`Replace selected value with ${text}`, 'user');
  message('Done. Select another value or export your file.');
  promptInput.value = '';
  selection = null;
  updateSelectionBox();
  refreshEditList();
  renderFrame();
});

function loaded() {
  document.getElementById('emptyStage').hidden = true;
  document.getElementById('fileLabel').textContent = media.file.name;
  document.getElementById('mediaDetails').textContent = `${media.kind.toUpperCase()} · ${canvas.width} × ${canvas.height} · ${formatSize(media.file.size)}`;
  canvas.style.display = 'block';
  playButton.hidden = media.kind !== 'video';
  edits = []; selection = null; refreshEditList(); updateSelectionBox();
  if (media.kind === 'image') originalPixels = sampleBase();
  renderFrame();
  message(`${media.file.name} is ready. Drag a tight box around a value in the preview, then type its replacement.`);
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { message('Choose an image or video file.'); return; }
  video.pause(); cancelAnimationFrame(videoFrameLoop);
  if (audioGraph) { await audioGraph.context.close(); audioGraph = null; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  const kind = file.type.startsWith('image/') ? 'image' : 'video';
  media = { file, kind }; image = null; originalPixels = null;
  try {
    if (kind === 'image') {
      image = new Image(); image.src = objectUrl; await image.decode();
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    } else {
      video.src = objectUrl;
      video.load();
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    }
    if (!canvas.width || !canvas.height) throw new Error('The file has no readable frame.');
    loaded();
  } catch { media = null; message('This file could not be decoded on this device. Try PNG, JPG, MP4, or WebM.'); }
});

playButton.addEventListener('click', async () => {
  if (!media || media.kind !== 'video') return;
  if (video.paused) { await video.play(); playButton.textContent = 'Ⅱ PAUSE'; videoLoop(); }
  else { video.pause(); playButton.textContent = '▶ PLAY'; cancelAnimationFrame(videoFrameLoop); }
});
video.addEventListener('ended', () => { playButton.textContent = '▶ PLAY'; cancelAnimationFrame(videoFrameLoop); renderFrame(); });
clearButton.addEventListener('click', () => { edits = []; selection = null; refreshEditList(); updateSelectionBox(); renderFrame(); message('All replacements cleared.'); });

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function exportVideo() {
  if (!canvas.captureStream || !window.MediaRecorder) throw new Error('Video export is unavailable in this browser.');
  const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser has no supported video recording format.');
  video.pause(); video.currentTime = 0;
  await new Promise(resolve => { if (video.readyState >= 2 && video.currentTime === 0) resolve(); else video.onseeked = resolve; });
  renderFrame();
  const stream = canvas.captureStream(30);
  try {
    if (!audioGraph) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(video);
      const destination = context.createMediaStreamDestination();
      source.connect(destination);
      audioGraph = { context, destination };
    }
    await audioGraph.context.resume();
    audioGraph.destination.stream.getAudioTracks().forEach(track => stream.addTrack(track.clone()));
  } catch { /* A silent clip can still be exported. */ }
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('The video recorder stopped unexpectedly.'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recorder.start(1000);
  await video.play();
  await new Promise((resolve, reject) => {
    const ended = () => { video.removeEventListener('error', failed); resolve(); };
    const failed = () => { video.removeEventListener('ended', ended); reject(new Error('The uploaded video could not play through.')); };
    video.addEventListener('ended', ended, { once: true });
    video.addEventListener('error', failed, { once: true });
    videoLoop();
  });
  renderFrame(); recorder.stop();
  const blob = await done;
  stream.getTracks().forEach(track => track.stop());
  return { blob, extension: mimeType.includes('mp4') ? 'mp4' : 'webm' };
}

exportButton.addEventListener('click', async () => {
  if (!media || !edits.length || exporting) return;
  exporting = true; exportButton.disabled = true;
  const stem = media.file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'stats';
  try {
    if (media.kind === 'image') {
      renderFrame();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed on this device.');
      download(blob, `${stem}-edited.png`);
      message(`PNG saved: ${stem}-edited.png`);
    } else {
      message('Rendering video in real time. Keep this tab open until it finishes.');
      const { blob, extension } = await exportVideo();
      download(blob, `${stem}-edited.${extension}`);
      message(`${extension.toUpperCase()} video saved: ${stem}-edited.${extension}`);
    }
  } catch (error) { message(error.message || 'Export failed. Please try again.'); }
  finally { exporting = false; exportButton.disabled = false; playButton.textContent = '▶ PLAY'; }
});
