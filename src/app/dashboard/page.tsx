import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");

  if (user.role === "admin") redirect("/admin");
  if (user.role === "seller") redirect("/dashboard/penjual");
  // Buyer has no dashboard — orders are home.
  redirect("/pesanan");
}
