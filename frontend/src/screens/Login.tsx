import { useState, type FormEvent } from "react";
import { ClipboardList, Eye, Loader2, ShieldCheck, Stethoscope } from "lucide-react";

import { login, type Role, type Session, ApiError } from "@/lib/api";
import { RoleBadge } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const DEMO_PASSWORD = "password123";

const DEMO_USERS: {
  role: Role;
  email: string;
  name: string;
  blurb: string;
  Icon: typeof ClipboardList;
}[] = [
  {
    role: "intake_clerk",
    email: "clerk@clinic.test",
    name: "Casey Kim",
    blurb: "Submits intakes and runs the triage rules.",
    Icon: ClipboardList,
  },
  {
    role: "clinician",
    email: "clinician@clinic.test",
    name: "Dr. Nadia Rao",
    blurb: "Claims, approves or denies, and publishes rules.",
    Icon: Stethoscope,
  },
  {
    role: "viewer",
    email: "viewer@clinic.test",
    name: "Sam Ford",
    blurb: "Reads the queue and the audit trail. No writes.",
    Icon: Eye,
  },
];

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn(em: string, pw: string, key: string) {
    setBusy(key);
    setError("");
    try {
      onLogin(await login({ email: em, password: pw }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign in failed.");
    } finally {
      setBusy(null);
    }
  }

  function onManual(e: FormEvent) {
    e.preventDefault();
    void signIn(email, password, "manual");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-primary mb-3 inline-flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" />
          API-layer role based access control
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign in to the review console</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
          Pick a seeded user. The role you sign in as decides what the API lets you do. Every
          check runs on the server, so the same rules hold whatever calls them.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {DEMO_USERS.map((u) => (
          <Card key={u.role} className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <u.Icon className="size-5" />
                </div>
                <RoleBadge role={u.role} />
              </div>
              <CardTitle className="text-lg">{u.name}</CardTitle>
              <CardDescription>{u.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full"
                disabled={busy !== null}
                onClick={() => void signIn(u.email, DEMO_PASSWORD, u.role)}
              >
                {busy === u.role ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `Sign in as ${u.name.split(" ")[0]}`
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-destructive mt-4 text-center text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="mx-auto mt-10 max-w-sm">
        <div className="mb-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">or sign in by email</span>
          <Separator className="flex-1" />
        </div>
        <form onSubmit={onManual} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clinician@clinic.test"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full" disabled={busy !== null}>
            {busy === "manual" ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Seeded logins use the password <code className="font-mono">password123</code>.
        </p>
      </div>
    </div>
  );
}
