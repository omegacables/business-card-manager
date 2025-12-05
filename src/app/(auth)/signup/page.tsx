import { redirect } from "next/navigation";

// Signup is now handled via social login on the home page
export default function SignupPage() {
  redirect("/");
}
