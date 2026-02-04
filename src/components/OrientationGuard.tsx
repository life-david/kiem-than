import { useState, useEffect } from 'react';

export function OrientationGuard({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      let isVertical = false;

      // 优先使用 screen.orientation API (Modern & Sensor-based)
      if (screen.orientation) {
        isVertical = screen.orientation.type.includes('portrait');
      }
      // 回退方案 1: window.orientation (WeChat/iOS/Old Android)
      else if (typeof window.orientation !== 'undefined') {
        isVertical = Math.abs(window.orientation as number) !== 90;
      }
      // 回退方案 2: matchMedia (Safari/iOS compatible)
      else if (window.matchMedia) {
        isVertical = window.matchMedia('(orientation: portrait)').matches;
      }
      // 回退方案 3: 宽高比 (Basic fallback)
      else {
        isVertical = window.innerHeight > window.innerWidth;
      }

      // 仅在移动设备上启用检测
      const isMobile =
        // @ts-ignore
        (navigator.userAgentData && navigator.userAgentData.mobile) || // Newer API
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) ||
        'ontouchstart' in window ||
        window.innerWidth < 1024; // Loose width check

      setIsPortrait(isMobile && isVertical);
    };

    checkOrientation();

    // Listen for screen.orientation change
    if (screen.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }
    // Listen for window.orientation change (WeChat/Legacy)
    window.addEventListener('orientationchange', checkOrientation);
    // Also listen for resize just in case (compat)
    window.addEventListener('resize', checkOrientation);

    return () => {
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  if (isPortrait && !dismissed) {
    return (
      <>
        {children}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)', // Semi-transparent background
            backdropFilter: 'blur(5px)',
            color: '#00ff88',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            textAlign: 'center',
            padding: '20px',
            transition: 'opacity 0.3s',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📱➡️🔄</div>
          <h2
            style={{
              marginBottom: '10px',
              fontFamily: '"Courier New", monospace',
              fontSize: '24px',
            }}
          >
            Landscape Mode Recommended
          </h2>
          <p
            style={{
              color: '#ccc',
              maxWidth: '300px',
              marginBottom: '30px',
              lineHeight: '1.6',
              fontSize: '15px',
            }}
          >
            For the best casting view, please rotate your device.
            <br />
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              (View may be limited in portrait mode)
            </span>
          </p>

          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid #00ff88',
              color: '#00ff88',
              borderRadius: '20px',
              fontSize: '14px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Continue &gt;
          </button>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
