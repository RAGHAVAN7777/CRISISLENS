"use client";

import { Mic, Phone, Square, AlertTriangle, Send } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("Waiting for call...");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    setIsRecording(true);
    setTranscript("");
    setError(null);
    setSuccess(false);
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(prev => {
        if (prev >= 60) {
          stopRecording(60);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = (finalDuration = duration) => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Validation Constraints (Task 5)
    if (finalDuration < 1) {
      setError("Recording too short. Please speak for at least 1 second.");
      return;
    }
    if (finalDuration > 60) {
      setError("Recording too long. Maximum duration is 60 seconds.");
      return;
    }
    
    if (!transcript.trim()) {
      setError("No speech detected — please try again.");
      return;
    }
    
    setSuccess(true);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
          <Mic className="mr-3 text-blue-500" />
          Voice Report
        </h1>
        <p className="text-zinc-400 mt-2">Simulate an incoming emergency IVR call with data validation.</p>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8">
        <div className="flex items-center gap-4 mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="p-3 bg-blue-500 rounded-full">
            <Phone className="text-white w-6 h-6" />
          </div>
          <div>
            <h3 className="text-blue-400 font-medium text-lg">Call the Emergency Line</h3>
            <p className="text-zinc-400 text-sm">Number: +1 (555) 019-9999</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center">
            <Send className="w-5 h-5 text-emerald-500 mr-3" />
            <p className="text-emerald-400 text-sm font-medium">Voice report successfully submitted to processing queue!</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h4 className="text-zinc-300 font-medium mb-4">Live Transcription Feed</h4>
            
            <div className="space-y-4 mb-6">
              <div className="flex text-sm">
                <span className="text-zinc-500 w-16 flex-shrink-0">System:</span>
                <span className="text-zinc-300">"What is the nature of your emergency?"</span>
              </div>
              <div className="flex text-sm items-start">
                <span className="text-blue-400 w-16 flex-shrink-0">Caller:</span>
                <div className="flex-1">
                  {isRecording ? (
                    <textarea 
                      autoFocus
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder="Start typing to simulate Speech-to-Text..."
                      className="w-full bg-zinc-950 border border-blue-500/30 rounded px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 min-h-[80px]"
                    />
                  ) : (
                    <span className="text-zinc-100 italic">{transcript}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
              <div className="text-sm font-mono text-zinc-400">
                Duration: {duration}s / 60s
              </div>
              
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors text-sm"
                >
                  <Mic className="w-4 h-4 mr-2" /> Start Call Simulation
                </button>
              ) : (
                <button 
                  onClick={() => stopRecording(duration)}
                  className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors text-sm animate-pulse"
                >
                  <Square className="w-4 h-4 mr-2" /> End Call
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
