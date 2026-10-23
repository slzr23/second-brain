import { MotionConfig } from "motion/react";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { Shell } from "./components/Shell";
import { DemoDataProvider } from "./data/DemoDataProvider";
import { isDemo } from "./lib/config";

const RealApp = lazy(() => import("./RealApp"));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      {isDemo ? (
        <DemoDataProvider>
          <Shell demo />
        </DemoDataProvider>
      ) : (
        <Suspense fallback={<div className="signin" aria-busy="true" />}>
          <RealApp />
        </Suspense>
      )}
      <Toaster
        position="top-center"
        offset={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
        toastOptions={{ style: { borderRadius: 18, fontSize: 15, fontFamily: "var(--font)" } }}
      />
    </MotionConfig>
  );
}
