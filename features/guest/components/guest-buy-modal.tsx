"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * GuestBuyModal - port of the prototype's BUY CREDITS modal.
 * Credit packs with selectable state, confirm purchases credits
 * (demo only — no real charges).
 */

interface Pack {
  credits: number;
  price: string;
  bonus: number;
  badge?: string;
  badgeColor?: string;
}

const PACKS: Pack[] = [
  { credits: 5, price: "$5.00", bonus: 0, badge: "No bonus", badgeColor: "text-muted" },
  { credits: 11, price: "$10.00", bonus: 1, badge: "⚡ POPULAR" },
  { credits: 23, price: "$20.00", bonus: 3, badge: "🔥 BEST VALUE" },
  { credits: 58, price: "$50.00", bonus: 8, badge: "👑 HIGH ROLLER" },
];

export function GuestBuyModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (creditsToAdd: number) => void;
}) {
  const [selected, setSelected] = useState<Pack>(PACKS[1]);

  const confirm = () => {
    onConfirm(selected.credits);
    setSelected(PACKS[1]);
  };

  return (
    <Modal open={open} onClose={onClose} sheet>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
      >
        ✕
      </button>
      <div className="font-display text-[30px] tracking-[2px]">Buy Credits</div>
      <div className="mb-4 mt-1.5 text-xs text-muted">
        Credits let you request and bid songs up the queue
      </div>
      <div className="mb-3.5 text-center text-[11px] tracking-[1px] text-neon">
        1 credit = $1.00 &nbsp;·&nbsp; Buy more, get bonus credits free
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {PACKS.map((p) => {
          const isSel = p.credits === selected.credits;
          return (
            <button
              key={p.credits}
              onClick={() => setSelected(p)}
              className={`cursor-pointer rounded-[10px] border px-3 py-4 text-center transition-all ${
                isSel
                  ? "border-neon bg-neon/5"
                  : "border-edge bg-surface-2"
              }`}
            >
              <div className="font-display text-[36px] leading-none text-neon">
                {p.credits}
              </div>
              {p.bonus > 0 && (
                <div className="my-0.5 text-[11px] font-bold tracking-[0.5px] text-neon-3">
                  +{p.bonus} FREE
                </div>
              )}
              <div className="mt-0.5 text-xs text-muted">{p.price}</div>
              {p.badge && (
                <div className={`mt-1 text-[10px] font-bold ${p.badgeColor ?? "text-neon-2"}`}>
                  {p.badge}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={confirm}
        className="w-full cursor-pointer rounded-[10px] border-none bg-neon-2 px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white"
      >
        CONFIRM PURCHASE
      </button>

      <div className="mt-3 rounded-lg border border-neon/10 bg-neon/5 px-3 py-2.5 text-[11px] leading-[1.6] text-muted">
        💡 Any unused credits at the end of the event are automatically donated
        to the event organizer. Credits are $1.00 each — 70% goes to the
        organizer, 20% to the DJ/Band, and 10% to BidaBeat.
      </div>
      <div className="mt-2 text-center text-[10px] text-muted">
        Demo mode — no real charges
      </div>
    </Modal>
  );
}