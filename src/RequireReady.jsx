// src/RequireReady.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireReady({ userData, profileReady, children }) {
  const location = useLocation();

  // If userData not loaded yet, just wait (prevents flicker/false redirects)
  if (!userData) return null;

  if (!userData.assessmentCompleted) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{
          gateMsg: "Please complete the assessment first (in Profile) before using this feature.",
          from: location.pathname,
        }}
      />
    );
  }

  if (!profileReady) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{
          gateMsg: "Please complete your bio info in Profile before using this feature.",
          from: location.pathname,
        }}
      />
    );
  }

  return children;
}