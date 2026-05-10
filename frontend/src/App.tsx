import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { DiscussionRoom } from "./pages/DiscussionRoom";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn redirectUrl={window.location.href} /></SignedOut>
    </>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth needed */}
        <Route path="/" element={<Home />} />
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />

        {/* Protected routes */}
        <Route path="/app" element={<RequireAuth><Landing /></RequireAuth>} />
        <Route path="/room/:roomId" element={<RequireAuth><DiscussionRoom /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  if (!CLERK_KEY) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/app" element={<Landing />} />
          <Route path="/room/:roomId" element={<DiscussionRoom />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }
  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignInUrl="/app" afterSignUpUrl="/app">
      <AppRoutes />
    </ClerkProvider>
  );
}
