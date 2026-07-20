import Link from 'next/link';
import { getAllPosts } from '../../lib/notion';
import './blog.css';

export const revalidate = 60; // 60초마다 재생성 → 노션에 새 글 반영

export const metadata = {
  title: '건강 정보 · 새소식 | 호평아산내과',
  description: '호평아산내과 배창황 원장이 전하는 검진·내시경·만성질환 건강 정보',
};

export default async function BlogListPage() {
  let posts = [];
  let error = null;
  try {
    posts = await getAllPosts();
  } catch (e) {
    error = e.message;
  }

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <Link href="/" className="home">호평아산내과 건강검진센터</Link>
          <a className="tel" href="tel:031-511-2460">031-511-2460</a>
        </div>
      </div>

      <div className="blog-hero">
        <h1>건강 정보 · 새소식</h1>
        <p>검진 준비부터 동네 건강 이야기까지, 원장이 직접 전합니다.</p>
      </div>

      {error && (
        <div className="empty">글을 불러오는 중 문제가 발생했습니다. ({error})</div>
      )}

      {!error && posts.length === 0 && (
        <div className="empty">아직 게시된 글이 없습니다.</div>
      )}

      <div className="list-grid">
        {posts.map(p => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="card">
            {p.cover ? (
              <div className="cov" style={{ backgroundImage: `url(${p.cover})` }} />
            ) : (
              <div className="ph" />
            )}
            <div className="body">
              <span className="cat" style={{ color: p.categoryColor }}>{p.category}</span>
              <h2>{p.title}</h2>
              <p>{p.summary}</p>
              <div className="date">{p.date}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
