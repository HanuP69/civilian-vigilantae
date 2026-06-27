import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/AuthContext';
import { sendCopilotMessage } from '../../services/api';

function CopilotDrawer() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Greetings, Marshall. I am the Lucknow Guild Sentinel Copilot. Ask me of the threat index, active swarms, or strategic allocations.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  if (!isAuthenticated) return null;

  const handleSend = async (textToSend) => {
    let text = textToSend || input;
    if (!text.trim() || loading) return;

    if (!textToSend) setInput('');

    const detectKeywords = ['detect location', 'detect my location', 'get my location', 'use my location', 'where am i', 'current location'];
    const matchesDetect = detectKeywords.some(keyword => text.toLowerCase().includes(keyword));

    if (matchesDetect) {
      const newMessages = [...messages, { role: 'user', content: text }];
      setMessages(newMessages);
      setLoading(true);

      if (!('geolocation' in navigator)) {
        setMessages(prev => [...prev, { role: 'model', content: '⚠️ Geolocation is not supported by your browser.' }]);
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          let addressStr = 'Lucknow, India';
          try {
            const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsKey}`,
              { headers: { 'Accept-Language': 'en' } }
            );
            if (res.ok) {
              const data = await res.json();
              addressStr = data.results?.[0]?.formatted_address || addressStr;
            }
          } catch (err) {
            console.error('Reverse geocode failed:', err);
          }

          const modelResponseText = `📍 GPS Telemetry Captured:\n- Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n- Address: ${addressStr}\n\nI have locked this location. How would you like to proceed?`;
          setMessages(prev => [...prev, { role: 'model', content: modelResponseText }]);
          setLoading(false);
        },
        (err) => {
          setMessages(prev => [...prev, { role: 'model', content: `⚠️ Failed to acquire GPS lock: ${err.message}` }]);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Keep only last 10 messages for token context limit safety
      const history = messages.slice(-10);
      const res = await sendCopilotMessage(text, history);
      setMessages(prev => [...prev, { role: 'model', content: res.text || 'The archives are silent, Marshall.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: `⚠️ FAILED TO CONSULT SPIRITS: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const suggestions = [
    'Why is Hazratganj deteriorating?',
    'What issue cluster should be fixed first?',
    'Show summary of active issues'
  ];

  return (
    <>
      {/* Floating Toggle Button (Bottom-Right) */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="font-pixel"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 999,
          background: 'oklch(0.12 0.01 260)',
          color: 'var(--accent)',
          border: '2px solid var(--accent)',
          padding: '12px 18px',
          cursor: 'pointer',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.6), 0 0 15px rgba(255,215,0,0.2)',
          fontSize: '0.55rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: 0,
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
      >
        🔮 COPILOT EXECUTIVE
      </motion.button>

      {/* Slide-out Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="rpg-panel"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '420px',
              zIndex: 1002,
              background: 'rgba(15, 17, 23, 0.98)',
              backdropFilter: 'blur(10px)',
              borderLeft: '4px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.8)',
              borderRadius: 0,
              padding: 0
            }}
          >
            {/* Drawer Header */}
            <div 
              style={{ 
                padding: '16px 20px', 
                borderBottom: '2px solid var(--border-subtle)', 
                background: 'oklch(0.12 0.01 260)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 className="font-pixel" style={{ fontSize: '11px', color: 'var(--accent)', margin: 0 }}>
                  [ 🔮 SENTINEL COMMAND AI ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', marginTop: '4px', display: 'block' }}>LUCKNOW GUILD CO-PILOT CONSOLE</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-muted)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: 4
                }}
              >
                ✕
              </button>
            </div>

            {/* Chat Messages Log */}
            <div 
              className="rpg-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {messages.map((m, idx) => {
                const isModel = m.role === 'model';
                return (
                  <div 
                    key={idx}
                    style={{
                      alignSelf: isModel ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isModel ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <span 
                      className="font-pixel" 
                      style={{ 
                        fontSize: '0.35rem', 
                        color: isModel ? 'var(--accent)' : 'oklch(0.68 0.16 55)', 
                        marginBottom: '4px' 
                      }}
                    >
                      {isModel ? '🔮 SENTINEL CO-PILOT' : '🛡️ COMMANDER MARSHALL'}
                    </span>
                    <div 
                      className="rpg-panel"
                      style={{
                        padding: '10px 14px',
                        background: isModel ? 'rgba(255,255,255,0.02)' : 'rgba(255,215,0,0.04)',
                        border: isModel ? '1px solid var(--border-subtle)' : '1px solid var(--accent)',
                        borderRadius: 0,
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                        color: isModel ? 'var(--ink-secondary)' : 'var(--ink-primary)',
                        whiteSpace: 'pre-wrap',
                        textAlign: 'left'
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="font-pixel text-muted animate-pulse" style={{ fontSize: '10px' }}>Consulting spirits...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions Panel */}
            {messages.length <= 2 && (
              <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '9px' }}>SUGGESTED DISPATCH QUERIES:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      style={{
                        textAlign: 'left',
                        background: 'oklch(0.12 0.01 260)',
                        border: '1px dashed var(--border-subtle)',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.625rem',
                        color: 'var(--ink-muted)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = 'var(--accent)';
                        e.target.style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = 'var(--ink-muted)';
                        e.target.style.borderColor = 'var(--border-subtle)';
                      }}
                    >
                      📜 {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input Bar */}
            <div 
              style={{ 
                padding: '20px', 
                borderTop: '2px solid var(--border-subtle)', 
                background: 'oklch(0.12 0.01 260)',
                display: 'flex',
                gap: '10px'
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask command console..."
                style={{
                  flex: 1,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--ink-primary)',
                  padding: '10px 14px',
                  outline: 'none',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                onClick={() => handleSend()}
                className="btn btn-primary font-pixel"
                style={{
                  padding: '10px 16px',
                  borderRadius: 0,
                  fontSize: '0.5rem',
                  cursor: 'pointer',
                  letterSpacing: '0.5px'
                }}
              >
                🪄 SEND
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default CopilotDrawer;
