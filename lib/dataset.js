const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const IMAGE_COUNT = 200;
const IMAGE_WIDTH = 640;
const IMAGE_HEIGHT = 480;

function getImageUrl(id) {
  return `https://picsum.photos/id/${id}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}`;
}

// Picsum IDs that are known to exist and provide diverse, visually appealing content
const CURATED_IDS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73,
  74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 106, 107, 108,
  109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 139,
  140, 141, 142, 143, 144, 145, 146, 147, 149, 150, 151, 152, 153, 154, 155,
  156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170,
  171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185,
  186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200,
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;

    get(url, (response) => {
      // Follow redirects (picsum returns 302)
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadDataset(imageDir, onProgress) {
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }

  const ids = CURATED_IDS.slice(0, IMAGE_COUNT);
  let completed = 0;

  // Download in batches of 5 to avoid overwhelming the server
  const BATCH_SIZE = 5;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (id) => {
      const dest = path.join(imageDir, `${id}.jpg`);
      if (fs.existsSync(dest)) {
        completed++;
        if (onProgress) onProgress({ completed, total: ids.length });
        return;
      }
      try {
        await downloadFile(getImageUrl(id), dest);
      } catch (err) {
        console.error(`Failed to download image ${id}:`, err.message);
      }
      completed++;
      if (onProgress) onProgress({ completed, total: ids.length });
    });
    await Promise.all(promises);
  }

  return listImages(imageDir);
}

function listImages(imageDir) {
  if (!fs.existsSync(imageDir)) return [];
  return fs
    .readdirSync(imageDir)
    .filter((f) => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
    .sort((a, b) => {
      const na = parseInt(a);
      const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    })
    .map((f) => path.join(imageDir, f));
}

function isDatasetReady(imageDir) {
  if (!fs.existsSync(imageDir)) return false;
  const images = listImages(imageDir);
  return images.length >= IMAGE_COUNT * 0.9; // Allow for some failed downloads
}

module.exports = {
  downloadDataset,
  listImages,
  isDatasetReady,
  IMAGE_COUNT,
};
