"use client";
import { useState, useRef, useCallback } from "react";
import { callClaude, fileToBase64 } from "../lib/claude";

const OUTPUT_TABS = [
  { id: "instagram", label: "Instagram", icon: "📸", color: "#e8a8c4" },
  { id: "blog",      label: "ブログ",    icon: "✍️",  color: "#a8c4e8" },
  { id: "google",    label: "Google",    icon: "🗺",   color: "#a8e8c4" },
  { id: "hotpepper", label: "HPB",       icon: "💈",  color: "#e8c4a0" },
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

  google: (info, hasImg) => `あなたはGoogleビジネスプロフィールの最適化専門家です。以下のサロン情報${hasImg ? "と添付スタイル写真" : ""}をもとに、Googleビジネスプロフィールの「最新情報」投稿テキストを作成してください。

サロン情報:
${info}

要件: 投稿タイトル50字以内/本文300字以内・地域名+施術名キーワード含む・予約誘導あり

JSONのみ（バッククォート不要）:
{"title":"","body":"","cta":"今すぐ予約"}`,

  hotpepper: (info, hasImg) => `あなたはホットペッパービューティーの掲載最適化専門家です。以下のサロン情報${hasImg ? "と添付スタイル写真" : ""}をもとに、HPBスタイル登録用テキスト一式を作成してください。

サロン情報:
${info}

要件: スタイルタイトル30字以内/説明文200〜250字/おすすめポイント3項目40字以内/HPB準拠タグ

JSONのみ（バッククォート不要）:
{"styleTitle":"","description":"","points":["","",""],"tags":{"length":[],"color":[],"image":[],"face":[]}}`,
};

export default function ContentGenerator({ apiKey, onChangeKey }) {
  const [salonName, setSalonName]       = useState("");
  const [treatment, setTreatment]       = useState("");
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [targetAge, setTargetAge]       = useState("");
  const [season, setSeason]             = useState("");
  const [freeText, setFreeText]         = useState("");
  const [image, setImage]               = useState(null);
  const [imageBase64, setImageBase64]   = useState(null);
  const [dragging, setDragging]         = useState(false);
  const fileRef = useRef();

  const [activeTab, setActiveTab]       = useState("instagram");
  const [results, setResults]           = useState({});
  const [loading, setLoading]           = useState({});
  const [errors, setErrors]             = useState({});
  const [copied, setCopied]             = useState("");
  const [generating, setGenerating]     = useState(false);
  const [fixedHashtags, setFixedHashtags] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("fixedHashtags") || "";
  });
  const [templates, setTemplates] = useState(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("salonTemplates") || "[]");
  });
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");

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

  const generateOne = async (tabId) => {
    const info = buildInfo();
    setLoading(p => ({ ...p, [tabId]: true }));
    setErrors(p => ({ ...p, [tabId]: null }));

    const content = imageBase64
      ? [
          { type: "image", source: { type: "base64", media_type: imageBase64.mediaType, data: imageBase64.data } },
          { type: "text", text: PROMPTS[tabId](info, true) },
        ]
      : [{ type: "text", text: PROMPTS[tabId](info, false) }];

    try {
      const { clean } = await callClaude({ apiKey, messages: [{ role: "user", content }] });
      setResults(p => ({ ...p, [tabId]: JSON.parse(clean) }));
    } catch (e) {
      setErrors(p => ({ ...p, [tabId]: e.message || "生成に失敗しました" }));
    } finally {
      setLoading(p => ({ ...p, [tabId]: false }));
    }
  };

  const generateAll = async () => {
    if (!isReady) return;
    setGenerating(true);
    await Promise.all(OUTPUT_TABS.map(t => generateOne(t.id)));
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

  // ---- renderers ----
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
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={S.blogH}>■ {s.heading}</div>
              <div style={S.bodyText}>{s.body}</div>
            </div>
          ))}
          <div style={S.blogClosing}>{r.closing}</div>
        </div>
        <CopyBtn text={full} id="blog" copied={copied} onCopy={handleCopy} />
      </div>
    );
  };

  const renderGoogle = (r) => {
    const full = `${r.title}\n\n${r.body}\n\n▶ ${r.cta}`;
    return (
      <div>
        <div style={S.card}>
          <div style={S.googleTitle}>{r.title}</div>
          <div style={S.bodyText}>{r.body}</div>
          <div style={S.googleCta}>▶ {r.cta}</div>
        </div>
        <CopyBtn text={full} id="google" copied={copied} onCopy={handleCopy} />
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
          <div style={{ margin: "12px 0", display: "flex", flexDirection: "column", gap: 7 }}>
            {r.points?.map((p, i) => (
              <div key={i} style={S.hpbPoint}>
                <span style={S.hpbNum}>{i+1}</span>{p}
              </div>
            ))}
          </div>
          {r.tags && (
            <div style={{ borderTop: "1px solid #2a3545", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(r.tags).map(([cat, arr]) => arr?.length > 0 && (
                <div key={cat} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={S.tagCat}>{cat}</span>
                  {arr.map(t => <span key={t} style={S.tagChip}>{t}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
        <CopyBtn text={full} id="hpb" copied={copied} onCopy={handleCopy} />
      </div>
    );
  };

  const RENDERERS = { instagram: renderInstagram, blog: renderBlog, google: renderGoogle, hotpepper: renderHPB };

  return (
    <div style={S.root}>
      <div style={S.noise} />
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <p style={S.headerEn}>SALON CONTENT STUDIO</p>
          <h1 style={S.headerJa}>集客コンテンツ<span style={S.accent}>一括生成</span></h1>
          <p style={S.headerSub}>Instagram・ブログ・Google・ホットペッパーを同時に作成</p>
          <button style={S.keyBtn} onClick={onChangeKey}>🔑 APIキーを変更</button>
        </div>

        <div style={S.layout}>
          {/* INPUT */}
          <div style={S.inputPanel}>
            {/* テンプレート */}
            {templates.length > 0 && (
              <div style={S.templateSection}>
                <div style={S.templateLabel}>保存済みテンプレート</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {templates.map(t => (
                    <div key={t.id} style={S.templateChipWrap}>
                      <button style={S.templateChip} onClick={() => loadTemplate(t)}>{t.name}</button>
                      <button style={S.templateDel} onClick={() => deleteTemplate(t.id)}>✕</button>
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
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {STYLE_OPTIONS.map(s => (
                  <button key={s} style={{ ...S.chip, ...(selectedStyles.includes(s) ? S.chipActive : {}) }} onClick={() => toggleStyle(s)}>{s}</button>
                ))}
              </div>
            </Inp>
            <div style={{ display:"flex", gap:12 }}>
              <Inp label="ターゲット" style={{ flex:1 }}>
                <select style={S.select} value={targetAge} onChange={e => setTargetAge(e.target.value)}>
                  <option value="">選択...</option>
                  {TARGET_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Inp>
              <Inp label="季節" style={{ flex:1 }}>
                <select style={S.select} value={season} onChange={e => setSeason(e.target.value)}>
                  <option value="">選択...</option>
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
            {/* テンプレート保存 */}
            {showTemplateSave ? (
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...S.input, flex:1 }} placeholder="テンプレート名（例：Bloom定番）" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveTemplate()} />
                <button style={S.tplSaveBtn} onClick={saveTemplate}>保存</button>
                <button style={S.tplCancelBtn} onClick={() => setShowTemplateSave(false)}>✕</button>
              </div>
            ) : (
              <button style={S.tplOpenBtn} onClick={() => setShowTemplateSave(true)}>＋ 現在の入力をテンプレートに保存</button>
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
                    <button style={S.removeBtn} onClick={e => { e.stopPropagation(); setImage(null); setImageBase64(null); }}>✕</button>
                  </div>
                ) : (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>📷</div>
                    <div style={{ color:"#6a7080", fontSize:12 }}>写真をドロップ or クリック</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => processFile(e.target.files[0])} />
            </Inp>

            <button style={{ ...S.genBtn, ...(!isReady || generating ? S.genBtnOff : {}) }} onClick={generateAll} disabled={!isReady || generating}>
              {generating
                ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={S.spinner} />生成中...</span>
                : "⚡ 4媒体まとめて生成"}
            </button>
            {!isReady && <p style={{ color:"#3a4550", fontSize:11, textAlign:"center", marginTop:6 }}>※ サロン名と施術内容を入力してください</p>}
          </div>

          {/* OUTPUT */}
          <div style={S.outputPanel}>
            <div style={S.tabs}>
              {OUTPUT_TABS.map(t => {
                const done = !!results[t.id];
                const ld   = !!loading[t.id];
                const err  = !!errors[t.id];
                return (
                  <button key={t.id}
                    style={{ ...S.tab, ...(activeTab === t.id ? { ...S.tabActive, borderColor: t.color } : {}) }}
                    onClick={() => setActiveTab(t.id)}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {ld   && <span style={S.tabSpinner} />}
                    {done && !ld && <span style={{ ...S.tabDot, background: t.color }}>✓</span>}
                    {err  && !ld && <span style={{ ...S.tabDot, background: "#c87070" }}>!</span>}
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
                if (ld) return <Center><Dots color={tab.color} /><p style={{ color:"#7a8090", fontSize:13, marginTop:16 }}>{tab.label}を生成中...</p></Center>;
                if (err) return <div style={S.errorBox}>⚠️ {err}<br /><button style={S.retryBtn} onClick={() => generateOne(activeTab)}>再試行</button></div>;
                if (!res && !Object.keys(results).length) return (
                  <Center>
                    <div style={{ fontSize:48, marginBottom:16 }}>✨</div>
                    <p style={{ color:"#5a6070", fontSize:14, lineHeight:1.8, marginBottom:20 }}>左のフォームを入力して<br />「4媒体まとめて生成」を押してください</p>
                    {OUTPUT_TABS.map(t => <div key={t.id} style={{ color:"#3a4050", fontSize:13, marginBottom:6 }}>{t.icon} {t.label}</div>)}
                  </Center>
                );
                if (!res) return <Center><p style={{ color:"#5a6070", fontSize:13, marginBottom:12 }}>このタブはまだ生成されていません</p><button style={S.retryBtn} onClick={() => generateOne(activeTab)}>単体で生成</button></Center>;
                return RENDERERS[activeTab]?.(res);
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, required, children, style }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, ...style }}>
      <label style={{ color:"#7a90a8", fontSize:12, fontWeight:700, letterSpacing:"0.08em" }}>
        {label}{required && <span style={{ color:"#e88888", fontSize:10, marginLeft:4 }}>必須</span>}
      </label>
      {children}
    </div>
  );
}

function CopyBtn({ text, id, copied, onCopy }) {
  const done = copied === id;
  return (
    <button style={{ ...S.copyBtn, ...(done ? S.copyBtnDone : {}) }} onClick={() => onCopy(text, id)}>
      {done ? "✅ コピーしました！" : "📋 テキストをコピー"}
    </button>
  );
}

function Center({ children }) {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center" }}>{children}</div>;
}

function Dots({ color }) {
  return (
    <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
      {[0,1,2].map(i => <div key={i} style={{ width:10, height:10, borderRadius:"50%", background: color, animation:"bounce 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s` }} />)}
    </div>
  );
}

const S = {
  root: { minHeight:"100vh", background:"#111820", fontFamily:"'Noto Sans JP', sans-serif", position:"relative" },
  noise: { position:"fixed", inset:0, background:"radial-gradient(ellipse at 10% 90%, #0d2040 0%, transparent 50%), radial-gradient(ellipse at 90% 10%, #1a0d30 0%, transparent 50%)", pointerEvents:"none" },
  container: { maxWidth:1100, margin:"0 auto", padding:"32px 20px", position:"relative", zIndex:1 },
  header: { textAlign:"center", marginBottom:32 },
  headerEn: { fontFamily:"'Playfair Display', serif", fontSize:11, color:"#4a6080", letterSpacing:"0.4em", marginBottom:8 },
  headerJa: { fontSize:28, fontWeight:900, color:"#c0cce0", marginBottom:8, letterSpacing:"0.05em" },
  accent: { color:"#7ab8e8", fontStyle:"italic" },
  headerSub: { color:"#4a6070", fontSize:13, marginBottom:12 },
  keyBtn: { background:"transparent", border:"1px solid #2a3545", borderRadius:8, color:"#4a6070", fontSize:12, padding:"6px 14px", cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif" },
  layout: { display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" },
  inputPanel: { flex:"0 0 320px", minWidth:280, display:"flex", flexDirection:"column", gap:16 },
  input: { background:"#1a2030", border:"1px solid #2a3545", borderRadius:10, padding:"10px 14px", color:"#c0cce0", fontSize:14, width:"100%", transition:"border-color 0.2s" },
  textarea: { background:"#1a2030", border:"1px solid #2a3545", borderRadius:10, padding:"10px 14px", color:"#c0cce0", fontSize:13, width:"100%", resize:"vertical", lineHeight:1.7, transition:"border-color 0.2s" },
  select: { background:"#1a2030", border:"1px solid #2a3545", borderRadius:10, padding:"10px 14px", color:"#c0cce0", fontSize:13, width:"100%", cursor:"pointer" },
  chip: { padding:"6px 12px", borderRadius:16, border:"1px solid #2a3545", background:"transparent", color:"#5a7090", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif", transition:"all 0.15s" },
  chipActive: { borderColor:"#7ab8e8", color:"#7ab8e8", background:"#0d1e30" },
  drop: { border:"1.5px dashed #2a3545", borderRadius:12, height:130, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", background:"#141c28", overflow:"hidden" },
  dropDrag: { borderColor:"#7ab8e8", background:"#0d1e30" },
  dropFilled: { cursor:"default", border:"1px solid #2a3545" },
  previewImg: { width:"100%", height:"100%", objectFit:"cover", borderRadius:10 },
  removeBtn: { position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.7)", color:"#c0cce0", border:"none", borderRadius:"50%", width:22, height:22, fontSize:11, cursor:"pointer" },
  genBtn: { padding:"14px 0", background:"linear-gradient(135deg, #3a7ab8, #2a5a90)", border:"none", borderRadius:12, color:"#fff", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:900, fontSize:15, cursor:"pointer", width:"100%", transition:"all 0.2s" },
  genBtnOff: { background:"#1a2530", color:"#3a4550", cursor:"not-allowed" },
  spinner: { width:14, height:14, border:"2px solid rgba(255,255,255,0.2)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" },
  outputPanel: { flex:1, minWidth:300 },
  tabs: { display:"flex", gap:6, flexWrap:"wrap" },
  tab: { flex:1, minWidth:70, padding:"10px 8px", background:"#141c28", border:"1.5px solid #2a3545", borderBottom:"none", borderRadius:"10px 10px 0 0", color:"#4a6070", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.15s" },
  tabActive: { background:"#1a2535", color:"#c0cce0", borderBottom:"2px solid" },
  tabSpinner: { width:10, height:10, border:"1.5px solid #3a4550", borderTop:"1.5px solid #7ab8e8", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  tabDot: { width:16, height:16, borderRadius:"50%", fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", color:"#111820", fontWeight:900 },
  outputBox: { background:"#1a2535", border:"1px solid #2a3545", borderRadius:"0 12px 12px 12px", padding:"20px", minHeight:500, animation:"fadeIn 0.3s ease" },
  errorBox: { background:"#1e1015", border:"1px solid #4a2025", borderRadius:12, padding:16, color:"#c87070", fontSize:14, lineHeight:1.8 },
  retryBtn: { marginTop:12, padding:"8px 20px", background:"transparent", border:"1px solid #4a5060", borderRadius:8, color:"#7a90a8", fontFamily:"'Noto Sans JP', sans-serif", fontSize:13, cursor:"pointer" },
  card: { background:"#111820", borderRadius:12, padding:18, marginBottom:14, border:"1px solid #2a3545", animation:"fadeIn 0.4s ease" },
  copyBtn: { width:"100%", padding:12, background:"transparent", border:"1.5px solid #2a3545", borderRadius:10, color:"#5a7090", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" },
  copyBtnDone: { borderColor:"#4a9060", color:"#4a9060" },
  igCatch: { fontFamily:"'Playfair Display', serif", fontSize:16, fontStyle:"italic", color:"#e8c4a0", marginBottom:12, lineHeight:1.5 },
  igBody: { color:"#b0bcc8", fontSize:13, lineHeight:2, marginBottom:14 },
  igTags: { color:"#7ab8e8", fontSize:11, lineHeight:1.9, wordBreak:"break-all" },
  blogTitle: { fontWeight:900, fontSize:16, color:"#c0cce0", marginBottom:10, lineHeight:1.5 },
  blogLead: { color:"#8a9aaa", fontSize:13, lineHeight:1.8, marginBottom:14, paddingBottom:14, borderBottom:"1px solid #2a3545" },
  blogH: { color:"#7ab8e8", fontWeight:700, fontSize:14, marginBottom:6 },
  blogClosing: { marginTop:14, paddingTop:14, borderTop:"1px solid #2a3545", color:"#a8c4a0", fontSize:13, lineHeight:1.8, fontWeight:700 },
  bodyText: { color:"#b0bcc8", fontSize:13, lineHeight:1.9 },
  googleTitle: { fontWeight:900, fontSize:15, color:"#c0cce0", marginBottom:10 },
  googleCta: { display:"inline-block", padding:"8px 18px", background:"#1a3a5a", borderRadius:8, color:"#7ab8e8", fontWeight:700, fontSize:13, marginTop:10 },
  hpbTitle: { fontWeight:900, fontSize:15, color:"#e8c4a0", marginBottom:10 },
  hpbPoint: { display:"flex", alignItems:"flex-start", gap:10, color:"#b0bcc8", fontSize:13, lineHeight:1.7 },
  hpbNum: { width:20, height:20, borderRadius:"50%", background:"#2a3a1a", color:"#a8c4a0", fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 },
  tagCat: { color:"#4a6070", fontSize:10, fontWeight:700, width:50, flexShrink:0 },
  tagChip: { padding:"3px 10px", borderRadius:10, background:"#2a3a20", color:"#a8c4a0", fontSize:11, fontWeight:700 },
  templateSection: { background:"#141c28", border:"1px solid #2a3545", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 },
  templateLabel: { color:"#4a6080", fontSize:11, fontWeight:700, letterSpacing:"0.08em" },
  templateChipWrap: { display:"flex", alignItems:"center" },
  templateChip: { padding:"5px 12px", borderRadius:"12px 0 0 12px", border:"1px solid #2a4060", borderRight:"none", background:"#0d1e30", color:"#7ab8e8", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif" },
  templateDel: { padding:"5px 8px", borderRadius:"0 12px 12px 0", border:"1px solid #2a4060", background:"#0d1e30", color:"#4a6070", fontSize:10, cursor:"pointer", fontFamily:"'Noto Sans JP', sans-serif" },
  tplOpenBtn: { padding:"9px 0", background:"transparent", border:"1px dashed #2a3545", borderRadius:10, color:"#4a6070", fontFamily:"'Noto Sans JP', sans-serif", fontSize:12, cursor:"pointer", width:"100%", transition:"all 0.2s" },
  tplSaveBtn: { padding:"9px 16px", background:"#1a3a5a", border:"none", borderRadius:10, color:"#7ab8e8", fontFamily:"'Noto Sans JP', sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" },
  tplCancelBtn: { padding:"9px 12px", background:"transparent", border:"1px solid #2a3545", borderRadius:10, color:"#4a6070", fontFamily:"'Noto Sans JP', sans-serif", fontSize:13, cursor:"pointer" },
};
