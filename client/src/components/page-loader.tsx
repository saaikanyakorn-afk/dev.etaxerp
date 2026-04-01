export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white" data-testid="page-loader">
      <img
        src="/etax-icon.png"
        alt="E-Tax Center"
        className="h-20 w-auto mb-6 animate-pulse"
        data-testid="img-loader-logo"
      />
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-[3px] border-gray-200" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-transparent animate-spin" style={{ borderTopColor: "var(--theme-primary)" }} />
      </div>
      <p className="mt-4 text-sm text-gray-400 font-sarabun">กำลังโหลด...</p>
    </div>
  );
}
