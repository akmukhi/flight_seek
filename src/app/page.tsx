export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">
        Aviation disruption intelligence
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
        Stay ahead of delays, ground programs, and airport issues
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        flight_seek will aggregate federal and global feeds, surface security
        and weather context where available, and help you explore reroutes and
        ground options when plans change.
      </p>
      <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-500">
        Stack: Next.js, PostgreSQL + PostGIS, Redis — start services with{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          npm run docker:up
        </code>
        , then copy{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          .env.example
        </code>{" "}
        to{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          .env.local
        </code>
        .
      </p>
    </div>
  );
}
