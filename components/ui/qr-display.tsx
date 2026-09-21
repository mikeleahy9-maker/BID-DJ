"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a real QR code (data URL) for guest-join links.
 */
export function QrDisplay({ value, size = 160, className = "" }: QrDisplayProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-white ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-black/40">…</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`QR code: ${value}`}
      width={size}
      height={size}
      className={`rounded-xl bg-white ${className}`}
    />
  );
}

export default QrDisplay;