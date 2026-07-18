"use client";
import { useState } from "react";

export default function ApiKeyModal({ onSave }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      setError("APIキーは「sk-ant-」から始まる形式です");
      return;
    }
    onSave(trimmed);
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.icon}>🔑</div>
        <h2 style={S.title}>Anthropic APIキーを設定</h2>
        <p style={S.desc}>
          このツールはAnthropicのAI（Claude）を使用します。<br />
          APIキーはお使いのブラウザにのみ保存され、外部には送信されません。
        </p>
        <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={S.link}>
          → APIキーの取得はこちら（console.anthropic.com）
        </a>
        <input
          style={S.input}
          type="password"
          placeholder="sk-ant-api03-..."
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
        />
        {error && <p style={S.error}>{error}</p>}
        <button style={{ ...S.btn, ...(!value.trim() ? S.btnDisabled : {}) }} onClick={handleSave} disabled={!value.trim()}>
          保存して始める
        </button>
        <p style={S.note}>
          ※ APIキーは無料で取得できますが、使用量に応じて課金されます（少量なら数円〜数十円程度）
        </p>
      </div>
    </div>
  );
}

const S = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 },
  modal: { background:"#1a2535", border:"1px solid #2a3545", borderRadius:20, padding:"40px 36px", maxWidth:480, width:"100%", textAlign:"center" },
  icon: { fontSize:48, marginBottom:16 },
  title: { fontFamily:"'Playfair Display', serif", fontSize:22, color:"#c0cce0", marginBottom:12 },
  desc: { color:"#7a90a8", fontSize:13, lineHeight:1.9, marginBottom:14 },
  link: { display:"inline-block", color:"#7ab8e8", fontSize:12, marginBottom:20, textDecoration:"none" },
  input: { width:"100%", background:"#111820", border:"1px solid #2a3545", borderRadius:10, padding:"12px 16px", color:"#c0cce0", fontSize:14, marginBottom:10, letterSpacing:"0.05em" },
  error: { color:"#e87070", fontSize:12, marginBottom:10 },
  btn: { width:"100%", padding:"14px", background:"linear-gradient(135deg, #3a7ab8, #2a5a90)", border:"none", borderRadius:12, color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", marginBottom:16, fontFamily:"'Noto Sans JP', sans-serif" },
  btnDisabled: { background:"#1a2530", color:"#3a4550", cursor:"not-allowed" },
  note: { color:"#3a5060", fontSize:11, lineHeight:1.7 },
};
