import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Landing } from "./pages/Landing";
import { DiscussionRoom } from "./pages/DiscussionRoom";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
        <Route path="/" element={<Protected><Landing /></Protected>} />
        <Route path="/room/:roomId" element={<Protected><DiscussionRoom /></Protected>} />
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
          <Route path="/" element={<Landing />} />
          <Route path="/room/:roomId" element={<DiscussionRoom />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }
  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignInUrl="/" afterSignUpUrl="/">
      <AppRoutes />
    </ClerkProvider>
  );
}
