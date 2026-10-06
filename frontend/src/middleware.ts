import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Remove port for processing
  const hostnameWithoutPort = hostname.split(':')[0];

  let subdomain = '';

  // Extract subdomain logic
  if (hostnameWithoutPort.endsWith('.localhost')) {
    subdomain = hostnameWithoutPort.replace('.localhost', '');
  } else if (hostnameWithoutPort.includes('localhost') && hostnameWithoutPort !== 'localhost') {
    subdomain = hostnameWithoutPort.split('.')[0];
  } else if (hostnameWithoutPort !== 'localhost' && !/^[0-9.]+$/.test(hostnameWithoutPort) && !hostnameWithoutPort.endsWith('.vercel.app')) {
    // For normal domains (e.g., tenant.app.com)
    const parts = hostnameWithoutPort.split('.');
    if (parts.length >= 3) {
      subdomain = parts[0];
    }
  }

  if (subdomain === 'www') {
    subdomain = '';
  }

  // If a valid subdomain is found, rewrite the request internally to /[subdomain]/[...path]
  if (subdomain) {
    return NextResponse.rewrite(new URL(`/${subdomain}${url.pathname}${url.search}`, req.url));
  }

  // Otherwise, continue normally (landing page, register, etc.)
  return NextResponse.next();
}

