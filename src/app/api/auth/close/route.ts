import { NextRequest } from "next/server";

import { deleteSessionCookies } from "./_utils/borrarCookiesDeSesion";

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("token");

  if (!token) return new Response(null, { status: 401 });

  return new Response(null, {
    status: 200,
    headers: deleteSessionCookies(),
  });

  // If you want to automatically redirect instead of just deleting cookies:
  // return new Response(null, {
  //   status: 302,
  //   headers: {
  //     ...deleteSessionCookies(),
  //     Location: "/login",
  //   },
  // });
}