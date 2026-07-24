import { redirect } from "next/navigation";

export default function SignupRolePage() {
  // Redirect to simplified signup (Marketing Officer only, flat referral-based model)
  redirect("/signup/simplified");
}
