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

  return (
    <div className="processing">
      <h1>Processing</h1>
      <div className="processing-spinner" aria-hidden="true" />
      <p className="progress-text">
        Processing {current} of {total}
      </p>
    </div>
  );
}
