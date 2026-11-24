import { redirect } from "next/navigation";

/** The games now live under « Jouer » (and the Christmas ones under « Célébrer »). */
export default function JeuxPage() {
  redirect("/jouer");
}
