import Image from "next/image";

/*
  Right-hand panel of the sign-in screen.

  Photo by Vitaly Gariev on Unsplash (https://unsplash.com/@silverkblack),
  extracted from the design mockup into public/login.jpg. Desaturated so the
  navy accents stay the only colour on the screen.

  Rendered twice — as the tall desktop column and the short mobile banner — so
  `fill` + object-cover does the cropping and `sizes` reflects both cases.
*/
export function LoginArt() {
  return (
    <Image
      src="/login.jpg"
      alt=""
      aria-hidden="true"
      fill
      priority
      sizes="(min-width: 1024px) 480px, 100vw"
      className="object-cover grayscale contrast-[1.08]"
    />
  );
}
