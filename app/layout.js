import "./globals.css";

export const metadata = {
  title: "サロン AI コンテンツツール",
  description: "ホットペッパービューティー・Instagram・ブログ・Googleビジネス向けコンテンツ自動生成",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
