'use client';

import { Activity, AlertTriangle, ShieldCheck, Package, Truck, Home, Search, Droplets, Flame } from 'lucide-react';
import styles from './ResultsDashboard.module.css';

export default function ResultsDashboard({ result, originalImage, isPredicting }) {
  if (isPredicting) {
    return (
      <div className={`glass-panel ${styles.dashboard} ${styles.loadingState}`}>
        <div className={styles.spinner}></div>
        <p>Analyzing image structure...</p>
        <p className={styles.loadingSubtext}>Generating Grad-CAM visualization</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const getSeverityIcon = (className) => {
    switch (className) {
      case 'normal': return <ShieldCheck className={styles.safeIcon} />;
      default: return <AlertTriangle className={styles.dangerIcon} />;
    }
  };

  const getSeverityColor = (className) => {
    if (className === 'normal') return 'var(--success-color)';
    return 'var(--danger-color)';
  };

  return (
    <div className={`glass-panel animate-fade-in ${styles.dashboard}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Activity size={24} className={styles.icon} /> 
          Analysis Results
        </h2>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Detected Class</p>
          <div className={styles.metricValueWrapper} style={{ color: getSeverityColor(result.prediction) }}>
            {getSeverityIcon(result.prediction)}
            <span className={styles.metricValue}>{result.prediction.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Confidence</p>
          <div className={styles.metricValueWrapper}>
            <span className={styles.metricValue}>{(result.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className={styles.progressBarBg}>
            <div 
              className={styles.progressBarFill} 
              style={{ width: `${result.confidence * 100}%`, backgroundColor: getSeverityColor(result.prediction) }}
            ></div>
          </div>
        </div>
      </div>

      {result.resources && result.resources.length > 0 && (
        <div className={styles.resourcesSection}>
          <h3 className={styles.resourcesTitle}>Recommended Resources</h3>
          <div className={styles.resourcesGrid}>
            {result.resources.map((resource, index) => {
              const r = resource.toLowerCase();
              let Icon = Package;
              if (r.includes('water') || r.includes('foam') || r.includes('drop')) Icon = Droplets;
              else if (r.includes('fire') || r.includes('burn')) Icon = Flame;
              else if (r.includes('search')) Icon = Search;
              else if (r.includes('shelter') || r.includes('home')) Icon = Home;
              else if (r.includes('transport') || r.includes('machinery') || r.includes('boat') || r.includes('engine') || r.includes('vehicle') || r.includes('tanker')) Icon = Truck;

              return (
                <div key={index} className={styles.resourceCard}>
                  <Icon size={20} className={styles.resourceIcon} />
                  <span>{resource}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.visualsGrid}>
        <div className={styles.visualCard}>
          <h4 className={styles.visualTitle}>Original Image</h4>
          <div className={styles.imageWrapper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalImage} alt="Original Upload" className={styles.resultImage} />
          </div>
        </div>
        
        {result.grad_cam_base64 && (
          <div className={styles.visualCard}>
            <h4 className={styles.visualTitle}>Grad-CAM Explanation</h4>
            {result.explanation && <p className={styles.explanationText}>{result.explanation}</p>}
            <div className={styles.imageWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`data:image/jpeg;base64,${result.grad_cam_base64}`} 
                alt="Grad-CAM Heatmap" 
                className={styles.resultImage} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
