"use client";
import { useState, useRef, useCallback } from "react";
import { callClaude, fileToBase64 } from "../lib/claude";

const OUTPUT_TABS = [
  { id: "instagram", label: "Instagram", color: "#b8906a" },
  { id: "blog",      label: "ブログ",    color: "#6a82a8" },
  { id: "hotpepper", label: "HPB",       color: "#a87858" },
];

const STYLE_OPTIONS = ["カット","カラー","パーマ","縮毛矯正","トリートメント","ヘッドスパ","ブリーチ","髪質改善"];
const TARGET_OPTIONS = ["20代女性","30代女性","40代女性","50代以上","メンズ","学生","OL・会社員","主婦"];
const SEASON_OPTIONS = ["春","夏","秋","冬"];

const PROMPTS = {
  instagram: (info, hasImg) => `あなたはプロの美容サロンSNSマーケターです。以下のサロン情報${hasImg ? "と添付スタイル写真" : ""}をもとに、Instagram投稿文を作成してください。

サロン情報:
${info}

要件:
- 投稿本文: 150〜200文字、読みやすく改行多め、絵文字を効果的に使用
- キャッチコピー1行（冒頭）
- ハッシュタグ: 20〜25個（日本語・英語混在、HPB集客向け＋インスタ映え系）

JSONのみで返答（バッククォート不要）:
{"catchcopy":"","body":"（改行は\\nで表現）","hashtags":["#タグ"]}`,

  blog: (info, hasImg) => `あなたはプロの美容サロンブログライターです。以下のサロン情報${hasImg ? "と添付スタイル写真" : ""}をもとに、SEOに強いサロンブログ記事を作成してください。

サロン情報:
${info}

要件: タイトル/リード文80字/見出し3〜4個・各100〜150字/まとめCTA付き/全体600〜800字

JSONのみ（バッククォート不要）:
{"title":"","lead":"","sections":[{"heading":"","body":""}],"closing":""}`,

  hotpepper: (info, hasImg) => `あなたはホットペッパービューティーの掲載最適化専門家です。以下のサロン情報${hasImg ? "と添付スタイル写真" : ""}をもとに、HPBスタイル登録用テキスト一式を作成してください。

サロン情報:
${info}

要件: スタイルタイトル30字以内/説明文200〜250字/おすすめポイント3項目40字以内/HPB準拠タグ

JSONのみ（バッククォート不要）:
{"styleTitle":"","description":"","points":["","",""],"tags":{"length":[],"color":[],"image":[],"face":[]}}`,
};

const BRAND_PROMPT = (info) => `あなたはブランドストラテジストです。以下のサロン情報を分析し、全媒体共通のブランドの方向性を定義してください。

サロン情報:
${info}

JSONのみで返答（バッククォート不要）:
{"tone":"例：親しみやすくプロフェッショナル","keywords":["キーワード1","キーワード2","キーワード3"],"targetAppeal":"ターゲット層への主な訴求ポイント一文","styleNote":"文章・表現スタイルの具体的な指示"}`;

const REVIEW_PROMPTS = {
  instagram: (json) => `あなたはプロの美容サロンSNSマーケターです。以下のInstagram投稿文をレビューし、品質を評価してください。

投稿内容:
${json}

評価基準: 文章の自然さ・集客訴求力・媒体特性への適合度・ハッシュタグの有効性

JSONのみで返答（バッククォート不要）:
{"score":4,"good":"良い点を一文で","improve":"改善提案（問題なければnull）"}`,

  blog: (json) => `あなたはプロの美容サロンブログライターです。以下のブログ記事をレビューし、品質を評価してください。

記事内容:
${json}

評価基準: SEO適合度・読みやすさ・情報量・予約への誘導力

JSONのみで返答（バッククォート不要）:
{"score":4,"good":"良い点を一文で","improve":"改善提案（問題なければnull）"}`,

  hotpepper: (json) => `あなたはホットペッパービューティーの掲載最適化専門家です。以下のHPBコンテンツをレビューし、品質を評価してください。

コンテンツ:
${json}

評価基準: タイトルのインパクト・説明文の訴求力・ポイントの明確さ・タグの網羅性

JSONのみで返答（バッククォート不要）:
{"score":4,"good":"良い点を一文で","improve":"改善提案（問題なければnull）"}`,
};

export default function ContentGenerator({ apiKey, onChangeKey }) {
  const [salonName, setSalonName]           = useState("");
  const [treatment, setTreatment]           = useState("");
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [targetAge, setTargetAge]           = useState("");
  const [season, setSeason]                 = useState("");
  const [freeText, setFreeText]             = useState("");
  const [image, setImage]                   = useState(null);
  const [imageBase64, setImageBase64]       = useState(null);
  const [dragging, setDragging]             = useState(false);
  const fileRef = useRef();

  const [activeTab, setActiveTab]           = useState("instagram");
  const [results, setResults]               = useState({});
  const [loading, setLoading]               = useState({});
  const [errors, setErrors]                 = useState({});
  const [copied, setCopied]                 = useState("");
  const [generating, setGenerating]         = useState(false);

  const [brandAnalysis, setBrandAnalysis]   = useState(null);
  const [analyzingBrand, setAnalyzingBrand] = useState(false);

  const [reviews, setReviews]               = useState({});
  const [reviewing, setReviewing]           = useState({});

  const [fixedHashtags, setFixedHashtags]   = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("fixedHashtags") || "";
  });
  const [templates, setTemplates]           = useState(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("salonTemplates") || "[]");
  });
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName]     = useState("");

  const [history, setHistory]               = useState(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("generationHistory") || "[]");
  });
  const [showHistory, setShowHistory]       = useState(false);

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file));
    fileToBase64(file).then(setImageBase64);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const toggleStyle = (s) =>
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const buildInfo = () => [
    salonName    && `サロン名: ${salonName}`,
    treatment    && `施術内容: ${treatment}`,
    selectedStyles.length && `施術種別: ${selectedStyles.join("・")}`,
    targetAge    && `ターゲット: ${targetAge}`,
    season       && `季節: ${season}`,
    freeText     && `こだわり: ${freeText}`,
  ].filter(Boolean).join("\n");

  const isReady = salonName.trim() && treatment.trim();

  const analyzeBrand = async () => {
    try {
      const { clean } = await callClaude({
        apiKey, maxTokens: 600,
        messages: [{ role: "user", content: [{ type: "text", text: BRAND_PROMPT(buildInfo()) }] }],
      });
      return JSON.parse(clean);
    } catch { return null; }
  };

  const reviewOne = async (tabId, result) => {
    setReviewing(p => ({ ...p, [tabId]: true }));
    try {
      const { clean } = await callClaude({
        apiKey, maxTokens: 400,
        messages: [{ role: "user", content: [{ type: "text", text: REVIEW_PROMPTS[tabId](JSON.stringify(result)) }] }],
      });
      setReviews(p => ({ ...p, [tabId]: JSON.parse(clean) }));
    } catch { }
    finally { setReviewing(p => ({ ...p, [tabId]: false })); }
  };

  const generateOne = async (tabId, brand = null) => {
    const info = buildInfo();
    const brandNote = brand
      ? `\n\n【ブランドの方向性】\nトーン: ${brand.tone}\nキーワード: ${brand.keywords?.join("・")}\n訴求: ${brand.targetAppeal}\n${brand.styleNote}`
      : "";
    setLoading(p => ({ ...p, [tabId]: true }));
    setErrors(p => ({ ...p, [tabId]: null }));
    setReviews(p => ({ ...p, [tabId]: null }));
    const promptText = PROMPTS[tabId](info + brandNote, !!imageBase64);
    const content = imageBase64
      ? [
          { type: "image", source: { type: "base64", media_type: imageBase64.mediaType, data: imageBase64.data } },
          { type: "text", text: promptText },
        ]
      : [{ type: "text", text: promptText }];
    try {
      const { clean } = await callClaude({ apiKey, messages: [{ role: "user", content }] });
      const result = JSON.parse(clean);
      setResults(p => ({ ...p, [tabId]: result }));
      reviewOne(tabId, result);
      return result;
    } catch (e) {
      setErrors(p => ({ ...p, [tabId]: e.message || "生成に失敗しました" }));
      return null;
    } finally {
      setLoading(p => ({ ...p, [tabId]: false }));
    }
  };

  const generateAll = async () => {
    if (!isReady) return;
    setGenerating(true);
    setResults({});
    setErrors({});
    setReviews({});
    setAnalyzingBrand(true);
    const brand = await analyzeBrand();
    setBrandAnalysis(brand);
    setAnalyzingBrand(false);
    const allResults = {};
    await Promise.all(
      OUTPUT_TABS.map(async (t) => {
        const result = await generateOne(t.id, brand);
        if (result) allResults[t.id] = result;
      })
    );
    if (Object.keys(allResults).length > 0) {
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        input: { salonName, treatment, selectedStyles, targetAge, season, freeText, fixedHashtags },
        brandAnalysis: brand,
        results: allResults,
      };
      setHistory(prev => {
        const updated = [entry, ...prev].slice(0, 30);
        localStorage.setItem("generationHistory", JSON.stringify(updated));
        return updated;
      });
    }
    setGenerating(false);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id); setTimeout(() => setCopied(""), 2000);
    });
  };

  const handleFixedHashtagsChange = (val) => {
    setFixedHashtags(val);
    localStorage.setItem("fixedHashtags", val);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate = {
      id: Date.now(),
      name: templateName.trim(),
      data: { salonName, treatment, selectedStyles, targetAge, season, freeText, fixedHashtags },
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem("salonTemplates", JSON.stringify(updated));
    setTemplateName("");
    setShowTemplateSave(false);
  };

  const loadTemplate = (t) => {
    setSalonName(t.data.salonName || "");
    setTreatment(t.data.treatment || "");
    setSelectedStyles(t.data.selectedStyles || []);
    setTargetAge(t.data.targetAge || "");
    setSeason(t.data.season || "");
    setFreeText(t.data.freeText || "");
    handleFixedHashtagsChange(t.data.fixedHashtags || "");
  };

  const deleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem("salonTemplates", JSON.stringify(updated));
  };

  const loadFromHistory = (entry) => {
    setSalonName(entry.input.salonName || "");
    setTreatment(entry.input.treatment || "");
    setSelectedStyles(entry.input.selectedStyles || []);
    setTargetAge(entry.input.targetAge || "");
    setSeason(entry.input.season || "");
    setFreeText(entry.input.freeText || "");
    handleFixedHashtagsChange(entry.input.fixedHashtags || "");
    setResults(entry.results || {});
    setBrandAnalysis(entry.brandAnalysis || null);
    setReviews({});
    setErrors({});
    setActiveTab("instagram");
    setShowHistory(false);
  };

  const renderInstagram = (r) => {
    const fixedTags = fixedHashtags.trim()
      ? fixedHashtags.trim().split(/[\s　]+/).filter(t => t)
      : [];
    const allHashtags = [...(r.hashtags || []), ...fixedTags];
    const full = `${r.catchcopy}\n\n${r.body}\n\n${allHashtags.join(" ")}`;
    return (
      <div>
        <div style={S.card}>
          <div style={S.igCatch}>{r.catchcopy}</div>
          <div style={S.igBody}>{r.body?.split("\\n").map((l, i) => <div key={i}>{l || <br />}</div>)}</div>
          <div style={S.igTags}>{allHashtags.join(" ")}</div>
        </div>
        <ReviewBadge review={reviews.instagram} reviewing={!!reviewing.instagram} />
        <CopyBtn text={full} id="ig" copied={copied} onCopy={handleCopy} />
      </div>
    );
  };

  const renderBlog = (r) => {
    const full = `【${r.title}】\n\n${r.lead}\n\n${r.sections?.map(s => `■${s.heading}\n${s.body}`).join("\n\n")}\n\n${r.closing}`;
    return (
      <div>
        <div style={S.card}>
          <div style={S.blogTitle}>{r.title}</div>
          <div style={S.blogLead}>{r.lead}</div>
          {r.sections?.map((s, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={S.blogH}>— {s.heading}</div>
              <div style={S.bodyText}>{s.body}</div>
            </div>
          ))}
          <div style={S.blogClosing}>{r.closing}</div>
        </div>
        <ReviewBadge review={reviews.blog} reviewing={!!reviewing.blog} />
        <CopyBtn text={full} id="blog" copied={copied} onCopy={handleCopy} />
      </div>
    );
  };

  const renderHPB = (r) => {
    const tagsFlat = r.tags ? Object.values(r.tags).flat().join("　") : "";
    const full = `【${r.styleTitle}】\n\n${r.description}\n\n▶ おすすめポイント\n${r.points?.map((p, i) => `${i+1}. ${p}`).join("\n")}\n\nタグ: ${tagsFlat}`;
    return (
      <div>
        <div style={S.card}>
          <div style={S.hpbTitle}>{r.styleTitle}</div>
          <div style={S.bodyText}>{r.description}</div>
          <div style={{ margin: "14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {r.points?.map((p, i) => (
              <div key={i} style={S.hpbPoint}>
                <span style={S.hpbNum}>{i+1}</span>{p}
              </div>
            ))}
          </div>
          {r.tags && (
            <div style={{ borderTop: "1px solid #ece8e2", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(r.tags).map(([cat, arr]) => arr?.length > 0 && (
                <div key={cat} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={S.tagCat}>{cat}</span>
                  {arr.map(t => <span key={t} style={S.tagChip}>{t}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
        <ReviewBadge review={reviews.hotpepper} reviewing={!!reviewing.hotpepper} />
        <CopyBtn text={full} id="hpb" copied={copied} onCopy={handleCopy} />
      </div>
    );
  };

  const RENDERERS = { instagram: renderInstagram, blog: renderBlog, hotpepper: renderHPB };

  const btnLabel = analyzingBrand
    ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={S.spinner} />ブランド分析中</span>
    : generating
      ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={S.spinner} />生成中</span>
      : "3媒体まとめて生成";

  return (
    <div style={S.root}>
      <div style={S.container}>
        <div style={S.header}>
          <p style={S.headerEn}>SALON CONTENT STUDIO</p>
          <h1 style={S.headerJa}>集客コンテンツ<span style={S.accentText}>一括生成</span></h1>
          <p style={S.headerSub}>Instagram · ブログ · ホットペッパーを同時に作成</p>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginTop:16 }}>
            <button style={S.ghostBtn} onClick={onChangeKey}>APIキーを変更</button>
            <button style={S.ghostBtn} onClick={() => setShowHistory(true)}>
              履歴{history.length > 0 ? `  ${history.length}` : ""}
            </button>
          </div>
        </div>

        <div style={S.layout}>
          {/* INPUT */}
          <div style={S.inputPanel}>
            {templates.length > 0 && (
              <div style={S.templateSection}>
                <div style={S.templateLabel}>テンプレート</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {templates.map(t => (
                    <div key={t.id} style={S.templateChipWrap}>
                      <button style={S.templateChip} onClick={() => loadTemplate(t)}>{t.name}</button>
                      <button style={S.templateDel} onClick={() => deleteTemplate(t.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Inp label="サロン名" required>
              <input style={S.input} placeholder="例：Hair Salon Bloom" value={salonName} onChange={e => setSalonName(e.target.value)} />
            </Inp>
            <Inp label="施術内容・スタイルの特徴" required>
              <textarea style={S.textarea} rows={3} placeholder="例：透明感のあるミルクティーベージュ。ブリーチなしで明るく仕上げました。" value={treatment} onChange={e => setTreatment(e.target.value)} />
            </Inp>
            <Inp label="施術種別">
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {STYLE_OPTIONS.map(s => (
                  <button key={s} style={{ ...S.chip, ...(selectedStyles.includes(s) ? S.chipActive : {}) }} onClick={() => toggleStyle(s)}>{s}</button>
                ))}
              </div>
            </Inp>
            <div style={{ display:"flex", gap:10 }}>
              <Inp label="ターゲット" style={{ flex:1 }}>
                <select style={S.select} value={targetAge} onChange={e => setTargetAge(e.target.value)}>
                  <option value="">選択</option>
                  {TARGET_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Inp>
              <Inp label="季節" style={{ flex:1 }}>
                <select style={S.select} value={season} onChange={e => setSeason(e.target.value)}>
                  <option value="">選択</option>
                  {SEASON_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Inp>
            </div>
            <Inp label="こだわり・補足">
              <textarea style={S.textarea} rows={2} placeholder="例：骨格補正、再現性が高い、自宅で簡単スタイリング..." value={freeText} onChange={e => setFreeText(e.target.value)} />
            </Inp>
            <Inp label="固定ハッシュタグ（Instagram に毎回追加）">
              <textarea style={S.textarea} rows={2} placeholder="例：#新宿美容院 #西新宿 #新宿駅" value={fixedHashtags} onChange={e => handleFixedHashtagsChange(e.target.value)} />
            </Inp>

            {showTemplateSave ? (
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...S.input, flex:1 }} placeholder="テンプレート名" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveTemplate()} />
                <button style={S.tplSaveBtn} onClick={saveTemplate}>保存</button>
                <button style={S.tplCancelBtn} onClick={() => setShowTemplateSave(false)}>×</button>
              </div>
            ) : (
              <button style={S.tplOpenBtn} onClick={() => setShowTemplateSave(true)}>+ 入力をテンプレートに保存</button>
            )}

            <Inp label="スタイル写真（任意）">
              <div style={{ ...S.drop, ...(dragging ? S.dropDrag : {}), ...(image ? S.dropFilled : {}) }}
                onClick={() => !image && fileRef.current.click()}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}>
                {image ? (
                  <div style={{ width:"100%", height:"100%", position:"relative" }}>
                    <img src={image} alt="style" style={S.previewImg} />
                    <button style={S.removeBtn} onClick={e => { e.stopPropagation(); setImage(null); setImageBase64(null); }}>×</button>
                  </div>
                ) : (
                  <div style={{ textAlign:"center" }}>
                    <div style={S.dropIcon}>+</div>
                    <div style={{ color:"#b0a89e", fontSize:12 }}>写真をドロップ または クリック</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => processFile(e.target.files[0])} />
            </Inp>

            <button
              style={{ ...S.genBtn, ...(!isReady || generating || analyzingBrand ? S.genBtnOff : {}) }}
              onClick={generateAll}
              disabled={!isReady || generating || analyzingBrand}>
              {btnLabel}
            </button>
            {!isReady && <p style={{ color:"#c0b8b0", fontSize:11, textAlign:"center", marginTop:4 }}>サロン名と施術内容を入力してください</p>}
          </div>

          {/* OUTPUT */}
          <div style={S.outputPanel}>
            {brandAnalysis && (
              <div style={S.brandBadge}>
                <span style={S.brandLabel}>ブランド分析</span>
                <span style={S.brandTone}>{brandAnalysis.tone}</span>
                {brandAnalysis.keywords?.map(k => (
                  <span key={k} style={S.brandKeyword}>{k}</span>
                ))}
              </div>
            )}

            <div style={S.tabs}>
              {OUTPUT_TABS.map(t => {
                const done = !!results[t.id];
                const ld   = !!loading[t.id];
                const err  = !!errors[t.id];
                return (
                  <button key={t.id}
                    style={{ ...S.tab, ...(activeTab === t.id ? { ...S.tabActive, borderTopColor: t.color } : {}) }}
                    onClick={() => setActiveTab(t.id)}>
                    {t.label}
                    {ld   && <span style={S.tabSpinner} />}
                    {done && !ld && <span style={{ ...S.tabDot, background: t.color }} />}
                    {err  && !ld && <span style={{ ...S.tabDot, background: "#d07070" }} />}
                  </button>
                );
              })}
            </div>
            <div style={S.outputBox}>
              {(() => {
                const tab = OUTPUT_TABS.find(t => t.id === activeTab);
                const res = results[activeTab];
                const err = errors[activeTab];
                const ld  = loading[activeTab];
                if (ld) return <Center><Dots color={tab.color} /><p style={{ color:"#b0a89e", fontSize:13, marginTop:16 }}>{tab.label}を生成中...</p></Center>;
                if (err) return (
                  <div style={S.errorBox}>
                    {err}
                    <button style={S.retryBtn} onClick={() => generateOne(activeTab, brandAnalysis)}>再試行</button>
                  </div>
                );
                if (!res && !Object.keys(results).length) return (
                  <Center>
                    <div style={S.emptyIcon}>+</div>
                    <p style={{ color:"#a09890", fontSize:14, lineHeight:2, marginBottom:20 }}>左のフォームを入力して<br />「3媒体まとめて生成」を押してください</p>
                    {OUTPUT_TABS.map(t => <div key={t.id} style={{ color:"#c8c0b8", fontSize:12, marginBottom:4 }}>{t.label}</div>)}
                  </Center>
                );
                if (!res) return (
                  <Center>
                    <p style={{ color:"#a09890", fontSize:13, marginBottom:12 }}>このタブはまだ生成されていません</p>
                    <button style={S.retryBtn} onClick={() => generateOne(activeTab, brandAnalysis)}>単体で生成</button>
                  </Center>
                );
                return RENDERERS[activeTab]?.(res);
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={S.historyOverlay} onClick={() => setShowHistory(false)}>
          <div style={S.historyPanel} onClick={e => e.stopPropagation()}>
            <div style={S.historyHeader}>
              <span style={S.historyTitle}>生成履歴</span>
              <button style={S.historyClose} onClick={() => setShowHistory(false)}>×</button>
            </div>
            {history.length === 0 ? (
              <div style={S.historyEmpty}>まだ履歴がありません</div>
            ) : history.map(entry => (
              <div key={entry.id} style={S.historyEntry}>
                <div style={S.historyDate}>{new Date(entry.date).toLocaleString("ja-JP")}</div>
                <div style={S.historySalon}>{entry.input.salonName || "（サロン名なし）"}</div>
                <div style={S.historyTreatment}>{(entry.input.treatment || "").slice(0, 40)}{(entry.input.treatment || "").length > 40 ? "..." : ""}</div>
                <button style={S.historyLoad} onClick={() => loadFromHistory(entry)}>読み込む</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Inp({ label, required, children, style }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, ...style }}>
      <label style={{ color:"#8a8078", fontSize:11, fontWeight:700, letterSpacing:"0.08em" }}>
        {label}{required && <span style={{ color:"#c07070", fontSize:10, marginLeft:4 }}>必須</span>}
      </label>
      {children}
    </div>
  );
}

function CopyBtn({ text, id, copied, onCopy }) {
  const done = copied === id;
  return (
    <button style={{ ...S.copyBtn, ...(done ? S.copyBtnDone : {}) }} onClick={() => onCopy(text, id)}>
      {done ? "コピーしました" : "テキストをコピー"}
    </button>
  );
}

function Center({ children }) {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center" }}>{children}</div>;
}

function Dots({ color }) {
  return (
    <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
      {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background: color, animation:"bounce 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s` }} />)}
    </div>
  );
}

function ReviewBadge({ review, reviewing }) {
  if (reviewing) return (
    <div style={S.reviewLoading}>
      <span style={S.reviewSpinner} />
      AIがレビュー中...
    </div>
  );
  if (!review) return null;
  const good = review.score >= 4;
  return (
    <div style={{ ...S.reviewBadge, borderColor: good ? "#b8d8c4" : "#e0d498", background: good ? "#f4faf6" : "#fdfbee" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ color: good ? "#5a8a6a" : "#9a8030", fontSize:11, fontWeight:700 }}>
          {good ? "✓" : "!"} {review.score}/5
        </span>
        <span style={{ color: good ? "#6a9a7a" : "#a09040", fontSize:12 }}>{review.good}</span>
      </div>
      {review.improve && (
        <div style={{ color:"#9a8848", fontSize:11, lineHeight:1.6, marginTop:4 }}>改善提案 — {review.improve}</div>
      )}
    </div>
  );
}

const S = {
  root: { minHeight:"100vh", background:"#f8f6f2", fontFamily:"'Noto Sans JP', sans-serif", color:"#1e1b18" },
  container: { maxWidth:1120, margin:"0 auto", padding:"40px 24px" },
  header: { textAlign:"center", marginBottom:40 },
  headerEn: { fontSize:10, color:"#c0b8b0", letterSpacing:"0.5em", marginBottom:10, fontWeight:400 },
  headerJa: { fontSize:26, fontWeight:900, color:"#1e1b18", marginBottom:8, letterSpacing:"0.02em" },
  accentText: { color:"#8a7860" },
  headerSub: { color:"#a09890", fontSize:13 },
  ghostBtn: { background:"white", border:"1px solid #e2ddd8", borderRadius:8, color:"#7a7268", fontSize:12, padding:"7px 16px", cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif", letterSpacing:"0.04em", transition:"border-color 0.15s" },
  layout: { display:"flex", gap:28, alignItems:"flex-start", flexWrap:"wrap" },
  inputPanel: { flex:"0 0 310px", minWidth:280, display:"flex", flexDirection:"column", gap:16, background:"white", border:"1px solid #ece8e2", borderRadius:16, padding:"24px 20px" },
  input: { background:"#f8f6f2", border:"1px solid #e8e3db", borderRadius:8, padding:"9px 13px", color:"#1e1b18", fontSize:13, width:"100%", transition:"border-color 0.2s" },
  textarea: { background:"#f8f6f2", border:"1px solid #e8e3db", borderRadius:8, padding:"9px 13px", color:"#1e1b18", fontSize:13, width:"100%", resize:"vertical", lineHeight:1.7 },
  select: { background:"#f8f6f2", border:"1px solid #e8e3db", borderRadius:8, padding:"9px 13px", color:"#1e1b18", fontSize:13, width:"100%", cursor:"pointer" },
  chip: { padding:"5px 11px", borderRadius:20, border:"1px solid #e2ddd8", background:"white", color:"#8a8278", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif", transition:"all 0.15s" },
  chipActive: { borderColor:"#1e1b18", color:"#1e1b18", background:"#f0ece6" },
  drop: { border:"1.5px dashed #d8d3cc", borderRadius:10, height:110, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", background:"#f8f6f2", overflow:"hidden" },
  dropDrag: { borderColor:"#8a7860", background:"#f4f0e8" },
  dropFilled: { cursor:"default", border:"1px solid #e2ddd8" },
  dropIcon: { fontSize:24, color:"#c8c0b8", marginBottom:6, fontWeight:300 },
  previewImg: { width:"100%", height:"100%", objectFit:"cover", borderRadius:8 },
  removeBtn: { position:"absolute", top:6, right:6, background:"rgba(255,255,255,0.9)", color:"#6a6258", border:"1px solid #e2ddd8", borderRadius:"50%", width:22, height:22, fontSize:12, cursor:"pointer", lineHeight:"20px" },
  genBtn: { padding:"13px 0", background:"#1e1b18", border:"none", borderRadius:10, color:"white", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%", letterSpacing:"0.06em", transition:"opacity 0.2s" },
  genBtnOff: { background:"#e2ddd8", color:"#b0a898", cursor:"not-allowed" },
  spinner: { width:13, height:13, border:"1.5px solid rgba(255,255,255,0.3)", borderTop:"1.5px solid white", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" },
  outputPanel: { flex:1, minWidth:300 },
  brandBadge: { display:"flex", flexWrap:"wrap", gap:6, alignItems:"center", marginBottom:12, padding:"10px 14px", background:"white", border:"1px solid #ece8e2", borderRadius:10 },
  brandLabel: { color:"#b0a898", fontSize:10, fontWeight:700, letterSpacing:"0.1em" },
  brandTone: { color:"#8a7860", fontSize:12, fontWeight:700 },
  brandKeyword: { padding:"2px 9px", borderRadius:12, background:"#f4f0e8", color:"#8a7860", fontSize:11, border:"1px solid #e8e0d4" },
  tabs: { display:"flex", gap:4 },
  tab: { flex:1, padding:"11px 8px", background:"#f0ece8", border:"1px solid #e8e3db", borderBottom:"none", borderTop:"3px solid transparent", borderRadius:"8px 8px 0 0", color:"#a09890", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.15s", letterSpacing:"0.04em" },
  tabActive: { background:"white", color:"#1e1b18", borderColor:"#e8e3db" },
  tabSpinner: { width:8, height:8, border:"1.5px solid #d8d3cc", borderTop:"1.5px solid #8a7860", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  tabDot: { width:6, height:6, borderRadius:"50%" },
  outputBox: { background:"white", border:"1px solid #e8e3db", borderRadius:"0 8px 8px 8px", padding:"24px", minHeight:500, animation:"fadeIn 0.3s ease" },
  emptyIcon: { fontSize:32, color:"#d8d3cc", marginBottom:16, fontWeight:200 },
  errorBox: { background:"#fdf8f6", border:"1px solid #e8c8c0", borderRadius:10, padding:"16px 20px", color:"#a06060", fontSize:13, lineHeight:1.8 },
  retryBtn: { marginTop:10, padding:"7px 18px", background:"white", border:"1px solid #e2ddd8", borderRadius:7, color:"#7a7268", fontFamily:"'Noto Sans JP', sans-serif", fontSize:12, cursor:"pointer" },
  card: { background:"#fdfcfb", borderRadius:10, padding:20, marginBottom:14, border:"1px solid #f0ece6", animation:"fadeIn 0.4s ease" },
  copyBtn: { width:"100%", padding:11, background:"#f5f2ee", border:"1px solid #e8e3db", borderRadius:8, color:"#7a7268", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:600, fontSize:12, cursor:"pointer", letterSpacing:"0.04em", transition:"all 0.15s" },
  copyBtnDone: { borderColor:"#7ab890", color:"#5a8a6a", background:"#f2faf5" },
  igCatch: { fontSize:15, fontWeight:700, color:"#2a2420", marginBottom:12, lineHeight:1.6 },
  igBody: { color:"#4a4440", fontSize:13, lineHeight:2, marginBottom:14 },
  igTags: { color:"#8a7860", fontSize:11, lineHeight:1.9, wordBreak:"break-all" },
  blogTitle: { fontWeight:900, fontSize:16, color:"#1e1b18", marginBottom:10, lineHeight:1.5 },
  blogLead: { color:"#6a6258", fontSize:13, lineHeight:1.8, marginBottom:16, paddingBottom:16, borderBottom:"1px solid #f0ece6" },
  blogH: { color:"#8a7860", fontWeight:700, fontSize:13, marginBottom:6, letterSpacing:"0.04em" },
  blogClosing: { marginTop:16, paddingTop:16, borderTop:"1px solid #f0ece6", color:"#5a8a6a", fontSize:13, lineHeight:1.8, fontWeight:700 },
  bodyText: { color:"#4a4440", fontSize:13, lineHeight:1.9 },
  hpbTitle: { fontWeight:900, fontSize:15, color:"#1e1b18", marginBottom:10 },
  hpbPoint: { display:"flex", alignItems:"flex-start", gap:10, color:"#4a4440", fontSize:13, lineHeight:1.7 },
  hpbNum: { width:20, height:20, borderRadius:"50%", background:"#f0ece6", color:"#8a7860", fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 },
  tagCat: { color:"#b0a898", fontSize:10, fontWeight:700, width:48, flexShrink:0 },
  tagChip: { padding:"3px 9px", borderRadius:10, background:"#f4f0e8", color:"#8a7860", fontSize:11, fontWeight:600, border:"1px solid #e8e0d4" },
  reviewBadge: { borderRadius:8, border:"1px solid", padding:"8px 12px", marginBottom:12 },
  reviewLoading: { display:"flex", alignItems:"center", gap:8, color:"#b0a898", fontSize:11, padding:"6px 0", marginBottom:10 },
  reviewSpinner: { width:9, height:9, border:"1.5px solid #e0dbd4", borderTop:"1.5px solid #8a7860", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" },
  templateSection: { background:"#f8f6f2", border:"1px solid #e8e3db", borderRadius:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 },
  templateLabel: { color:"#b0a898", fontSize:10, fontWeight:700, letterSpacing:"0.1em" },
  templateChipWrap: { display:"flex", alignItems:"center" },
  templateChip: { padding:"4px 12px", borderRadius:"14px 0 0 14px", border:"1px solid #e0dbd4", borderRight:"none", background:"white", color:"#6a6258", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif" },
  templateDel: { padding:"4px 8px", borderRadius:"0 14px 14px 0", border:"1px solid #e0dbd4", background:"white", color:"#c0b8b0", fontSize:11, cursor:"pointer" },
  tplOpenBtn: { padding:"8px 0", background:"transparent", border:"1px dashed #d8d3cc", borderRadius:8, color:"#b0a898", fontFamily:"'Noto Sans JP', sans-serif", fontSize:12, cursor:"pointer", width:"100%", letterSpacing:"0.04em" },
  tplSaveBtn: { padding:"8px 14px", background:"#1e1b18", border:"none", borderRadius:8, color:"white", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" },
  tplCancelBtn: { padding:"8px 12px", background:"white", border:"1px solid #e2ddd8", borderRadius:8, color:"#a09890", fontFamily:"'Noto Sans JP', sans-serif", fontSize:12, cursor:"pointer" },
  historyOverlay: { position:"fixed", inset:0, background:"rgba(30,27,24,0.4)", zIndex:1000, display:"flex", justifyContent:"flex-end" },
  historyPanel: { width:360, maxWidth:"90vw", background:"white", borderLeft:"1px solid #e8e3db", height:"100vh", display:"flex", flexDirection:"column", padding:"28px 22px", gap:12, overflowY:"auto" },
  historyHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  historyTitle: { color:"#1e1b18", fontSize:14, fontWeight:900, letterSpacing:"0.04em" },
  historyClose: { background:"transparent", border:"none", color:"#b0a898", fontSize:18, cursor:"pointer", lineHeight:1 },
  historyEmpty: { color:"#c0b8b0", fontSize:13, textAlign:"center", marginTop:40 },
  historyEntry: { background:"#fdfcfb", border:"1px solid #ece8e2", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:4, flexShrink:0 },
  historyDate: { color:"#c0b8b0", fontSize:10 },
  historySalon: { color:"#2a2420", fontSize:13, fontWeight:700 },
  historyTreatment: { color:"#8a8278", fontSize:11, lineHeight:1.5 },
  historyLoad: { marginTop:6, padding:"6px 14px", background:"white", border:"1px solid #e2ddd8", borderRadius:7, color:"#6a6258", fontFamily:"'Noto Sans JP', sans-serif", fontSize:12, fontWeight:600, cursor:"pointer", alignSelf:"flex-start", letterSpacing:"0.04em" },
};
