"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "salon_ai_api_key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    setApiKeyState(stored);
    setLoaded(true);
  }, []);

  const setApiKey = (key) => {
    const trimmed = key.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKeyState(trimmed);
  };

  const clearApiKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState("");
  };

  return { apiKey, setApiKey, clearApiKey, loaded };
}
