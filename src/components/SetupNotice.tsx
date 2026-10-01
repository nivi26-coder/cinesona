export function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-surface p-6 text-sm leading-6">
      <h2 className="mb-2 text-lg font-semibold">Connect your Atlas cluster</h2>
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>
          Copy <code className="font-mono text-foreground">.env.example</code> to{" "}
          <code className="font-mono text-foreground">.env.local</code>.
        </li>
        <li>
          In Atlas, open <strong className="text-foreground">Connect → Drivers</strong> on Cluster0 and paste the
          connection string into <code className="font-mono text-foreground">MONGODB_URI</code>.
        </li>
        <li>
          Run <code className="font-mono text-foreground">npm run db:indexes</code> and{" "}
          <code className="font-mono text-foreground">npm run import:mflix</code> once, then restart{" "}
          <code className="font-mono text-foreground">npm run dev</code>.
        </li>
      </ol>
    </div>
  );
}
