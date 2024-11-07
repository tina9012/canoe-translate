// src/App.tsx 

import React, { useState, useRef, useEffect } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { TextAnalyticsClient, AzureKeyCredential } from "@azure/ai-text-analytics";
import { Headphones, Download, Trash2, Plus, X } from 'lucide-react';
import '@fontsource/roboto/300.css';  // Example for Roboto Light font
import ReactCountryFlag from "react-country-flag"; // Alternative to react-flag-icon-css

// Access environment variables via import.meta.env for Vite
const speechKey = import.meta.env.VITE_SPEECH_KEY?.trim() || '';
const serviceRegion = import.meta.env.VITE_SPEECH_REGION?.trim() || '';
const textAnalyticsKey = import.meta.env.VITE_TEXT_ANALYTICS_KEY?.trim() || '';
const textAnalyticsRegion = import.meta.env.VITE_TEXT_ANALYTICS_REGION?.trim() || '';
const textAnalyticsEndpoint = import.meta.env.VITE_TEXT_ANALYTICS_ENDPOINT?.trim() || '';

interface AudioInputDevice {
  deviceId: string;
  label: string;
}

interface TargetLanguageOption {
  code: string;
  name: string;
}

function App() {
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for accumulated session transcription
  const [sessionTranscription, setSessionTranscription] = useState<string>(''); // **New**

  // State to control visibility of transcription sections
  const [showTranscriptionSections, setShowTranscriptionSections] = useState<boolean>(false); // **New**

  // Define supported input languages
  const supportedInputLanguages = ['en', 'fr', 'es', 'it'];

  // Define target languages
  const targetLanguages: TargetLanguageOption[] = [
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'la', name: 'Latin' }, // Note: Latin may not have official voice support
    // Add more languages as desired
  ];

  const [targetLanguage, setTargetLanguage] = useState<string>('fr'); // Default to French

  // State for audio input devices
  const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedAudioInputDevice, setSelectedAudioInputDevice] = useState<string>('');

  // State for phrase list
  const [phraseInput, setPhraseInput] = useState<string>(''); // Current input field
  const [phraseList, setPhraseList] = useState<string[]>([]); // List of phrases

  const initialRecognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const translationRecognizerRef = useRef<SpeechSDK.TranslationRecognizer | null>(null);
  const synthRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
  const textAnalyticsClient = useRef<TextAnalyticsClient | null>(null);
  const stopInProgressRef = useRef(false);

  // Initialize Text Analytics Client
  useEffect(() => {
    if (textAnalyticsKey && textAnalyticsEndpoint) {
      try {
        textAnalyticsClient.current = new TextAnalyticsClient(
          textAnalyticsEndpoint,
          new AzureKeyCredential(textAnalyticsKey)
        );
        console.log('TextAnalyticsClient initialized.');
      } catch (error) {
        console.error('Error initializing TextAnalyticsClient:', error);
        setError('Error initializing Text Analytics client.');
      }
    } else {
      setError('Missing Text Analytics environment variables.');
    }
  }, [textAnalyticsKey, textAnalyticsEndpoint]);

  // Temporary logging for environment variables
  useEffect(() => {
    console.log('VITE_SPEECH_KEY:', speechKey ? 'Loaded' : 'Missing');
    console.log('VITE_SPEECH_REGION:', serviceRegion ? serviceRegion : 'Missing');
    console.log('VITE_TEXT_ANALYTICS_KEY:', textAnalyticsKey ? 'Loaded' : 'Missing');
    console.log('VITE_TEXT_ANALYTICS_REGION:', textAnalyticsRegion ? textAnalyticsRegion : 'Missing');
    console.log('VITE_TEXT_ANALYTICS_ENDPOINT:', textAnalyticsEndpoint ? textAnalyticsEndpoint : 'Missing');
  }, [speechKey, serviceRegion, textAnalyticsKey, textAnalyticsRegion, textAnalyticsEndpoint]);

  // Enumerate audio input devices on component mount
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        console.log('Requesting microphone access...');
        // Request microphone access to get device labels (requires user permission)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId}`
          }));
        setAudioInputDevices(audioInputs);
        console.log('Audio input devices:', audioInputs);
        // Set default device if not already selected
        if (audioInputs.length > 0 && !selectedAudioInputDevice) {
          setSelectedAudioInputDevice(audioInputs[0].deviceId);
          console.log(`Default audio input device set to: ${audioInputs[0].label}`);
        }
      } catch (err) {
        console.error('Error enumerating audio devices:', err);
        setError('Unable to access audio devices. Please check your microphone permissions.');
      }
    };

    enumerateDevices();
  }, []); // Fixed dependency array to run only once on mount

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      if (synthRef.current) {
        try {
          synthRef.current.close();
          console.log('Synthesizer closed on unmount');
        } catch (error) {
          console.warn('Synthesizer already closed on unmount:', error);
        }
      }
      if (initialRecognizerRef.current) {
        try {
          initialRecognizerRef.current.close();
        } catch (error) {
          console.warn('Initial recognizer already closed on unmount:', error);
        }
      }
      if (translationRecognizerRef.current) {
        try {
          translationRecognizerRef.current.close();
        } catch (error) {
          console.warn('Translation recognizer already closed on unmount:', error);
        }
      }
    };
  }, []);

  // **Updated Helper Function**
  const appendOrReplaceSessionTranscription = (newText: string) => {
    setSessionTranscription(prev => {
      const lines = prev.split('\n');
      // Find the last index of a line starting with "Translation:"
      const lastTranslationIndex = lines.reduce((lastIndex, line, index) => {
        return line.startsWith("Translation:") ? index : lastIndex;
      }, -1);
      
      if (lastTranslationIndex !== -1) {
        // Replace the last translation line with the new one
        lines[lastTranslationIndex] = newText;
        return lines.join('\n');
      } else {
        // Append as a new line if no previous translation exists
        return prev + (prev ? '\n' : '') + newText;
      }
    });
  };

  const startRecognition = async () => {
    console.log('Start Recognition button clicked.');

    if (isRecognizing) {
      console.warn('Recognition is already in progress.');
      return;
    }

    if (!textAnalyticsClient.current) {
      console.error('TextAnalyticsClient is not initialized.');
      setError('Text Analytics client is not initialized.');
      return;
    }

    if (!speechKey || !serviceRegion) {
      console.error('Speech service credentials are missing.');
      setError('Speech service credentials are missing.');
      return;
    }

    // Ensure all recognizers are stopped before starting a new one
    await stopRecognition();

    setTranscription('');
    setTranslation('');
    setDetectedLanguage('');
    setSessionTranscription(''); // Reset session transcription on new recognition
    setError(null);
    setIsRecognizing(true);
    setShowTranscriptionSections(true); // **Show transcription sections upon starting**

    try {
      // Initialize Speech Config for initial transcription
      console.log('Initializing SpeechConfig with key and region.');
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
      speechConfig.speechRecognitionLanguage = 'en-US'; // Temporary language for initial detection
      speechConfig.setProfanity(SpeechSDK.ProfanityOption.Raw); // **Allow profanity**

      console.log('SpeechConfig initialized:', speechConfig);

      // Use selected audio input device
      const audioConfig = selectedAudioInputDevice
        ? SpeechSDK.AudioConfig.fromMicrophoneInput(selectedAudioInputDevice)
        : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      console.log('AudioConfig for SpeechRecognizer:', audioConfig);

      // Create the initial recognizer
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      console.log('SpeechRecognizer created:', recognizer);

      initialRecognizerRef.current = recognizer;

      // Instantiate PhraseListGrammar using fromRecognizer
      console.log('Creating PhraseListGrammar using fromRecognizer.');
      const phraseListConstraint = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer);
      console.log('PhraseListGrammar created:', phraseListConstraint);

      // Add phrases to the PhraseListGrammar
      if (phraseList.length > 0) {
        const allStrings = phraseList.every(phrase => typeof phrase === 'string');
        if (!allStrings) {
          setError('Phrase list contains non-string items.');
          setIsRecognizing(false);
          return;
        }

        try {
          console.log('Adding phrases to PhraseListGrammar.');
          phraseList.forEach(phrase => {
            console.log('Adding phrase:', phrase);
            phraseListConstraint.addPhrase(phrase);
          });
          console.log('Phrases added successfully.');

          // **Removed the incorrect method call**
          // recognizer.addGrammar(phraseListConstraint);
          // console.log('PhraseListConstraint added to SpeechRecognizer.');
        } catch (error) {
          console.error('Error adding phrases:', error);
          setError('Error adding phrases to phrase list.');
          stopRecognition();
          return;
        }
      }

      // Set up event handlers
      recognizer.recognized = async (s, e) => {
        console.log('Recognizer recognized event triggered.');
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          setTranscription(text);
          appendOrReplaceSessionTranscription(text); // **Use helper function**
          console.log(`Transcription: ${text}`);

          // Detect language using Text Analytics
          const detectedLang = await detectLanguage(text);
          if (detectedLang && supportedInputLanguages.includes(detectedLang)) {
            setDetectedLanguage(detectedLang);
            console.log(`Detected Language: ${detectedLang}`);

            // Stop initial recognizer
            await stopRecognition();

            // Start translation recognizer with detected language
            startTranslation(detectedLang);
          } else {
            console.error('Detected language is not supported.');
            setError('Detected language is not supported. Please speak in English, French, Spanish, or Italian.');
            stopRecognition();
          }
        } else {
          console.warn('Speech not recognized. Reason:', e.result.reason);
        }
      };

      recognizer.canceled = (s, e) => {
        console.error('Recognition canceled:', e.errorDetails);
        setError(`Recognition canceled: ${e.errorDetails}`);
        stopRecognition();
      };

      recognizer.sessionStopped = () => {
        console.log('Session stopped');
        stopRecognition();
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log('Initial recognition started');
        },
        (err) => {
          console.error('Failed to start initial recognition:', err);
          setError('Failed to start recognition.');
          recognizer.close();
          initialRecognizerRef.current = null;
          stopRecognition();
        }
      );
    } catch (err) {
      console.error('Error during startRecognition:', err);
      setError('An unexpected error occurred during recognition.');
      setIsRecognizing(false);
    }
  };

  const detectLanguage = async (text: string): Promise<string | null> => {
    try {
      console.log('Detecting language for text:', text);
      const results = await textAnalyticsClient.current!.detectLanguage([text]);
      const result = results[0];
      if (result.error) {
        console.error("Language detection error:", result.error);
        setError('Language detection failed.');
        return null;
      }
      console.log('Detected language:', result.primaryLanguage.iso6391Name);
      return result.primaryLanguage.iso6391Name; // e.g., 'en', 'es', 'fr', 'it'
    } catch (error) {
      console.error("Error during language detection:", error);
      setError('Error during language detection.');
      return null;
    }
  };

  const startTranslation = async (sourceLanguage: string) => {
    console.log(`Starting translation for source language: ${sourceLanguage}`);
    setIsRecognizing(true); // Ensure isRecognizing remains true

    const languageMap: { [key: string]: string } = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'it': 'it-IT',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'la': 'la', // Latin may not be supported; check availability
      // Add more mappings as needed
    };

    const mappedSourceLanguage = languageMap[sourceLanguage] || 'en-US';

    try {
      console.log('Initializing SpeechTranslationConfig.');
      const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
      speechConfig.speechRecognitionLanguage = mappedSourceLanguage;
      speechConfig.addTargetLanguage(targetLanguage);
      speechConfig.setProfanity(SpeechSDK.ProfanityOption.Raw); // **Allow profanity in translation**

      console.log('SpeechTranslationConfig initialized:', speechConfig);

      // Use selected audio input device
      const audioConfig = selectedAudioInputDevice
        ? SpeechSDK.AudioConfig.fromMicrophoneInput(selectedAudioInputDevice)
        : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      console.log('AudioConfig for TranslationRecognizer:', audioConfig);

      // Create the translation recognizer
      const recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);
      console.log('TranslationRecognizer created:', recognizer);

      translationRecognizerRef.current = recognizer;

      // Instantiate PhraseListGrammar using fromRecognizer
      console.log('Creating PhraseListGrammar using fromRecognizer for TranslationRecognizer.');
      const phraseListConstraint = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer);
      console.log('PhraseListGrammar created for TranslationRecognizer:', phraseListConstraint);

      // Add phrases to the PhraseListGrammar
      if (phraseList.length > 0) {
        const allStrings = phraseList.every(phrase => typeof phrase === 'string');
        if (!allStrings) {
          setError('Phrase list contains non-string items.');
          setIsRecognizing(false);
          return;
        }

        try {
          console.log('Adding phrases to PhraseListGrammar for TranslationRecognizer.');
          phraseList.forEach(phrase => {
            console.log('Adding phrase:', phrase);
            phraseListConstraint.addPhrase(phrase);
          });
          console.log('Phrases added successfully to TranslationRecognizer.');

          // **Removed the incorrect method call**
          // recognizer.addGrammar(phraseListConstraint);
          // console.log('PhraseListConstraint added to SpeechTranslationConfig.');
        } catch (error) {
          console.error('Error adding phrases to TranslationRecognizer:', error);
          setError('Error adding phrases to phrase list.');
          stopRecognition();
          return;
        }
      }

      // Set up event handlers
      recognizer.recognizing = (s, e) => {
        const text = e.result.text;
        const translationText = e.result.translations.get(targetLanguage) || '';
        setTranscription(text);
        setTranslation(translationText);
        appendOrReplaceSessionTranscription(`Translation: ${translationText}`); // **Use helper function**
        console.log(`Recognizing: ${text} | Translation: ${translationText}`);
      };

      recognizer.recognized = (s, e) => {
        console.log('Translation recognizer recognized event triggered.');
        if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech) {
          const text = e.result.text;
          const translationText = e.result.translations.get(targetLanguage) || '';
          setTranscription(text);
          setTranslation(translationText);
          appendOrReplaceSessionTranscription(`Translation: ${translationText}`); // **Use helper function**
          console.log(`Translated Speech: ${translationText}`);
          synthesizeSpeech(translationText);
        } else {
          console.warn('Translation not recognized. Reason:', e.result.reason);
        }
      };

      recognizer.canceled = (s, e) => {
        console.error('Translation recognition canceled:', e.errorDetails);
        setError(`Translation canceled: ${e.errorDetails}`);
        stopRecognition();
      };

      recognizer.sessionStopped = () => {
        console.log('Translation recognition session stopped');
        stopRecognition();
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log('Translation recognition started');
        },
        (err) => {
          console.error('Failed to start translation recognition:', err);
          setError('Failed to start translation recognition.');
          recognizer.close();
          translationRecognizerRef.current = null;
          stopRecognition();
        }
      );
    } catch (err) {
      console.error('Error during startTranslation:', err);
      setError('An unexpected error occurred during translation.');
      stopRecognition();
    }
  };

  const stopRecognition = async () => {
    if (stopInProgressRef.current) {
      // Prevent concurrent stop operations
      return;
    }

    stopInProgressRef.current = true;
    try {
      const stopPromises: Promise<void>[] = [];

      // Stop initial recognizer if active
      if (initialRecognizerRef.current) {
        const initialStopPromise = new Promise<void>((resolve) => {
          initialRecognizerRef.current?.stopContinuousRecognitionAsync(
            () => {
              try {
                initialRecognizerRef.current?.close();
                console.log('Initial recognizer stopped');
              } catch (error) {
                console.warn('Error closing initial recognizer:', error);
              }
              initialRecognizerRef.current = null;
              resolve();
            },
            (err) => {
              console.error('Error stopping initial recognizer:', err);
              setError('Failed to stop initial recognizer.');
              try {
                initialRecognizerRef.current?.close();
              } catch (error) {
                console.warn('Error closing initial recognizer after failure:', error);
              }
              initialRecognizerRef.current = null;
              resolve(); // Resolve even on error to prevent hanging
            }
          );
        });
        stopPromises.push(initialStopPromise);
      }

      // Stop translation recognizer if active
      if (translationRecognizerRef.current) {
        const translationStopPromise = new Promise<void>((resolve) => {
          translationRecognizerRef.current?.stopContinuousRecognitionAsync(
            () => {
              try {
                translationRecognizerRef.current?.close();
                console.log('Translation recognizer stopped');
              } catch (error) {
                console.warn('Error closing translation recognizer:', error);
              }
              translationRecognizerRef.current = null;
              resolve();
            },
            (err) => {
              console.error('Error stopping translation recognizer:', err);
              setError('Failed to stop translation recognizer.');
              try {
                translationRecognizerRef.current?.close();
              } catch (error) {
                console.warn('Error closing translation recognizer after failure:', error);
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
          console.log('Synthesizer stopped');
        } catch (error) {
          console.warn('Synthesizer already closed:', error);
        }
        synthRef.current = null;
      }

      setIsRecognizing(false);
    } catch (err) {
      console.error('Error during stopRecognition:', err);
      setError('An unexpected error occurred during stop.');
      setIsRecognizing(false);
    } finally {
      stopInProgressRef.current = false;
    }
  };

  const synthesizeSpeech = (text: string) => {
    try {
      console.log(`Synthesizing speech for text: ${text}`);
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
      const targetLangMap: { [key: string]: string } = {
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE',
        'it': 'it-IT',
        'zh': 'zh-CN',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'ar': 'ar-SA',
        'pt': 'pt-PT',
        'ru': 'ru-RU',
        'la': 'la', // Latin may not be supported
        // Add more mappings as needed
      };
      const synthesisLanguage = targetLangMap[targetLanguage] || 'fr-FR';
      speechConfig.speechSynthesisLanguage = synthesisLanguage;
      speechConfig.speechSynthesisVoiceName = getVoiceName(targetLanguage);

      speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_Synthesizer_VoiceSpeed, "1.4");

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log('Speech synthesized for text:', text);
          } else {
            console.error('Speech synthesis failed:', result.errorDetails);
            setError('Speech synthesis failed.');
          }
          // Do not close synthesizer here
        },
        (error) => {
          console.error('Error during speech synthesis:', error);
          setError('Error during speech synthesis.');
          // Do not close synthesizer here
        }
      );

      synthRef.current = synthesizer;
    } catch (err) {
      console.error('Error during synthesizeSpeech:', err);
      setError('An unexpected error occurred during speech synthesis.');
    }
  };

  const getVoiceName = (lang: string): string => {
    const voiceMap: { [key: string]: string } = {
      'fr': 'fr-FR-DeniseNeural',
      'es': 'es-ES-LauraNeural',
      'de': 'de-DE-KatjaNeural',
      'it': 'it-IT-ElsaNeural',
      'zh': 'zh-CN-XiaoxiaoNeural',
      'ja': 'ja-JP-AyumiNeural',
      'ko': 'ko-KR-SunHiNeural',
      'ar': 'ar-SA-SalmaNeural',
      'pt': 'pt-PT-CamilaNeural',
      'ru': 'ru-RU-IrinaNeural',
      'la': 'la-Latin-Voice', // Placeholder for Latin
      // Add more mappings as needed
    };
    return voiceMap[lang] || 'fr-FR-DeniseNeural';
  };

  const handleTargetLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTargetLanguage = e.target.value;

    if (newTargetLanguage === targetLanguage) return; // No change

    console.log(`Target language changed to ${newTargetLanguage}.`);

    setTargetLanguage(newTargetLanguage);

    if (isRecognizing && (translationRecognizerRef.current || initialRecognizerRef.current)) {
      // Restart translation recognizer with the new target language
      console.log(`Restarting recognizer due to target language change to ${newTargetLanguage}.`);
      await stopRecognition();

      if (detectedLanguage && supportedInputLanguages.includes(detectedLanguage)) {
        startTranslation(detectedLanguage);
      } else {
        setError('Detected language is unknown or unsupported. Cannot restart translation recognizer.');
      }
    }
  };

  // Handler for audio input device change
  const handleAudioInputDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    console.log(`Audio input device changed to: ${newDeviceId}`);
    setSelectedAudioInputDevice(newDeviceId);

    if (isRecognizing) {
      console.log(`Restarting recognition due to audio device change to ${newDeviceId}.`);
      await stopRecognition();
      if (detectedLanguage && supportedInputLanguages.includes(detectedLanguage)) {
        startTranslation(detectedLanguage);
      } else {
        startRecognition();
      }
    }
  };

  // Handlers for Phrase List
  const handleAddPhrase = () => {
    const trimmedPhrase = phraseInput.trim();
    if (trimmedPhrase && !phraseList.includes(trimmedPhrase)) {
      setPhraseList([...phraseList, trimmedPhrase]);
      setPhraseInput('');
      console.log(`Phrase added: ${trimmedPhrase}`);
    }
  };

  const handleRemovePhrase = (phrase: string) => {
    setPhraseList(phraseList.filter(p => p !== phrase));
    console.log(`Phrase removed: ${phrase}`);
  };

  const handleClearPhrases = () => {
    setPhraseList([]);
    console.log('All phrases cleared.');
  };

  const handlePhraseInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPhrase();
    }
  };

  // **New Function: Download Session Transcription**
  const downloadSessionTranscription = () => {
    if (!sessionTranscription) {
      setError('No transcription available to download.');
      return;
    }

    const element = document.createElement("a");
    const file = new Blob([sessionTranscription], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "session_transcription.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 font-roboto">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Headphones className="w-12 h-12 text-blue-500 animate-pulse" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Real-time Speech-to-Speech Translation
          </h1>
          <p className="text-xl text-gray-700">
            Speak in English, French, Spanish, or Italian - we'll transcribe and translate it automatically
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded shadow flex items-center">
            <X className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {/* Device and Language Selection */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-6 mb-8">
          {/* Audio Input Device Selection */}
          <div className="w-full max-w-md">
            <label htmlFor="audio-input-device" className="block text-gray-700 font-medium mb-2">
              Select Audio Input Device:
            </label>
            <select
              id="audio-input-device"
              value={selectedAudioInputDevice}
              onChange={handleAudioInputDeviceChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            >
              {audioInputDevices.length > 0 ? (
                audioInputDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              ) : (
                <option value="">No audio input devices found</option>
              )}
            </select>
          </div>

          {/* Target Language Selection */}
          <div className="w-full max-w-md">
            <label htmlFor="target-language" className="block text-gray-700 font-medium mb-2">
              Select Target Language:
            </label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={handleTargetLanguageChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            >
              {targetLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Phrase List Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-4">Enhance Recognition with Phrase List</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <input
              type="text"
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              onKeyDown={handlePhraseInputKeyDown}
              placeholder="Enter a phrase or word and press Enter"
              className="w-full md:w-auto p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200 text-sm"
            />
            <button
              onClick={handleAddPhrase}
              className="flex items-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </button>
            <button
              onClick={handleClearPhrases}
              className={`flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm ${
                phraseList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={phraseList.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </button>
          </div>
          {/* Display Phrase List */}
          {phraseList.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Current Phrases:</h3>
              <div className="h-24 overflow-y-auto p-2 bg-gray-50 rounded-md shadow-inner">
                <ul className="space-y-1">
                  {phraseList.map((phrase, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span className="text-sm">{phrase}</span>
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

        {/* Start/Stop Button */}
        <div className="text-center mb-8">
          {!isRecognizing ? (
            <button
              onClick={startRecognition}
              className={`flex items-center justify-center w-48 py-3 rounded-md font-semibold text-white transition duration-200 ${
                (!speechKey || !serviceRegion || !!error || audioInputDevices.length === 0)
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
              disabled={!speechKey || !serviceRegion || !!error || audioInputDevices.length === 0}
            >
              Start Translation
            </button>
          ) : (
            <button
              onClick={stopRecognition}
              className="flex items-center justify-center w-48 py-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition duration-200"
            >
              Stop Translation
            </button>
          )}
        </div>

        {/* Detected Language */}
        {detectedLanguage && (
          <div className="mt-4 text-center">
            <p className="text-lg text-gray-700">
              Detected Language: <strong>{detectedLanguage.toUpperCase()}</strong>
            </p>
          </div>
        )}

        {/* Transcription and Translation Display */}
        {showTranscriptionSections && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Transcription */}
            <div>
              <h2 className="text-3xl font-bold mb-4 text-gray-800">Transcription</h2>
              <div className="p-6 bg-white rounded-lg shadow-md min-h-[150px] animate-fade-in">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {transcription || 'Transcription will appear here...'}
                </p>
              </div>
            </div>
            {/* Translation */}
            <div>
              <h2 className="text-3xl font-bold mb-4 text-gray-800">Translation</h2>
              <div className="p-6 bg-white rounded-lg shadow-md min-h-[150px] animate-fade-in">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {translation || 'Translation will appear here...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* **New Section: Session Transcription and Download** */}
        {showTranscriptionSections && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-800">Session Transcription</h2>
            <div className="p-6 bg-white rounded-lg shadow-md min-h-[200px] overflow-y-auto animate-fade-in">
              <pre className="text-gray-800 whitespace-pre-wrap">
                {sessionTranscription || 'Session transcription will appear here...'}
              </pre>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={downloadSessionTranscription}
                className={`flex items-center justify-center px-6 py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  !sessionTranscription ? 'bg-purple-300 cursor-not-allowed' : ''
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
    </div>
  );
}

export default App;
