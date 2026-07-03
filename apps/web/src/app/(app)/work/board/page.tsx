import { redirect } from "next/navigation";

// Consolidated into Mission Control (`/work/live`) — its Board lens renders the
// same tasks with agent identity + live timers. Kept as a redirect so existing
// links resolve.
export default function WorkBoardPage() {
  redirect("/work/live");
}
