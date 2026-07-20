export const metadata = {
  title: '호평아산내과 건강검진센터',
  description: '남양주 호평동 호평아산내과 건강검진센터 — 검진·내시경·초음파·만성질환 관리',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
