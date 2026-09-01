"use client";

import { useState } from 'react';
import { PhoneCall, Phone, Mic, Loader2, CheckCircle2, ChevronRight, PhoneOff, AlertTriangle } from 'lucide-react';
import { AIReasoningService } from '@/lib/services/ai';
import { TwilioService } from '@/lib/services/twilio';
import { Incident } from '@/lib/storage';
import Link from 'next/link';

export default function CallPage() {
  const [callStatus, setCallStatus] = useState<'IDLE' | 'CALLING' | 'Q1' | 'Q2' | 'Q3' | 'PROCESSING' | 'DONE'>('IDLE');
  
  const [hazard, setHazard] = useState('');
  const [location, setLocation] = useState('');
  const [affected, setAffected] = useState('');
  
  const [fusedIncident, setFusedIncident] = useState<Incident | null>(null);

  const startCall = () => {
    setCallStatus('CALLING');
    setTimeout(() => setCallStatus('Q1'), 2500);
  };

  const endCallEarly = () => {
    setCallStatus('IDLE');
    setHazard('');
    setLocation('');
    setAffected('');
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (callStatus === 'Q1') {
      if (!hazard) return;
      setCallStatus('Q2');
    } else if (callStatus === 'Q2') {
      if (!location) return;
      setCallStatus('Q3');
    } else if (callStatus === 'Q3') {
      if (!affected) return;
      finishCall();
    }
  };

  const finishCall = async () => {
    setCallStatus('PROCESSING');
    
    const combinedTranscript = `Hazard reported: ${hazard}. Location stated: ${location}. People/vehicles affected: ${affected}.`;
    const callerNumber = '+91 99999 00000';

    await TwilioService.handleIncomingCall(callerNumber, combinedTranscript);
    
    // Pass text to AI reasoning to extract structured data
    const { incident } = await AIReasoningService.processTextReport(combinedTranscript, 'Voice', callerNumber);
    
    setFusedIncident(incident);
    setCallStatus('DONE');
  };

  const severityColor = (sev: string) => {
    if (sev === 'CRITICAL') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (sev === 'HIGH') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (sev === 'MEDIUM') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-zinc-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
            <PhoneCall className="mr-3 text-cyan-500" />
            Emergency Voice IVR
          </h1>
          <p className="text-zinc-400 mt-2">Simulate an incoming automated phone call interacting with Twilio Voice.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Phone Simulator */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col relative overflow-hidden shadow-2xl min-h-[600px] max-w-sm mx-auto w-full">
          {/* Phone Top Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl flex items-center justify-center">
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full"></div>
          </div>

          <div className="flex-1 mt-8 flex flex-col justify-center">
            
            {callStatus === 'IDLE' && (
              <div className="text-center">
                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Phone className="w-10 h-10 text-zinc-600" />
                </div>
                <h3 className="text-2xl font-medium text-zinc-300 mb-2">EOC Hotline</h3>
                <p className="text-zinc-500 mb-12">+1 (800) DIS-ASTR</p>
                <button 
                  onClick={startCall}
                  className="w-20 h-20 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-transform hover:scale-105"
                >
                  <Phone className="w-8 h-8 text-white fill-current" />
                </button>
                <p className="text-zinc-400 mt-4 text-sm font-bold uppercase tracking-widest">START CALL</p>
              </div>
            )}

            {callStatus === 'CALLING' && (
              <div className="text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <PhoneCall className="w-10 h-10 text-cyan-500" />
                </div>
                <h3 className="text-2xl font-medium text-zinc-300 mb-2">Connecting...</h3>
                <p className="text-zinc-500 mb-12">Dialing Emergency System</p>
                
                <button 
                  onClick={endCallEarly}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center mx-auto mt-8"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
              </div>
            )}

            {(callStatus === 'Q1' || callStatus === 'Q2' || callStatus === 'Q3') && (
              <form onSubmit={handleNext} className="flex-1 flex flex-col justify-between animate-in slide-in-from-bottom-8 duration-500">
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center mb-4">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-6 bg-cyan-500 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                      <div className="w-1.5 h-10 bg-cyan-500 rounded-full animate-[pulse_1.2s_ease-in-out_infinite]"></div>
                      <div className="w-1.5 h-8 bg-cyan-500 rounded-full animate-[pulse_0.8s_ease-in-out_infinite]"></div>
                      <div className="w-1.5 h-12 bg-cyan-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                      <div className="w-1.5 h-7 bg-cyan-500 rounded-full animate-[pulse_0.9s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                  <p className="text-cyan-400 text-sm font-medium mb-1">IVR SYSTEM SPEAKING</p>
                  <h3 className="text-xl font-bold text-zinc-100 italic">
                    "{callStatus === 'Q1' ? "What type of hazard are you reporting?" :
                      callStatus === 'Q2' ? "What is your exact location?" :
                      "Are people or vehicles affected?"}"
                  </h3>
                </div>

                <div className="flex-1">
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                    <label className="flex items-center text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">
                      <Mic className="w-4 h-4 mr-2" /> Your Voice Reply
                    </label>
                    
                    {callStatus === 'Q1' && (
                      <input 
                        type="text" autoFocus required value={hazard} onChange={(e) => setHazard(e.target.value)}
                        placeholder="e.g. A massive flood"
                        className="w-full bg-transparent text-xl text-zinc-100 focus:outline-none border-b border-zinc-700 pb-2 focus:border-cyan-500"
                      />
                    )}
                    {callStatus === 'Q2' && (
                      <input 
                        type="text" autoFocus required value={location} onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Gandhi Road"
                        className="w-full bg-transparent text-xl text-zinc-100 focus:outline-none border-b border-zinc-700 pb-2 focus:border-cyan-500"
                      />
                    )}
                    {callStatus === 'Q3' && (
                      <input 
                        type="text" autoFocus required value={affected} onChange={(e) => setAffected(e.target.value)}
                        placeholder="e.g. Yes, cars are stuck"
                        className="w-full bg-transparent text-xl text-zinc-100 focus:outline-none border-b border-zinc-700 pb-2 focus:border-cyan-500"
                      />
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={endCallEarly} className="w-16 h-16 flex-shrink-0 bg-zinc-800 hover:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center transition-colors">
                    <PhoneOff className="w-6 h-6" />
                  </button>
                  <button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full flex items-center justify-center transition-colors">
                    {callStatus === 'Q3' ? 'FINISH CALL' : 'REPLY'}
                  </button>
                </div>
              </form>
            )}

            {(callStatus === 'PROCESSING' || callStatus === 'DONE') && (
              <div className="text-center flex flex-col justify-between h-full animate-in fade-in duration-500">
                <div className="mt-12">
                  <CheckCircle2 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-medium text-zinc-300 mb-2">Call Ended</h3>
                  <p className="text-zinc-500">Duration: 00:42</p>
                </div>
                
                <button 
                  onClick={endCallEarly}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl mt-auto transition-colors"
                >
                  START NEW CALL
                </button>
              </div>
            )}
            
          </div>
        </div>

        {/* Right Column: AI Extraction Results */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-2xl min-h-[600px]">
          <h2 className="text-xl font-bold text-zinc-100 mb-6 border-b border-zinc-800 pb-4 flex items-center">
            <Mic className="w-6 h-6 mr-3 text-cyan-500" />
            Transcription & NLP Extraction
          </h2>

          {callStatus === 'IDLE' || callStatus === 'CALLING' || callStatus === 'Q1' || callStatus === 'Q2' || callStatus === 'Q3' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
              <PhoneCall className="w-16 h-16 mb-4 opacity-20" />
              <p>Waiting for completed call audio...</p>
            </div>
          ) : callStatus === 'PROCESSING' ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
              <p className="text-zinc-400">Transcribing and extracting intent...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-500">
              <div className="space-y-6">
                
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">Raw Transcription String</p>
                  <p className="text-sm font-medium text-zinc-300 italic">
                    "Hazard reported: {hazard}. Location stated: {location}. People/vehicles affected: {affected}."
                  </p>
                </div>
                
                {fusedIncident && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Extracted Hazard</p>
                        <p className="text-xl font-black text-zinc-100 uppercase">{fusedIncident.hazard}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Calculated Severity</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${severityColor(fusedIncident.severity)}`}>
                          {fusedIncident.severity}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <AlertTriangle className="text-blue-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-blue-400 font-bold text-sm">Incident Created & Fused</p>
                        <p className="text-blue-500/70 text-xs">Available instantly on the Live Map.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <Link href="/map" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-4 rounded-xl transition-colors flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  Track on Live Map <ChevronRight className="w-5 h-5 ml-1" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
