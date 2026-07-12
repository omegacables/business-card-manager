import { NextResponse } from "next/server";

// Apple App Site Association (AASA) を配信する。
// iOS は https://<domain>/.well-known/apple-app-site-association を取得し、
// ここに列挙された appID / paths に対して Universal Links を有効化する。
// 実際の公開パスは /.well-known/... （next.config.ts の rewrite でここへ転送）。
export const dynamic = "force-dynamic";

const APP_BUNDLE_ID = "app.rork.tyl7sdawrtvvc61p9zjd0";

// Apple Developer チームID。Vercel に EXPO_PUBLIC_TEAM_ID があればそれを優先。
const DEFAULT_TEAM_ID = "525PRK5N5U";

export async function GET() {
  const teamId = process.env.EXPO_PUBLIC_TEAM_ID || DEFAULT_TEAM_ID;

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${APP_BUNDLE_ID}`,
          paths: ["/line-callback*"],
        },
      ],
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
