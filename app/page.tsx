import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to conversations page (T078 - homepage entry point)
  // Use relative path - Next.js automatically prepends basePath ("/outreach")
  redirect("/conversations");
}
