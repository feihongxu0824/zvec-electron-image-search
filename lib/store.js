const zvec = require('@zvec/zvec');
const fs = require('fs');

let initialized = false;
let collection = null;

const COLLECTION_NAME = 'photos';
const VECTOR_DIM = 512;

function ensureInit() {
  if (!initialized) {
    zvec.ZVecInitialize({});
    initialized = true;
  }
}

function createCollection(indexDir) {
  ensureInit();
  const schema = new zvec.ZVecCollectionSchema({
    name: COLLECTION_NAME,
    vectors: [{
      name: 'feature',
      dataType: zvec.ZVecDataType.VECTOR_FP32,
      dimension: VECTOR_DIM,
      indexParams: {
        indexType: zvec.ZVecIndexType.FLAT,
        metricType: zvec.ZVecMetricType.COSINE,
      },
    }],
  });
  collection = zvec.ZVecCreateAndOpen(indexDir, schema);
  return collection;
}

function openCollection(indexDir) {
  ensureInit();
  if (collection) {
    try { collection.closeSync(); } catch (_) {}
  }
  collection = zvec.ZVecOpen(indexDir);
  return collection;
}

function insertVectors(docs) {
  if (!collection) throw new Error('Collection not opened');
  collection.insertSync(
    docs.map((d) => ({
      id: d.id,
      vectors: { feature: d.vector },
    }))
  );
}

function optimize() {
  if (!collection) return;
  collection.optimizeSync();
}

function search(queryVector, topk = 20) {
  if (!collection) throw new Error('Collection not opened');
  const results = collection.querySync({
    fieldName: 'feature',
    vector: queryVector,
    topk,
  });
  // Cosine distance: 0 = identical, 2 = opposite.
  // Convert to a similarity score in [0, 1] for display.
  return results.map((r) => ({
    id: r.id,
    score: 1 - r.score / 2,
  }));
}

function isIndexReady(indexDir) {
  return fs.existsSync(indexDir) && fs.readdirSync(indexDir).length > 0;
}

function close() {
  if (collection) {
    try { collection.closeSync(); } catch (_) {}
    collection = null;
  }
}

module.exports = {
  createCollection,
  openCollection,
  insertVectors,
  optimize,
  search,
  isIndexReady,
  close,
  VECTOR_DIM,
};
