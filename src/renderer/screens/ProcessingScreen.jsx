import { useState, useEffect } from 'react';

export default function ProcessingScreen({ total }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const unbind = window.electronAPI.onProcessorProgress((data) => {
      setCurrent(data.current ?? 0);
    });
    return () => {
      if (typeof unbind === 'function') unbind();
    };
  }, []);

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="processing">
      <h1>Processing</h1>
      <p className="progress-text">
        Processing {current} of {total}
      </p>
      <div className="progress-bar-wrap">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
