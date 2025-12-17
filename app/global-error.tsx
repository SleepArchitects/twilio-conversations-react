"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error; // Acknowledge error param
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <h1 className="text-4xl font-bold">500</h1>
          <p className="mt-2">Internal Server Error</p>
          <button onClick={reset} className="mt-4 underline">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
