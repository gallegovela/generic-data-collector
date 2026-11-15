// Página de inicio mínima (placeholder): solo garantiza que la
// aplicación responde en "/" (CA-PLT-01). El panel real llega con
// form-editor y submissions-dashboard.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-16 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight">FormIA</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Plataforma de recogida de datos. El proyecto base está en marcha.
      </p>
    </main>
  );
}
