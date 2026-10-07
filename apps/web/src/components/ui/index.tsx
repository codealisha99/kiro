"use client";

import { forwardRef, useId } from "react";
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
