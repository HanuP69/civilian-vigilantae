import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/AuthContext';
import { sendCopilotMessage } from '../../services/api';

function parseMarkdown(text) {
  if (!text) return '';
  
  // 1. Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Bold headers or sections
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--ink-primary); font-weight: 600;">$1</strong>');

  // 3. Quest links (opens in a new tab to preserve Copilot drawer context!)
  html = html.replace(/\[(?:Quest|Report)\s+#([\w-]+)\]/g, '<a href="/ticket/$1" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: underline; font-family: monospace; font-weight: bold;">[Report #$1]</a>');

  // 4. Inline code
  html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.06); padding: 2px 6px; font-family: monospace; color: var(--accent); font-size: 0.9em;">$1</code>');

  // 5. Headings
  html = html.replace(/^###\s+(.*)$/gm, '<h4 style="margin: 12px 0 6px; color: var(--accent); font-family: monospace; font-size: 0.8rem;">$1</h4>');
  html = html.replace(/^##\s+(.*)$/gm, '<h3 style="margin: 14px 0 8px; color: var(--accent); font-family: monospace; font-size: 0.9rem;">$1</h3>');
  html = html.replace(/^#\s+(.*)$/gm, '<h2 style="margin: 16px 0 10px; color: var(--accent); font-family: monospace; font-size: 1rem;">$1</h2>');

  // 6. Numbered lists
  html = html.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<div style="margin-left: 8px; margin-bottom: 6px; display: flex; gap: 8px; align-items: flex-start;"><span style="color: var(--accent); font-family: monospace; flex-shrink: 0;">$1.</span><span>$2</span></div>');

  // 7. Bullet lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<div style="margin-left: 8px; margin-bottom: 4px; display: flex; gap: 8px; align-items: flex-start;"><span style="color: var(--accent); flex-shrink: 0;">▪</span><span>$1</span></div>');

  // 8. Newlines to breaks
  html = html.replace(/\n/g, '<br />');

  // 9. Clean up duplicate linebreaks after block tags
  html = html.replace(/(<\/div>|<\/h2>|<\/h3>|<\/h4>)<br \/>/g, '$1');

  return html;
}

function CopilotDrawer() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Greetings, Citizen. I am the Sentinel Civic Copilot. Ask me about active reports, spatial recurrence risks, or municipal resource dispatches.' }
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
            const res = await fetchWithTimeout(
              `/api/reports/geocode/proxy?lat=${latitude}&lng=${longitude}`,
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
      setMessages(prev => [...prev, { role: 'model', content: res.text || 'No active telemetry matches this query.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: `⚠️ CO-PILOT ERROR: ${err.message}` }]);
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
        className="font-pixel copilot-trigger"
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
        🔮 CO-PILOT ASSISTANT
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
                  [ 🤖 SENTINEL CIVIC CO-PILOT ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', marginTop: '4px', display: 'block' }}>LUCKNOW HYPERLOCAL CIVIC ASSISTANT</span>
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
                      {isModel ? '🤖 SENTINEL AI' : '👤 CITIZEN SENSOR'}
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
                        textAlign: 'left'
                      }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }}
                    />
                  </div>
                );
              })}
              {loading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="font-pixel text-muted animate-pulse" style={{ fontSize: '10px' }}>Analyzing civic database...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions Panel */}
            {messages.length <= 2 && (
              <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="font-pixel text-muted" style={{ fontSize: '9px' }}>SUGGESTED CO-PILOT QUESTIONS:</span>
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
