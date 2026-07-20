// 노션 API를 SDK 없이 fetch로 직접 호출합니다.
// (교육/워크숍 용도로 의존성을 최소화 — 버전 호환 문제를 피합니다)

const NOTION_VERSION = '2025-09-03';
const TOKEN = process.env.NOTION_TOKEN;
const DATA_SOURCE_ID = process.env.NOTION_BLOG_DATA_SOURCE_ID;

function headers() {
  if (!TOKEN) throw new Error('NOTION_TOKEN 환경변수가 설정되지 않았습니다.');
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    ...options,
    headers: headers(),
    // 목록/개별 글 페이지는 재생성(ISR)으로 최신화하므로 fetch 캐시는 짧게
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Notion API 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

// 노션 select 색상 → 사이트 chip 색상 매핑 (필요시 자유롭게 확장)
const CATEGORY_COLORS = {
  '검진 가이드': '#13657f',
  '검진 클리닉': '#1a7a3e',
  '만성질환': '#b6862f',
  '소화기 건강': '#8a7a1e',
  '5대암 검진': '#b03a2e',
  '건강검진': '#5b3a99',
  '건강정보': '#395966',
};

function slugify(title, fallbackId) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\uac00-\ud7a3\s-]/g, '') // 한글/영문/숫자만 남김
    .replace(/\s+/g, '-');
  return base || fallbackId.replace(/-/g, '').slice(0, 12);
}

function getProp(props, name, type) {
  const p = props[name];
  if (!p) return null;
  switch (type) {
    case 'title':
      return (p.title || []).map(t => t.plain_text).join('') || '';
    case 'rich_text':
      return (p.rich_text || []).map(t => t.plain_text).join('') || '';
    case 'select':
      return p.select ? p.select.name : '';
    case 'date':
      return p.date ? p.date.start : '';
    case 'checkbox':
      return !!p.checkbox;
    case 'url':
      return p.url || '';
    default:
      return null;
  }
}

function mapPage(page) {
  const props = page.properties;
  const title = getProp(props, '제목', 'title');
  const slugRaw = getProp(props, '슬러그', 'rich_text');
  return {
    id: page.id,
    slug: slugRaw && slugRaw.trim() ? slugRaw.trim() : slugify(title, page.id),
    title,
    summary: getProp(props, '요약', 'rich_text'),
    category: getProp(props, '카테고리', 'select') || '건강정보',
    categoryColor: CATEGORY_COLORS[getProp(props, '카테고리', 'select')] || '#395966',
    date: getProp(props, '발행일', 'date') || page.created_time.slice(0, 10),
    published: getProp(props, '공개', 'checkbox'),
    cover: getProp(props, '커버이미지', 'url') || '',
  };
}

// 공개(published) 글만, 최신순으로 반환
export async function getAllPosts() {
  const data = await notionFetch(`data_sources/${DATA_SOURCE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      sorts: [{ property: '발행일', direction: 'descending' }],
      page_size: 100,
    }),
  });
  return data.results.map(mapPage).filter(p => p.published && p.title);
}

export async function getPostBySlug(slug) {
  const posts = await getAllPosts();
  return posts.find(p => p.slug === slug) || null;
}

// ---- 페이지 본문 블록 → 안전한 HTML 변환 (지원: 문단/제목/목록/인용/구분선/이미지/굵게/링크) ----

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function richTextToHtml(rich) {
  return (rich || []).map(t => {
    let s = escapeHtml(t.plain_text).replace(/\n/g, '<br>');
    const a = t.annotations || {};
    if (a.code) s = `<code>${s}</code>`;
    if (a.bold) s = `<strong>${s}</strong>`;
    if (a.italic) s = `<em>${s}</em>`;
    if (a.strikethrough) s = `<del>${s}</del>`;
    if (t.href) s = `<a href="${escapeHtml(t.href)}" target="_blank" rel="noopener">${s}</a>`;
    return s;
  }).join('');
}

async function fetchBlockChildren(blockId) {
  let results = [];
  let cursor;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100';
    const data = await notionFetch(`blocks/${blockId}/children${qs}`);
    results = results.concat(data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function getPostHtml(pageId) {
  const blocks = await fetchBlockChildren(pageId);
  let html = '';
  let listBuffer = []; // { type: 'ul'|'ol', html }[]

  function flushList() {
    if (!listBuffer.length) return;
    const tag = listBuffer[0].type;
    html += `<${tag}>` + listBuffer.map(li => `<li>${li.html}</li>`).join('') + `</${tag}>`;
    listBuffer = [];
  }

  for (const block of blocks) {
    const t = block.type;
    const val = block[t];

    if (t === 'bulleted_list_item' || t === 'numbered_list_item') {
      const tag = t === 'bulleted_list_item' ? 'ul' : 'ol';
      if (listBuffer.length && listBuffer[0].type !== tag) flushList();
      listBuffer.push({ type: tag, html: richTextToHtml(val.rich_text) });
      continue;
    } else {
      flushList();
    }

    switch (t) {
      case 'paragraph': {
        const text = richTextToHtml(val.rich_text);
        html += text.trim() ? `<p>${text}</p>` : '';
        break;
      }
      case 'heading_1':
        html += `<h2>${richTextToHtml(val.rich_text)}</h2>`;
        break;
      case 'heading_2':
        html += `<h3>${richTextToHtml(val.rich_text)}</h3>`;
        break;
      case 'heading_3':
        html += `<h4>${richTextToHtml(val.rich_text)}</h4>`;
        break;
      case 'quote':
        html += `<blockquote>${richTextToHtml(val.rich_text)}</blockquote>`;
        break;
      case 'divider':
        html += `<hr>`;
        break;
      case 'image': {
        const src = val.type === 'external' ? val.external.url : val.file.url;
        const caption = richTextToHtml(val.caption);
        html += `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(caption || '')}" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        break;
      }
      case 'callout': {
        const emoji = val.icon && val.icon.type === 'emoji' ? val.icon.emoji : '💡';
        html += `<div class="callout"><span class="callout-icon">${emoji}</span><div>${richTextToHtml(val.rich_text)}</div></div>`;
        break;
      }
      default:
        // 지원하지 않는 블록 타입은 건너뜁니다 (표/코드/임베드 등 필요 시 확장)
        break;
    }
  }
  flushList();
  return html;
}
