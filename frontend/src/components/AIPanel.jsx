import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import pytron from 'pytron-client';

const AIPanel = ({ activePath }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am Pytron AI. Ask me anything about your code.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Get current file content if available
      let context = '';
      if (activePath) {
        const res = await pytron.read_file_content(activePath);
        if (res.success) context = res.content;
      }

      const res = await pytron.ask_ai(input, context, activePath);
      if (res.success) {
        setMessages(prev => [...prev, { role: 'assistant', text: res.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + res.error }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#252526' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #333', fontWeight: 'bold', fontSize: '11px', color: '#bbb' }}>
        PYTRON AI
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: m.role === 'user' ? '#007fd4' : '#4caf50',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {m.role === 'user' ? <User size={14} color="#fff" /> : <Bot size={14} color="#fff" />}
            </div>
            <div style={{
              background: '#333', padding: '8px', borderRadius: '6px',
              fontSize: '13px', lineHeight: '1.4', color: '#ddd', maxWidth: '85%'
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Thinking...</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '10px', borderTop: '1px solid #333', display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          style={{
            flex: 1, background: '#3c3c3c', border: 'none', borderRadius: '4px',
            color: '#fff', padding: '6px 8px', fontSize: '13px', outline: 'none'
          }}
        />
        <button onClick={handleSend} style={{ background: '#007fd4', border: 'none', borderRadius: '4px', width: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={14} color="#fff" />
        </button>
      </div>
    </div>
  );
};

export default AIPanel;
