import Link from "next/link";
import {
  ArrowRight,
  HeartHandshake,
  Radar,
  UserRoundPlus,
  Users
} from "lucide-react";
import { HackRadarLogo } from "@/components/hackradar-logo";

const steps = [
  {
    title: "プロフィールを登録する",
    body: "GitHubでログインして、参加するハッカソンとチームを登録します。",
    icon: UserRoundPlus
  },
  {
    title: "参加者・チーム・進捗が見える",
    body: "誰が参加していて、各チームの進捗（ポイント）が一覧でわかります。",
    icon: Users
  },
  {
    title: "見つけてもらえる",
    body: "運営に自分のチームと作品を知ってもらえます。",
    icon: Radar
  }
];

type IntroContentProps = {
  /**
   * "about": /about ページ用。CTAはトップ（＝登録開始点）へリンクし、
   * 登録済み向けのダッシュボードリンクも表示する。
   * "top": トップページのゲスト向け先頭セクション用。CTAはGitHubログイン
   * そのものへリンクし（直下のオンボーディングにもログイン導線があるため
   * 遷移だけのボタンは置かない）、ダッシュボードリンクは出さない。
   */
  variant?: "about" | "top";
};

export function IntroContent({ variant = "about" }: IntroContentProps) {
  const isTop = variant === "top";

  return (
    <div className="space-y-8">
      <header className="text-center">
        <HackRadarLogo className="mx-auto size-16" />
        <p className="mt-5 text-sm font-bold text-pulse">HackRadarとは</p>
        <h1 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-ink sm:text-[2.5rem] sm:leading-snug">
          ハッカソンの参加者・チーム・進捗が、ひと目でわかる。
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink2 sm:text-base sm:leading-7">
          HackRadarは、ハッカソンに参加する人・チームと、GitHubの開発状況（進捗）をリアルタイムに可視化するダッシュボードです。
        </p>
      </header>

      <section aria-labelledby="steps-heading">
        <h2
          id="steps-heading"
          className="mb-4 text-center text-xl font-bold tracking-tight text-ink"
        >
          使い方は3ステップ
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                key={step.title}
                className="rounded-2xl border border-line/70 bg-surface p-5 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-sand text-pulse shadow-soft">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-lg font-bold text-pulse">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-line/70 bg-surface p-2 shadow-card">
        <div className="flex items-start gap-4 rounded-xl border border-pulse/25 bg-pulse/5 px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-pulse shadow-soft">
            <HeartHandshake aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-bold tracking-tight text-ink">運営の方へ</h2>
            <p className="mt-1 text-sm leading-6 text-ink2 sm:text-base sm:leading-7">
              参加者と作品の状況がひと目で把握できるので、声かけやサポートがしやすくなります。
            </p>
          </div>
        </div>
      </section>

      <div className="text-center">
        <Link
          href={isTop ? "/api/auth/github" : "/"}
          className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-ink px-8 text-sm font-bold text-white shadow-btn transition-[box-shadow,background-color,transform] hover:bg-ink2 active:translate-y-px active:shadow-pressed"
        >
          参加登録をはじめる
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <p className="mt-3 text-sm leading-6 text-muted">
          GitHubアカウントでログインします
        </p>
      </div>

      {!isTop && (
        <footer className="text-center text-sm leading-6 text-muted">
          すでに登録済みの方は{" "}
          <Link
            href="/dashboard"
            className="font-bold text-pulse underline underline-offset-4"
          >
            ダッシュボードを見る
          </Link>
        </footer>
      )}
    </div>
  );
}
