import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/auth/callback", "/api/health"];
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function securityHeaders(response: NextResponse, nonce: string, development: boolean) {
  const scripts = development ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'` : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  response.headers.set("Content-Security-Policy", `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src ${scripts}; connect-src 'self' https://*.supabase.co https://api.xiaomimimo.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestId = request.headers.get("x-request-id")?.slice(0, 64) ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  const secure = (value: NextResponse) => {
    value.headers.set("x-request-id", requestId);
    return securityHeaders(value, nonce, process.env.NODE_ENV !== "production");
  };
  if (request.nextUrl.pathname.startsWith("/api/v1/") && unsafeMethods.has(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) return secure(NextResponse.json({ error: "Origem inválida" }, { status: 403 }));
  }
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return secure(response);
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", request.nextUrl.pathname);
    return secure(NextResponse.redirect(login));
  }
  if (user && request.nextUrl.pathname === "/login") {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    return secure(NextResponse.redirect(dashboard));
  }
  return secure(response);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
