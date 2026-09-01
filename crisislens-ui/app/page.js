'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ImageUploader from '@/components/ImageUploader';
import ResultsDashboard from '@/components/ResultsDashboard';
import { Layers } from 'lucide-react';
import styles from './page.module.css';

// Dynamically import LocationMap with SSR disabled since Leaflet requires the window object
const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className={`glass-panel ${styles.mapLoading}`}>
      <p>Loading Map...</p>
    </div>
  )
});

export default function Home() {
  const [fileData, setFileData] = useState({ file: null, preview: null, location: null });
  const [result, setResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelected = (file, preview, location) => {
    setFileData({ file, preview, location });
    setResult(null);
    setError(null);
  };

  const analyzeImage = async () => {
    if (!fileData.file) return;

    setIsPredicting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', fileData.file);

    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Prediction request failed. Make sure the FastAPI server is running.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.logoWrapper}>
          <Layers className={styles.logoIcon} size={32} />
          <h1>CrisisLens AI</h1>
        </div>
        <p>Disaster Classification & Geolocation Platform</p>
      </header>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <div className={styles.uploadSection}>
            <ImageUploader onFileSelected={handleFileSelected} />
            
            {fileData.file && (
              <div className={styles.actionSection}>
                <button 
                  className="btn-primary" 
                  onClick={analyzeImage} 
                  disabled={isPredicting}
                  style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
                >
                  {isPredicting ? 'Analyzing...' : 'Run AI Analysis'}
                </button>
                {error && <div className={styles.errorBanner}>{error}</div>}
              </div>
            )}
          </div>
          
          <div className={styles.mapSection}>
            <LocationMap location={fileData.location} severity={result?.severity} />
          </div>
        </div>

        <div className={styles.bottomRow}>
          {(isPredicting || result) && (
            <ResultsDashboard 
              result={result} 
              originalImage={fileData.preview} 
              isPredicting={isPredicting} 
            />
          )}
        </div>
      </div>
    </main>
  );
}
