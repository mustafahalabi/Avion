import { redirect } from "next/navigation";

// Chat is the CEO's home surface (MUS-303): state a goal and watch it ship.
export default function RootPage() {
  redirect("/chat");
}
