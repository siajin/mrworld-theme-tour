export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="w-full max-w-[440px] rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
      <h1 className="text-[24px] font-bold text-ink">{title}</h1>
      {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
