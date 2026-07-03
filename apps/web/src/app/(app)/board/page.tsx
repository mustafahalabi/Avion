import { redirect } from "next/navigation";

// `/board` (the standalone `@avion/api` Socket.IO kanban) and `/work/board`
// (the plain task kanban) were three-way redundant with the live pipeline. They
// are consolidated into **Mission Control** (`/work/live`), which carries agent
// identity + live timers and offers a Board lens over the same data. Kept as a
// redirect so existing links / bookmarks resolve. (The `@avion/api` backend and
// `LiveBoard` component remain for external/embedded use — see MUS-260.)
export default function BoardPage() {
  redirect("/work/live");
}
