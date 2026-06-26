"use client";

import { Suspense, useActionState } from "react";
import { registerUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function RegisterForm() {
  const [state, action, pending] = useActionState(registerUser, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-neutral-400">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Alex Chen"
          className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 transition-colors"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-neutral-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 transition-colors"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-400">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-medium text-neutral-400"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Min. 8 characters"
          className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 transition-colors"
        />
        {state?.errors?.password && (
          <p className="text-xs text-red-400">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-400">
          {state.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        loading={pending}
        className="mt-1 w-full bg-white text-neutral-900 hover:bg-neutral-100"
      >
        Create account
      </Button>

      <p className="text-center text-xs text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="text-neutral-400 hover:text-neutral-200 transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <span className="text-sm font-bold text-neutral-900">E</span>
          </div>
          <span className="text-base font-semibold text-neutral-100">
            Engineering OS
          </span>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="mb-1 text-lg font-semibold text-neutral-100">
            Create your account
          </h1>
          <p className="mb-6 text-sm text-neutral-500">
            Your virtual engineering company awaits
          </p>

          <Suspense fallback={<div className="h-56" />}>
            <RegisterForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-600">
          Engineering OS · Internal platform
        </p>
      </div>
    </div>
  );
}
