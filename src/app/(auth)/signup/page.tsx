"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

/**
 * Signup page, driven by a server action via <form action={...}> —
 * same hydration-proof pattern as the login page.
 */
export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    { error: null }
  );

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Start building content that sounds like you.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {state.error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-hint"
            className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
          <p id="password-hint" className="text-xs text-text-faint">
            At least 8 characters.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
