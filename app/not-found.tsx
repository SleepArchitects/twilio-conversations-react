export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Page not found</p>
      <a href="/outreach" className="mt-4 text-primary hover:underline">
        Return to Outreach
      </a>
    </div>
  );
}
