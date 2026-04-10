const { app, BrowserWindow, ipcMain, protocol, net, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const store = require('./lib/store');
const clip = require('./lib/clip');
const dataset = require('./lib/dataset');

const os = require('os');
const DATA_DIR = path.join(os.homedir(), '.zvec-image-search');
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const INDEX_DIR = path.join(DATA_DIR, 'index');

let mainWindow = null;

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Register a custom protocol to serve local images securely
function registerImageProtocol() {
  protocol.handle('local-image', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-image://', ''));
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// --- IPC Handlers ---

let collectionOpened = false;

ipcMain.handle('check-status', async () => {
  const datasetReady = dataset.isDatasetReady(IMAGE_DIR);
  const indexReady = store.isIndexReady(INDEX_DIR);
  return { datasetReady, indexReady, needsSetup: !datasetReady || !indexReady };
});

ipcMain.handle('start-setup', async (event) => {
  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  try {
    // Stage 1: Download CLIP model
    send('setup-progress', { stage: 'model', message: 'Downloading CLIP model...', progress: 0 });
    await clip.loadModel((p) => {
      send('setup-progress', { stage: 'model', message: `Downloading model: ${p.file}`, progress: p.progress });
    });
    send('setup-progress', { stage: 'model', message: 'Model ready', progress: 100 });

    // Stage 2: Download images
    send('setup-progress', { stage: 'images', message: 'Downloading images...', progress: 0 });
    await dataset.downloadDataset(IMAGE_DIR, (p) => {
      const pct = Math.round((p.completed / p.total) * 100);
      send('setup-progress', { stage: 'images', message: `Downloading images (${p.completed}/${p.total})`, progress: pct });
    });
    send('setup-progress', { stage: 'images', message: 'Images ready', progress: 100 });

    // Stage 3: Build vector index
    send('setup-progress', { stage: 'index', message: 'Building search index...', progress: 0 });
    const images = dataset.listImages(IMAGE_DIR);
    const collection = store.createCollection(INDEX_DIR);

    const BATCH_SIZE = 10;
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      const docs = [];

      for (const imgPath of batch) {
        try {
          const vector = await clip.embedImage(imgPath);
          const id = path.basename(imgPath, path.extname(imgPath));
          docs.push({ id, vector });
        } catch (err) {
          console.error(`Failed to embed ${imgPath}:`, err.message);
        }
      }

      if (docs.length > 0) {
        store.insertVectors(docs);
      }

      const pct = Math.round(((i + batch.length) / images.length) * 100);
      send('setup-progress', {
        stage: 'index',
        message: `Building index (${Math.min(i + batch.length, images.length)}/${images.length})`,
        progress: pct,
      });
    }

    store.optimize();
    collectionOpened = true;

    send('setup-progress', { stage: 'done', message: 'Setup complete!', progress: 100 });
    return { success: true };
  } catch (err) {
    send('setup-progress', { stage: 'error', message: err.message, progress: 0 });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('search', async (event, query) => {
  try {
    if (!clip.isModelLoaded()) {
      await clip.loadModel();
    }

    if (!store.isIndexReady(INDEX_DIR)) {
      return { results: [], error: 'Index not ready' };
    }

    if (!collectionOpened) {
      store.openCollection(INDEX_DIR);
      collectionOpened = true;
    }

    const queryVector = await clip.embedText(query);
    const results = store.search(queryVector, 20);

    const mapped = results.map((r) => ({
      id: r.id,
      score: r.score,
      imagePath: path.join(IMAGE_DIR, `${r.id}.jpg`),
    }));

    return { results: mapped };
  } catch (err) {
    return { results: [], error: err.message };
  }
});

ipcMain.handle('get-image-path', (event, id) => {
  return path.join(IMAGE_DIR, `${id}.jpg`);
});

ipcMain.handle('copy-image', async (event, imagePath) => {
  try {
    const img = nativeImage.createFromPath(imagePath);
    if (img.isEmpty()) return { success: false, error: 'Failed to load image' };
    clipboard.writeImage(img);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- App Lifecycle ---

app.whenReady().then(() => {
  registerImageProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  store.close();
  if (process.platform !== 'darwin') app.quit();
});
