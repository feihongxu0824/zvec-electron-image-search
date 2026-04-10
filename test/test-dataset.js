/**
 * CI test: Verify dataset download logic.
 *
 * Downloads 3 images from picsum.photos using the same download
 * mechanism as dataset.js, and validates file existence and size.
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const TEST_DIR = path.join(process.cwd(), '.ci-dataset-test');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

(async () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const testIds = [0, 1, 2];
  console.log(`Downloading ${testIds.length} images from picsum.photos...`);

  for (const id of testIds) {
    const dest = path.join(TEST_DIR, `${id}.jpg`);
    const url = `https://picsum.photos/id/${id}/640/480`;
    await downloadFile(url, dest);
    const stat = fs.statSync(dest);
    if (stat.size < 1000) {
      throw new Error(`Image ${id}.jpg too small: ${stat.size} bytes`);
    }
    console.log(`  ${id}.jpg: ${stat.size} bytes - OK`);
  }

  // Also verify listImages works
  const dataset = require('../lib/dataset');
  const images = dataset.listImages(TEST_DIR);
  if (images.length !== testIds.length) {
    throw new Error(`listImages returned ${images.length}, expected ${testIds.length}`);
  }
  console.log('listImages:', images.length, 'images - OK');

  // Cleanup
  fs.rmSync(TEST_DIR, { recursive: true });
  console.log('Dataset test PASSED');
})().catch((e) => {
  console.error('Dataset test FAILED:', e);
  process.exit(1);
});
