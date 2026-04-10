const { CLIPTextModelWithProjection, CLIPVisionModelWithProjection, AutoTokenizer, AutoProcessor, RawImage, env } = require('@huggingface/transformers');

// Support HF_ENDPOINT env var for mirror access
if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT;
}

const MODEL_ID = 'Xenova/clip-vit-base-patch32';

let textModel = null;
let visionModel = null;
let tokenizer = null;
let processor = null;

async function loadModel(onProgress) {
  if (textModel && visionModel && tokenizer && processor) return;

  const progressCallback = onProgress
    ? (progress) => {
        if (progress.status === 'progress' && progress.progress != null) {
          onProgress({
            file: progress.file || '',
            progress: Math.round(progress.progress),
          });
        }
      }
    : undefined;

  [textModel, visionModel, tokenizer, processor] = await Promise.all([
    CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      progress_callback: progressCallback,
    }),
    CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      progress_callback: progressCallback,
    }),
    AutoTokenizer.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
    }),
    AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
    }),
  ]);
}

function normalize(vec) {
  const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
  let norm = 0;
  for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < arr.length; i++) arr[i] /= norm;
  }
  return arr;
}

async function embedImage(imagePath) {
  if (!visionModel || !processor) throw new Error('Model not loaded');
  const image = await RawImage.read(imagePath);
  const imageInputs = await processor(image);
  const { image_embeds } = await visionModel(imageInputs);
  return normalize(image_embeds.data);
}

async function embedText(text) {
  if (!textModel || !tokenizer) throw new Error('Model not loaded');
  const textInputs = tokenizer([text], { padding: true, truncation: true });
  const { text_embeds } = await textModel(textInputs);
  return normalize(text_embeds.data);
}

function isModelLoaded() {
  return textModel !== null && visionModel !== null && tokenizer !== null && processor !== null;
}

module.exports = {
  loadModel,
  embedImage,
  embedText,
  isModelLoaded,
};
