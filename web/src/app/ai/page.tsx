import { Cpu, Server, Activity } from 'lucide-react';

export default function AIPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-zinc-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center">
            <Cpu className="mr-3 text-purple-500" />
            AI Reasoning Engine
          </h1>
          <p className="text-zinc-400 mt-2">System metrics and inference visualization.</p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center text-purple-400 text-sm font-medium">
          <Activity className="w-4 h-4 mr-2 animate-pulse" />
          Model Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Vision Model</h3>
          <p className="text-2xl font-bold text-zinc-100">EfficientNet-B0</p>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>Latency: 45ms</span>
            <span className="text-green-500">Online</span>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">NLP Model</h3>
          <p className="text-2xl font-bold text-zinc-100">Groq LLaMA 3</p>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>Latency: 12ms</span>
            <span className="text-green-500">Online</span>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Speech-to-Text</h3>
          <p className="text-2xl font-bold text-zinc-100">Whisper</p>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>Latency: 210ms</span>
            <span className="text-green-500">Online</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2 text-zinc-400" />
          Fusion Engine Logs
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-400 h-64 overflow-y-auto space-y-2">
          <div>[INFO] Received SMS report from +1555019****</div>
          <div>[INFO] Extracting NLP features... [Hazard: Flood, Severity: High]</div>
          <div>[INFO] Geographic cluster match found for [lat: 34.05, lng: -118.24]</div>
          <div><span className="text-purple-400">[FUSION]</span> Corroborating incident #1024. Confidence updated to 94%</div>
          <div>[INFO] Enqueuing to responder dashboard...</div>
          <div className="animate-pulse">_</div>
        </div>
      </div>
    </div>
  );
}
