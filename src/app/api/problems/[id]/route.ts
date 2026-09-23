import { publicProblems } from "@/lib/public-problems";

export async function GET(_request: Request, context: RouteContext<"/api/problems/[id]">) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Problem not found." }, { status: 404 });
  }
  const [problem] = await publicProblems(id);
  if (!problem) return Response.json({ error: "Problem not found." }, { status: 404 });
  return Response.json(problem);
}
