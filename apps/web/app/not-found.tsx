import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d0f14] text-center px-4">
      <div className="text-6xl font-bold text-indigo-500 mb-4">404</div>
      <h1 className="text-2xl font-semibold text-white mb-2">Page not found</h1>
      <p className="text-slate-400 text-sm mb-8 max-w-sm">
        This page doesn&apos;t exist yet. It may be coming in a future phase of Jarvis.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
