export async function callClaude({ apiKey, messages, maxTokens = 1500, tools }) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages,
    ...(tools ? { tools } : {}),
  };

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "APIエラーが発生しました");
  }

  const text = data.content?.map((b) => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();

  return { text, clean, raw: data };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ data: e.target.result.split(",")[1], mediaType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
