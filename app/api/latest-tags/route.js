import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("latestHpbTags")?.value;
    if (raw) {
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json({ error: "タグがありません" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "タグがありません" }, { status: 404 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const res = NextResponse.json({ ok: true });
    res.cookies.set("latestHpbTags", JSON.stringify(data), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
