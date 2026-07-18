let mode = 'fill';
let isHpbPage = false;
let salonAiUrl = '';

const urlSetup      = document.getElementById('urlSetup');
const mainEl        = document.getElementById('main');
const urlInput      = document.getElementById('urlInput');
const urlSave       = document.getElementById('urlSave');
const urlChange     = document.getElementById('urlChange');
const fetchBtn      = document.getElementById('fetchBtn');
const fetchStatus   = document.getElementById('fetchStatus');
const emptyState    = document.getElementById('emptyState');
const tagsArea      = document.getElementById('tagsArea');
const aiMeta        = document.getElementById('aiMeta');
const tagCategories = document.getElementById('tagCategories');
const hpbWarning    = document.getElementById('hpbWarning');
const toast         = document.getElementById('toast');

const CAT_LABELS = {
  trend:  '📸 トレンドタグ',
  length: '長さ',
  color:  'カラー',
  image:  'イメージ',
  face:   '顔型',
  area:   'エリア・駅名',
};

// モード切替
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    if (hpbWarning) hpbWarning.style.display = (mode === 'fill' && !isHpbPage) ? 'block' : 'none';
  });
});

// HPBページか確認
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  isHpbPage = tab?.url?.includes('hotpepper.jp') ?? false;
  if (hpbWarning) hpbWarning.style.display = (mode === 'fill' && !isHpbPage) ? 'block' : 'none';
});

// 起動時：設定を読み込む
chrome.storage.local.get(['salonAiUrl', 'aiTagsData'], (data) => {
  salonAiUrl = data.salonAiUrl || '';
  if (!salonAiUrl) {
    showUrlSetup();
  } else {
    showMain();
    if (data.aiTagsData) renderTags(data.aiTagsData);
  }
});

function showUrlSetup() {
  urlSetup.style.display = 'block';
  mainEl.style.display = 'none';
}

function showMain() {
  urlSetup.style.display = 'none';
  mainEl.style.display = 'block';
}

// URL保存
urlSave.addEventListener('click', () => {
  const url = urlInput.value.trim().replace(/\/$/, '');
  if (!url) return;
  salonAiUrl = url;
  chrome.storage.local.set({ salonAiUrl: url }, () => {
    showMain();
    fetchTags();
  });
});
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') urlSave.click(); });

// URL変更
urlChange.addEventListener('click', () => {
  urlInput.value = salonAiUrl;
  showUrlSetup();
});

// タグ取得
fetchBtn.addEventListener('click', fetchTags);

async function fetchTags() {
  if (!salonAiUrl) return;
  fetchBtn.disabled = true;
  fetchStatus.textContent = '取得中...';
  try {
    const res = await fetch(`${salonAiUrl}/api/latest-tags`, { cache: 'no-store' });
    if (!res.ok) {
      fetchStatus.textContent = '⚠ タグがありません。AIツールでHPBコンテンツを先に生成してください';
      return;
    }
    const data = await res.json();
    if (!data?.tags) {
      fetchStatus.textContent = '⚠ タグがありません';
      return;
    }
    chrome.storage.local.set({ aiTagsData: data });
    renderTags(data);
    const count = Object.values(data.tags).flat().length;
    fetchStatus.textContent = `✓ ${count}個のタグを取得しました`;
    setTimeout(() => { fetchStatus.textContent = ''; }, 3000);
  } catch {
    fetchStatus.textContent = '⚠ 接続できません。AIツールが起動しているか確認してください';
  } finally {
    fetchBtn.disabled = false;
  }
}

function renderTags(data) {
  const tags = data.tags || {};
  const hasAny = Object.values(tags).some(arr => arr.length > 0);
  if (!hasAny) return;

  emptyState.style.display = 'none';
  tagsArea.style.display = 'block';
  if (data.styleTitle) aiMeta.textContent = `「${data.styleTitle}」のタグ`;

  tagCategories.innerHTML = '';
  const ORDER = ['trend', 'length', 'color', 'image', 'face', 'area'];
  const sorted = [...ORDER.filter(k => tags[k]?.length), ...Object.keys(tags).filter(k => !ORDER.includes(k) && tags[k]?.length)];
  for (const key of sorted) {
    const arr = tags[key];
    if (!arr?.length) continue;
    const section = document.createElement('div');
    section.className = 'category';
    const label = document.createElement('div');
    label.className = 'cat-label';
    label.textContent = CAT_LABELS[key] || key;
    const row = document.createElement('div');
    row.className = 'tag-row';
    arr.forEach(t => row.appendChild(makeChip(t, key === 'trend')));
    section.appendChild(label);
    section.appendChild(row);
    tagCategories.appendChild(section);
  }
}

function makeChip(label, isTrend = false) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (isTrend ? ' chip-trend' : '');
  btn.textContent = label;
  btn.addEventListener('click', () => handleClick(label, btn));
  return btn;
}

async function handleClick(label, chip) {
  if (mode === 'fill' && isHpbPage) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_TAG', tag: label }, (res) => {
      if (res?.success) {
        flash(chip); showToast(`「${label}」を入力しました`);
      } else {
        copyText(label); showToast(`「${label}」をコピーしました（入力欄を先に選択してください）`);
      }
    });
  } else {
    copyText(label); flash(chip); showToast(`「${label}」をコピーしました`);
  }
}

function copyText(text) { navigator.clipboard.writeText(text).catch(() => {}); }

function flash(chip) {
  chip.classList.add('done');
  setTimeout(() => chip.classList.remove('done'), 700);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
