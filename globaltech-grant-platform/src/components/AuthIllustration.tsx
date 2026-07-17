import Image from "next/image";
import { User, TrendingUp, Handshake } from "lucide-react";

function AvatarBadge({
  icon: Icon,
  className,
  size = 44,
}: {
  icon: typeof User;
  className: string;
  size?: number;
}) {
  return (
    <div
      className={`absolute flex items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-white ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand to-brandDark">
        <Icon className="text-white" size={size * 0.5} strokeWidth={2.25} />
      </div>
    </div>
  );
}

/**
 * The auth-side illustration: the actual Globe-Tech globe-and-Africa mark,
 * large, with a soft drop shadow and a few icon avatar badges peeking over
 * its edges (representing people the platform connects — grant applicants
 * and the staff helping their businesses grow). `variant="background"`
 * renders just the mark, blurred and oversized, for the page backdrop.
 */
export default function AuthIllustration({
  variant = "panel",
}: {
  variant?: "panel" | "background";
}) {
  if (variant === "background") {
    return (
      <div className="relative h-full w-full scale-[1.8] opacity-[0.16] blur-3xl">
        <Image src="/logo.png" alt="" fill className="object-contain" priority />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-visible p-10">
      <div className="relative h-full w-full max-w-[280px]" style={{ filter: "drop-shadow(0 18px 28px rgba(3,46,22,0.25))" }}>
        <Image src="/logo.png" alt="Globe-Tech" fill className="object-contain" priority />
      </div>

      <AvatarBadge icon={User} className="right-6 top-6 sm:right-10 sm:top-10" size={44} />
      <AvatarBadge icon={TrendingUp} className="left-2 top-1/2 hidden sm:flex" size={44} />
      <AvatarBadge icon={Handshake} className="bottom-6 right-12 sm:bottom-10" size={40} />
    </div>
  );
}
