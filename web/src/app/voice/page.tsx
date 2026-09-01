import { Mic, Phone } from 'lucide-react';

export default function VoicePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-zinc-800 pb-6">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
          <Mic className="mr-3 text-blue-500" />
          Voice Report
        </h1>
        <p className="text-zinc-400 mt-2">Simulate an incoming emergency IVR call.</p>
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

        <div className="space-y-6">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h4 className="text-zinc-300 font-medium mb-2">Live Transcription Feed</h4>
            <div className="space-y-3">
              <div className="flex text-sm">
                <span className="text-zinc-500 w-16">System:</span>
                <span className="text-zinc-300">"What type of hazard?"</span>
              </div>
              <div className="flex text-sm">
                <span className="text-blue-400 w-16">Caller:</span>
                <span className="text-zinc-100 italic">"Waiting for call..."</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
