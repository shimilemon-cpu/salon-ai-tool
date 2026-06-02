"use client";
import { useApiKey } from "../lib/useApiKey";
import ApiKeyModal from "../components/ApiKeyModal";
import ContentGenerator from "../components/ContentGenerator";

export default function Home() {
  const { apiKey, setApiKey, clearApiKey, loaded } = useApiKey();

  if (!loaded) return null; // hydration待ち

  if (!apiKey) {
    return <ApiKeyModal onSave={setApiKey} />;
  }

  return <ContentGenerator apiKey={apiKey} onChangeKey={clearApiKey} />;
}
