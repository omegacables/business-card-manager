import { redirect } from "next/navigation";

// Signup is now handled via social login
// Redirect to login page
export default function SignupPage() {
  redirect("/login");
}
