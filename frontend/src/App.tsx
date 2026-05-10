import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Landing } from "./pages/Landing";
import { RoomSetup } from "./pages/RoomSetup";
import { DiscussionRoom } from "./pages/DiscussionRoom";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  console.warn("VITE_CLERK_PUBLISHABLE_KEY not set — auth disabled");
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
        <Route
          path="/"
          element={
            <>
              <SignedIn><Landing /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />
        <Route
          path="/room/:roomId/setup"
          element={
            <>
              <SignedIn><RoomSetup /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <>
              <SignedIn><DiscussionRoom /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  if (!CLERK_KEY) {
    // Dev mode: no auth wrapper
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/room/:roomId/setup" element={<RoomSetup />} />
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
