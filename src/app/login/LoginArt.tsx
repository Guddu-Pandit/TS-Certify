/*
  Right-hand panel of the sign-in screen. The design calls for a cropped photo
  here; there is no photograph in `public/`, so this is a flat geometric stand-in
  in the same palette — swap it for an <Image src="/login.jpg" fill /> once a
  photo exists and the rest of the layout is unchanged.

  Drawn with `slice` so it crops like object-cover in both the tall desktop
  column and the short mobile banner. Everything is orthogonal and hard-edged:
  no rounding, no gradients.
*/
export function LoginArt() {
  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <rect width="600" height="800" fill="#1a1f3d" />

      {/* Field of hairlines — the engraved ground of a printed document. */}
      <g stroke="#f3f2f2" strokeOpacity="0.07">
        {Array.from({ length: 24 }, (_, i) => (
          <line key={i} x1={i * 26} y1="0" x2={i * 26} y2="800" />
        ))}
      </g>

      {/* Blocks, in tints of the brand navy so they read against its ground. */}
      <rect x="0" y="0" width="600" height="6" fill="#3d4780" />
      <rect x="452" y="120" width="148" height="148" fill="#3d4780" />
      <rect x="0" y="612" width="96" height="188" fill="#2b3358" />

      {/* The certificate itself. */}
      <g transform="translate(150 250)">
        <rect width="330" height="300" fill="#f3f2f2" />
        <rect x="18" y="18" width="294" height="264" fill="none" stroke="#1a1f3d" strokeOpacity="0.25" />

        <rect x="42" y="52" width="120" height="12" fill="#1a1f3d" />
        <g fill="#1a1f3d">
          <rect x="42" y="88" width="228" height="6" fillOpacity="0.75" />
          <rect x="42" y="104" width="178" height="6" fillOpacity="0.35" />
          <rect x="42" y="150" width="246" height="8" fillOpacity="0.85" />
          <rect x="42" y="172" width="196" height="6" fillOpacity="0.3" />
          <rect x="42" y="220" width="84" height="4" fillOpacity="0.35" />
          <rect x="42" y="232" width="56" height="4" fillOpacity="0.2" />
        </g>

        {/* Seal: a QR-ish block, matching the verification promise. */}
        <rect x="228" y="196" width="60" height="60" fill="#1a1f3d" />
        <g fill="#f3f2f2">
          <rect x="238" y="206" width="16" height="16" />
          <rect x="262" y="206" width="16" height="16" />
          <rect x="238" y="230" width="16" height="16" />
          <rect x="266" y="234" width="8" height="8" />
        </g>
      </g>

      {/* Corner registration marks. */}
      <g stroke="#ec3013" strokeWidth="2">
        <path d="M40 700 h28 M40 700 v-28" fill="none" />
        <path d="M560 700 h-28 M560 700 v-28" fill="none" />
      </g>
    </svg>
  );
}
