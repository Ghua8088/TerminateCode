import React from 'react';

const DynamicComponent = ({ componentName, ...props }) => {
  // In a real implementation, we would use React.lazy or a registry
  // For this PoC, we will try to resolve from a map of pre-registered or dynamically loaded modules
  // Since we can't easily dynamic import variables in Vite without glob,
  // We will assume the index.js in custom_panels exports a map.
  
  return <div className="p-4 text-center">Dynamic Panel Placeholder: {componentName}</div>;
};

export default DynamicComponent;
