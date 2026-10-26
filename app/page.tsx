import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <h1>熱量小幫手 🍱</h1>
      <p className="muted">在 LINE 傳餐點照片給官方帳號，就能記錄熱量與三大營養素。</p>
      <p>
        <Link href="/dashboard">打開儀表板 →</Link>
      </p>
    </main>
  );
}
