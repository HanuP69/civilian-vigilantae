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
    { role: 'model', content: 'Greetings, Citizen. I am the Citizen Vigilantae Copilot. Ask me about active reports, spatial recurrence risks, or municipal resource dispatches.' }
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
      {/* Floating Toggle Button (Bottom-Right) */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          animate={{ y: [0, -8, 0] }}
          transition={{
            y: {
              repeat: Infinity,
              duration: 3,
              ease: "easeInOut"
            }
          }}
          className="copilot-floating-trigger"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            width: '96px',
            height: '96px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
          aria-label="Open Co-pilot Assistant"
        >
          <img 
            src="/robo.png" 
            alt="Co-pilot Assistant" 
            style={{ 
              width: '100%', 
              height: '100%', 
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0px 8px 12px rgba(0,0,0,0.65)) drop-shadow(0 0 6px rgba(252,211,77,0.35))'
            }} 
          />
        </motion.button>
      )}

      {/* Slide-out Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Blurred Backdrop */}
            <motion.div
              key="copilot-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1001,
                background: 'rgba(16, 11, 8, 0.45)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)'
              }}
            />

            <motion.div
              key="copilot-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="rpg-panel-sandstone"
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                maxWidth: '420px',
                zIndex: 1002,
                background: 'url(/sandstone.png) repeat',
                borderLeft: '4px solid #513a23',
                outline: '2px solid #d8a96d',
                outlineOffset: '-6px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.85)',
                borderRadius: 0,
                padding: '6px'
              }}
            >
            {/* Drawer Header */}
            <div 
              style={{ 
                padding: '16px 20px', 
                borderBottom: '3px solid #513a23', 
                background: '#1c130c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: '2px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src="/robo.png" 
                  alt="Sentinel Robo" 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    border: '1px solid #d8a96d', 
                    background: '#100b08',
                    imageRendering: 'pixelated', 
                    boxShadow: '1px 1px 0 rgba(0,0,0,0.5)',
                    padding: '2px'
                  }} 
                />
                <div>
                  <h3 className="font-pixel" style={{ fontSize: '11px', color: '#fcd34d', margin: 0, textShadow: '1px 1px 0 #000' }}>
                    CITIZEN VIGILANTAE CO-PILOT
                  </h3>
                  <span className="font-pixel" style={{ fontSize: '9px', marginTop: '2px', display: 'block', color: '#ecdcb9', textShadow: '1px 1px 0 #000' }}>LUCKNOW WATCH GUILD ASSISTANT</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ecdcb9',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: 4,
                  textShadow: '1px 1px 0 #000'
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
                padding: '20px 14px',
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
                      maxWidth: '90%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isModel ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <span 
                      className="font-pixel" 
                      style={{ 
                        fontSize: '0.45rem', 
                        color: isModel ? '#fcd34d' : '#60a5fa', 
                        textShadow: '1px 1px 0 #000',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isModel ? (
                        <>
                          <img 
                            src="/robo.png" 
                            alt="" 
                            style={{ 
                              width: '14px', 
                              height: '14px', 
                              imageRendering: 'pixelated',
                              background: '#100b08',
                              border: '1px solid #d8a96d',
                              padding: '1px'
                            }} 
                          />
                          <span>VIGILANTE AI</span>
                        </>
                      ) : (
                        <span>👤 CITIZEN SENSOR</span>
                      )}
                    </span>
                    <div 
                      className="card pixel-border"
                      style={{
                        padding: '12px 16px',
                        background: isModel ? '#fcf8ee' : '#fffbeb',
                        border: isModel ? '2px solid #85613c' : '2px solid #b45309',
                        borderRadius: 0,
                        fontSize: '0.95rem',
                        lineHeight: 1.5,
                        color: '#291d12',
                        textAlign: 'left',
                        boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
                        width: '100%'
                      }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }}
                    />
                  </div>
                );
              })}
              {loading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="font-pixel animate-pulse" style={{ fontSize: '10px', color: '#fcd34d', textShadow: '1px 1px 0 #000' }}>Analyzing civic database...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions Panel */}
            {messages.length <= 2 && (
              <div style={{ padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="font-pixel" style={{ fontSize: '9px', color: '#ecdcb9', textShadow: '1px 1px 0 #000' }}>SUGGESTED CO-PILOT QUESTIONS:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      style={{
                        textAlign: 'left',
                        background: '#fcf8ee',
                        border: '2px dashed #85613c',
                        color: '#291d12',
                        padding: '10px 14px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '1px 1px 0 rgba(0,0,0,0.1)'
                      }}
                      className="suggestion-btn-v2"
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
                padding: '16px 20px', 
                borderTop: '3px solid #513a23', 
                background: '#1c130c',
                display: 'flex',
                gap: '10px',
                margin: '2px'
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask watch guild..."
                style={{
                  flex: 1,
                  background: '#fffbeb',
                  border: '2px solid #85613c',
                  color: '#291d12',
                  padding: '10px 14px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-sans)',
                  borderRadius: 0
                }}
              />
              <button
                onClick={() => handleSend()}
                className="font-pixel"
                style={{
                  padding: '10px 16px',
                  background: '#b45309',
                  border: '2px solid #513a23',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.65rem'
                }}
              >
                🪄 SEND
              </button>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default CopilotDrawer;
