"use client";

import { useEffect } from 'react';
import { seedInitialData } from '@/lib/storage';

export default function StorageInit() {
  useEffect(() => {
    seedInitialData();
  }, []);

  return null;
}
