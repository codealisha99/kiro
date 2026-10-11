"use client";

// Adapted from Aceternity UI's File Upload. See docs/ui-attributions.md.
import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useDropzone } from "react-dropzone";
import { WorkspaceIcon } from "../WorkspaceIcon";

export function FileUpload({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    multiple: false,
    disabled,
    maxSize: 10 * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    onDrop: (accepted, rejected) => {
      if (rejected.length) {
        setError(
          rejected.some(({ errors }) =>
            errors.some(({ code }) => code === "file-too-large"),
          )
            ? "Choose a document smaller than 10 MB."
            : "Choose one PDF, Markdown, text, or CSV document.",
        );
        return;
      }
      setError(null);
      if (accepted[0]) onChange(accepted[0]);
    },
  });

  return (
    <div className="file-upload">
      <div
        {...getRootProps({
          className: `file-upload-zone${isDragActive ? " is-dragging" : ""}`,
          role: "button",
          "aria-label": file ? "Replace document" : "Choose a document",
          "aria-describedby": `${id}-hint`,
          "aria-disabled": disabled,
        })}
      >
        <input {...getInputProps()} />
        <motion.div
          className="file-upload-tile"
          aria-hidden="true"
          animate={{
            y: !reducedMotion && isDragActive ? -6 : 0,
            rotate: !reducedMotion && isDragActive ? -4 : 0,
          }}
          transition={{ duration: 0.18 }}
        >
          <WorkspaceIcon
            name={file ? "file" : "upload"}
            width="25"
            height="25"
          />
        </motion.div>
        <strong>
          {isDragActive
            ? "Drop your document here"
            : file
              ? "Choose a different document"
              : "Drop a document, or browse"}
        </strong>
        <span id={`${id}-hint`}>PDF, Markdown, text, or CSV · up to 10 MB</span>
      </div>
      {file && (
        <motion.div
          className="file-upload-selected"
          key={`${file.name}-${file.lastModified}`}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <WorkspaceIcon name="file" />
          <div>
            <strong>{file.name}</strong>
            <span>
              {file.size < 1024 * 1024
                ? `${Math.max(1, Math.ceil(file.size / 1024))} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}{" "}
              · Ready to add
            </span>
          </div>
          <button
            type="button"
            disabled={disabled}
            aria-label="Remove selected document"
            onClick={() => {
              onChange(null);
              setError(null);
            }}
          >
            <WorkspaceIcon name="close" />
          </button>
        </motion.div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="file-upload-retry"
            onClick={open}
            disabled={disabled}
          >
            Browse files
          </button>
        </p>
      )}
    </div>
  );
}
