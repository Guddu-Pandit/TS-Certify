import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out visitors to /login.
 *
 * This is a gate, not the security boundary. Each page and API route
 * re-checks the session server-side (see src/lib/auth.ts) — middleware alone
 * would be bypassable and cannot see roles, which live in the database.
 */
export async function middleware(request: NextRequest) {
  // Start from a response that carries the incoming cookies, so anything
  // Supabase refreshes below gets written back to the browser.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates against Supabase and, as a side effect, refreshes an
  // expiring token. Do not replace it with getSession(), which only decodes
  // the cookie and would let an expired session linger.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    // Remember where they were headed so login can send them back.
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   /login          the sign-in page itself (would loop)
     *   /verify/*       the public QR verification page — must stay open
     *   /api/verify/*   data for that page
     *   /api/cron/*     called by Vercel Cron, authorised by CRON_SECRET instead
     *   /auth/*         Supabase auth callbacks
     *   static assets and image files
     */
    "/((?!login|verify|api/verify|api/cron|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
