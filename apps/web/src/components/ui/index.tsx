"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
export { FileUpload } from "./file-upload";

import { forwardRef, useEffect, useId, useRef } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function classes(...values: (string | undefined | false)[]) {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ink" | "secondary" | "danger";
  size?: "small" | "regular";
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant, size, fullWidth, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={classes(
          "btn",
          variant === "primary" && "signal",
          variant === "secondary" && "ghost",
          variant === "danger" && "danger",
          size === "small" && "small",
          fullWidth && "block",
          className,
        )}
        {...props}
      />
    );
  },
);

// Aceternity's stateful feedback pattern, driven by the actual request state.
export function StatefulButton({
  loading = false,
  success = false,
  children,
  disabled,
  ...props
}: ButtonProps & { loading?: boolean; success?: boolean }) {
  const reducedMotion = useReducedMotion();
  return (
    <Button {...props} disabled={disabled || loading} aria-busy={loading}>
      <AnimatePresence initial={false}>
        {(loading || success) && (
          <motion.span
            className="button-feedback"
            key={loading ? "loading" : "success"}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 18 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            aria-hidden="true"
          >
            <svg
              className={loading ? "button-spinner" : undefined}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {loading ? (
                <path d="M21 12a9 9 0 1 1-9-9" />
              ) : (
                <path d="m5 12 4 4L19 6" />
              )}
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </Button>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={classes("input", className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={classes("input", className)} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={classes("input", className)} {...props} />
  );
});

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}) {
  const id = useId();
  const description = error || hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-describedby": description ? `${id}-description` : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {description && (
        <p id={`${id}-description`} className={error ? "field-error" : "muted"}>
          {description}
        </p>
      )}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span className={classes("badge", `tone-${tone}`, className)} {...props} />
  );
}

export function Alert({
  tone = "info",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={classes("alert", `tone-${tone}`, className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes("card", className)} {...props} />;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  closeDisabled = false,
}: {
  open: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open && !dialog.open) return;
    if (open && !dialog.open) dialog.showModal();
    // Preserve native focus trapping and restoration while animating the surface.
    const controls = animate(
      dialog,
      {
        opacity: open ? [0, 1] : [1, 0],
        y: open ? [6, 0] : [0, 6],
        scale: open ? [0.985, 1] : [1, 0.985],
      },
      { duration: reducedMotion ? 0 : 0.18, ease: "easeOut" },
    );
    let cancelled = false;
    void controls.then(() => {
      if (!cancelled && !open) dialog.close();
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [open, reducedMotion]);

  return (
    <dialog
      ref={ref}
      className={classes("ui-dialog", className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(event) => {
        if (closeDisabled || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="ui-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="secondary"
          size="small"
          className="ui-dialog-close"
          aria-label={`Close ${title.toLowerCase()}`}
          disabled={closeDisabled}
          onClick={onClose}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </Button>
      </header>
      <div className="ui-dialog-body">{children}</div>
    </dialog>
  );
}
