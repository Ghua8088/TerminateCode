import React from 'react';
import { 
  File, 
  FileCode, 
  FileJson, 
  FileType, 
  Image, 
  FileText,
  Terminal
} from 'lucide-react';

const FileIcon = ({ name, size = 16, style = {} }) => {
  const ext = name.split('.').pop().toLowerCase();
  
  let Icon = File;
  let color = '#ccc';

  switch (ext) {
    case 'js':
    case 'jsx':
      Icon = FileCode;
      color = '#f1e05a';
      break;
    case 'ts':
    case 'tsx':
      Icon = FileCode;
      color = '#2b7489';
      break;
    case 'css':
    case 'scss':
    case 'less':
      Icon = FileCode;
      color = '#563d7c';
      break;
    case 'html':
      Icon = FileCode;
      color = '#e34c26';
      break;
    case 'json':
      Icon = FileJson;
      color = '#f1e05a'; // JSON often yellow-ish in icons
      break;
    case 'py':
      Icon = FileCode; // Or a specific Python icon if available, but FileCode is safe
      color = '#3572A5';
      break;
    case 'md':
      Icon = FileText;
      color = '#083fa1';
      break;
    case 'txt':
      Icon = FileText;
      color = '#ccc';
      break;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      Icon = Image;
      color = '#b07219';
      break;
    case 'sh':
    case 'bat':
    case 'ps1':
      Icon = Terminal;
      color = '#89e051';
      break;
    default:
      Icon = File;
      color = '#ccc';
  }

  return <Icon size={size} style={{ ...style, color }} />;
};

export default FileIcon;
