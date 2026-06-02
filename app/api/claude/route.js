export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return Response.json({ error: "APIキーが必要です" }, { status: 401 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "APIエラーが発生しました" },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
