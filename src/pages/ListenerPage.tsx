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
  const pingIntervalRef = useRef<number | null>(null); // Store the ping interval


  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);

  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);

  const [speechKey] = useState<string>(import.meta.env.VITE_SPEECH_KEY || "YOUR_SPEECH_KEY");
  const [serviceRegion] = useState<string>(import.meta.env.VITE_SPEECH_REGION || "YOUR_SERVICE_REGION");

  const processQueue = () => {
    if (playbackCompleted && audioQueue.length > 0) {
      const nextAudio = audioQueue[0];
      if (nextAudio) {
        playAudio(nextAudio.text, nextAudio.languageCode);
        setAudioQueue((prevQueue) => prevQueue.slice(1)); // Remove the first item
      }
    }
  };

  const playAudio = (text: string, languageCode: string) => {
    console.log("Inside playAudio function");
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
    console.log("enqueueAudio called with:", text, languageCode);

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
    const timer = setTimeout(() => {
      processQueue();
    }, 100);

    return () => clearTimeout(timer); // Cleanup timer
  }, [playbackCompleted, audioQueue]);


  useEffect(() => {
    const currentSessionId = window.location.pathname.split("/").pop() || "";
    setSessionId(currentSessionId);
    console.log("Session ID:", currentSessionId);
  }, []);

  useEffect(() => {
    if (!sessionStarted) {
      console.log("Session stopped. Resetting state.");
      setReceivedTranscription("");
      setTranslations({});
      setFullTranslations({});
    }
  }, [sessionStarted]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionData = async () => {
      try {
          //const response = await fetch(`http://localhost:8080/api/session-data?sessionId=${sessionId}`);
          const response = await fetch(`https://backend-app-1015371839961.us-central1.run.app/api/session-data?sessionId=${sessionId}`);
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Response is not JSON");
          }
          const data = await response.json();
          console.log("Fetched session data:", data);
          setAvailableLanguages(data.languages);
          setFullTranslations(data.fullTranslations || {});
      } catch (error) {
          console.error("Error fetching session data:", error);
      }
  };


    fetchSessionData();
  }, [sessionId]);

  const ws = useRef<WebSocket | null>(null); // Correctly typed as a WebSocket or null

  const initializeWebSocket = () => {
    if (ws.current) {
      ws.current.close();
    }

    //const newWs = new WebSocket("ws://localhost:8080");
    const newWs = new WebSocket("wss://backend-app-1015371839961.us-central1.run.app");

    newWs.onopen = () => {
      console.log("WebSocket connection established.");
      setPlaybackCompleted(true);
      setAudioQueue([]);
      processQueue();
    };

    newWs.onmessage = (event) => {

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
                //if (newTranslation && !updatedFullTranslations[lang]?.endsWith(newTranslation)) {
                if (newTranslation) {
                  updatedFullTranslations[lang] =
                    (updatedFullTranslations[lang] || "") + "\n" + newTranslation;
                }
              }
          
              return updatedFullTranslations;
            });
          }
          

          if (data.isComplete) {
            console.log("Queuing audio now!")
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
      } finally {
        setTimeout(() => {
        }, 500); // Adjust debounce timing as needed
    }
  };

  newWs.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  newWs.onclose = () => {
    console.log("WebSocket connection closed.");
    setTimeout(() => {
      console.log("Reconnecting WebSocket...");
      initializeWebSocket(); // Re-initialize WebSocket connection
    }, 5000);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
  };

  pingIntervalRef.current = window.setInterval(() => {
    if (newWs.readyState === WebSocket.OPEN) {
      newWs.send(JSON.stringify({ type: "ping" }));
      console.log("Sent ping to keep WebSocket alive.");
    }
  }, 30000);

  ws.current = newWs;
};

useEffect(() => {
  if (sessionId) {
    initializeWebSocket();
  }
  return () => {
    if (ws.current) ws.current.close();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
  };
}, [sessionId]);

const handleReconnectWebSocket = () => {
  initializeWebSocket();
};

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

      <button onClick={handleReconnectWebSocket}>Enable Audio Playback</button>

      {/* Download Button */}
      <button onClick={handleDownload}>Download Full Translated Text</button>
    </>
    </div>
  );
};

export default ListenerPage;