import { NextRequest } from "next/server";
import { auth } from "@/lib/staff-bff";
type Context = { params: Promise<{ action: string }> };
async function handle(request: NextRequest, context: Context) {
  return auth(request, (await context.params).action);
}
export const GET = handle;
export const POST = handle;
