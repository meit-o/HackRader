export function SupportFooter() {
  const email = process.env.SUPPORT_EMAIL?.trim();

  if (!email) {
    return null;
  }

  const subject = encodeURIComponent("HackRadarの不具合報告");

  return (
    <footer className="border-t border-line bg-paper px-4 py-5 text-center text-sm text-muted">
      <a
        href={`mailto:${encodeURIComponent(email)}?subject=${subject}`}
        className="inline-flex min-h-11 items-center rounded-md px-3 underline underline-offset-4 hover:text-pulse"
      >
        バグを報告
      </a>
    </footer>
  );
}
