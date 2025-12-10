import React, { useState, useEffect, useCallback } from 'react';

const ResizeHandle = ({ onResize, orientation = 'vertical', style }) => {
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      onResize(e);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize, orientation]);

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        setIsResizing(true);
      }}
      style={{
        ...style,
        [orientation === 'vertical' ? 'width' : 'height']: '4px',
        cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
        zIndex: 100,
        flexShrink: 0,
        background: isResizing ? 'var(--pytron-primary, #007fd4)' : 'transparent',
      }}
      className="resize-handle"
    />
  );
};

export default ResizeHandle;
