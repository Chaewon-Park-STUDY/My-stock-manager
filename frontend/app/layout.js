import localFont from "next/font/local";
import Nav from "@/components/Nav";
import "./globals.css";

// 한글 가독성이 좋은 Pretendard 폰트 (npm 패키지에서 불러와 인터넷 없이도 동작)
const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata = {
  title: "내주식관리앱",
  description: "배당·단타·장기투자·이자를 한 곳에서 관리하는 개인 자산관리 앱",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${pretendard.variable} antialiased`}>
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Nav />
          <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
