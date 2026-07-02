import { useState, useEffect, useCallback } from "react";

/**
 * Tracks browser online/offline status in real time.
 *
 * Returns:
 *  - isOnline: current connectivity state
 *  - wasOffline: true if the user was ever offline during this session
 *
 * Usage:
 *   const { isOnline } = useOnlineStatus();
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}

export default useOnlineStatus;
