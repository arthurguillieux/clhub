import { NextResponse } from "next/server";
import { buildIcsFeedForToken } from "@/modules/pretotheque/data/icalFeed";

/**
 * Public by design — calendar apps subscribe to this URL directly, no
 * interactive login possible. The random token in the path is what stands
 * in for authentication, same as any private iCal feed (Google Calendar, etc).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const ics = await buildIcsFeedForToken(token);
  if (!ics) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="clhub.ics"',
    },
  });
}
