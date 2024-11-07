import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const speechKey = process.env.AZURE_SPEECH_KEY;
const serviceRegion = process.env.AZURE_SPEECH_REGION;
const targetLanguage = 'fr'; // Change to desired target language code

io.on('connection', (socket) => {
  console.log('Client connected');
  let recognizer = null;

  socket.on('startAzureStream', () => {
    if (recognizer) {
      recognizer.close();
      recognizer = null;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, serviceRegion);
    speechConfig.speechRecognitionLanguage = 'en-US'; // Source language
    speechConfig.addTargetLanguage(targetLanguage); // Target language

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    recognizer = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
      const transcription = e.result.text;
      const translation = e.result.translations.get(targetLanguage) || '';
      socket.emit('transcription', { transcription, translation });
    };

    recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.TranslatedSpeech) {
        const transcription = e.result.text;
        const translation = e.result.translations.get(targetLanguage) || '';
        socket.emit('transcription', { transcription, translation });
        // Optionally, send synthesized speech back to client
        // Implement speech synthesis if needed
      }
    };

    recognizer.canceled = (s, e) => {
      console.error('Speech recognition canceled:', e.errorDetails);
      socket.emit('error', e.errorDetails);
      recognizer.close();
      recognizer = null;
    };

    recognizer.sessionStopped = () => {
      console.log('Speech recognition session stopped');
      recognizer.close();
      recognizer = null;
    };

    recognizer.startContinuousRecognitionAsync();
  });

  socket.on('endAzureStream', () => {
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close();
        recognizer = null;
      });
    }
  });

  socket.on('disconnect', () => {
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close();
        recognizer = null;
      });
    }
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
