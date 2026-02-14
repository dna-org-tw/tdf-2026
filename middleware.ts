import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 處理 /zh 和 /en 路徑，重新導向至根路徑並新增查詢參數
  if (pathname === '/zh' || pathname.startsWith('/zh/')) {
    const redirectUrl = new URL(request.url);
    // 移除 /zh 前綴，如果結果為空，則設為根路徑
    const remainingPath = pathname.replace(/^\/zh\/?/, '');
    redirectUrl.pathname = remainingPath ? `/${remainingPath}` : '/';
    redirectUrl.searchParams.set('lang', 'zh');
    return NextResponse.redirect(redirectUrl);
  }
  
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const redirectUrl = new URL(request.url);
    // 移除 /en 前綴，如果結果為空，則設為根路徑
    const remainingPath = pathname.replace(/^\/en\/?/, '');
    redirectUrl.pathname = remainingPath ? `/${remainingPath}` : '/';
    redirectUrl.searchParams.set('lang', 'en');
    return NextResponse.redirect(redirectUrl);
  }
  
  // 從 URL 查詢參數獲取語言
  const langParam = request.nextUrl.searchParams.get('lang');
  const lang = langParam === 'en' ? 'en' : 'zh-TW';
  
  // 將語言設置到請求頭中，以便 layout.tsx 可以使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-lang', lang);
  
  // 如果有語言參數，也將它存儲在 cookie 中以便持久化
  if (langParam) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.cookies.set('lang', lang, {
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }
  
  // 如果沒有語言參數，檢查 cookie
  const cookieLang = request.cookies.get('lang')?.value;
  if (cookieLang) {
    requestHeaders.set('x-lang', cookieLang);
  }
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
