import { redirect } from "next/navigation";

// The app has no marketing page. Signed-out visitors get bounced to /login by
// the middleware; signed-in ones land on the submissions table.
export default function Home() {
  redirect("/admin");
}
