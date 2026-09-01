'use client';

import { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, MapPin } from 'lucide-react';
import exifr from 'exifr';
import styles from './ImageUploader.module.css';

export default function ImageUploader({ onFileSelected }) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setIsProcessing(true);

    try {
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Extract EXIF data
      let location = null;
      try {
        const exifData = await exifr.gps(file);
        if (exifData && exifData.latitude && exifData.longitude) {
          location = { lat: exifData.latitude, lng: exifData.longitude };
        }
      } catch (err) {
        console.log('No EXIF GPS data found');
      }

      onFileSelected(file, objectUrl, location);
    } catch (error) {
      console.error('Error processing file', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className={`glass-panel animate-fade-in ${styles.uploaderContainer}`}>
      <h2 className={styles.title}>Upload Disaster Image</h2>
      <p className={styles.subtitle}>Upload a photo to classify the disaster type and extract location.</p>
      
      <div 
        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept="image/*" 
          onChange={handleChange} 
          className={styles.hiddenInput} 
        />
        
        {!preview ? (
          <div className={styles.emptyState}>
            <div className={styles.iconWrapper}>
              <UploadCloud size={48} className={styles.uploadIcon} />
            </div>
            <h3>Drag & Drop</h3>
            <p>or click to browse your files</p>
          </div>
        ) : (
          <div className={styles.previewState}>
            <div className={styles.imageWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className={styles.previewImage} />
            </div>
            <div className={styles.fileInfo}>
              <ImageIcon size={16} />
              <span>Image loaded successfully</span>
            </div>
          </div>
        )}
      </div>

      {isProcessing && <div className={styles.loading}>Extracting EXIF data...</div>}
    </div>
  );
}
