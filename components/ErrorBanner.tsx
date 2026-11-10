export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
        >
          Retry
        </button>
      )}
    </div>
  );
}
