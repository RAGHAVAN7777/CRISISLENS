// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  source: 'Photo' | 'Voice' | 'SMS';
  image?: string;
  message?: string;
  transcript?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  hazard: string | string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  evidence: string[];
  // Blur detection fields
  blurScore?: number;
  isBlurry?: boolean;
  createdAt: string;
  location_precision?: 'approximate' | 'exact';
}

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'FIELD_VERIFICATION_REQUIRED'
  | 'VERIFICATION_IN_PROGRESS'
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'FALSE_REPORT'
  | 'UNABLE_TO_VERIFY';

export interface Incident {
  id: string;
  hazard: string | string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  latitude: number;
  longitude: number;
  accuracy?: number;
  confidence: number;
  reportIds: string[];
  reportCount: number;
  sources: string[];
  status: 'PENDING' | 'AI_CLASSIFIED' | 'VERIFIED' | 'RESOLVED' | 'REJECTED' | 'STALE';
  createdAt: string;
  // Blur & verification
  blurScore?: number;
  isBlurry?: boolean;
  verificationRequired?: boolean;
  verificationStatus?: VerificationStatus;
  assignedVolunteerId?: string;
  verificationNotes?: string;
  verifiedAt?: string;
  // Model metadata
  disasterType?: string;
  damageClass?: string;
  imageUrl?: string;
  // Fusion
  conflictingReports?: boolean;
  location_precision?: 'approximate' | 'exact';
}

export interface Shelter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  status: 'OPEN' | 'LIMITED' | 'FULL' | 'CLOSED';
}

export interface Route {
  id: string;
  roads: string[];
  distance: number;
  time: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ── Volunteer system ──────────────────────────────────────────────────────────

export interface VolunteerNotification {
  id: string;
  incidentId: string;
  message: string;
  disasterType: string;
  severity: string;
  confidence: number;
  isBlurry: boolean;
  timestamp: string;
  read: boolean;
}

export interface SmsDeliveryRecord {
  incidentId: string;
  recipient: string;
  status: 'sent' | 'failed' | 'simulated';
  mode: 'real_twilio' | 'demo_simulation';
  message: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface Volunteer {
  volunteerId: string;
  name: string;
  phone?: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  location?: { lat: number; lng: number };
  notifications: VolunteerNotification[];
  assignedTasks: string[]; // incidentIds
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = {
  REPORTS: 'disaster_reports',
  INCIDENTS: 'disaster_incidents',
  SHELTERS: 'disaster_shelters',
  ROUTES: 'disaster_routes',
  INITIALIZED: 'disaster_data_initialized',
  VOLUNTEERS: 'disaster_volunteers',
  VOLUNTEER_INITIALIZED: 'disaster_volunteers_initialized',
  SMS_DELIVERIES: 'disaster_sms_deliveries',
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage`, error);
    return defaultValue;
  }
};

const setItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage`, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

export const getReports = (): Report[] => getItem<Report[]>(KEYS.REPORTS, []);
export const saveReports = (reports: Report[]): void => setItem(KEYS.REPORTS, reports);
export const addReport = (report: Report): void => {
  const reports = getReports();
  saveReports([report, ...reports]);
};
export const updateReport = (id: string, updates: Partial<Report>): void => {
  const reports = getReports();
  const index = reports.findIndex(r => r.id === id);
  if (index !== -1) {
    reports[index] = { ...reports[index], ...updates };
    saveReports(reports);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

export const getIncidents = (includeOlder: boolean = false): Incident[] => {
  const incidents = getItem<Incident[]>(KEYS.INCIDENTS, []);
  let changed = false;
  const now = Date.now();
  
  const updated = incidents.map(inc => {
    const age = now - new Date(inc.createdAt).getTime();
    if (age > 24 * 60 * 60 * 1000 && inc.status !== 'RESOLVED' && inc.status !== 'REJECTED' && inc.status !== 'STALE') {
      changed = true;
      return { ...inc, status: 'STALE' as const };
    }
    return inc;
  });

  if (changed) {
    saveIncidents(updated);
  }

  if (includeOlder) {
    return updated;
  }

  return updated.filter(inc => {
    const age = now - new Date(inc.createdAt).getTime();
    return age <= 72 * 60 * 60 * 1000;
  });
};
export const saveIncidents = (incidents: Incident[]): void => setItem(KEYS.INCIDENTS, incidents);
export const addIncident = (incident: Incident): void => {
  const incidents = getIncidents();
  saveIncidents([incident, ...incidents]);
};
export const updateIncident = (id: string, updates: Partial<Incident>): void => {
  const incidents = getIncidents();
  const index = incidents.findIndex(i => i.id === id);
  if (index !== -1) {
    incidents[index] = { ...incidents[index], ...updates };
    saveIncidents(incidents);
  }
};
export const getIncidentById = (id: string): Incident | undefined => {
  return getIncidents().find(i => i.id === id);
};

// ─────────────────────────────────────────────────────────────────────────────
// Shelters
// ─────────────────────────────────────────────────────────────────────────────

export const getShelters = (): Shelter[] => getItem<Shelter[]>(KEYS.SHELTERS, []);
export const saveShelters = (shelters: Shelter[]): void => setItem(KEYS.SHELTERS, shelters);
export const addShelter = (shelter: Shelter): void => {
  const shelters = getShelters();
  saveShelters([shelter, ...shelters]);
};
export const updateShelter = (id: string, updates: Partial<Shelter>): void => {
  const shelters = getShelters();
  const index = shelters.findIndex(s => s.id === id);
  if (index !== -1) {
    shelters[index] = { ...shelters[index], ...updates };
    saveShelters(shelters);
  }
};
export const getAvailableShelters = (): Shelter[] => {
  return getShelters().filter(s => (s.status === 'OPEN' || s.status === 'LIMITED') && s.capacity < 100);
};
export const findNearestSafeShelter = (userLat: number, userLng: number): Shelter | null => {
  const available = getAvailableShelters();
  if (available.length === 0) return null;

  let nearest: Shelter | null = null;
  let minDistance = Infinity;

  available.forEach(shelter => {
    const dist = Math.hypot(shelter.latitude - userLat, shelter.longitude - userLng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = shelter;
    }
  });

  return nearest;
};

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export const getRoutes = (): Route[] => getItem<Route[]>(KEYS.ROUTES, []);
export const saveRoutes = (routes: Route[]): void => setItem(KEYS.ROUTES, routes);

// ─────────────────────────────────────────────────────────────────────────────
// Volunteers
// ─────────────────────────────────────────────────────────────────────────────

export const getVolunteers = (): Volunteer[] => getItem<Volunteer[]>(KEYS.VOLUNTEERS, []);
export const saveVolunteers = (volunteers: Volunteer[]): void => setItem(KEYS.VOLUNTEERS, volunteers);

export const updateVolunteer = (volunteerId: string, updates: Partial<Volunteer>): void => {
  const volunteers = getVolunteers();
  const index = volunteers.findIndex(v => v.volunteerId === volunteerId);
  if (index !== -1) {
    volunteers[index] = { ...volunteers[index], ...updates };
    saveVolunteers(volunteers);
  }
};

export const getVolunteerById = (id: string): Volunteer | undefined => {
  return getVolunteers().find(v => v.volunteerId === id);
};

/**
 * Creates a notification for EVERY volunteer when a citizen submits a report.
 */
export const notifyAllVolunteers = (
  incidentId: string,
  disasterType: string,
  severity: string,
  confidence: number,
  isBlurry: boolean
): void => {
  const volunteers = getVolunteers();
  const notification: Omit<VolunteerNotification, 'id'> = {
    incidentId,
    message: `🚨 NEW DISASTER REPORT: ${disasterType} | Severity: ${severity} | Confidence: ${confidence}%${isBlurry ? ' | ⚠ BLURRY — FIELD VERIFICATION REQUIRED' : ''}`,
    disasterType,
    severity,
    confidence,
    isBlurry,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const updated = volunteers.map(v => ({
    ...v,
    notifications: [
      { ...notification, id: `notif_${Date.now()}_${v.volunteerId}` },
      ...v.notifications,
    ],
  }));
  saveVolunteers(updated);

  // Dispatch event so the volunteer dashboard reacts in real-time
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('volunteerNotification', {
      detail: { incidentId, disasterType, severity }
    }));
  }
};

/**
 * Mark a volunteer notification as read.
 */
export const markNotificationRead = (volunteerId: string, notificationId: string): void => {
  const volunteers = getVolunteers();
  const vIdx = volunteers.findIndex(v => v.volunteerId === volunteerId);
  if (vIdx === -1) return;
  const nIdx = volunteers[vIdx].notifications.findIndex(n => n.id === notificationId);
  if (nIdx === -1) return;
  volunteers[vIdx].notifications[nIdx].read = true;
  saveVolunteers(volunteers);
};

/**
 * Count unread notifications across ALL volunteers (for header badge).
 */
export const getTotalUnreadNotifications = (): number => {
  const volunteers = getVolunteers();
  return volunteers.reduce((sum, v) => sum + v.notifications.filter(n => !n.read).length, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// SMS Deliveries (localStorage tracker)
// ─────────────────────────────────────────────────────────────────────────────

export const getSmsDeliveries = (): SmsDeliveryRecord[] => getItem<SmsDeliveryRecord[]>(KEYS.SMS_DELIVERIES, []);
export const saveSmsDeliveries = (records: SmsDeliveryRecord[]): void => setItem(KEYS.SMS_DELIVERIES, records);

export const addSmsDeliveryRecords = (records: SmsDeliveryRecord[]): void => {
  const existing = getSmsDeliveries();
  saveSmsDeliveries([...records, ...existing]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smsDeliveryUpdated', {
      detail: { count: records.length }
    }));
  }
};

export const getSmsDeliveriesForIncident = (incidentId: string): SmsDeliveryRecord[] => {
  return getSmsDeliveries().filter(r => r.incidentId === incidentId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeding
// ─────────────────────────────────────────────────────────────────────────────

export const seedVolunteers = (): void => {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEYS.VOLUNTEER_INITIALIZED) === 'true') return;

  const demoVolunteers: Volunteer[] = [
    { volunteerId: 'vol_1', name: 'Arun Sharma', phone: '+918838250227', status: 'AVAILABLE', notifications: [], assignedTasks: [] },
    { volunteerId: 'vol_2', name: 'Priya Mehta', phone: '+919444562413', status: 'AVAILABLE', notifications: [], assignedTasks: [] },
    { volunteerId: 'vol_3', name: 'Ravi Patel', status: 'AVAILABLE', notifications: [], assignedTasks: [] },
    { volunteerId: 'vol_4', name: 'Neha Singh', status: 'AVAILABLE', notifications: [], assignedTasks: [] },
    { volunteerId: 'vol_5', name: 'Kiran Kumar', status: 'AVAILABLE', notifications: [], assignedTasks: [] },
  ];
  saveVolunteers(demoVolunteers);
  localStorage.setItem(KEYS.VOLUNTEER_INITIALIZED, 'true');
};

export const seedInitialData = () => {
  if (typeof window === 'undefined') return;

  if (localStorage.getItem(KEYS.INITIALIZED) === 'true') {
    return; // Already seeded
  }

  const mockShelters: Shelter[] = [
    { id: 's1', name: 'Government Rajiv Gandhi General Hospital & Trauma Centre', latitude: 13.0805, longitude: 80.2785, capacity: 250, status: 'OPEN' },
    { id: 's2', name: 'Ripon Building Disaster Relief & Operations Centre', latitude: 13.0833, longitude: 80.2728, capacity: 180, status: 'OPEN' },
    { id: 's3', name: 'Loyola College Evacuation Center', latitude: 13.0626, longitude: 80.2337, capacity: 320, status: 'OPEN' },
    { id: 's4', name: 'Anna University Emergency Shelter & Camp', latitude: 13.0118, longitude: 80.2359, capacity: 400, status: 'OPEN' },
    { id: 's5', name: 'Government Stanley Medical College Hospital', latitude: 13.1075, longitude: 80.2872, capacity: 220, status: 'OPEN' },
    { id: 's6', name: 'Madhavaram Milk Colony Community Center', latitude: 13.1486, longitude: 80.2312, capacity: 175, status: 'OPEN' },
  ];
  saveShelters(mockShelters);

  const mockIncidents: Incident[] = [
    { id: 'inc1', hazard: 'Flood', severity: 'HIGH', latitude: 13.142, longitude: 80.208, confidence: 95, reportIds: ['rep1', 'rep2', 'rep3'], reportCount: 3, sources: ['Photo', 'SMS', 'Voice'], status: 'VERIFIED', verificationStatus: 'VERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'inc2', hazard: 'Fire', severity: 'CRITICAL', latitude: 13.131, longitude: 80.215, confidence: 98, reportIds: ['rep4', 'rep5'], reportCount: 2, sources: ['Photo', 'SMS'], status: 'AI_CLASSIFIED', verificationStatus: 'UNVERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'inc3', hazard: 'Road Damage', severity: 'MEDIUM', latitude: 13.118, longitude: 80.222, confidence: 65, reportIds: ['rep6'], reportCount: 1, sources: ['Voice'], status: 'PENDING', verificationStatus: 'FIELD_VERIFICATION_REQUIRED', verificationRequired: true, createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: 'inc4', hazard: 'Power Outage', severity: 'LOW', latitude: 13.095, longitude: 80.235, confidence: 90, reportIds: ['rep7'], reportCount: 1, sources: ['SMS'], status: 'VERIFIED', verificationStatus: 'VERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 900000).toISOString() },
    { id: 'inc5', hazard: 'Chemical Spill', severity: 'CRITICAL', latitude: 13.155, longitude: 80.225, confidence: 92, reportIds: ['rep8', 'rep9'], reportCount: 2, sources: ['Photo', 'Voice'], status: 'PENDING', verificationStatus: 'FIELD_VERIFICATION_REQUIRED', verificationRequired: true, isBlurry: true, blurScore: 42, createdAt: new Date(Date.now() - 4500000).toISOString() },
    { id: 'inc6', hazard: 'Flood', severity: 'MEDIUM', latitude: 13.138, longitude: 80.198, confidence: 78, reportIds: ['rep10'], reportCount: 1, sources: ['SMS'], status: 'AI_CLASSIFIED', verificationStatus: 'UNVERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 500000).toISOString() },
    { id: 'inc7', hazard: 'Structure Collapse', severity: 'HIGH', latitude: 13.105, longitude: 80.245, confidence: 88, reportIds: ['rep11', 'rep12'], reportCount: 2, sources: ['Photo', 'SMS'], status: 'PENDING', verificationStatus: 'UNVERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 2500000).toISOString() },
    { id: 'inc8', hazard: 'Fire', severity: 'MEDIUM', latitude: 13.088, longitude: 80.260, confidence: 82, reportIds: ['rep13'], reportCount: 1, sources: ['Voice'], status: 'RESOLVED', verificationStatus: 'VERIFIED', createdAt: new Date(Date.now() - 10000000).toISOString() },
    { id: 'inc9', hazard: 'Road Blocked', severity: 'LOW', latitude: 13.128, longitude: 80.185, confidence: 96, reportIds: ['rep14'], reportCount: 1, sources: ['SMS'], status: 'VERIFIED', verificationStatus: 'VERIFIED', createdAt: new Date(Date.now() - 1200000).toISOString() },
    { id: 'inc10', hazard: 'Gas Leak', severity: 'CRITICAL', latitude: 13.112, longitude: 80.210, confidence: 91, reportIds: ['rep15', 'rep16'], reportCount: 2, sources: ['Photo', 'Voice'], status: 'PENDING', verificationStatus: 'UNVERIFIED', verificationRequired: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  ];
  saveIncidents(mockIncidents);

  const mockReports: Report[] = [
    { id: 'rep1', source: 'Photo', image: '/placeholder.jpg', latitude: 13.142, longitude: 80.208, hazard: 'Flood', severity: 'HIGH', confidence: 96, evidence: ['Standing water', 'Submerged vehicles'], createdAt: mockIncidents[0].createdAt },
    { id: 'rep2', source: 'SMS', message: 'Huge flood on main street', latitude: 13.1425, longitude: 80.2085, hazard: 'Flood', severity: 'HIGH', confidence: 85, evidence: ['Text match: flood'], createdAt: new Date(Date.now() - 3500000).toISOString() },
    { id: 'rep3', source: 'Voice', transcript: 'The road is completely underwater here.', latitude: 13.1415, longitude: 80.2075, hazard: 'Flood', severity: 'MEDIUM', confidence: 88, evidence: ['Keyword: underwater'], createdAt: new Date(Date.now() - 3400000).toISOString() },
    { id: 'rep4', source: 'Photo', image: '/fire.jpg', latitude: 13.131, longitude: 80.215, hazard: 'Fire', severity: 'CRITICAL', confidence: 99, evidence: ['Flames visible', 'Smoke plume'], createdAt: mockIncidents[1].createdAt },
    { id: 'rep5', source: 'SMS', message: 'Fire spread to the next building!', latitude: 13.1312, longitude: 80.2155, hazard: 'Fire', severity: 'CRITICAL', confidence: 92, evidence: ['Text match: fire, building'], createdAt: new Date(Date.now() - 7100000).toISOString() },
    { id: 'rep6', source: 'Voice', transcript: 'There is a massive pothole that ruined my tire.', latitude: 13.118, longitude: 80.222, hazard: 'Road Damage', severity: 'MEDIUM', confidence: 85, evidence: ['Keyword: pothole'], createdAt: mockIncidents[2].createdAt },
    { id: 'rep7', source: 'SMS', message: 'Power is out in the whole block', latitude: 13.095, longitude: 80.235, hazard: 'Power Outage', severity: 'LOW', confidence: 90, evidence: ['Text match: power out'], createdAt: mockIncidents[3].createdAt },
    { id: 'rep8', source: 'Photo', image: '/spill.jpg', latitude: 13.155, longitude: 80.225, hazard: 'Chemical Spill', severity: 'CRITICAL', confidence: 95, evidence: ['Hazardous material sign', 'Liquid pool'], blurScore: 42, isBlurry: true, createdAt: mockIncidents[4].createdAt },
    { id: 'rep9', source: 'Voice', transcript: 'A truck overturned and is leaking green fluid.', latitude: 13.1552, longitude: 80.2255, hazard: 'Chemical Spill', severity: 'CRITICAL', confidence: 89, evidence: ['Keyword: leaking, fluid'], createdAt: new Date(Date.now() - 4400000).toISOString() },
    { id: 'rep10', source: 'SMS', message: 'Water starting to pool up on the intersection', latitude: 13.138, longitude: 80.198, hazard: 'Flood', severity: 'MEDIUM', confidence: 78, evidence: ['Text match: water, pool'], createdAt: mockIncidents[5].createdAt },
    { id: 'rep11', source: 'Photo', image: '/collapse.jpg', latitude: 13.105, longitude: 80.245, hazard: 'Structure Collapse', severity: 'HIGH', confidence: 93, evidence: ['Rubble', 'Damaged roof'], createdAt: mockIncidents[6].createdAt },
    { id: 'rep12', source: 'SMS', message: 'The old warehouse roof just caved in', latitude: 13.1055, longitude: 80.2455, hazard: 'Structure Collapse', severity: 'HIGH', confidence: 83, evidence: ['Text match: roof, caved'], createdAt: new Date(Date.now() - 2400000).toISOString() },
    { id: 'rep13', source: 'Voice', transcript: 'Small brush fire started by the highway.', latitude: 13.088, longitude: 80.260, hazard: 'Fire', severity: 'MEDIUM', confidence: 82, evidence: ['Keyword: brush fire'], createdAt: mockIncidents[7].createdAt },
    { id: 'rep14', source: 'SMS', message: 'Tree fell over blocking both lanes', latitude: 13.128, longitude: 80.185, hazard: 'Road Blocked', severity: 'LOW', confidence: 96, evidence: ['Text match: tree fell, blocked'], createdAt: mockIncidents[8].createdAt },
    { id: 'rep15', source: 'Photo', image: '/gas.jpg', latitude: 13.112, longitude: 80.210, hazard: 'Gas Leak', severity: 'CRITICAL', confidence: 88, evidence: ['Hissing pipe', 'Vapor'], createdAt: mockIncidents[9].createdAt },
    { id: 'rep16', source: 'Voice', transcript: 'I smell a very strong odor of gas in the alley.', latitude: 13.1125, longitude: 80.2105, hazard: 'Gas Leak', severity: 'CRITICAL', confidence: 94, evidence: ['Keyword: smell gas'], createdAt: new Date(Date.now() - 280000).toISOString() },
  ];
  saveReports(mockReports);

  const mockRoutes: Route[] = [
    { id: 'route1', roads: ['Main St', 'Broadway', '1st Ave'], distance: 4.2, time: 14, risk: 'LOW' },
    { id: 'route2', roads: ['Figueroa St', 'Olympic Blvd'], distance: 3.1, time: 22, risk: 'HIGH' },
    { id: 'route3', roads: ['Grand Ave', '5th St', 'Spring St'], distance: 5.5, time: 18, risk: 'MEDIUM' }
  ];
  saveRoutes(mockRoutes);

  localStorage.setItem(KEYS.INITIALIZED, 'true');
};

/**
 * Completely clears all disaster reports, incidents, routes, and volunteer state from localStorage.
 * If `reseedMock` is true, restores clean default demo mock data.
 * If `reseedMock` is false, leaves the database completely empty (0 reports, 0 incidents).
 */
export const clearAllDisasterData = (reseedMock: boolean = false) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEYS.REPORTS);
    localStorage.removeItem(KEYS.INCIDENTS);
    localStorage.removeItem(KEYS.ROUTES);
    localStorage.removeItem(KEYS.SMS_DELIVERIES);
    localStorage.removeItem(KEYS.INITIALIZED);
    localStorage.removeItem(KEYS.VOLUNTEERS);
    localStorage.removeItem(KEYS.VOLUNTEER_INITIALIZED);

    if (reseedMock) {
      seedInitialData();
      seedVolunteers();
    } else {
      saveReports([]);
      saveIncidents([]);
      saveRoutes([]);
      saveSmsDeliveries([]);
      localStorage.setItem(KEYS.INITIALIZED, 'true');
    }
  } catch (e) {
    console.error('Failed to clear disaster data:', e);
  }
};

