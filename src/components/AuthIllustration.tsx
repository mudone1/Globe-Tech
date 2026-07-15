import { User, TrendingUp, Handshake } from "lucide-react";

/**
 * A single continent silhouette, stamped three times at different scales/
 * offsets/tones to read as stacked, torn paper — the same device as the
 * reference's layered leaf fronds, applied to Africa instead (echoing the
 * globe-and-Africa mark in the Globe-Tech logo).
 */
const AFRICA_PATH =
  "M97,4 C112,3 124,12 130,24 C142,28 154,34 158,46 C168,52 176,64 170,76 " +
  "C182,84 188,100 178,112 C186,124 184,142 172,152 C176,168 168,186 156,198 " +
  "C148,214 134,226 118,230 C110,232 103,226 101,216 C90,214 80,204 82,192 " +
  "C68,186 58,174 64,160 C50,152 42,138 50,124 C38,114 34,98 44,86 " +
  "C36,74 38,58 50,48 C48,36 54,22 68,16 C74,8 86,5 97,4 Z";

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
 * The full illustration: layered map + avatar badges peeking over the edges.
 * `variant="background"` renders just the flat map shape (no badges) for the
 * oversized blurred page backdrop. `variant="panel"` is the real card
 * illustration — its on-screen size (and therefore how prominent it looks)
 * is controlled entirely by the parent container's height via Tailwind
 * classes, so the same markup works for the compact mobile strip and the
 * full desktop panel.
 */
export default function AuthIllustration({
  variant = "panel",
}: {
  variant?: "panel" | "background";
}) {
  if (variant === "background") {
    return (
      <svg
        viewBox="0 0 240 240"
        className="h-full w-full scale-[2.2] opacity-[0.14] blur-3xl"
        aria-hidden="true"
      >
        <path d={AFRICA_PATH} transform="translate(20,4)" fill="#0E7A3A" />
      </svg>
    );
  }

  return (
    <div className="relative h-full w-full overflow-visible">
      <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true">
        <defs>
          <filter id="paperShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#032E16" floodOpacity="0.18" />
          </filter>
        </defs>
        {/* Back layer — lightest, largest, most offset */}
        <path
          d={AFRICA_PATH}
          transform="translate(38,10) scale(1.06) rotate(-4 100 120)"
          fill="#D7E4D9"
          filter="url(#paperShadow)"
        />
        {/* Mid layer */}
        <path
          d={AFRICA_PATH}
          transform="translate(26,14) scale(1.0) rotate(2 100 120)"
          fill="#7FA688"
          filter="url(#paperShadow)"
        />
        {/* Front layer — brand green, sits closest to the "surface" */}
        <path
          d={AFRICA_PATH}
          transform="translate(18,18) scale(0.92) rotate(-1 100 120)"
          fill="#0E7A3A"
          filter="url(#paperShadow)"
        />
        {/* Madagascar — small satellite shape, the classic device that makes an
            abstract blob unmistakably read as "Africa" */}
        <ellipse
          cx="178"
          cy="176"
          rx="6"
          ry="14"
          transform="rotate(18 178 176)"
          fill="#054A26"
          filter="url(#paperShadow)"
        />
      </svg>

      <AvatarBadge icon={User} className="-right-3 top-6 sm:top-10" size={44} />
      <AvatarBadge icon={TrendingUp} className="-left-4 top-1/2 hidden sm:flex" size={44} />
      <AvatarBadge icon={Handshake} className="bottom-2 right-8 sm:bottom-6" size={40} />
    </div>
  );
}
