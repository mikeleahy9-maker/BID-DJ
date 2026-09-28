"use client";

import { Modal } from "@/components/ui/modal";

/**
 * GuestBidAllModal - port of the prototype's BID ALL confirmation sheet
 * (#bid-all-modal): warns that every remaining credit goes on one song and
 * that it cannot be undone.
 */
export function GuestBidAllModal({
  open,
  songTitle,
  amount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  songTitle: string;
  amount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} sheet className="text-center">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
      >
        ✕
      </button>
      <div className="text-[52px]" aria-hidden>
        🔥
      </div>
      <div className="mt-3 font-display text-[32px] tracking-[2px]">Go All In?</div>
      <div className="mt-1.5 text-[13px] text-muted">{songTitle}</div>
      <div className="my-2 font-display text-[48px] leading-none text-neon">
        {amount} 💎
      </div>
      <div className="mb-6 text-[12px] text-muted">
        All your remaining credits will go on this song.
        <br />
        This cannot be undone.
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-lg border border-edge bg-surface-2 px-4 py-3 text-sm font-bold text-muted transition active:opacity-80"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={amount <= 0}
          className="flex-[2] cursor-pointer rounded-lg border-none bg-[linear-gradient(135deg,#ffe600,#ff8800)] px-4 py-3 text-sm font-black tracking-[0.5px] text-bg transition active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          🔥 GO ALL IN
        </button>
      </div>
    </Modal>
  );
}
