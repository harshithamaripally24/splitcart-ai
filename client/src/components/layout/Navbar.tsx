export function Navbar() {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 10.2a2 2 0 002 1.6h7.8a2 2 0 001.9-1.4L21 7H7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v8m-3-3l3 3 3-3" />
              <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
              <circle cx="17.5" cy="19.5" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              SplitCart <span className="text-blue-600">AI</span>
            </span>
            <p className="text-xs text-slate-500">
              Smart bundle shopping tailored to your bi-weekly paycheck & bill calendar
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
