import { requireApiUser } from "@/lib/auth";
import { layoutSchema } from "@/lib/certificate/layout";
import { renderCertificate, type CertificateData } from "@/lib/certificate/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renders a sample certificate from a layout that has NOT been saved yet.
 *
 * The editor cannot fake this in the browser: whether a name fits, shrinks,
 * wraps or gets clipped depends on real font metrics from the same canvas the
 * generator uses. So the only honest preview is one produced by the renderer
 * itself, which is what this route is for.
 */

const SAMPLES: Record<string, CertificateData> = {
  normal: {
    certificateId: "TS-2026-0001",
    fullName: "Aarav Sharma",
    domain: "Web Development",
    institution: "Delhi Technological University",
    startDate: "2026-01-12",
    endDate: "2026-03-09",
    issuedOn: new Date(),
  },
  long: {
    certificateId: "TS-2026-0002",
    fullName: "Lakshminarayanan Balasubramaniam Venkataraghavan",
    domain: "Artificial Intelligence and Machine Learning",
    institution: "Indian Institute of Information Technology, Allahabad",
    startDate: "2026-01-05",
    endDate: "2026-06-30",
    issuedOn: new Date(),
  },
  short: {
    certificateId: "TS-2026-0003",
    fullName: "Ravi K",
    domain: "UI/UX",
    institution: "NIT Trichy",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    issuedOn: new Date(),
  },
};

export async function POST(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const { layout, sample } = (body ?? {}) as { layout?: unknown; sample?: string };
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { ok: false, error: `${issue?.path.join(".") || "layout"}: ${issue?.message}` },
      { status: 400 },
    );
  }

  const data = SAMPLES[sample ?? "normal"] ?? SAMPLES.normal;

  try {
    const { png, adjustedFields } = await renderCertificate(data, parsed.data);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        // Read by the editor to warn that a value had to be shrunk or clipped,
        // which is invisible on a downscaled preview image.
        "X-Adjusted-Fields": adjustedFields.join(","),
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
