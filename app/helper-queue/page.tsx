import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { readHelperSession } from "@/lib/helper-session";
import QueueManager from "@/features/dj/components/queue-manager";

export const metadata = { title: "Helper Queue" };

export default async function HelperQueuePage() {
  const helper = await readHelperSession();
  if (!helper) {
    redirect("/dj-login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-3/20 bg-surface p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[2px] text-neon-3">
            🤝 Helper Mode
          </div>
          <div className="font-display text-xl tracking-[1.5px]">{helper.name}</div>
          <div className="text-[11px] text-muted">Queue only — no financials</div>
        </div>
        <Link
          href="/helper-queue/signout"
          className="rounded-lg border border-edge bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-neon-3 hover:text-neon-3"
        >
          ↩ Exit Helper Mode
        </Link>
      </header>

      <QueueManager
        appUrl={getAppUrl()}
        eventContext={{ name: helper.name, code: helper.code }}
        helperMode
      />
    </main>
  );
}