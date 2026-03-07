import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

export async function parseJsonBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const raw = await req.json();
  return schema.parse(raw);
}

export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}
