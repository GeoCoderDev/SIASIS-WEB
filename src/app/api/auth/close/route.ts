import { NextRequest } from "next/server";

import { borrarCookiesDeSesion } from "./_utils/borrarCookiesDeSesion";

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("token");

  if (!token) return new Response(null, { status: 401 });

  return new Response(null, {
    status: 200,
    headers: borrarCookiesDeSesion(),
  });

  // If you want to automatically redirect instead of just deleting cookies:
  // return new Response(null, {
  //   status: 302,
  //   headers: {
  //     ...borrarCookiesDeSesion(),
  //     Location: "/login",
  //   },
  // });
}
