import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { listRecentActivity } from "@/core/activity";
import { listNotifications } from "@/core/notifications";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [activityEntries, notifications] = await Promise.all([
    listRecentActivity(20),
    listNotifications(session.member.id, 20),
  ]);

  return (
    <main style={{ maxWidth: "500px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>LE CLHUB</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        {session.user.name} — membre #{session.member.memberNumber} —{" "}
        <a href="/invite">inviter quelqu&apos;un</a>
      </p>

      <h2 style={{ fontSize: "16px", marginTop: "32px" }}>Notifications</h2>
      {notifications.length === 0 && (
        <p style={{ color: "#999", fontSize: "14px" }}>Rien pour l&apos;instant.</p>
      )}
      <ul style={{ fontSize: "14px", paddingLeft: "20px" }}>
        {notifications.map((n) => (
          <li key={n.id}>
            [{n.kind}] {JSON.stringify(n.payload)} — {n.createdAt.toLocaleString("fr-FR")}
            {!n.readAt && " • non lu"}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: "16px", marginTop: "32px" }}>Activité du club</h2>
      <ul style={{ fontSize: "14px", paddingLeft: "20px" }}>
        {activityEntries.map((a) => (
          <li key={a.id}>
            [{a.section}/{a.kind}] {JSON.stringify(a.payload)} —{" "}
            {a.createdAt.toLocaleString("fr-FR")}
          </li>
        ))}
      </ul>
    </main>
  );
}
