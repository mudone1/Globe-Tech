import AuthIllustration from "@/components/AuthIllustration";
import BrandMark from "@/components/BrandMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-10">
      {/* Oversized blurred backdrop, echoing the card's own illustration */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[140vh] w-[140vh]">
          <AuthIllustration variant="background" />
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col-reverse overflow-hidden rounded-[2rem] bg-white shadow-2xl md:flex-row">
        {/* Form side */}
        <div className="flex w-full flex-col justify-center px-8 py-10 sm:px-12 sm:py-14 md:w-[46%]">
          <BrandMark size="sm" />
          <div className="mt-8">{children}</div>
        </div>

        {/* Illustration side — a compact strip above the form on mobile
            (flex-col-reverse puts this DOM-second block visually first),
            a full side panel on desktop. */}
        <div className="h-32 w-full bg-mist/40 md:h-auto md:w-[54%]">
          <AuthIllustration variant="panel" />
        </div>
      </div>
    </main>
  );
}
