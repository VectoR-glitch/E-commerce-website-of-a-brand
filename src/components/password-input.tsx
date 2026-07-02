"use client";
import { useState } from "react";

// A password field with a show/hide toggle. Drop-in replacement for a plain
// <input type="password"> — spreads all the usual input props (name, id,
// required, autoComplete, minLength, placeholder, className). The trailing
// eye button flips the input between password and text.
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        // Explicit type wins over any type passed in props.
        type={show ? "text" : "password"}
        className={`${className ?? ""} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-ink/40 transition-colors hover:text-forest"
      >
        {show ? (
          // eye-off
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M8.2 4.2A7.5 7.5 0 0110 4c4 0 7 3.5 8 6-.4 1-1.2 2.2-2.4 3.2M5 5.3C2.9 6.6 1.5 8.6 1 10c1 2.5 4 6 9 6a8.7 8.7 0 003.6-.8M3 3l14 14M9 9a1.8 1.8 0 002.4 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // eye
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M1 10c1-2.5 4-6 9-6s8 3.5 9 6c-1 2.5-4 6-9 6s-8-3.5-9-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        )}
      </button>
    </div>
  );
}