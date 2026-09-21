"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Mobile bottom-sheet style (slides up from bottom, rounded top). Desktop stays centered. */
  sheet?: boolean;
}

/**
 * Accessible modal overlay used across the DJ dashboard.
 * Closes on backdrop click and Escape.
 */
export function Modal({ open, onClose, children, className = "", sheet = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[300] flex justify-center bg-black/80 p-4 ${sheet ? "items-end lg:items-center lg:p-4" : "items-center"}`}
      onClick={onClose}
    >
      <div
        className={`relative max-h-[92vh] w-full overflow-y-auto bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${
          sheet
            ? "max-w-lg animate-slide-up rounded-t-[20px] border border-b-0 border-edge p-[28px_24px_44px] lg:animate-none lg:rounded-2xl lg:border-b"
            : "max-w-lg rounded-2xl border border-edge p-6"
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;