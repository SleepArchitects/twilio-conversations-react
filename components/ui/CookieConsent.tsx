"use client";

import { Button } from "flowbite-react";
import { useEffect, useState } from "react";
import CookieSettings from "../modals/CookieSettings";

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setShowConsent(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "true");
    setShowConsent(false);
  };

  if (!showConsent) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white p-4 shadow-lg dark:bg-gray-800">
        <div className="mx-auto max-w-screen-xl px-4 md:flex md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cookie Policy
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              We use cookies to enhance your experience. By continuing to visit
              this site you agree to our use of cookies.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button color="gray" onClick={() => setShowSettings(true)}>
              Cookie Settings
            </Button>
            <Button color="blue" onClick={handleAccept}>
              Accept All
            </Button>
          </div>
        </div>
      </div>
      <CookieSettings
        onClose={() => setShowSettings(false)}
        show={showSettings}
      />
    </>
  );
}
