import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WelcomeScreen } from "@/components/welcome/welcome-screen";

export default function RootPage() {
  const cookieStore = cookies();
  const hasWelcomed = cookieStore.get("sakuin_welcomed")?.value;

  // If user has already seen the welcome screen, redirect to login
  if (hasWelcomed) {
    redirect("/login");
  }

  // First time visitor: show the Welcome Screen
  return <WelcomeScreen />;
}
