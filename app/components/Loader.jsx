export default function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-white to-white">
      <div className="relative">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-indigo-200 opacity-20"></div>

        {/* Spinning ring */}
        <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-indigo-500 border-r-indigo-400 animate-spin"></div>

        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
