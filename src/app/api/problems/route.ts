import { publicProblems } from "@/lib/public-problems";
export async function GET() {
  return Response.json({ problems: await publicProblems() });
}
