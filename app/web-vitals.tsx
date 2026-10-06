'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'production') {
      const color = metric.rating === 'good' ? '#10b981' : metric.rating === 'needs-improvement' ? '#f59e0b' : '#ef4444';
      console.log(
        `%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
        `color: ${color}; font-weight: bold; font-family: monospace;`
      );
    }
  });

  return null;
}
