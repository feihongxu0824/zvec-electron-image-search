/**
 * CI test: Verify CLIP model loading, text embedding, and image embedding.
 *
 * Downloads the quantized CLIP model from HuggingFace (or mirror),
 * generates a text embedding and an image embedding, then validates
 * their shape and normalisation.
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const clip = require('../lib/clip');

// Download a single test image from picsum
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

function assertClose(actual, expected, msg) {
  if (Math.abs(actual - expected) > 0.01) {
    throw new Error(`${msg}: expected ~${expected}, got ${actual}`);
  }
}

(async () => {
  // 1. Load model
  console.log('Loading CLIP model...');
  await clip.loadModel();
  console.log('Model loaded:', clip.isModelLoaded());
  if (!clip.isModelLoaded()) throw new Error('Model not loaded');

  // 2. Text embedding
  console.log('Generating text embedding...');
  const textVec = await clip.embedText('a photo of a cat');
  console.log('  dim:', textVec.length);
  if (textVec.length !== 512) throw new Error(`Expected dim 512, got ${textVec.length}`);
  const textNorm = Math.sqrt(Array.from(textVec).reduce((s, v) => s + v * v, 0));
  assertClose(textNorm, 1.0, 'Text embedding L2 norm');
  console.log('  L2 norm:', textNorm.toFixed(4), '- OK');

  // 3. Image embedding
  console.log('Downloading test image...');
  const tmpDir = path.join(process.cwd(), '.ci-clip-test');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const imgPath = path.join(tmpDir, 'test.jpg');
  await downloadFile('https://picsum.photos/id/1/320/240', imgPath);
  const stat = fs.statSync(imgPath);
  console.log('  Downloaded:', stat.size, 'bytes');

  console.log('Generating image embedding...');
  const imgVec = await clip.embedImage(imgPath);
  console.log('  dim:', imgVec.length);
  if (imgVec.length !== 512) throw new Error(`Expected dim 512, got ${imgVec.length}`);
  const imgNorm = Math.sqrt(Array.from(imgVec).reduce((s, v) => s + v * v, 0));
  assertClose(imgNorm, 1.0, 'Image embedding L2 norm');
  console.log('  L2 norm:', imgNorm.toFixed(4), '- OK');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  console.log('CLIP test PASSED');
})().catch((e) => {
  console.error('CLIP test FAILED:', e);
  process.exit(1);
});
