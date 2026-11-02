import { NextRequest } from "next/server";
import { proxy } from "@/lib/staff-bff";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
