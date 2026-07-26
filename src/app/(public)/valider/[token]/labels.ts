export function describeTokenError(reason: "not-found" | "expired" | "used"): string {
  switch (reason) {
    case "not-found":
      return "Ce lien n'est pas valide.";
    case "expired":
      return "Ce lien a expiré.";
    case "used":
      return "Cette demande a déjà été traitée.";
  }
}

export function describeRespondError(
  reason: "not-found" | "forbidden" | "already-responded" | "conflict",
): string {
  switch (reason) {
    case "not-found":
      return "Cette réservation n'existe plus.";
    case "forbidden":
      return "Tu n'es pas autorisé à valider cette demande.";
    case "already-responded":
      return "Cette demande a déjà été traitée.";
    case "conflict":
      return "Ces dates viennent d'être prises par une autre réservation confirmée.";
  }
}
