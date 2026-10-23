interface FujiProps {
  /** Sizes the box. The mountain fills its height; hills span its width. */
  className?: string;
  body?: string;
  snow?: string;
  /** Foothill colours, back to front. */
  hills?: [string, string];
}

/**
 * Flat, layered Mount Fuji silhouette with a snow cap and foothills.
 * The mountain keeps its aspect ratio (full on wide screens, side-cropped on
 * phones) while the hills stretch edge to edge and hide the mountain's base.
 */
export function Fuji({
  className = '',
  body = '#6B3550',
  snow = '#FFF8FA',
  hills = ['#5A2C45', '#4A2238'],
}: FujiProps) {
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1200 420"
        className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2"
        style={{ aspectRatio: '1200 / 420' }}
        focusable="false"
      >
        <path
          d="M0 420 L0 384 C160 372 300 300 420 240 C500 196 552 140 580 104 L620 104 C648 140 700 196 780 240 C900 300 1040 372 1200 384 L1200 420 Z"
          fill={body}
        />
        <path
          d="M580 104 L620 104 C640 130 664 158 690 184 L668 176 L652 196 L630 178 L608 200 L590 180 L568 198 L548 178 L512 190 C540 160 562 132 580 104 Z"
          fill={snow}
        />
      </svg>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[26%] w-full"
        focusable="false"
      >
        <path
          d="M0 120 L0 40 C140 22 260 24 380 40 C520 58 640 34 760 24 C900 12 1060 28 1200 44 L1200 120 Z"
          fill={hills[0]}
        />
        <path
          d="M0 120 L0 80 C180 66 320 86 480 88 C660 90 820 72 980 74 C1080 76 1140 82 1200 86 L1200 120 Z"
          fill={hills[1]}
        />
      </svg>
    </div>
  );
}
