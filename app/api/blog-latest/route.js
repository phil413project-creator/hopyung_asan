import { NextResponse } from 'next/server';
import { getAllPosts } from '../../../lib/notion';

// 메인 홈페이지(index.html)의 블로그 미리보기 카드가 호출하는 경량 API
// 최신 3개 글의 요약 정보만 반환 (본문 제외)
export async function GET() {
  try {
    const posts = await getAllPosts();
    const preview = posts.slice(0, 3).map(p => ({
      title: p.title,
      summary: p.summary,
      category: p.category,
      cover: p.cover,
      slug: p.slug,
    }));
    return NextResponse.json({ posts: preview });
  } catch (err) {
    return NextResponse.json({ posts: [], error: String(err) }, { status: 200 });
  }
}
