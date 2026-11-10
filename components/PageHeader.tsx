import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-md md:p-7">
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-500/30 blur-3xl" />
      <p className="relative text-xs font-semibold uppercase tracking-widest text-indigo-200">
        {eyebrow}
      </p>
      <h1 className="relative mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      {children && (
        <div className="relative mt-2 max-w-2xl text-[15px] leading-6 text-indigo-100">
          {children}
        </div>
      )}
      {actions && <div className="relative mt-4 flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
