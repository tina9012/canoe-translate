import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { socket } from '../socket';

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    socket.on('transcription', (data) => {
      setTranscript(data.transcript);
      if (data.detectedLanguage) {
        setDetectedLanguage(data.detectedLanguage);
      }
    });

    return () => {
      socket.off('transcription');
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      
      socket.emit('startGoogleCloudStream', {});
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              socket.emit('audioData', reader.result);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      mediaRecorder.current.start(250);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      socket.emit('endGoogleCloudStream');
      setIsRecording(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-4 rounded-full transition-all ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isRecording ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
        
        {detectedLanguage && (
          <div className="text-sm font-medium text-gray-600">
            Detected Language: {detectedLanguage}
          </div>
        )}

        <div className="w-full min-h-[200px] p-6 bg-white rounded-lg shadow-lg">
          <p className="text-lg leading-relaxed">
            {transcript || 'Start speaking to see the transcription...'}
          </p>
        </div>
      </div>
    </div>
  );
}