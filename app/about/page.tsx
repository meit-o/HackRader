import type { Metadata } from "next";
import { IntroContent } from "@/components/intro-content";

export const metadata: Metadata = {
  title: "HackRadarとは | HackRadar",
  description:
    "HackRadarは、ハッカソンの参加者・チームとGitHubの開発状況（進捗）をリアルタイムに可視化するダッシュボードです。参加登録は3ステップ。",
  alternates: { canonical: "https://www.hackradar.dev/about" }
};

export default function AboutPage() {
  return (
    <main className="relative min-h-screen bg-paper px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <IntroContent variant="about" />
      </div>
    </main>
  );
}
