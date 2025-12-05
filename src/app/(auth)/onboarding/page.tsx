import { redirect } from "next/navigation";

// Onboarding is now handled in settings page
export default function OnboardingPage() {
  redirect("/settings?setup=email");
}
