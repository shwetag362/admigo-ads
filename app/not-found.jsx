import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white flex-col space-y-4">
      <h2 className="text-4xl font-semibold">404</h2>

      <div className="mb-12 justify-center text-center px-4">
        <h2 className="text-3xl font-semibold text-white/70 mb-4">
          Page Not Found
        </h2>

        <p className="text-gray-400 text-lg max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        <Link href="/" className="text-blue-500 underline">
          Return Home
        </Link>
      </div>
    </div>
  );
}