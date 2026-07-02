"use client";

// A submit button that asks for confirmation before letting its form submit.
// Used for destructive admin actions (delete product / variant) so a stray
// click can't wipe data. Cancelling preventDefaults the submit.
export function ConfirmSubmit({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}