import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '吨吨记 · 把今天喝的，贴进日历里',
  description:
    '吨吨记应用下载与版本说明。用奶油纸贴记录饮品、穿搭、美食和今天的小心情。',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
