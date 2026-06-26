"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar
          src={user.image}
          fallback={user.name ?? user.email ?? "?"}
          size="sm"
        />
        <span className="max-w-[120px] truncate text-xs font-medium text-neutral-300">
          {user.name ?? user.email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-neutral-800 bg-neutral-900 p-1 shadow-xl shadow-black/40"
        >
          <div className="px-3 py-2 border-b border-neutral-800 mb-1">
            <p className="text-xs font-medium text-neutral-200 truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
          </div>

          <Link
            role="menuitem"
            href="/settings"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </Link>

          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
            onClick={() => signOut(() => router.push("/sign-in"))}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
