import Link from "next/link";

export function AppNav() {
  return (
    <nav className="app-nav">
      <Link className="brand" href="/">AI 圆桌会议</Link>
      <div className="nav-links">
        <Link href="/meetings/new">创建会议</Link>
        <Link href="/meetings">历史会议</Link>
        <Link href="/models">模型配置</Link>
      </div>
    </nav>
  );
}
