"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/core/auth/session";
import {
  cancelBooking,
  markPickedUp,
  markReturned,
  respondToBooking,
} from "@/modules/pretotheque/data/bookings";

async function requireMemberId(): Promise<string | null> {
  const session = await getSession();
  return session?.member.id ?? null;
}

export async function approveRequest(bookingId: string): Promise<void> {
  const memberId = await requireMemberId();
  if (!memberId) return;
  await respondToBooking(bookingId, "approved", memberId);
  revalidatePath("/pretotheque/mine");
}

export async function rejectRequest(bookingId: string): Promise<void> {
  const memberId = await requireMemberId();
  if (!memberId) return;
  await respondToBooking(bookingId, "rejected", memberId);
  revalidatePath("/pretotheque/mine");
}

export async function confirmPickup(bookingId: string): Promise<void> {
  const memberId = await requireMemberId();
  if (!memberId) return;
  await markPickedUp(bookingId, memberId);
  revalidatePath("/pretotheque/mine");
}

export async function confirmReturn(bookingId: string): Promise<void> {
  const memberId = await requireMemberId();
  if (!memberId) return;
  await markReturned(bookingId, memberId);
  revalidatePath("/pretotheque/mine");
}

export async function cancelMyBooking(bookingId: string): Promise<void> {
  const memberId = await requireMemberId();
  if (!memberId) return;
  await cancelBooking(bookingId, memberId);
  revalidatePath("/pretotheque/mine");
}
