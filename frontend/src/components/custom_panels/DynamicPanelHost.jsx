import React, { Suspense } from 'react';

// Use Vite's dynamic glob import to automatically scan all custom panels in this directory
const modules = import.meta.glob('./*.jsx');

const DynamicComponent = ({ componentName, onClose, ...props }) => {
  // Normalize matching key (e.g. `./mytool.jsx` from `MyTool`)
  const matchKey = Object.keys(modules).find(
    (key) => key.toLowerCase() === `./${componentName.toLowerCase()}.jsx`
  );

  if (!matchKey) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
        Custom panel "{componentName}" not found. Reload UI or trigger registration.
      </div>
    );
  }

  // Dynamically import the matched module
  const LazyComponent = React.lazy(modules[matchKey]);

  return (
    <Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading Dynamic Panel...</div>}>
      <LazyComponent onClose={onClose} {...props} />
    </Suspense>
  );
};

export default DynamicComponent;
