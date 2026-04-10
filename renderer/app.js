const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Screens
const setupScreen = $('#setup-screen');
const searchScreen = $('#search-screen');

// Setup elements
const btnSetup = $('#btn-setup');
const setupIdle = $('#setup-idle');
const setupRunning = $('#setup-running');
const setupStatus = $('#setup-status');

// Search elements
const searchInput = $('#search-input');
const searchSpinner = $('#search-spinner');
const emptyState = $('#empty-state');
const resultsGrid = $('#results-grid');

// Lightbox
const lightbox = $('#lightbox');
const lightboxImg = $('#lightbox-img');
const lightboxScore = $('#lightbox-score');
const btnCopyImage = $('#btn-copy-image');

// --- Initialization ---

async function init() {
  const status = await window.api.checkStatus();
  if (status.needsSetup) {
    showSetupScreen();
  } else {
    showSearchScreen();
  }
}

function showSetupScreen() {
  setupScreen.style.display = '';
  searchScreen.style.display = 'none';
}

function showSearchScreen() {
  setupScreen.style.display = 'none';
  searchScreen.style.display = '';
  searchInput.focus();
}

// --- Setup ---

btnSetup.addEventListener('click', () => {
  setupIdle.style.display = 'none';
  setupRunning.style.display = '';
  window.api.startSetup();
});

window.api.onSetupProgress((data) => {
  const { stage, message, progress } = data;

  setupStatus.textContent = message;

  if (stage === 'model' || stage === 'images' || stage === 'index') {
    const bar = $(`#bar-${stage}`);
    const pct = $(`#pct-${stage}`);
    const stageEl = $(`#stage-${stage}`);

    if (bar) bar.style.width = `${progress}%`;
    if (pct) pct.textContent = `${progress}%`;

    // Mark active/done
    if (stageEl) {
      stageEl.classList.add('active');
      if (progress >= 100) {
        stageEl.classList.remove('active');
        stageEl.classList.add('done');
      }
    }
  }

  if (stage === 'done') {
    setTimeout(() => showSearchScreen(), 600);
  }

  if (stage === 'error') {
    setupStatus.textContent = `Error: ${message}`;
    setupStatus.style.color = '#ef4444';
  }
});

// --- Search ---

let searchTimeout = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();
  if (!query) {
    showEmpty();
    return;
  }
  searchTimeout = setTimeout(() => performSearch(query), 400);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query) performSearch(query);
  }
});

// Suggestion chips
$$('.suggestion').forEach((btn) => {
  btn.addEventListener('click', () => {
    const query = btn.dataset.query;
    searchInput.value = query;
    performSearch(query);
  });
});

async function performSearch(query) {
  searchSpinner.style.display = '';
  emptyState.style.display = 'none';
  resultsGrid.style.display = 'grid';

  try {
    const { results, error } = await window.api.search(query);

    if (error) {
      console.error('Search error:', error);
      showEmpty();
      return;
    }

    renderResults(results);
  } catch (err) {
    console.error('Search failed:', err);
    showEmpty();
  } finally {
    searchSpinner.style.display = 'none';
  }
}

function renderResults(results) {
  if (!results || results.length === 0) {
    resultsGrid.innerHTML = '<p style="color:var(--text-dim);grid-column:1/-1;text-align:center;padding:40px;">No results found</p>';
    return;
  }

  resultsGrid.innerHTML = results
    .map(
      (r) => `
    <div class="result-card" data-path="${r.imagePath}" data-score="${r.score.toFixed(3)}">
      <img src="local-image://${encodeURIComponent(r.imagePath)}" alt="Image ${r.id}" loading="lazy">
      <span class="result-score">${r.score.toFixed(3)}</span>
    </div>
  `
    )
    .join('');

  // Add click listeners for lightbox
  resultsGrid.querySelectorAll('.result-card').forEach((card) => {
    card.addEventListener('click', () => {
      openLightbox(card.dataset.path, card.dataset.score);
    });
  });
}

function showEmpty() {
  emptyState.style.display = '';
  resultsGrid.style.display = 'none';
  resultsGrid.innerHTML = '';
}

// --- Lightbox ---

let currentImagePath = '';

function openLightbox(imagePath, score) {
  currentImagePath = imagePath;
  lightboxImg.src = `local-image://${encodeURIComponent(imagePath)}`;
  lightboxScore.textContent = `Similarity: ${score}`;
  lightbox.style.display = '';
  // Reset copy button
  btnCopyImage.classList.remove('copied');
}

async function copyCurrentImage() {
  if (!currentImagePath) return;
  const { success } = await window.api.copyImage(currentImagePath);
  if (success) {
    btnCopyImage.classList.add('copied');
    const origHTML = btnCopyImage.innerHTML;
    btnCopyImage.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    setTimeout(() => {
      btnCopyImage.innerHTML = origHTML;
      btnCopyImage.classList.remove('copied');
    }, 1500);
  }
}

function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxImg.src = '';
}

lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
btnCopyImage.addEventListener('click', (e) => {
  e.stopPropagation();
  copyCurrentImage();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox.style.display !== 'none') {
    closeLightbox();
  }
});

// --- Platform-specific adjustments ---

if (window.api.platform !== 'darwin') {
  // On Windows/Linux with standard title bar, disable body drag region
  document.body.style.webkitAppRegion = 'no-drag';
}

// --- Start ---

init();
