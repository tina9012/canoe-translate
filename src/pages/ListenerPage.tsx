import React, { useState, useEffect } from "react";

const languages = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
];

const ListenerPage: React.FC = () => {
  const [receivedTranscription, setReceivedTranscription] = useState<string>("");
  const [translations, setTranslations] = useState<{ [key: string]: string }>({});
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en"); // Default to English
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [fullTranslations, setFullTranslations] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const currentSessionId = window.location.pathname.split("/").pop() || "";
    setSessionId(currentSessionId);
    console.log("Session ID:", currentSessionId);

    const ws = new WebSocket("wss://websocket-server-549270727339.us-central1.run.app"); // WebSocket server URL
    //const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("WebSocket connection established.");
    };

    // Handle WebSocket messages
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);
    
        if (data.sessionId === sessionId) {
          if (typeof data.sessionStarted !== "undefined") {
            setSessionStarted(data.sessionStarted);
          }
    
          if (data.languages) {
            setAvailableLanguages(data.languages);
          }
    
          // Update real-time transcription and translations
          setReceivedTranscription(data.transcription || ""); // Default to empty string
          setTranslations(data.translations || {}); // Default to empty object
    
          // Append new translations to fullTranslations
          if (data.fullTranslations) {
            setFullTranslations((prevFullTranslations) => {
              const updatedFullTranslations = { ...prevFullTranslations };
    
              for (const lang in data.fullTranslations) {
                const newTranslation = data.fullTranslations[lang];
                if (newTranslation) {
                  // Append the new translation to the existing one
                  updatedFullTranslations[lang] =
                    (updatedFullTranslations[lang] || "") + "\n" + newTranslation;
                }
              }
    
              return updatedFullTranslations;
            });
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected on ListenerPage");
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
        console.log("Ping sent to server.");
      }
    }, 30000); // Send every 30 seconds

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [sessionId]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value);
  };

  const handleDownload = () => {
    const fullTranslatedText = fullTranslations[selectedLanguage] || "Waiting for translations...";
    const blob = new Blob([fullTranslatedText], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `full_translated_text_${sessionId}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Derive fullTranslatedText dynamically based on selected language
  const fullTranslatedText = fullTranslations[selectedLanguage] || "Waiting for translations...";

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1 className="page-title">Listener Page</h1>
      <p>Joining session ID: {sessionId}</p>
      {!sessionStarted ? (
        <p>
          Awaiting speaker to begin session...
          You may not join a session that has already begun.
        </p>
      ) : (
        <>
          <h2>Available Languages</h2>
          <select value={selectedLanguage} onChange={handleLanguageChange}>
            <option value="">Select a language to begin</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languages.find((l) => l.code === lang)?.name || lang}
              </option>
            ))}
          </select>

<div className="container">
        <h2>Transcription</h2>
        <div className="scrollable-box">{receivedTranscription || "Waiting for transcription..."}</div>
      </div>

      {/* Translation Section */}
      <div className="container">
        <h2>Translation</h2>
        <div className="scrollable-box">
          {translations[selectedLanguage] || "Waiting for translation..."}
        </div>
      </div>

      {/* Full Translated Text Section */}
      <div className="container">
        <h2>Full Translated Text</h2>
        <div className="scrollable-box">{fullTranslatedText}</div>
      </div>

      {/* Download Button */}
      <button onClick={handleDownload}>Download Full Translated Text</button>
    </>
  )}
    </div>
  );
};

export default ListenerPage;