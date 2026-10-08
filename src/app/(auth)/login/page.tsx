"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

/**
 * Login page, driven by a server action via <form action={...}>.
 * Works even if client JS fails to hydrate: the browser submits the form
 * natively, the server action runs, and the redirect is real — no silent
 * "nothing happens" failures.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    { error: null }
  );

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Sign in to your Draftly account.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {state.error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}

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
            autoComplete="current-password"
            required
            className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        New to Draftly?{" "}
        <Link href="/signup" className="font-medium text-accent hover:text-accent-strong">
          Create an account
        </Link>
      </p>
    </div>
  );
}
