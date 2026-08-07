import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Clerkのドメイン制限(Allowlist)は有料プラン限定のため、代わりにアプリ側でメールドメインを制限する。
// 未設定なら制限なし。実際の案件では顧客企業の実ドメインに変更すること。
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth.protect();

  if (ALLOWED_EMAIL_DOMAIN) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress.toLowerCase() ?? "";
    if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      return NextResponse.json(
        { error: `許可されたメールドメイン(@${ALLOWED_EMAIL_DOMAIN})以外はアクセスできません` },
        { status: 403 }
      );
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
