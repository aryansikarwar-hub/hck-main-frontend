import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reset password" };

/**
 * Placeholder until an email provider is chosen — a reset flow without a way
 * to send the link would either silently do nothing or expose a token in the
 * response. Better to say plainly what to do in the meantime than to ship a
 * form that cannot work.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Password reset</h1>
            <p className="text-sm text-muted-foreground">
              Self-service password reset isn&apos;t enabled yet. Ask an administrator to reset your
              password, and they can send you a new one directly.
            </p>
            <Link href="/login">
              <Button variant="outline">Back to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
