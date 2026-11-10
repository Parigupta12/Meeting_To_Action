const COLORS = [
  "bg-indigo-100 text-indigo-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
];

function hash(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export default function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const unassigned = !name || name.toLowerCase() === "unassigned";
  const initial = unassigned ? "?" : name.trim().charAt(0).toUpperCase();
  const tone = unassigned
    ? "bg-slate-100 text-slate-500 ring-1 ring-dashed ring-slate-300"
    : COLORS[hash(name) % COLORS.length];
  const dims = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${tone}`}
    >
      {initial}
    </span>
  );
}
