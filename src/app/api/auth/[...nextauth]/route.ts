import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

const authHandler = NextAuth(authOptions);

async function handler(request: Request, context: RouteContext<"/api/auth/[...nextauth]">) {
  const { nextauth } = await context.params;
  if (process.env.NODE_ENV === "production" && nextauth[1] === "dev") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return authHandler(request, context);
}

export { handler as GET, handler as POST };
