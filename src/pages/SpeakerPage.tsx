import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { QRCodeCanvas } from "qrcode.react";
import MultiSelect from "../components/MultiSelect";
//import SingleSelect from "../components/SingleSelect";
import QRCodeLink from "../components/QRCode";
import { useSession } from "../components/SessionContext";
import { useParams, useNavigate } from "react-router-dom";


const speech_languages = [
  { code: "fr-CA", name: "French (Canadian)" },
  { code: "en-US", name: "English (United States)" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "de-DE", name: "German (Germany)" },
  { code: "it-IT", name: "Italian (Italy)" },
  { code: "zh-CN", name: "Chinese (Mandarin, Simplified)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)" },
  { code: "pt-PT", name: "Portuguese (Portugal)" },
  { code: "ru-RU", name: "Russian" },
];

const target_languages = [
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

const SpeakerPage: React.FC = () => {
  //const [sessionId] = useState<string>(uuidv4());
  const { sessionId } = useParams<{ sessionId: string }>(); // Extract sessionId from the route
  const navigate = useNavigate();

  
  const [transcription, setTranscription] = useState<string>("");
  const [fullTranscription, setFullTranscription] = useState<string>(""); // Full transcription to keep all speech
  const [translations, setTranslations] = useState<{ [key: string]: string }>({});
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [fullTranslations, setFullTranslations] = useState<{ [key: string]: string }>({});
  const [targetLanguages, setTargetLanguages] = useState<string[]>(["en"]); // Default to English
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputDevice, setSelectedAudioInputDevice] = useState<string>("");
  const [selectedRecognitionLanguage, setSelectedRecognitionLanguage] = useState<string>("fr-CA"); // Default recognition language


  const recognizerRef = useRef<SpeechSDK.TranslationRecognizer | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const speechKey = import.meta.env.VITE_SPEECH_KEY || "YOUR_SPEECH_KEY";
  const serviceRegion = import.meta.env.VITE_SPEECH_REGION || "YOUR_SERVICE_REGION";

  useEffect(() => {
    if (!sessionId) {
      generateNewSession();
    }
  }, [sessionId]);

  const generateNewSession = async () => {
    const newSessionId = uuidv4();
  
    try {
      console.log("Creating new session:", newSessionId);
      //const response = await fetch("http://localhost:8080/api/create-session", {
      const response = await fetch("https://backend-app-1015371839961.us-central1.run.app/api/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId }),
      });
  
      if (!response.ok) {
        const errorMessage = await response.text();
        console.error("Failed to create session:", errorMessage);
        return;
      }
  
      console.log("Session created successfully:", newSessionId);
  
      // Navigate to the new session
      navigate(`/speaker/${newSessionId}`, { replace: true });
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };
  
  

  // Listener URL with session ID


  const listenerUrl = `${window.location.origin}/listen/${sessionId}`;

  useEffect(() => {
    const fetchAudioInputDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        setAudioInputDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedAudioInputDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error fetching audio input devices:", err);
      }
    };
    fetchAudioInputDevices();
  }, []);



  useEffect(() => {
    //ws.current = new WebSocket("ws://localhost:8080");

    const initializeWebSocket = () => {

      if (ws.current) {
        ws.current.close(); // Close any existing WebSocket connection
      }

      const newWs = new WebSocket("wss://backend-app-1015371839961.us-central1.run.app");

      newWs.onopen = () => {
        console.log("WebSocket connection established.");
        // Perform any other logic on open, e.g., updating state, sending initial messages
      };

      newWs.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      newWs.onclose = () => {
        console.log("WebSocket connection closed.");
        // Automatically try to reconnect after 5 seconds if closed
        setTimeout(() => {
          console.log("Reconnecting WebSocket...");
          initializeWebSocket(); // Re-initialize WebSocket connection
        }, 5000);
      };

      ws.current = newWs; // Set the new WebSocket instance to the ref
  

    };

    initializeWebSocket();

    // Ping the WebSocket every 30 seconds to keep the connection alive
    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  
    // Cleanup on component unmount: clear the ping interval and close the WebSocket
    return () => {
      clearInterval(pingInterval); // Stop the pinging when the component unmounts
      if (ws.current) {
        ws.current.close(); // Close WebSocket connection when component unmounts
      }
    };
  }, []);

    const sendUpdate = (data: {
      transcription?: string;
      translations?: { [key: string]: string };
      fullTranslations?: { [key: string]: string };
      languages?: string[];
      sessionStarted?: boolean;
      isComplete?: boolean;
  }) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          const message = {
              sessionId,
              languages: targetLanguages,
              fullTranslations,
              ...data,
          };
          console.log("translations: ", translations)
          console.log("full translations: ", fullTranslations)
          console.log("Sending WebSocket message:", message);
          ws.current.send(JSON.stringify(message));
      }
  };


  const startRecognition = () => {
    sendUpdate({ fullTranslations: {} }); // Notify listeners that fullTranslations is reset

    if (!speechKey || !serviceRegion) {
      alert("Missing Speech SDK credentials.");
      return;
    }

    setSessionStarted(true);
    sendUpdate({ sessionStarted: true, languages: targetLanguages });


    const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
    speechConfig.speechRecognitionLanguage = selectedRecognitionLanguage;
    

    // Add target languages to translation config
    targetLanguages.forEach((lang) => {
      speechConfig.addTargetLanguage(lang);
    });

    const audioConfig = selectedAudioInputDevice
      ? SpeechSDK.AudioConfig.fromMicrophoneInput(selectedAudioInputDevice)
      : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    const recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s: any, e: SpeechSDK.TranslationRecognitionEventArgs) => {
      const newTranscription = e.result.text || "Listening...";
      const newTranslations: { [key: string]: string } = {};

      targetLanguages.forEach((lang) => {
        const translation = e.result.translations.get(lang);
        if (translation) {
          newTranslations[lang] = translation;
        }
      });

      setTranscription(newTranscription);
      setTranslations(newTranslations);

      sendUpdate({ transcription: newTranscription, translations: newTranslations, isComplete: false });

    };

    recognizer.recognized = (s: any, e: SpeechSDK.TranslationRecognitionEventArgs) => {
      if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech) {
        const newTranscription = e.result.text;
        const newTranslations: { [key: string]: string } = {};
        const updatedFullTranslations = { ...fullTranslations };


        targetLanguages.forEach((lang) => {
          const translation = e.result.translations.get(lang);
          if (translation) {
            newTranslations[lang] = translation;
            updatedFullTranslations[lang] = (updatedFullTranslations[lang] || "") + "\n" + translation;
          }
        });

        setTranscription(newTranscription);
        setTranslations(newTranslations);
        setFullTranscription((prevFullTranscription) => prevFullTranscription + "\n" + newTranscription);
        setFullTranslations(updatedFullTranslations);
        sendUpdate({ transcription: newTranscription, translations: newTranslations, fullTranslations: updatedFullTranslations, isComplete: true });


      }
    };

    recognizer.canceled = (s: any, e: SpeechSDK.TranslationRecognitionCanceledEventArgs) => {
      console.error("Recognition canceled:", e.errorDetails);
      stopRecognition();
    };

    recognizer.startContinuousRecognitionAsync(
      () => console.log("Recognition started."),
      (err) => console.error("Failed to start recognition:", err)
    );

    recognizerRef.current = recognizer;
    setIsRecognizing(true);
  };

  const stopRecognition = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => console.log("Recognition stopped."),
        (err) => console.error("Failed to stop recognition:", err)
      );
      recognizerRef.current.close();
      recognizerRef.current = null;
    }
    setIsRecognizing(false);
    setSessionStarted(false);
    sendUpdate({ sessionStarted: false });
    setFullTranslations({}); // Clear fullTranslations when the session stops


  };

  const handleRecognitionLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRecognitionLanguage(e.target.value);
  };

  const handleTargetLanguageChange = (selected: string[]) => {
    setTargetLanguages(selected);
  };

  const handleDownload = () => {
    const blob = new Blob([fullTranscription], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `full_transcription_${sessionId}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };


  return (
    <div className="page-container">
      <h1 className="page-title">Speaker Page</h1>
      <h3>Your session ID: {sessionId}</h3>

      <div className="qr-code-container">
        <p>Scan the QR code to join the session:</p>
        <QRCodeCanvas value={listenerUrl} size={150} />
        <p>
          Or use this link:{" "}
        </p>
        <a href={listenerUrl} target="_blank" rel="noopener noreferrer">
          {listenerUrl}
        </a>
      </div>

      <button onClick={generateNewSession} style={{ marginTop: "20px" }}>
        Generate New Session
      </button>

      <div>
        <label>Select Audio Input Device:</label>
        <select
          value={selectedAudioInputDevice}
          onChange={(e) => setSelectedAudioInputDevice(e.target.value)}
          disabled={sessionStarted}
        >
          {audioInputDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      <div className="target-language-selector-container">

      <label>Select the Primary Speaking Language:</label>
        <select
          value={selectedRecognitionLanguage}
          onChange={handleRecognitionLanguageChange}
          disabled={sessionStarted}
        >
          {speech_languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className="target-language-container">
        <p>Target Languages:</p>
        <MultiSelect
          options={target_languages.map((lang) => ({
            value: lang.code,
            label: lang.name,
          }))}
          selectedValues={targetLanguages}
          onChange={handleTargetLanguageChange}
          placeholder="Select Target Languages"
        />
      </div>


      {sessionStarted && (
        <p style={{ color: "red" }}>
          You can only change target languages after stopping the session.
        </p>
      )}

      

      <div>
        <button onClick={isRecognizing ? stopRecognition : startRecognition}>
          {isRecognizing ? "Stop" : "Start"} Session
        </button>
      </div>

      {sessionStarted && (
        
        <div>
        {/* Current Transcription */}
        <div className="container">
          <h2>Current Transcription</h2>
          <div className="scrollable-box">
            {transcription || "Speak to see transcription..."}
          </div>
        </div>

        {/* Full Transcription */}
        <div className="container">
          <h2>Full Transcription</h2>
          <div className="scrollable-box">
            {fullTranscription || "Full transcription will appear here as you speak..."}
          </div>
        </div>

        {/* Download Button */}
        <button onClick={handleDownload}>Download Full Transcription</button>
      </div>
      )}
    </div>
  );
};

export default SpeakerPage;