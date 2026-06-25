import { useState, useRef } from 'react';
import { submitReport } from '../services/api';
import { capitalize } from '../utils/formatters';
import AgentTrace from '../components/agent/AgentTrace';

const STEPS = ['Media', 'Location', 'Details', 'Review'];

function ReportPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [detecting, setDetecting] = useState(false);
  
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const getLocation = () => {
    setDetecting(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setDetecting(false);
        },
        () => setDetecting(false)
      );
    } else {
      setDetecting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        // Also set as file so it gets uploaded
        setFile(new File([audioBlob], 'voice_report.webm', { type: 'audio/webm' }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Audio recording failed', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append('media', file);
      formData.append('text', description);
      formData.append('address', address);
      formData.append('lat', lat != null ? lat.toString() : '26.85');
      formData.append('lng', lng != null ? lng.toString() : '80.95');
      
      let userId = localStorage.getItem('userId');
      if (!userId) {
        userId = `user-${Math.random().toString(36).substr(2, 6)}`;
        localStorage.setItem('userId', userId);
      }
      formData.append('reporter_id', userId);
      const res = await submitReport(formData);
      setResult(res);
      if (res.category) setClassification(res.category);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return address.trim().length > 0;
    if (step === 2) return description.trim().length > 0;
    return true;
  };

  return (
    <div className="report-page-container animate-fade-up" style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      <header style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h2 className="font-serif animate-reveal" style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>Report an Issue</h2>
        <p className="text-secondary font-sans animate-fade-up stagger-1" style={{ fontSize: '1.125rem' }}>Help us improve the city by reporting infrastructure or civic concerns.</p>
      </header>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 animate-fade-up stagger-2" style={{ marginBottom: 'var(--space-10)' }}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3" style={{ flex: 1 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-serif)',
                background: i <= step ? 'var(--accent)' : 'transparent',
                border: `1px solid ${i <= step ? 'var(--accent)' : 'var(--border)'}`,
                color: i <= step ? 'var(--bg-primary)' : 'var(--ink-muted)',
                transition: 'all 0.4s ease',
              }}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'font-medium' : 'text-muted'}`} style={{ letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'color 0.4s ease' }}>{s}</span>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 1,
                background: i < step ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.4s ease',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Form Area */}
      <div className="animate-fade-up stagger-3" style={{ minHeight: 400, position: 'relative' }}>
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <h3 className="font-serif" style={{ fontSize: '1.75rem', color: 'var(--accent)' }}>Upload Media</h3>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-10) var(--space-5)',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                transition: 'all 0.3s ease',
              }}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxHeight: 240, borderRadius: 'var(--radius-md)', margin: '0 auto' }} />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </div>
                  <p className="font-serif" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Drag & drop your image or video</p>
                  <p className="text-sm text-muted">or click to browse your files</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
            
            <div className="flex items-center gap-4" style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {audioUrl ? (
              <div className="flex items-center justify-center gap-4" style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                <audio src={audioUrl} controls style={{ height: 40 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => { setAudioUrl(null); setFile(null); }}>Discard</button>
              </div>
            ) : (
              <button 
                className={`btn flex justify-center items-center ${recording ? 'btn-danger' : 'btn-secondary'}`} 
                style={{ padding: 'var(--space-4)', fontSize: '1.125rem', borderRadius: 'var(--radius-lg)', width: '100%' }}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? 'Stop Recording' : 'Record Voice Note instead'}
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <h3 className="font-serif" style={{ fontSize: '1.75rem', color: 'var(--accent)' }}>Location Details</h3>
            <div className="flex flex-col gap-3">
              <label className="text-sm text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Street Address</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter the location of the issue..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ flex: 1, fontSize: '1.25rem', padding: 'var(--space-4)', background: 'var(--bg-secondary)', border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}
                />
                <button className="btn btn-secondary" onClick={getLocation} disabled={detecting} style={{ padding: '0 var(--space-6)' }}>
                  {detecting ? 'Detecting...' : 'Auto-detect'}
                </button>
              </div>
              <p className="text-xs text-secondary" style={{ marginTop: 'var(--space-2)' }}>
                {lat != null ? `Coordinates locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'If no address is provided, we will attempt to auto-detect your location on submit.'}
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <h3 className="font-serif" style={{ fontSize: '1.75rem', color: 'var(--accent)' }}>Issue Description</h3>
            <div className="flex flex-col gap-3">
              <label className="text-sm text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provide details</label>
              <textarea
                rows={6}
                placeholder="Describe what happened, the current state, and any potential hazards..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ fontSize: '1.125rem', lineHeight: 1.6, padding: 'var(--space-4)', background: 'var(--bg-secondary)', border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', resize: 'vertical' }}
              />
            </div>
            
            {classification && (
              <div className="flex items-center gap-4" style={{ padding: 'var(--space-4)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid oklch(1 0 0 / 0.05)' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-serif)', color: 'var(--accent)' }}>AI</span>
                <div>
                  <p className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>AI Classification</p>
                  <p className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--ink-primary)' }}>{capitalize(classification)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-8 animate-fade-up">
            <h3 className="font-serif" style={{ fontSize: '1.75rem', color: 'var(--accent)' }}>Review & Submit</h3>
            
            <div className="flex flex-col gap-5" style={{ padding: 'var(--space-6)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid oklch(1 0 0 / 0.05)' }}>
              {preview && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <img src={preview} alt="Attached" style={{ maxHeight: 160, borderRadius: 'var(--radius-md)' }} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</span>
                <span className="font-serif" style={{ fontSize: '1.25rem' }}>{address || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</span>
                <span className="text-secondary" style={{ fontSize: '1.125rem', lineHeight: 1.6 }}>{description || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordinates</span>
                <span className="font-mono text-sm">{lat != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '26.85, 80.95 (Default)'}</span>
              </div>
            </div>

            {!result && (
              <button
                className="btn btn-primary flex justify-center items-center"
                style={{ padding: 'var(--space-4)', fontSize: '1.25rem', borderRadius: 'var(--radius-lg)' }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting to intelligence layer...' : 'Submit Report'}
              </button>
            )}

            {result && (
              <div className="animate-fade-up" style={{ padding: 'var(--space-6)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: result.error ? '1px solid var(--error)' : '1px solid var(--success)' }}>
                {result.error ? (
                  <p style={{ color: 'var(--error)', fontSize: '1.125rem' }}>{result.error}</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>OK</div>
                      <span className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--ink-primary)' }}>Report submitted successfully</span>
                    </div>
                    {result.ticket_id && (
                      <p className="text-secondary" style={{ letterSpacing: '0.05em' }}>Ticket ID: <span className="font-mono">{result.ticket_id}</span></p>
                    )}
                    {result.agent_trace && (
                      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid oklch(1 0 0 / 0.05)' }}>
                        <p className="text-sm text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-4)' }}>Processing Trace</p>
                        <AgentTrace trace={result.agent_trace} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center animate-fade-up stagger-4" style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid oklch(1 0 0 / 0.05)' }}>
        <button
          className="btn btn-ghost text-secondary"
          style={{ fontSize: '1.125rem' }}
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0 || result != null}
        >
          {step > 0 ? '← Back' : ''}
        </button>
        {step < 3 && !result && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: '1.125rem', padding: 'var(--space-3) var(--space-6)', borderRadius: 'var(--radius-full)' }}
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}

export default ReportPage;
