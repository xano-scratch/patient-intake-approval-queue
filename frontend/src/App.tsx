import { useEffect, useState } from "react";
import { Activity, Loader2, LogOut, RotateCcw } from "lucide-react";

import {
  getSession,
  login,
  seed,
  setSession as persistSession,
  type Role,
  type Session,
} from "@/lib/api";
import { RoleBadge } from "@/lib/format";
import { Login } from "@/screens/Login";
import { Submit } from "@/screens/Submit";
import { Queue } from "@/screens/Queue";
import { Rules } from "@/screens/Rules";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "submit" | "queue" | "rules";

const DEMO_EMAIL: Record<string, string> = {
  clerk: "clerk@clinic.test",
  intake_clerk: "clerk@clinic.test",
  clinician: "clinician@clinic.test",
  viewer: "viewer@clinic.test",
};

function defaultTab(role: Role): Tab {
  return role === "intake_clerk" ? "submit" : "queue";
}

export default function App() {
  const [session, setSessionState] = useState<Session | null>(getSession());
  const [tab, setTab] = useState<Tab>("queue");
  const [selectedIntake, setSelectedIntake] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [resetting, setResetting] = useState(false);

  // On first load: make sure the workspace is seeded (idempotent), then honor
  // the deep-link params a shared demo URL can carry (auto-login + open a view).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await seed(false);
      } catch {
        /* a fresh deploy may briefly 404; the login screen still works */
      }
      const params = new URLSearchParams(window.location.search);
      const demo = params.get("demo");
      if (demo && DEMO_EMAIL[demo] && !getSession()) {
        try {
          const s = await login({ email: DEMO_EMAIL[demo], password: "password123" });
          if (alive) {
            setSessionState(s);
            setTab(defaultTab(s.role));
          }
        } catch {
          /* ignore, fall through to the login screen */
        }
      }
      const t = params.get("tab");
      if (t === "submit" || t === "queue" || t === "rules") setTab(t);
      const intake = params.get("intake");
      if (intake && Number(intake)) {
        setSelectedIntake(Number(intake));
        setTab("queue");
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function onLogin(s: Session) {
    setSessionState(s);
    setTab(defaultTab(s.role));
    setSelectedIntake(null);
  }

  function logout() {
    persistSession(null);
    setSessionState(null);
    setSelectedIntake(null);
  }

  function openDetail(id: number) {
    setSelectedIntake(id);
    setTab("queue");
  }

  async function resetDemo() {
    setResetting(true);
    try {
      await seed(true);
      setSelectedIntake(null);
      setDataVersion((n) => n + 1);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card/40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Patient Intake Approval Queue</div>
              <div className="text-muted-foreground text-xs">
                Play 3 · Pilot to Production · Healthcare
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {session && (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="text-sm">{session.display_name}</span>
                  <RoleBadge role={session.role} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => void resetDemo()} disabled={resetting}>
                  {resetting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  <span className="hidden md:inline">Reset demo</span>
                </Button>
              </>
            )}
            <ModeToggle />
            {session && (
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="size-4" />
                <span className="hidden md:inline">Sign out</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {!ready ? (
        <div className="text-muted-foreground flex h-[60vh] items-center justify-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Preparing the demo…
        </div>
      ) : !session ? (
        <Login onLogin={onLogin} />
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="submit">Intake</TabsTrigger>
              <TabsTrigger value="queue">Review queue</TabsTrigger>
              <TabsTrigger value="rules">Rule versions</TabsTrigger>
            </TabsList>
          </Tabs>

          <div key={`${tab}:${dataVersion}`} className="mt-6">
            {tab === "submit" && <Submit onOpenDetail={openDetail} />}
            {tab === "queue" && (
              <Queue session={session} selectedId={selectedIntake} onSelect={setSelectedIntake} />
            )}
            {tab === "rules" && <Rules session={session} />}
          </div>
        </main>
      )}
    </div>
  );
}
