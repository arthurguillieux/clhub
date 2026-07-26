import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item, project, type Project } from "@/core/db/schema";
import { createBookingRequest, type BookingRequestResult } from "./bookings";

export interface CreateProjectInput {
  name: string;
  startDate: string;
  endDate: string;
  message: string | null;
  itemIds: string[];
}

export interface ProjectItemResult {
  itemId: string;
  itemName: string;
  result: BookingRequestResult;
}

/**
 * Creates the project label, then requests each item independently through
 * the ordinary single-item booking path — every item still gets its own
 * validation, its own owner decision, and the same exclusion-constraint
 * safety net. One item conflicting doesn't block the others.
 */
export async function createProjectWithBookings(
  requesterId: string,
  input: CreateProjectInput,
): Promise<{ project: Project; results: ProjectItemResult[] }> {
  const [createdProject] = await db
    .insert(project)
    .values({
      requesterId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      message: input.message,
    })
    .returning();
  if (!createdProject) throw new Error("Failed to create project");

  const items = await db.select().from(item).where(inArray(item.id, input.itemIds));
  const itemNameById = new Map(items.map((i) => [i.id, i.name]));

  const results: ProjectItemResult[] = [];
  for (const itemId of input.itemIds) {
    const result = await createBookingRequest({
      itemId,
      borrowerId: requesterId,
      startDate: input.startDate,
      endDate: input.endDate,
      message: input.message,
      projectId: createdProject.id,
    });
    results.push({ itemId, itemName: itemNameById.get(itemId) ?? "Objet", result });
  }

  return { project: createdProject, results };
}

export interface ProjectBookingSummary {
  bookingId: string;
  itemId: string;
  itemName: string;
  itemSlug: string;
  status: string;
}

export interface ProjectWithBookings extends Project {
  bookings: ProjectBookingSummary[];
}

export async function listProjectsForMember(requesterId: string): Promise<ProjectWithBookings[]> {
  const projects = await db
    .select()
    .from(project)
    .where(eq(project.requesterId, requesterId))
    .orderBy(desc(project.createdAt));
  if (projects.length === 0) return [];

  const bookings = await db
    .select({ booking, itemName: item.name, itemSlug: item.slug })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(
      inArray(
        booking.projectId,
        projects.map((p) => p.id),
      ),
    );

  const bookingsByProject = new Map<string, ProjectBookingSummary[]>();
  for (const row of bookings) {
    if (!row.booking.projectId) continue;
    const list = bookingsByProject.get(row.booking.projectId) ?? [];
    list.push({
      bookingId: row.booking.id,
      itemId: row.booking.itemId,
      itemName: row.itemName,
      itemSlug: row.itemSlug,
      status: row.booking.status,
    });
    bookingsByProject.set(row.booking.projectId, list);
  }

  return projects.map((p) => ({ ...p, bookings: bookingsByProject.get(p.id) ?? [] }));
}
