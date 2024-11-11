// src/App.tsx

import React, { useState, useRef, useEffect } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { Download, Trash2, Plus, X, Check } from "lucide-react";
import "@fontsource/roboto/300.css"; // Roboto Light font
import ReactCountryFlag from "react-country-flag"; // For displaying country flags
import logo from "./assets/logo.png"; // Ensure you have a logo in src/assets/
import contactImage from "./assets/contact.png"; // Ensure you have contact.png in src/assets/
import { AudioVisualizer } from "./components/AudioVisualizer";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { debounce } from "lodash";

// Access environment variables via import.meta.env for Vite
const speechKey = import.meta.env.VITE_SPEECH_KEY?.trim() || "";
const serviceRegion = import.meta.env.VITE_SPEECH_REGION?.trim() || "";

// Define the complete list of languages used for both source and target
const languages: { code: string; name: string }[] = [
    { code: "en", name: "English" },
    { code: "fr", name: "French" },
    { code: "es", name: "Spanish" },
    { code: "pl", name: "Polish" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    // Add more languages as desired
];

// Function to map language codes to country codes for flags
const getCountryCode = (languageCode: string) => {
    const countryMap: { [key: string]: string } = {
        pl: "PL",
        en: "US", // English - United States
        fr: "FR",
        es: "ES",
        de: "DE",
        it: "IT",
        zh: "CN",
        ja: "JP",
        ko: "KR",
        ar: "SA",
        pt: "PT",
        ru: "RU",
    };
    return countryMap[languageCode] || "US"; // Default to "US" if not found
};

// Predefined Scientific Terms per Language
const predefinedScientificTerms: { [key: string]: string[] } = {
    pl: ["mechanika kwantowa", "neuronauka", "fotosynteza"], // Polish terms
    en: ["quantum mechanics", "neuroscience", "photosynthesis"],
    fr: ["mécanique quantique", "neurosciences", "photosynthèse"],
    es: ["mecánica cuántica", "neurociencias", "fotosíntesis"],
    // Add more languages and terms as needed
};

// Define Phrase Lists per Language (initially empty, users can add)
const initialPhraseLists: { [key: string]: string[] } = languages.reduce((acc, lang) => {
    acc[lang.code] = [];
    return acc;
}, {} as { [key: string]: string[] });

// Voice names mapping based on language
const voiceMap: { [key: string]: string } = {
    pl: "pl-PL-ZofiaNeural",
    en: "en-US-JennyNeural",
    fr: "fr-FR-DeniseNeural",
    es: "es-ES-LauraNeural",
    de: "de-DE-KatjaNeural",
    it: "it-IT-ElsaNeural",
    zh: "zh-CN-XiaoxiaoNeural",
    ja: "ja-JP-AyumiNeural",
    ko: "ko-KR-SunHiNeural",
    ar: "ar-SA-SalmaNeural",
    pt: "pt-PT-CamilaNeural",
    ru: "ru-RU-IrinaNeural",
    // Add more mappings as needed
};

function App() {
    // State variables
    const [transcription, setTranscription] = useState("");
    const [translation, setTranslation] = useState("");
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for accumulated session transcription
    const [sessionTranscription, setSessionTranscription] = useState<string>("");

    // State to control visibility of transcription sections
    const [showTranscriptionSections, setShowTranscriptionSections] = useState<boolean>(false);

    // Define target languages
    const targetLanguages: { code: string; name: string }[] = languages;

    // Define source languages
    const sourceLanguages: { code: string; name: string }[] = languages;

    // Initialize source and target language states
    const [sourceLanguage, setSourceLanguage] = useState<string>("en"); // Default to English
    const [targetLanguage, setTargetLanguage] = useState<string>("fr"); // Default to French

    // State for audio input devices
    const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
    const [selectedAudioInputDevice, setSelectedAudioInputDevice] = useState<string>("");

    // State for phrase list: language-specific
    const [phraseInput, setPhraseInput] = useState<string>(""); // Current input field
    const [phraseList, setPhraseList] = useState<{ [key: string]: string[] }>(initialPhraseLists); // List of phrases per language

    // State for audio playback speed
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.5); // Default speed 1.5

    // Refs for recognizer and synthesizer
    const translationRecognizerRef = useRef<SpeechSDK.TranslationRecognizer | null>(null);
    const synthRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
    const stopInProgressRef = useRef(false);

    // Debounced function to apply phrases to recognizer
    const debouncedApplyPhrases = useRef(
        debounce(
            (recognizer: SpeechSDK.SpeechRecognizer | SpeechSDK.TranslationRecognizer) => {
                addPhrasesToRecognizer(recognizer);
            },
            500
        )
    ).current;

    // Enumerate audio input devices on component mount
    useEffect(() => {
        const enumerateDevices = async () => {
            try {
                console.log("Requesting microphone access...");
                // Request microphone access to get device labels (requires user permission)
                await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log("Microphone access granted.");
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices
                    .filter((device) => device.kind === "audioinput")
                    .map((device) => ({
                        deviceId: device.deviceId,
                        label: device.label || `Microphone ${device.deviceId}`,
                    }));
                setAudioInputDevices(audioInputs);
                console.log("Audio input devices:", audioInputs);
                // Set default device if not already selected
                if (audioInputs.length > 0 && !selectedAudioInputDevice) {
                    setSelectedAudioInputDevice(audioInputs[0].deviceId);
                    console.log(`Default audio input device set to: ${audioInputs[0].label}`);
                }
            } catch (err) {
                console.error("Error enumerating audio devices:", err);
                setError("Unable to access audio devices. Please check your microphone permissions.");
            }
        };

        enumerateDevices();
    }, []); // Run once on mount

    // Load phrase lists from local storage on mount
    useEffect(() => {
        const savedPhrases = localStorage.getItem("phraseList");
        if (savedPhrases) {
            setPhraseList(JSON.parse(savedPhrases));
            console.log("Phrase lists loaded from local storage.");
        }
    }, []);

    // Save phrase lists to local storage whenever they change
    useEffect(() => {
        localStorage.setItem("phraseList", JSON.stringify(phraseList));
    }, [phraseList]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopRecognition();
            if (synthRef.current) {
                try {
                    synthRef.current.close();
                    console.log("Synthesizer closed on unmount");
                } catch (error) {
                    console.warn("Synthesizer already closed on unmount:", error);
                }
            }
            if (translationRecognizerRef.current) {
                try {
                    translationRecognizerRef.current.close();
                } catch (error) {
                    console.warn("Translation recognizer already closed on unmount:", error);
                }
            }
        };
    }, []);

    // Helper function to append or replace session transcription
    const appendOrReplaceSessionTranscription = (newText: string) => {
        setSessionTranscription((prev) => {
            const lines = prev.split("\n");
            // Find the last index of a line starting with "Translation:"
            const lastTranslationIndex = lines.reduce(
                (lastIndex, line, index) => {
                    return line.startsWith("Translation:") ? index : lastIndex;
                },
                -1
            );

            if (lastTranslationIndex !== -1) {
                // Replace the last translation line with the new one
                lines[lastTranslationIndex] = newText;
                return lines.join("\n");
            } else {
                // Append as a new line if no previous translation exists
                return prev + (prev ? "\n" : "") + newText;
            }
        });
    };

    // Validate Phrase Function
    const isValidPhrase = (phrase: string): boolean => {
        // Allow letters, numbers, spaces, and common punctuation
        const regex = /^[\p{L}\p{N}\s.,'-]+$/u;
        return regex.test(phrase);
    };

    // Normalize Phrase Function
    const normalizePhrase = (phrase: string): string => {
        return phrase.normalize("NFC"); // Normalize to Unicode NFC form
    };

    // Handle Add Phrase
    const handleAddPhrase = () => {
        const trimmedPhrase = normalizePhrase(phraseInput.trim());
        if (
            trimmedPhrase &&
            isValidPhrase(trimmedPhrase) &&
            !phraseList[sourceLanguage]?.includes(trimmedPhrase)
        ) {
            setPhraseList({
                ...phraseList,
                [sourceLanguage]: [...(phraseList[sourceLanguage] || []), trimmedPhrase],
            });
            setPhraseInput("");
            setSuccessMessage("Phrase added successfully!");
            console.log(`[${sourceLanguage}] Phrase added: "${trimmedPhrase}"`);
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } else {
            setError("Invalid or duplicate phrase. Please ensure it contains valid characters and is unique.");
        }
    };

    // Handle Add Predefined Phrase
    const handleAddPredefinedPhrase = (phrase: string) => {
        if (!phraseList[sourceLanguage]?.includes(phrase)) {
            setPhraseList({
                ...phraseList,
                [sourceLanguage]: [...(phraseList[sourceLanguage] || []), phrase],
            });
            setSuccessMessage("Predefined phrase added successfully!");
            console.log(`[${sourceLanguage}] Predefined phrase added: "${phrase}"`);
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };

    // Handle Remove Phrase
    const handleRemovePhrase = (phrase: string) => {
        setPhraseList({
            ...phraseList,
            [sourceLanguage]: (phraseList[sourceLanguage] || []).filter((p) => p !== phrase),
        });
        setSuccessMessage("Phrase removed successfully!");
        console.log(`[${sourceLanguage}] Phrase removed: "${phrase}"`);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // Handle Clear Phrases
    const handleClearPhrases = () => {
        setPhraseList({
            ...phraseList,
            [sourceLanguage]: [],
        });
        setSuccessMessage("All phrases cleared.");
        console.log(`All phrases cleared for ${sourceLanguage}.`);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // Handle Phrase Input Key Down (Enter key)
    const handlePhraseInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddPhrase();
        }
    };

    // Function to add phrases to recognizer using PhraseListGrammar
    const addPhrasesToRecognizer = (
        recognizer: SpeechSDK.SpeechRecognizer | SpeechSDK.TranslationRecognizer
    ): boolean => {
        try {
            const phraseListConstraint = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer);
            const currentPhrases = phraseList[sourceLanguage] || [];

            if (currentPhrases.length > 0) {
                const allStrings = currentPhrases.every(
                    (phrase) => typeof phrase === "string" && phrase.trim().length > 0
                );
                if (!allStrings) {
                    setError("Phrase list contains invalid entries.");
                    return false;
                }

                currentPhrases.forEach((phrase) => {
                    console.log(`[${sourceLanguage}] Adding phrase: "${phrase}"`);
                    phraseListConstraint.addPhrase(phrase);
                });
                console.log(`[${sourceLanguage}] All phrases added successfully.`);
            }
            return true;
        } catch (error: any) {
            console.error(`[${sourceLanguage}] Error adding phrases to recognizer:`, error);
            setError(`Error adding phrases to phrase list: ${error.message || error}`);
            return false;
        }
    };

    // Start Recognition Function
    const startRecognition = async () => {
        console.log("Start Recognition button clicked.");

        if (isRecognizing) {
            console.warn("Recognition is already in progress.");
            return;
        }

        if (!speechKey || !serviceRegion) {
            console.error("Speech service credentials are missing.");
            setError("Speech service credentials are missing.");
            return;
        }

        // Ensure all recognizers are stopped before starting a new one
        await stopRecognition();

        setTranscription("");
        setTranslation("");
        setError(null);
        setIsRecognizing(true);
        setShowTranscriptionSections(true); // Show transcription sections upon starting

        try {
            const languageMap: { [key: string]: string } = languages.reduce((acc, lang) => {
                acc[lang.code] = getLocaleCode(lang.code);
                return acc;
            }, {} as { [key: string]: string });

            const mappedSourceLanguage = languageMap[sourceLanguage] || "en-US";

            console.log("Initializing SpeechTranslationConfig.");
            const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
            speechConfig.speechRecognitionLanguage = mappedSourceLanguage;
            speechConfig.addTargetLanguage(targetLanguage);
            speechConfig.setProfanity(SpeechSDK.ProfanityOption.Raw); // Allow profanity in translation

            console.log("SpeechTranslationConfig initialized:", speechConfig);

            // Use selected audio input device
            const audioConfig = selectedAudioInputDevice
                ? SpeechSDK.AudioConfig.fromMicrophoneInput(selectedAudioInputDevice)
                : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

            console.log("AudioConfig for TranslationRecognizer:", audioConfig);

            // Create the translation recognizer
            const recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);
            console.log("TranslationRecognizer created:", recognizer);

            // Add phrases specific to the source language
            const phrasesAdded = addPhrasesToRecognizer(recognizer);
            if (!phrasesAdded) {
                recognizer.close();
                setIsRecognizing(false);
                return;
            }

            translationRecognizerRef.current = recognizer;

            // Set up event handlers
            recognizer.recognizing = (s, e) => {
                const text = e.result.text;
                const translationText = e.result.translations.get(targetLanguage) || "";
                setTranscription(text);
                setTranslation(translationText);
                appendOrReplaceSessionTranscription(`Translation: ${translationText}`);
                console.log(`[${targetLanguage}] Recognizing: ${text} | Translation: ${translationText}`);
            };

            recognizer.recognized = (s, e) => {
                console.log(`[${targetLanguage}] Translation recognizer recognized event triggered.`);
                if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech) {
                    const text = e.result.text;
                    const translationText = e.result.translations.get(targetLanguage) || "";
                    setTranscription(text);
                    setTranslation(translationText);
                    appendOrReplaceSessionTranscription(`Translation: ${translationText}`);
                    console.log(`[${targetLanguage}] Translated Speech: ${translationText}`);
                    synthesizeSpeech(translationText);
                } else {
                    console.warn(`[${targetLanguage}] Translation not recognized. Reason:`, e.result.reason);
                }
            };

            recognizer.canceled = (s, e) => {
                console.error(`[${targetLanguage}] Translation recognition canceled:`, e.errorDetails);
                setError(`Translation canceled: ${e.errorDetails}`);
                stopRecognition();
            };

            recognizer.sessionStopped = () => {
                console.log(`[${targetLanguage}] Translation recognition session stopped`);
                stopRecognition();
            };

            recognizer.startContinuousRecognitionAsync(
                () => {
                    console.log("Translation recognition started");
                },
                (err) => {
                    console.error("Failed to start translation recognition:", err);
                    setError("Failed to start translation recognition.");
                    recognizer.close();
                    translationRecognizerRef.current = null;
                    stopRecognition();
                }
            );
        } catch (err) {
            console.error("Error during startRecognition:", err);
            setError("An unexpected error occurred during recognition.");
            setIsRecognizing(false);
        }
    };

    // Stop Recognition Function
    const stopRecognition = async () => {
        if (stopInProgressRef.current) {
            // Prevent concurrent stop operations
            return;
        }

        stopInProgressRef.current = true;
        try {
            const stopPromises: Promise<void>[] = [];

            // Stop translation recognizer if active
            if (translationRecognizerRef.current) {
                const translationStopPromise = new Promise<void>((resolve) => {
                    translationRecognizerRef.current?.stopContinuousRecognitionAsync(
                        () => {
                            try {
                                translationRecognizerRef.current?.close();
                                console.log("Translation recognizer stopped");
                            } catch (error) {
                                console.warn("Error closing translation recognizer:", error);
                            }
                            translationRecognizerRef.current = null;
                            resolve();
                        },
                        (err) => {
                            console.error("Error stopping translation recognizer:", err);
                            setError("Failed to stop translation recognizer.");
                            try {
                                translationRecognizerRef.current?.close();
                            } catch (error) {
                                console.warn("Error closing translation recognizer after failure:", error);
                            }
                            translationRecognizerRef.current = null;
                            resolve(); // Resolve even on error
                        }
                    );
                });
                stopPromises.push(translationStopPromise);
            }

            // Wait for all stop operations to complete
            await Promise.all(stopPromises);

            // Stop and close synthesizer exclusively here
            if (synthRef.current) {
                try {
                    synthRef.current.close();
                    console.log("Synthesizer stopped");
                } catch (error) {
                    console.warn("Synthesizer already closed:", error);
                }
                synthRef.current = null;
            }

            setIsRecognizing(false);
        } catch (err) {
            console.error("Error during stopRecognition:", err);
            setError("An unexpected error occurred during stop.");
            setIsRecognizing(false);
        } finally {
            stopInProgressRef.current = false;
        }
    };

    // Synthesize Speech Function with adjustable speed
    const synthesizeSpeech = (text: string) => {
        try {
            console.log(`Synthesizing speech for text: ${text}`);
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
            const synthesisLanguage = voiceMap[targetLanguage] ? getLocaleCode(targetLanguage) : "en-US";
            speechConfig.speechSynthesisLanguage = synthesisLanguage;
            speechConfig.speechSynthesisVoiceName = voiceMap[targetLanguage] || "en-US-JennyNeural";

            const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

            // Create SSML with adjustable rate based on playbackSpeed state
            const ssml = `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${synthesisLanguage}">
              <voice name="${speechConfig.speechSynthesisVoiceName}">
                <prosody rate="${playbackSpeed}">${text}</prosody>
              </voice>
            </speak>`;

            synthesizer.speakSsmlAsync(
                ssml,
                (result) => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        console.log("Speech synthesized for text:", text);
                    } else {
                        console.error("Speech synthesis failed:", result.errorDetails);
                        setError("Speech synthesis failed.");
                    }
                },
                (error) => {
                    console.error("Error during speech synthesis:", error);
                    setError("Error during speech synthesis.");
                }
            );

            synthRef.current = synthesizer;
        } catch (err) {
            console.error("Error during synthesizeSpeech:", err);
            setError("An unexpected error occurred during speech synthesis.");
        }
    };

    // Function to get locale code based on language code
    const getLocaleCode = (langCode: string): string => {
        const localeMap: { [key: string]: string } = {
            pl: "pl-PL",
            en: "en-US",
            fr: "fr-FR",
            es: "es-ES",
            de: "de-DE",
            it: "it-IT",
            zh: "zh-CN",
            ja: "ja-JP",
            ko: "ko-KR",
            ar: "ar-SA",
            pt: "pt-PT",
            ru: "ru-RU",
            // Add more mappings as needed
        };
        return localeMap[langCode] || "en-US";
    };

    // Handle Target Language Change
    const handleTargetLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTargetLanguage = e.target.value;

        if (newTargetLanguage === targetLanguage) return; // No change

        console.log(`Target language changed to ${newTargetLanguage}.`);

        setTargetLanguage(newTargetLanguage);

        if (isRecognizing && translationRecognizerRef.current) {
            // Restart translation recognizer with the new target language
            console.log(`Restarting recognizer due to target language change to ${newTargetLanguage}.`);
            await stopRecognition();
            startRecognition();
        }
    };

    // Handle Source Language Change
    const handleSourceLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSourceLanguage = e.target.value;
        console.log(`Source language changed to ${newSourceLanguage}.`);
        setSourceLanguage(newSourceLanguage);

        // If recognition is in progress, restart it with the new source language
        if (isRecognizing) {
            await stopRecognition();
            startRecognition();
        }
    };

    // Handle Audio Input Device Change
    const handleAudioInputDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDeviceId = e.target.value;
        console.log(`Audio input device changed to: ${newDeviceId}`);
        setSelectedAudioInputDevice(newDeviceId);

        if (isRecognizing) {
            console.log(`Restarting recognition due to audio device change to ${newDeviceId}.`);
            await stopRecognition();
            startRecognition();
        }
    };

    // Download Session Transcription Function
    const downloadSessionTranscription = () => {
        if (!sessionTranscription) {
            setError("No transcription available to download.");
            return;
        }

        const element = document.createElement("a");
        const file = new Blob([sessionTranscription], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = "session_transcription.txt";
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="min-h-screen bg-white font-roboto text-[#171B17]">
            <div className="container mx-auto px-4 py-8">
                {/* Navigation Bar */}
                <nav className="flex items-center justify-between py-4">
                    <div className="flex items-center">
                        <img src={logo} alt="App Logo" className="h-10 w-30 mr-3" />
                        <span className="text-2xl font-bold text-[#171B17]">AI Translator</span>
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="text-center my-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-[#171B17] mb-4">
                        Real-time Speech-to-Speech Translation
                    </h1>
                    <p className="text-xl md:text-2xl text-[#817F75] max-w-2xl mx-auto">
                        Speak in any language, and we'll transcribe and translate it instantly with natural-sounding voices.
                    </p>
                    {/* Illustrative Image */}
                    <div className="mt-8">
                        <img src={contactImage} alt="Contact Us" className="mx-auto h-40 w-auto" />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg shadow flex items-center animate-fadeIn">
                        <X className="w-6 h-6 mr-2" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg shadow flex items-center animate-fadeIn">
                        <Check className="w-6 h-6 mr-2" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Device and Language Selection */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-6 mb-8">
                    {/* Audio Input Device Selection */}
                    <div className="w-full max-w-md">
                        <label htmlFor="audio-input-device" className="block text-[#817F75] font-medium mb-2">
                            Select Audio Input Device:
                        </label>
                        <select
                            id="audio-input-device"
                            value={selectedAudioInputDevice}
                            onChange={handleAudioInputDeviceChange}
                            className="w-full p-3 border border-[#C5D9E2] rounded-md bg-[#F5F5F5] text-[#171B17] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B6EA01]"
                        >
                            {audioInputDevices.length > 0 ? (
                                audioInputDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label}
                                    </option>
                                ))
                            ) : (
                                <option value="">No audio input devices found</option>
                            )}
                        </select>
                    </div>

                    {/* Source Language Selection */}
                    <div className="w-full max-w-md">
                        <label htmlFor="source-language" className="block text-[#817F75] font-medium mb-2">
                            Select Source Language:
                        </label>
                        <select
                            id="source-language"
                            value={sourceLanguage}
                            onChange={handleSourceLanguageChange}
                            className="w-full p-3 border border-[#C5D9E2] rounded-md bg-[#F5F5F5] text-[#171B17] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B6EA01]"
                        >
                            {sourceLanguages.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    <div className="flex items-center">
                                        <ReactCountryFlag
                                            countryCode={getCountryCode(lang.code)}
                                            svg
                                            style={{
                                                width: "1.5em",
                                                height: "1.5em",
                                                marginRight: "0.5em",
                                                borderRadius: "50%",
                                            }}
                                        />
                                        {lang.name}
                                    </div>
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Target Language Selection */}
                    <div className="w-full max-w-md">
                        <label htmlFor="target-language" className="block text-[#817F75] font-medium mb-2">
                            Select Target Language:
                        </label>
                        <select
                            id="target-language"
                            value={targetLanguage}
                            onChange={handleTargetLanguageChange}
                            className="w-full p-3 border border-[#C5D9E2] rounded-md bg-[#F5F5F5] text-[#171B17] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B6EA01]"
                        >
                            {targetLanguages.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    <div className="flex items-center">
                                        <ReactCountryFlag
                                            countryCode={getCountryCode(lang.code)}
                                            svg
                                            style={{
                                                width: "1.5em",
                                                height: "1.5em",
                                                marginRight: "0.5em",
                                                borderRadius: "50%",
                                            }}
                                        />
                                        {lang.name}
                                    </div>
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Phrase List Section */}
                <div className="mb-8">
                    <h2 className="text-2xl md:text-3xl font-semibold text-[#817F75] mb-4 text-center">
                        Enhance Recognition with Phrase List ({sourceLanguage.toUpperCase()})
                    </h2>
                    <div className="flex flex-col md:flex-row items-start justify-center md:items-center gap-2">
                        <input
                            type="text"
                            value={phraseInput}
                            onChange={(e) => setPhraseInput(e.target.value)}
                            onKeyDown={handlePhraseInputKeyDown}
                            placeholder="Enter a phrase or word and press Enter"
                            className="w-full md:w-auto p-2 border border-[#C5D9E2] rounded-md bg-[#F5F5F5] text-[#171B17] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B6EA01] transition duration-200 text-sm"
                        />
                        <button
                            onClick={handleAddPhrase}
                            className="flex items-center px-3 py-2 bg-[#B6EA01] text-[#171B17] rounded-full hover:bg-[#A0D800] transition duration-200 focus:outline-none shadow-sm text-sm"
                            aria-label="Add Phrase"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleClearPhrases}
                            className={`flex items-center px-3 py-2 bg-[#817F75] text-white rounded-full hover:bg-[#6E6E6E] transition duration-200 focus:outline-none shadow-sm text-sm ${
                                (phraseList[sourceLanguage]?.length || 0) === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}
                            disabled={(phraseList[sourceLanguage]?.length || 0) === 0}
                            aria-label="Clear Phrases"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Predefined Scientific Terms */}
                    {predefinedScientificTerms[sourceLanguage]?.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-medium text-[#817F75] mb-2">
                                Predefined Scientific Terms:
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {predefinedScientificTerms[sourceLanguage].map((term, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleAddPredefinedPhrase(term)}
                                        className="px-3 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-200 text-sm"
                                        aria-label={`Add predefined phrase ${term}`}
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Display Current Language's Phrase List */}
                    {(phraseList[sourceLanguage]?.length || 0) > 0 && (
                        <div className="mt-4">
                            <h3 className="text-lg font-medium text-[#817F75] mb-2">Current Phrases:</h3>
                            <div className="h-24 overflow-y-auto p-2 bg-[#F5F5F5] border border-[#C5D9E2] rounded-md shadow-inner">
                                <ul className="space-y-1">
                                    {phraseList[sourceLanguage].map((phrase, index) => (
                                        <li key={index} className="flex items-center justify-between">
                                            <span className="text-sm text-[#171B17]">{phrase}</span>
                                            <button
                                                onClick={() => handleRemovePhrase(phrase)}
                                                className="text-red-500 hover:text-red-700 transition duration-200 focus:outline-none"
                                                aria-label={`Remove phrase ${phrase}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Audio Playback Speed Control */}
                <div className="flex flex-col items-center mb-8">
                    <label htmlFor="playback-speed" className="block text-[#817F75] font-medium mb-2">
                        Adjust Audio Playback Speed: {playbackSpeed.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        id="playback-speed"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        className="w-full max-w-md"
                    />
                </div>

                {/* Start/Stop Button */}
                <div className="text-center mb-8">
                    <AudioVisualizer isRecording={isRecognizing} />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isRecognizing ? stopRecognition : startRecognition}
                        className={`p-4 rounded-full shadow-lg ${
                            isRecognizing ? "bg-red-500 hover:bg-red-600" : "bg-[#B6EA01] hover:bg-[#A0D800]"
                        } text-white transition-colors duration-200`}
                    >
                        {isRecognizing ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    </motion.button>
                </div>

                {/* Transcription and Translation Display */}
                {showTranscriptionSections && (
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Transcription */}
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[#817F75]">Transcription</h2>
                            <div className="p-6 bg-[#F5F5F5] rounded-lg shadow-md min-h-[150px]">
                                <p className="text-[#171B17] whitespace-pre-wrap">
                                    {transcription || "Transcription will appear here..."}
                                </p>
                            </div>
                        </div>
                        {/* Translation */}
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[#817F75]">Translation</h2>
                            <div className="p-6 bg-[#F5F5F5] rounded-lg shadow-md min-h-[150px]">
                                <p className="text-[#171B17] whitespace-pre-wrap">
                                    {translation || "Translation will appear here..."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Session Transcription and Download */}
                {showTranscriptionSections && (
                    <div className="mt-12">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[#817F75]">
                            Session Transcription
                        </h2>
                        <div className="p-6 bg-[#F5F5F5] rounded-lg shadow-md min-h-[200px] overflow-y-auto">
                            <pre className="text-[#171B17] whitespace-pre-wrap">
                                {sessionTranscription || "Session transcription will appear here..."}
                            </pre>
                        </div>
                        <div className="mt-4 text-center">
                            <button
                                onClick={downloadSessionTranscription}
                                className={`flex items-center justify-center px-6 py-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-lg transform hover:scale-105 ${
                                    !sessionTranscription ? "bg-purple-300 cursor-not-allowed" : ""
                                }`}
                                disabled={!sessionTranscription}
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Download Transcription
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="bg-[#F5F5F5] shadow-inner mt-12">
                <div className="container mx-auto px-4 py-6 flex flex-col items-center">
                    {/* Contact Image */}
                    <img src={contactImage} alt="Contact Us" className="h-30 w-50 mb-1" />
                    <p className="text-gray-600">&copy; 2024 AI Translator. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default App;
