import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ContactProfile } from "@/lib/modules/contact-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute(
      sql`SELECT id, name, revision, active, definition FROM module_contact_profile WHERE active ORDER BY name, id`
    );
    const list = result.rows as unknown as ContactProfile[];
    return Response.json(
      list.map((p) => ({
        ...p,
        definition: {
          ...p.definition,
          fields: p.definition.fields.filter((f) => f.channel !== "INTERNO"),
        },
      })),
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[perfis/publicos]", e);
    return Response.json([], { headers: { "cache-control": "no-store" } });
  }
}
