import { z } from "zod";

export const CATEGORIES = ["bricolage", "jardinage", "menage", "festif", "autre"] as const;
export const CONDITIONS = ["neuf", "bon", "usage", "fragile"] as const;

/** Empty strings from optional form fields should read as "not provided", not "invalid". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const optionalEuros = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || v.trim() === "") return null;
    const value = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  });

/** Shared by create (new/actions.ts) and edit ([slug]/actions.ts) — same fields, same rules either way. */
export const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(120),
  description: optionalText(2000),
  category: z.enum(CATEGORIES),
  brand: optionalText(120),
  model: optionalText(120),
  productUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.url().safeParse(v).success, "Lien invalide"),
  priceCents: optionalEuros,
  replacementValueCents: optionalEuros,
  condition: z.enum(CONDITIONS),
  accessories: optionalText(1000),
  consumables: optionalText(1000),
  safetyNotes: optionalText(1000),
  pickupLocation: optionalText(200),
  pickupNotes: optionalText(1000),
  autoApprove: z.boolean(),
  maxLoanDays: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number.parseInt(v, 10) : null)),
  bufferDays: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number.parseInt(v, 10) : 0)),
});

/** Reads the fields itemFormSchema expects out of a submitted item form's FormData. */
export function itemFormDataToInput(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    productUrl: formData.get("productUrl"),
    priceCents: formData.get("price"),
    replacementValueCents: formData.get("replacementValue"),
    condition: formData.get("condition"),
    accessories: formData.get("accessories"),
    consumables: formData.get("consumables"),
    safetyNotes: formData.get("safetyNotes"),
    pickupLocation: formData.get("pickupLocation"),
    pickupNotes: formData.get("pickupNotes"),
    // Unchecked checkboxes are simply absent from FormData (getting `null`,
    // not `undefined`) — normalize to a real boolean before Zod ever sees it.
    autoApprove: formData.get("autoApprove") === "on",
    maxLoanDays: formData.get("maxLoanDays"),
    bufferDays: formData.get("bufferDays"),
  };
}
