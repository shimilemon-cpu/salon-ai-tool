const stationInput  = document.getElementById('stationInput');
const suggestionsEl = document.getElementById('suggestions');
const stationStatus = document.getElementById('stationStatus');
const previewSection = document.getElementById('previewSection');
const stationPreview = document.getElementById('stationPreview');
const radiusRange    = document.getElementById('radiusRange');
const radiusVal      = document.getElementById('radiusVal');
const saveBtn        = document.getElementById('saveBtn');
const saveStatus     = document.getElementById('saveStatus');
const styleTagsEl    = document.getElementById('styleTags');

let currentStation = '';
let checkedStations = new Set();

// スタイルタグ（固定）を表示
STYLE_TAGS.forEach(t => {
  const el = document.createElement('span');
  el.className = 'tag-item';
  el.textContent = t.label;
  styleTagsEl.appendChild(el);
});

// 保存済み設定を読み込む
chrome.storage.sync.get(['homeStation', 'areaRadius', 'checkedStations'], (data) => {
  if (data.homeStation) {
    stationInput.value = data.homeStation;
    currentStation = data.homeStation;
  }
  if (data.areaRadius) {
    radiusRange.value = data.areaRadius;
    radiusVal.textContent = data.areaRadius;
  }
  if (data.checkedStations) {
    checkedStations = new Set(data.checkedStations);
  }
  if (currentStation) updatePreview();
});

// 駅名サジェスト
stationInput.addEventListener('input', () => {
  const q = stationInput.value.trim();
  const results = searchStations(q);
  renderSuggestions(results);
  currentStation = '';
  stationStatus.textContent = q ? '駅名を選択してください' : '';
  previewSection.style.display = 'none';
});

function renderSuggestions(list) {
  suggestionsEl.innerHTML = '';
  if (!list.length) { suggestionsEl.classList.remove('open'); return; }
  list.forEach(s => {
    const el = document.createElement('div');
    el.className = 'suggestion-item';
    el.textContent = s;
    el.addEventListener('click', () => selectStation(s));
    suggestionsEl.appendChild(el);
  });
  suggestionsEl.classList.add('open');
}

function selectStation(station) {
  stationInput.value = station;
  currentStation = station;
  suggestionsEl.classList.remove('open');
  checkedStations.clear();
  updatePreview();
}

// クリック外でサジェストを閉じる
document.addEventListener('click', e => {
  if (!stationInput.contains(e.target) && !suggestionsEl.contains(e.target)) {
    suggestionsEl.classList.remove('open');
  }
});

// 範囲スライダー
radiusRange.addEventListener('input', () => {
  radiusVal.textContent = radiusRange.value;
  if (currentStation) updatePreview();
});

function updatePreview() {
  if (!currentStation) return;

  // 路線チェック
  const lines = Object.entries(LINES)
    .filter(([, stations]) => stations.includes(currentStation))
    .map(([name]) => name);

  if (!lines.length) {
    stationStatus.textContent = '⚠ 路線データに見つかりませんでした';
    previewSection.style.display = 'none';
    return;
  }

  stationStatus.textContent = `✓ ${lines.join('・')} で見つかりました`;
  previewSection.style.display = 'block';

  const radius = parseInt(radiusRange.value, 10);
  const nearby = getNearbyStations(currentStation, radius, 10);

  stationPreview.innerHTML = '';
  nearby.forEach(s => {
    const isChecked = checkedStations.size === 0 || checkedStations.has(s);
    if (checkedStations.size === 0 && isChecked) checkedStations.add(s);

    const item = document.createElement('label');
    item.className = 'tag-item' + (isChecked ? ' checked' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isChecked;
    cb.addEventListener('change', () => {
      if (cb.checked) { checkedStations.add(s); item.classList.add('checked'); }
      else { checkedStations.delete(s); item.classList.remove('checked'); }
    });

    item.appendChild(cb);
    item.appendChild(document.createTextNode(s));
    stationPreview.appendChild(item);
  });
}

// 保存
saveBtn.addEventListener('click', () => {
  if (!currentStation) {
    saveStatus.textContent = '⚠ 最寄り駅を選択してください';
    return;
  }
  const radius = parseInt(radiusRange.value, 10);
  const nearby = getNearbyStations(currentStation, radius, 10);
  const selected = nearby.filter(s => checkedStations.has(s));

  chrome.storage.sync.set({
    homeStation: currentStation,
    areaRadius: radius,
    checkedStations: [...checkedStations],
    areaTags: selected,
  }, () => {
    saveStatus.textContent = '✓ 保存しました';
    setTimeout(() => { saveStatus.textContent = ''; }, 2000);
  });
});
