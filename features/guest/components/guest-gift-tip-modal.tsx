"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";

/**
 * GuestGiftTipModal - shared port of the prototype's DONATE (gift credits)
 * and TIP THE DJ/BAND modals. Preset amount pills + custom input, and an
 * optional message for tips.
 */

type Kind = "gift" | "tip";

const PRESETS: Record<Kind, number[]> = {
  gift: [5, 10, 20, 50],
  tip: [2, 5, 10, 20],
};

export function GuestGiftTipModal({
  open,
  kind,
  onClose,
}: {
  open: boolean;
  kind: Kind | null;
  onClose: () => void;
}) {
  const { show, toastNode } = useToast();
  const isTip = kind === "tip";
  const presets = kind ? PRESETS[kind] : PRESETS.gift;

  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");

  const pick = (amt: number) => {
    setAmount(amt);
    setCustom("");
  };

  const customChange = (v: string) => {
    setCustom(v);
    setAmount(parseFloat(v) || 0);
  };

  const reset = () => {
    setCustom("");
    setMessage("");
    setAmount(10);
  };

  const submit = () => {
    if (!amount || amount < 1) {
      show(`Minimum ${isTip ? "tip" : "donation"} is $1`);
      return;
    }
    onClose();
    reset();
    if (isTip) {
      show(`🎛️ $${amount.toFixed(2)} tip sent${message ? ` — "${message.slice(0, 30)}"` : ""}!`);
    } else {
      show(`🎁 $${amount.toFixed(2)} gifted to the event!`);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} sheet>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
        >
          ✕
        </button>
        <div className="font-display text-[30px] tracking-[2px]">
          {isTip ? "🎛️ Tip the DJ/Band" : "🎁 Gift Credits to Event"}
        </div>
        <div className="mb-4 mt-1.5 text-xs text-muted">
          {isTip
            ? "Send cash directly to the performer. They'll see your name and message."
            : "Your donation goes directly to the event organizer. Choose an amount below or enter your own."}
        </div>

        {/* presets */}
        <div className="mb-3 flex gap-2">
          {presets.map((p) => {
            const isSelected = !custom && amount === p;
            return (
              <button
                key={p}
                onClick={() => pick(p)}
                className={`flex-1 cursor-pointer rounded-lg border px-1.5 py-2.5 text-[15px] font-bold transition-all ${
                  isSelected
                    ? isTip
                      ? "border-neon-2 bg-neon-2/10 text-neon-2"
                      : "border-accent bg-accent/10 text-accent"
                    : "border-edge bg-surface-2 text-foreground"
                }`}
              >
                ${p}
              </button>
            );
          })}
        </div>

        {/* custom amount */}
        <div className="mb-3.5 flex items-center gap-2 rounded-[10px] border border-edge bg-surface-2 px-4 py-2.5">
          <span className="text-[22px] font-bold text-muted">$</span>
          <input
            type="number"
            min={1}
            value={custom || (amount ? amount : "")}
            onChange={(e) => customChange(e.target.value)}
            placeholder="0.00"
            className="w-full border-none bg-transparent font-display text-[28px] font-bold tracking-[2px] text-foreground outline-none placeholder:text-muted"
          />
        </div>

        {!isTip ? (
          <div className="mb-4 text-center text-[11px] text-muted">
            100% goes to the event — this is not converted to credits
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-[11px] text-muted">
              Leave a message (optional)
            </label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="You're killing it tonight! 🔥"
              maxLength={80}
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted"
            />
          </div>
        )}

        <button
          onClick={submit}
          className={`w-full cursor-pointer rounded-[10px] border-none px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white ${
            isTip
              ? "bg-[linear-gradient(135deg,#ff2d78,#cc1155)]"
              : "bg-[linear-gradient(135deg,#a855f7,#7c3aed)]"
          }`}
        >
          {isTip ? "SEND TIP 🎛️" : "SEND GIFT 🎁"}
        </button>
        <div className="mt-2.5 text-center text-[10px] text-muted">
          Demo mode — no real charges
        </div>
      </Modal>
      {toastNode}
    </>
  );
}