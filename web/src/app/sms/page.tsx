"use client";

import { useState } from 'react';
import { MessageSquare, Smartphone, Send, Loader2, CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import { AIReasoningService } from '@/lib/services/ai';
import { TwilioService } from '@/lib/services/twilio';
import { Incident } from '@/lib/storage';
import Link from 'next/link';

export default function SMSPage() {
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'ANALYZING' | 'DONE'>('IDLE');
  const [fusedIncident, setFusedIncident] = useState<Incident | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !phoneNumber) return;

    setStatus('SENDING');
    
    // 1. Pass to Twilio abstraction (simulation mode)
    await TwilioService.handleIncomingSMS(phoneNumber, message);
    
    setStatus('ANALYZING');

    // 2. AI Reasoning extracts info and fuses into map
    const { incident } = await AIReasoningService.processTextReport(message, 'SMS', phoneNumber);
    
    setFusedIncident(incident);
    setStatus('DONE');
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
            <MessageSquare className="mr-3 text-green-500" />
            SMS Disaster Report
          </h1>
          <p className="text-zinc-400 mt-2">Simulate an incoming SMS reaching the Twilio Webhook.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: SMS Form */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="text-zinc-500 w-6 h-6" />
            <h2 className="text-xl font-bold text-zinc-100">Twilio Simulation</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">
            <div>
              <label className="block text-sm text-zinc-400 mb-2 font-medium">Citizen Phone Number</label>
              <input 
                type="text" 
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={status !== 'IDLE'}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50" 
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-2 font-medium">Text Message</label>
              <textarea 
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={status !== 'IDLE'}
                className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50 resize-none"
                placeholder="e.g., FLOOD Gandhi Road cars stuck"
              ></textarea>
            </div>

            {status === 'IDLE' && (
              <button 
                type="submit"
                className="w-full mt-auto bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" /> SEND SMS TO SYSTEM
              </button>
            )}

            {status !== 'IDLE' && status !== 'DONE' && (
              <div className="w-full mt-auto bg-zinc-800 text-zinc-300 font-bold py-4 rounded-xl flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                {status === 'SENDING' ? 'Routing via Twilio...' : 'AI Extracting Intent...'}
              </div>
            )}
          </form>
        </div>

        {/* Right Column: AI Extraction Results */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 min-h-[500px] flex flex-col">
          <h2 className="text-xl font-bold text-zinc-100 mb-6 border-b border-zinc-800 pb-4">
            NLP Extraction Result
          </h2>

          {status === 'IDLE' || status === 'SENDING' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p>Waiting for SMS input...</p>
            </div>
          ) : status === 'ANALYZING' ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex space-x-2 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-zinc-400">Processing Natural Language...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-500">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-green-500 mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-bold text-lg">SMS Processed & Normalized</span>
                </div>
                
                {fusedIncident && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Hazard</p>
                        <p className="text-xl font-black text-zinc-100">{fusedIncident.hazard}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Severity</p>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${severityColor(fusedIncident.severity)}`}>
                          {fusedIncident.severity}
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">Location Coordinates</p>
                      <p className="text-sm font-medium text-zinc-300 font-mono">
                        {fusedIncident.latitude.toFixed(5)}, {fusedIncident.longitude.toFixed(5)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <AlertTriangle className="text-blue-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-blue-400 font-bold text-sm">Incident Created</p>
                        <p className="text-blue-500/70 text-xs">Available on Live Map and Dashboard.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => {
                    setMessage('');
                    setStatus('IDLE');
                    setFusedIncident(null);
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 rounded-xl transition-colors"
                >
                  Send Another SMS
                </button>
                <Link href="/map" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center">
                  View Map <ChevronRight className="w-5 h-5 ml-1" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
