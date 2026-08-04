import { useEffect } from "react";

export default function useUnsavedWarning(enabled: boolean, message = "You have unsaved changes - are you sure you want to leave?") {
  useEffect(() => {
    if (!enabled) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [enabled, message]);
}
