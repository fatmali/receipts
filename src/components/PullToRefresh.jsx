import { useState, useRef, useCallback } from 'react';

const THRESHOLD = 60;
const MAX_PULL = 100;

export default function PullToRefresh({ children, onRefresh, disabled = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback(
    (e) => {
      if (disabled || refreshing) return;
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [disabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!pulling.current || disabled || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      // Dampen the pull (resistance feel)
      const dampened = Math.min(delta * 0.5, MAX_PULL);
      setPullDistance(dampened);

      if (dampened > 10) {
        e.preventDefault();
      }
    },
    [disabled, refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled || refreshing) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh, disabled, refreshing]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto h-full"
      style={{
        overscrollBehavior: pulling.current ? 'none' : 'auto',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: showIndicator ? (refreshing ? 48 : pullDistance) : 0 }}
      >
        <div
          className={`w-6 h-6 border-2 rounded-full border-green ${
            refreshing || progress >= 1 ? 'animate-spin' : ''
          }`}
          style={{
            borderTopColor: 'transparent',
            opacity: progress,
            transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
          }}
        />
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform:
            pullDistance > 0 && !refreshing
              ? `translateY(0)`
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
