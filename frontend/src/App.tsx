import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <div className="mb-4 flex justify-end">
        <ModeToggle />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl tracking-tight">patient-intake-approval-queue</CardTitle>
          <CardDescription className="text-base">
            Your XanoTS project is ready. The backend lives in <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">xano/</code> and this frontend in <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">frontend/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-muted-foreground list-inside list-decimal space-y-2">
            <li>Author your first table + endpoint in <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">xano/index.ts</code> (see <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">xano/EXAMPLE.md</code>).</li>
            <li>Wire it into the UI from <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">frontend/src/lib/api.ts</code>.</li>
            <li>Ship it: <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">npm run xano:deploy</code>.</li>
          </ol>
        </CardContent>
        <CardFooter>
          {/* asChild renders the Button's styles onto the anchor. Components come
              from shadcn/ui — add more with `npx shadcn@latest add <name>`. */}
          <Button asChild>
            <a href="https://ui.shadcn.com/docs/components" target="_blank" rel="noreferrer">
              Browse UI components <ArrowRight />
            </a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
