(() => {
  if (document.getElementById('__hpb-tag-helper__')) return;

  // Shadow DOM でスタイル隔離
  const host = document.createElement('div');
  host.id = '__hpb-tag-helper__';
  Object.assign(host.style, { position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647' });
  (document.body || document.documentElement).appendChild(host);

  // HPBのSPAがbodyを書き換えてもパネルを維持する
  new MutationObserver(() => {
    if (!document.contains(host)) {
      (document.body || document.documentElement).appendChild(host);
    }
  }).observe(document.documentElement, { childList: true, subtree: false });
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .panel {
      background: #fff;
      border: 1px solid #e2ddd8;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.14);
      width: 280px;
      font-family: 'Hiragino Sans','Noto Sans JP',sans-serif;
    }
    .panel.minimized .body { display: none; }
    .panel-header {
      background: #b8906a; color: #fff;
      padding: 9px 12px;
      display: flex; align-items: center; justify-content: space-between;
      cursor: move; user-select: none;
      border-radius: 14px 14px 0 0;
    }
    .panel-title { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
    .hbtns { display: flex; gap: 4px; }
    .hbtn {
      background: rgba(255,255,255,0.25); border: none; border-radius: 4px;
      color: #fff; font-size: 11px; padding: 2px 7px; cursor: pointer; font-family: inherit;
    }
    .hbtn:hover { background: rgba(255,255,255,0.4); }
    .body { padding: 12px; max-height: 420px; overflow-y: auto; }

    /* 一括入力ボタン */
    .fill-all-btn {
      width: 100%;
      background: #b8906a; color: #fff;
      border: none; border-radius: 10px;
      padding: 11px;
      font-size: 13px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: background 0.15s;
      margin-bottom: 8px;
    }
    .fill-all-btn:hover { background: #a07858; }
    .fill-all-btn:active { transform: scale(0.97); }
    .fill-all-btn:disabled { background: #d0c0b0; cursor: default; }

    .status {
      font-size: 11px; text-align: center; padding: 4px 0 8px;
      min-height: 20px; color: #b8906a;
      border-bottom: 1px solid #f0ebe5;
      margin-bottom: 8px;
    }
    .status.error { color: #c07050; }

    .meta {
      font-size: 11px; color: #b8906a; font-weight: 600;
      margin-bottom: 6px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .refresh {
      background: none; border: 1px solid #e2ddd8; border-radius: 4px;
      color: #b8906a; font-size: 10px; padding: 2px 6px; cursor: pointer; font-family: inherit;
    }
    .refresh:hover { background: #f5ede4; }
    .cat-label {
      font-size: 10px; font-weight: 600; color: #aaa;
      letter-spacing: 0.07em; margin: 8px 0 4px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 2px; }
    .chip {
      background: #faf9f7; border: 1px solid #e2ddd8; border-radius: 12px;
      padding: 4px 10px; font-size: 11px; color: #4a4540;
      cursor: pointer; font-family: inherit; transition: all 0.1s;
    }
    .chip:hover { background: #f5ede4; border-color: #b8906a; color: #8a5c38; }
    .chip.ok { background: #b8906a; border-color: #b8906a; color: #fff; }
    .chip.fail { background: #f0f0f0; border-color: #ccc; color: #bbb; text-decoration: line-through; }
    .empty { font-size: 11px; color: #bbb; line-height: 1.8; padding: 8px 0; text-align: center; }
    .hint { font-size: 10px; color: #ccc; margin-top: 10px; text-align: center; line-height: 1.6; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header" id="drag">
      <span class="panel-title">📌 HPB タグ入力支援</span>
      <div class="hbtns">
        <button class="hbtn" id="refresh-btn" title="タグを再読み込み">↺</button>
        <button class="hbtn" id="min-btn">−</button>
        <button class="hbtn" id="close-btn">✕</button>
      </div>
    </div>
    <div class="body" id="body">
      <button class="fill-all-btn" id="fill-all-btn" style="display:none">
        🚀 すべてのタグを一括入力
      </button>
      <div class="status" id="status" style="display:none"></div>
      <div id="meta" class="meta" style="display:none">
        <span id="meta-title"></span>
        <button class="refresh" id="refresh-inline">↺ 更新</button>
      </div>
      <div id="categories"></div>
      <div id="empty" class="empty">
        サロンAIツールでHPBコンテンツを生成後<br>
        拡張アイコン →「最新タグを取得」を押してください
      </div>
      <p class="hint" id="hint" style="display:none">
        個別にクリックして1つずつ入力することもできます
      </p>
    </div>
  `;
  shadow.appendChild(panel);

  // ドラッグ
  let dragging = false, sx = 0, sy = 0, sr = 24, sb = 24;
  shadow.getElementById('drag').addEventListener('mousedown', e => {
    dragging = true; sx = e.clientX; sy = e.clientY;
    sr = parseInt(host.style.right) || 24; sb = parseInt(host.style.bottom) || 24;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    host.style.right  = Math.max(0, sr - (e.clientX - sx)) + 'px';
    host.style.bottom = Math.max(0, sb - (e.clientY - sy)) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  shadow.getElementById('min-btn').addEventListener('click', () => {
    panel.classList.toggle('minimized');
    shadow.getElementById('min-btn').textContent = panel.classList.contains('minimized') ? '+' : '−';
  });
  shadow.getElementById('close-btn').addEventListener('click', () => host.remove());
  shadow.getElementById('refresh-btn').addEventListener('click', loadTags);
  shadow.getElementById('refresh-inline').addEventListener('click', loadTags);

  // 一括入力ボタン
  shadow.getElementById('fill-all-btn').addEventListener('click', fillAllTags);

  const CAT_LABELS = {
    trend: '📸 トレンドタグ', length: '長さ', color: 'カラー',
    image: 'イメージ', face: '顔型', area: 'エリア・駅名',
  };
  const CAT_ORDER = ['trend', 'length', 'color', 'image', 'face', 'area'];

  let currentTags = [];

  function loadTags() {
    chrome.storage.local.get(['aiTagsData'], (data) => renderTags(data.aiTagsData));
  }

  function renderTags(data) {
    const categoriesEl = shadow.getElementById('categories');
    const emptyEl      = shadow.getElementById('empty');
    const metaEl       = shadow.getElementById('meta');
    const metaTitleEl  = shadow.getElementById('meta-title');
    const fillAllBtn   = shadow.getElementById('fill-all-btn');
    const hintEl       = shadow.getElementById('hint');

    categoriesEl.innerHTML = '';
    currentTags = [];

    const tags = data?.tags || {};
    const hasAny = Object.values(tags).some(a => a?.length > 0);

    if (!hasAny) {
      emptyEl.style.display = 'block';
      metaEl.style.display = 'none';
      fillAllBtn.style.display = 'none';
      hintEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    metaEl.style.display = 'flex';
    fillAllBtn.style.display = 'block';
    hintEl.style.display = 'block';
    metaTitleEl.textContent = data.styleTitle ? `「${data.styleTitle}」` : 'AIが生成したタグ';

    // カテゴリを順序通りに表示
    const keys = [...CAT_ORDER.filter(k => tags[k]?.length), ...Object.keys(tags).filter(k => !CAT_ORDER.includes(k) && tags[k]?.length)];
    for (const key of keys) {
      const arr = tags[key];
      if (!arr?.length) continue;
      currentTags.push(...arr);

      const label = document.createElement('div');
      label.className = 'cat-label';
      label.textContent = CAT_LABELS[key] || key;

      const chips = document.createElement('div');
      chips.className = 'chips';
      arr.forEach(t => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = t;
        chip.dataset.tag = t;
        chip.addEventListener('click', () => insertSingleTag(t, chip));
        chips.appendChild(chip);
      });

      categoriesEl.appendChild(label);
      categoriesEl.appendChild(chips);
    }
  }

  // ─── 一括入力 ───────────────────────────────────────────
  async function fillAllTags() {
    if (!currentTags.length) return;

    const btn = shadow.getElementById('fill-all-btn');
    const statusEl = shadow.getElementById('status');
    btn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.className = 'status';
    statusEl.textContent = '入力中...';

    let filled = 0;
    const failed = [];

    // 入力欄があればフォーカス固定＋Enterで連続入力、なければクリック方式
    const inputEl = findTagInput() || lastInput;

    for (const tag of currentTags) {
      let ok = false;
      if (inputEl) {
        fillInput(inputEl, tag);
        ok = true;
        await sleep(450); // HPBの追加処理を待つ
      } else {
        ok = tryClickTagOnPage(tag);
        await sleep(200);
      }

      if (ok) {
        filled++;
        markChip(tag, 'ok');
      } else {
        failed.push(tag);
        markChip(tag, 'fail');
      }
    }

    if (failed.length === 0) {
      statusEl.textContent = `✓ ${filled}個のタグをすべて入力しました`;
    } else if (filled > 0) {
      statusEl.textContent = `✓ ${filled}個入力 / ${failed.length}個はページ上に見つかりませんでした`;
      statusEl.className = 'status error';
    } else {
      statusEl.textContent = 'タグ選択欄が見つかりません。HPBのスタイル編集ページで使用してください';
      statusEl.className = 'status error';
    }

    btn.disabled = false;
  }

  /**
   * HPBページ上で tag と一致するクリック可能な要素を探してクリックする。
   * HPBのタグ選択UIは「タグ名が書かれたラベル or ボタン」の形式が多い。
   */
  function tryClickTagOnPage(tag) {
    const clean = tag.replace(/\s/g, '');

    // 候補となりうる要素（タグ選択欄でよく使われるもの）
    const selectors = [
      'label', 'button', '[role="checkbox"]', '[role="button"]',
      'li', '.tag', '[class*="tag"]', '[class*="Tag"]',
      '[class*="chip"]', '[class*="Chip"]', 'span',
    ];

    let bestEl = null;
    let bestScore = 0;

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!isVisible(el)) continue;
        const text = el.textContent.trim().replace(/\s/g, '');
        if (text === clean) {
          // 完全一致
          const score = scoreElement(el);
          if (score > bestScore) { bestEl = el; bestScore = score; }
        } else if (clean.length >= 2 && text.includes(clean)) {
          // 部分一致（短すぎるタグは誤クリック防止のためスキップ）
          const score = scoreElement(el) - 1;
          if (score > bestScore) { bestEl = el; bestScore = score; }
        }
      }
    }

    if (bestEl) {
      bestEl.click();
      // チェックボックスの場合は直接 checked にもする
      const cb = bestEl.querySelector('input[type="checkbox"]') || (bestEl.tagName === 'INPUT' ? bestEl : null);
      if (cb && !cb.checked) cb.click();
      return true;
    }
    return false;
  }

  /** クリックしたい要素らしさのスコア（高いほど優先） */
  function scoreElement(el) {
    let score = 0;
    const cls = (el.className || '').toLowerCase();
    const tag = el.tagName;
    if (tag === 'LABEL') score += 3;
    if (tag === 'BUTTON') score += 2;
    if (cls.includes('tag') || cls.includes('chip')) score += 2;
    if (cls.includes('select') || cls.includes('check')) score += 1;
    // 小さな要素（テキストだけのラベル）を優先
    if (el.textContent.trim().length < 15) score += 1;
    return score;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function markChip(tag, cls) {
    const chip = shadow.querySelector(`.chip[data-tag="${CSS.escape(tag)}"]`);
    if (chip) { chip.className = `chip ${cls}`; }
  }

  // ─── 個別入力（補助機能）───────────────────────────────
  let lastInput = null;
  document.addEventListener('focus', e => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') lastInput = e.target;
  }, true);

  function insertSingleTag(tag, chip) {
    // まずHPBページ上に同名要素があればクリック
    if (tryClickTagOnPage(tag)) {
      chip.className = 'chip ok';
      setTimeout(() => chip.className = 'chip', 700);
      return;
    }
    // なければフォーカスされた入力欄に直接入力
    const el = lastInput || findTagInput();
    if (el) {
      fillInput(el, tag);
      chip.className = 'chip ok';
      setTimeout(() => chip.className = 'chip', 700);
    } else {
      navigator.clipboard.writeText(tag).catch(() => {});
      chip.className = 'chip ok';
      setTimeout(() => chip.className = 'chip', 700);
    }
  }

  function fillInput(el, value) {
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown',  { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup',    { key: 'Enter', bubbles: true }));
  }

  function findTagInput() {
    for (const sel of ['input[name*="tag"]', 'input[placeholder*="タグ"]', '[class*="tag"] input[type="text"]']) {
      const el = document.querySelector(sel);
      if (el?.offsetParent) return el;
    }
    return null;
  }

  // 初回読み込み
  loadTags();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.aiTagsData) renderTags(changes.aiTagsData.newValue);
  });

  // popup からのメッセージ対応
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FILL_TAG') return;
    const ok = tryClickTagOnPage(msg.tag) || !!lastInput;
    if (!ok) navigator.clipboard.writeText(msg.tag).catch(() => {});
    else if (!tryClickTagOnPage(msg.tag)) fillInput(lastInput, msg.tag);
    sendResponse({ success: ok });
    return true;
  });
})();
