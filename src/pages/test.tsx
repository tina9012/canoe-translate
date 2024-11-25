import React, { useState, useEffect, useRef } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

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
  const [phraseCompleted, setPhraseCompleted] = useState<boolean>(false); // New state to track phrase completion
  const [playbackCompleted, setPlaybackCompleted] = useState<boolean>(true); // New state to track phrase completion
  const [audioQueue, setAudioQueue] = useState<Array<{ text: string; languageCode: string }>>([]);


  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);


  const [speechKey] = useState<string>(import.meta.env.VITE_SPEECH_KEY || "YOUR_SPEECH_KEY");
  const [serviceRegion] = useState<string>(import.meta.env.VITE_SPEECH_REGION || "YOUR_SERVICE_REGION");

  useEffect(() => {
    const processQueue = () => {
      if (playbackCompleted && audioQueue.length > 0) {
        const nextAudio = audioQueue[0];
        if (nextAudio) {
          playAudio(nextAudio.text, nextAudio.languageCode);
          setAudioQueue((prevQueue) => prevQueue.slice(1)); // Remove the first item
        }
      }
    };

    processQueue();
  }, [playbackCompleted, audioQueue]);

  const playAudio = (text: string, languageCode: string) => {
    if (!speechKey || !serviceRegion) {
      console.error("Azure Speech SDK credentials are missing.");
      return;
    }

    console.log(`Playing audio: ${text} in ${languageCode}`);
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
    const voiceName = getVoiceForLanguage(languageCode);
    const player = new SpeechSDK.SpeakerAudioDestination();
  
    player.onAudioEnd = () => {
      console.log("Audio playback completed.");
      setPlaybackCompleted(true); // Signal that playback is completed
    };

    const audioConfig = SpeechSDK.AudioConfig.fromSpeakerOutput(player);

    // Create a new synthesizer instance each time to ensure proper behavior
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
  

    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${languageCode}">
        <voice name="${voiceName}">
          <prosody rate="1.5">${text}</prosody>
        </voice>
      </speak>
    `;

    setPlaybackCompleted(false);

    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log("Speech synthesis completed.");
        } else {
          console.error("Speech synthesis failed:", result.errorDetails);
        }
        synthesizer.close();
      },
      (error) => {
        console.error("Error during speech synthesis:", error);
        synthesizer.close();
      }
    );
    };

  const enqueueAudio = (text: string, languageCode: string) => {
    setAudioQueue((prevQueue) => [...prevQueue, { text, languageCode }]);
  };

  const getVoiceForLanguage = (languageCode: string): string => {
    const voiceMap: { [key: string]: string } = {
      en: "en-US-JennyNeural",
      fr: "fr-FR-DeniseNeural",
      es: "es-ES-ElviraNeural",
      de: "de-DE-KatjaNeural",
      it: "it-IT-ElsaNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      ja: "ja-JP-KeitaNeural",
      ko: "ko-KR-SunHiNeural",
      ar: "ar-SA-ZariyahNeural",
      pt: "pt-PT-FernandaNeural",
      ru: "ru-RU-SvetlanaNeural",
    };

    return voiceMap[languageCode] || "en-US-JennyNeural";
  };


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

          if (data.isComplete) {
            setPhraseCompleted(true);
            if (data.translations && data.translations[selectedLanguage]) {
              enqueueAudio(data.translations[selectedLanguage], selectedLanguage);
            }
          } else {
            setPhraseCompleted(false);
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
  }, [sessionId, selectedLanguage]);

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

      {playbackCompleted && (
            <p style={{ color: "green" }}>current audio finished playing!</p>
      )}

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
    </div>
  );
};

export default ListenerPage;