import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: { px: 28, text: "text-base" },
  md: { px: 40, text: "text-lg" },
  lg: { px: 72, text: "text-2xl" },
} as const;

export default function BrandMark({
  size = "sm",
  withWordmark = true,
  href = "/",
}: {
  size?: keyof typeof SIZES;
  withWordmark?: boolean;
  href?: string;
}) {
  const { px, text } = SIZES[size];

  const content = (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="Globe-Tech"
        width={px}
        height={px}
        priority
        className="shrink-0"
      />
      {withWordmark && (
        <span className={`font-display font-semibold text-brandDeep ${text}`}>Globe-Tech</span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}
