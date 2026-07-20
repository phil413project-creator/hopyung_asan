import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug, getPostHtml } from '../../../lib/notion';
import '../blog.css';

export const revalidate = 60; // 60초마다 재생성 → 노션 수정 사항 자동 반영

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

// 빌드 시 모든 글의 경로를 미리 생성 (첫 방문도 빠르게)
export async function generateStaticParams() {
  try {
    const posts = await getAllPosts();
    return posts.map(p => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

// 글마다 다른 검색엔진 메타태그 — 이게 서울퍼스트내과 벤치마킹의 핵심입니다
export async function generateMetadata({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) return { title: '글을 찾을 수 없습니다 | 호평아산내과' };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | 호평아산내과 건강검진센터`,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.summary,
      url,
      type: 'article',
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const html = await getPostHtml(post.id);

  return (
    <>
      <div className="topbar">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <Link href="/" className="home">호평아산내과 건강검진센터</Link>
          <a className="tel" href="tel:031-511-2460">031-511-2460</a>
        </div>
      </div>

      <article className="post-wrap">
        <Link href="/blog" className="back">← 목록으로</Link>
        <span className="post-cat" style={{ color: post.categoryColor }}>{post.category}</span>
        <h1 className="post-title">{post.title}</h1>
        <div className="post-date">{post.date}</div>
        {post.cover && <img className="post-cover" src={post.cover} alt={post.title} />}

        <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />

        <p className="disclaimer">
          본 글은 일반적인 건강 정보 제공을 위한 것으로 개인의 진단·치료를 대신하지 않으며,
          검사·치료 필요 여부는 진료를 통해 상담받으시기 바랍니다.
        </p>

        <div className="cta">
          <div>진료·검진 문의는 언제든 편하게 연락 주세요.</div>
          <a href="tel:031-511-2460">031-511-2460 전화 예약</a>
        </div>
      </article>
    </>
  );
}
