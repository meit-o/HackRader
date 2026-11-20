import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-48 max-w-5xl items-center justify-center gap-3 px-4 text-sm text-ink2" role="status" aria-live="polite">
      <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ページを読み込んでいます…
    </main>
  );
}
