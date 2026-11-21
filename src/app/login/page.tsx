import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 p-6 dark:bg-black">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">FormIA</h1>
        <p className="text-sm text-muted-foreground">Inicia sesión para continuar.</p>
      </div>
      <LoginForm />
    </main>
  );
}
