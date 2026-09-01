"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, AlertTriangle, Mic, MessageSquare, 
  Map, ShieldAlert, Cpu, Navigation as NavIcon, Route,
  Users, Clock, Trash2, RefreshCw
} from 'lucide-react';
import { getIncidents, getTotalUnreadNotifications, seedVolunteers, clearAllDisasterData } from '@/lib/storage';

const routes = [
  { path: '/', label: 'Overview', icon: Activity },
  { path: '/report', label: 'Report Disaster', icon: AlertTriangle },
  { path: '/volunteer', label: 'Volunteer Center', icon: Users, badge: true },
  { path: '/map', label: 'Live Map', icon: Map },
  { path: '/route',   label: 'Route Planner', icon: Route },
  { path: '/routing', label: 'Safe Routing', icon: NavIcon },
  { path: '/call', label: 'Voice Report', icon: Mic },
  { path: '/sms', label: 'SMS Report', icon: MessageSquare },
  { path: '/responder', label: 'Responder Queue', icon: ShieldAlert },
  { path: '/judge', label: 'Judge AI', icon: Cpu },
  { path: '/forecast', label: '🔮 Time Machine', icon: Clock },
];

export default function Navigation() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    seedVolunteers();
    const updateBadge = () => {
      const incs = getIncidents();
      const needVerification = incs.filter(i => 
        i.verificationRequired && 
        !['VERIFIED', 'PARTIALLY_VERIFIED', 'FALSE_REPORT'].includes(i.verificationStatus ?? '')
      ).length;
      setUnreadCount(needVerification);
    };

    updateBadge();
    const interval = setInterval(updateBadge, 4000);
    window.addEventListener('volunteerNotification', updateBadge);
    window.addEventListener('incidentVerified', updateBadge);

    return () => {
      clearInterval(interval);
      window.removeEventListener('volunteerNotification', updateBadge);
      window.removeEventListener('incidentVerified', updateBadge);
    };
  }, []);

  const handleClearData = (reseed: boolean) => {
    const confirmMsg = reseed 
      ? "Reset database and restore default demo incidents?"
      : "Delete ALL disaster incidents, user reports, and routes completely?";
    if (window.confirm(confirmMsg)) {
      setClearing(true);
      clearAllDisasterData(reseed);
      window.location.reload();
    }
  };

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 h-screen flex flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <Activity className="text-red-500 mr-2" size={24} />
        <h1 className="text-zinc-100 font-bold text-lg tracking-tight">Disaster Intel</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {routes.map((route) => {
          const isActive = pathname === route.path || (route.path === '/volunteer' && pathname.startsWith('/volunteer'));
          const Icon = route.icon;
          return (
            <Link
              key={route.path}
              href={route.path}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-red-500/10 text-red-500' 
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              <div className="flex items-center">
                <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-red-500' : 'text-zinc-500'}`} />
                {route.label}
              </div>
              {route.badge && unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => handleClearData(false)}
            title="Wipe all reports and incidents completely"
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold transition-all cursor-pointer"
          >
            <Trash2 size={12} />
            Wipe Data
          </button>
          <button
            onClick={() => handleClearData(true)}
            title="Reset to default clean demo state"
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw size={12} />
            Reset Demo
          </button>
        </div>
        <div className="flex items-center px-1">
          <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
          <span className="text-[11px] text-zinc-500 font-medium tracking-wider uppercase">System Online</span>
        </div>
      </div>
    </aside>
  );
}
