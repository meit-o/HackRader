import { NextResponse, type NextRequest } from "next/server";
import { isDemoModeEnabled } from "@/lib/env";
import { isGitHubAuthConfigured } from "@/lib/github-auth";
import { isSameOriginRequest } from "@/lib/request-origin";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // GitHub authenticates deliveries using the raw-body HMAC in its route.
  if (path === "/api/github/webhook" || path === "/api/health") return NextResponse.next();

  if (!isDemoModeEnabled() && !isGitHubAuthConfigured()) {
    return NextResponse.json({ error: "認証設定を確認しています。時間をおいて再度お試しください。" }, { status: 503 });
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "HackRadarの画面から操作してください。" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*", "/dashboard/:path*", "/help/:path*", "/announcements/:path*"]
};
