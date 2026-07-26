import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { NewItemForm } from "./NewItemForm";

export default async function NewItemPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ maxWidth: "440px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Ajouter un objet</h1>
      <NewItemForm />
    </main>
  );
}
