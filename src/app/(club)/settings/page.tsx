import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { uploadAvatar } from "./actions";
import { ProfileForm } from "./ProfileForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main style={{ maxWidth: "400px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Réglages</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        {session.user.name} — membre #{session.member.memberNumber}
      </p>

      <h2 style={{ fontSize: "16px", marginTop: "24px" }}>Avatar</h2>
      {session.user.image && (
        // eslint-disable-next-line @next/next/no-img-element -- raw <img> is fine for this unstyled placeholder page
        <img
          src={session.user.image}
          alt=""
          width={80}
          height={80}
          style={{ borderRadius: "50%", display: "block", marginBottom: "12px" }}
        />
      )}
      <form action={uploadAvatar} style={{ display: "flex", gap: "8px" }}>
        <input type="file" name="avatar" accept="image/*" required />
        <button type="submit">Envoyer</button>
      </form>

      <h2 style={{ fontSize: "16px", marginTop: "24px" }}>Profil</h2>
      <ProfileForm bio={session.member.bio} phone={session.member.phone} />
    </main>
  );
}
