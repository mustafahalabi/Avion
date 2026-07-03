import { redirect } from "next/navigation";

// The Dashboard and Control Center were near-duplicate overviews in two design
// languages. They are consolidated into one **Home** at `/control-center`
// (planning next-actions, live pipeline, attention queue, and company health in
// one place). Kept as a redirect so existing links resolve.
export default function DashboardPage() {
  redirect("/control-center");
}
