import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { submitReport } from '../services/api';
import { capitalize } from '../utils/formatters';
import { useToast } from '../hooks/useToast.jsx';
import { useAgentStream } from '../hooks/useAgentStream.js';
import AgentReveal from '../components/agent/AgentReveal.jsx';

const STEPS = ['Media', 'Location', 'Details', 'Review'];

const MEDIA_TYPES = {
  image: 'Image',
  video: 'Video',
  audio: 'Voice Note',
};

function ReportPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeReportId, setActiveReportId] = useState(null);
  const [traceSteps, setTraceSteps] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileRef = useRef(null);

  const agentStream = useAgentStream(activeReportId, traceSteps);
  const showReveal = activeReportId !== null && (submitting || agentStream.isComplete);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setGeoError('');
    if (f.type.startsWith('audio')) {
      // Audio files: no image preview, handled separately
      const url = URL.createObjectURL(f);
      setAudioUrl(url);
      setPreview(null);
    } else {
      // Image and video: use FileReader for data URL preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const getLocation = () => {
    setDetecting(true);
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setDetecting(false);
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        try {
          const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsKey}`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const readable = data.results?.[0]?.formatted_address || '';
            if (readable) setAddress(readable);
          }
        } catch {
          setAddress('Location captured');
        }
        setDetecting(false);
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location access denied. Enter an address instead.');
        } else {
          setGeoError('Could not detect location. Enter an address instead.');
        }
      }
    );
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
        setFile(new File([audioBlob], 'voice_report.webm', { type: 'audio/webm' }));
        setPreview(null);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
    } catch {
      toast('Microphone access denied or unavailable', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const goToStep = (target) => {
    if (result) return;
    if (target > step) {
      for (let i = 0; i < target; i++) {
        if (!canNext(i)) {
          toast('Please complete this step first', 'error');
          return;
        }
      }
    }
    setStep(target);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setTraceSteps([]);
    setResult(null);
    const reportId = `report-${Date.now()}`;
    setActiveReportId(reportId);

    const formData = new FormData();
    if (file) formData.append('media', file);
    formData.append('text', description);
    formData.append('address', address);
    formData.append('lat', lat != null ? lat.toString() : '26.85');
    formData.append('lng', lng != null ? lng.toString() : '80.95');
    formData.append('reporter_name', 'Anonymous');
    formData.append('report_id', reportId);

    let res;
    try {
      res = await submitReport(formData);
    } catch {
      setResult({ error: 'Submission failed. Please check your connection and try again.' });
      toast('Submission failed', 'error');
      setSubmitting(false);
      setActiveReportId(null);
      setTraceSteps([]);
      return;
    }

    setResult(res);
    if (res.trace) setTraceSteps(res.trace);
    if (res.classification) setClassification(res.classification.category);
  };

  useEffect(() => {
    if (agentStream.isComplete && agentStream.steps.length > 0) {
      const completeStep = agentStream.steps.find(
        s => s && (s.step === 'create_ticket' || s.step === 'merge_into_ticket') && s.status === 'success'
      );
      if (completeStep && completeStep.output) {
        setResult(prev => ({
          ...prev,
          ticket_id: completeStep.output.ticket_id || completeStep.output.ticketId,
          merged: completeStep.step === 'merge_into_ticket',
        }));
      }
    }
  }, [agentStream.isComplete, agentStream.steps]);

  const handleCloseReveal = () => {
    setSubmitting(false);
    setActiveReportId(null);
    if (result?.success && result?.merged) {
      toast('Report merged into existing ticket', 'success');
    } else if (result?.success) {
      toast('Report submitted successfully', 'success');
    }
  };

  const resetForm = () => {
    setStep(0);
    setFile(null);
    setPreview(null);
    setAddress('');
    setDescription('');
    setClassification(null);
    setResult(null);
    setActiveReportId(null);
    setTraceSteps([]);
    setLat(null);
    setLng(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setGeoError('');
  };

  const canNext = (stepIndex = step) => {
    if (stepIndex === 0) return true;
    if (stepIndex === 1) return address.trim().length > 0;
    if (stepIndex === 2) return description.trim().length > 0;
    return true;
  };

  const stepError = () => {
    if (step === 1 && address.trim().length === 0) return 'A location is required';
    if (step === 2 && description.trim().length === 0) return 'A description is required';
    return '';
  };

  const mediaType = file ? (file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image') : null;

  return (
    <div className="report-page-container animate-fade-up" style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      <header style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h2 className="font-serif animate-reveal" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 'var(--space-3)' }}>Report an Issue</h2>
        <p className="text-secondary font-sans animate-fade-up stagger-1" style={{ fontSize: '1.125rem' }}>Help us improve the city by reporting infrastructure or civic concerns.</p>
      </header>

      <div className="hero-panel rpg-panel animate-fade-up stagger-2" style={{ marginBottom: 'var(--space-6)', borderRadius: 0 }}>
        <div className="hero-panel-row">
          <span className="info-pill" style={{ borderRadius: 0 }}>🤖 AI classifies your issue</span>
          <span className="info-pill" style={{ borderRadius: 0 }}>🧠 Detects duplicates</span>
          <span className="info-pill" style={{ borderRadius: 0 }}>📍 Prioritizes by ward and urgency</span>
        </div>
        <p className="text-secondary" style={{ marginTop: 'var(--space-2)' }}>
          Report a civic issue in minutes. The system understands the problem, checks for similar reports, and helps it reach the right people faster.
        </p>
      </div>

      <div className="report-step-rail animate-fade-up stagger-2">
        {STEPS.map((s, i) => (
          <div key={s} className="report-step">
            <button
              type="button"
              onClick={() => goToStep(i)}
              aria-label={`Go to step ${i + 1}: ${s}`}
              className={`report-step-node ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              disabled={!!result}
              style={{ borderRadius: 0 }}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <button
              type="button"
              onClick={() => goToStep(i)}
              className={`report-step-label ${i === step ? 'active' : ''}`}
              disabled={!!result}
            >
              {s}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`report-step-connector ${i < step ? 'done' : ''}`} style={{ borderRadius: 0 }} />
            )}
          </div>
        ))}
      </div>

      <div className="card rpg-panel animate-fade-up stagger-3" style={{ minHeight: 320, position: 'relative', padding: 'var(--space-6) var(--space-7)', borderRadius: 0, background: 'var(--bg-surface)' }}>
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <h3 className="section-title" style={{ fontSize: '1.75rem', marginBottom: 0 }}>Upload Media</h3>
              <span className="text-xs text-muted">optional · powers AI classification</span>
            </div>
            <div
              className={`dropzone rpg-panel ${dragOver ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileRef.current?.click()}
              style={{ cursor: file ? 'default' : 'pointer', borderRadius: 0 }}
            >
              {preview && mediaType === 'image' ? (
                <div style={{ position: 'relative' }}>
                  <img src={preview} alt="Preview" style={{ maxHeight: 240, borderRadius: 0, margin: '0 auto', display: 'block' }} />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', borderRadius: 0 }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : preview && mediaType === 'video' ? (
                <div style={{ position: 'relative' }}>
                  <video src={preview} controls style={{ maxHeight: 240, borderRadius: 0, margin: '0 auto', display: 'block', maxWidth: '100%' }} />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', borderRadius: 0 }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : audioUrl && mediaType === 'audio' && !recording ? (
                <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <div style={{ width: '48px', height: '48px', borderRadius: 0, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  </div>
                  <audio src={audioUrl} controls style={{ width: '100%', maxWidth: 320 }} />
                  <p className="text-xs text-muted">{file?.name || 'audio file'}</p>
                  <button className="btn btn-ghost btn-sm" onClick={removeFile} style={{ borderRadius: 0 }}>✕ Remove</button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div style={{ width: '56px', height: '56px', borderRadius: 0, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </div>
                  <p className="font-serif" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Drag & drop image, video, or audio</p>
                  <p className="text-sm text-muted">or click to browse · JPG, PNG, MP4, MP3, WAV</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,audio/*"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            {!(audioUrl && mediaType === 'audio' && !recording) && (
              <>
                <div className="flex items-center gap-4" aria-hidden="true">
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {audioUrl && recording === false ? null : recording ? (
                  <button
                    className="btn btn-danger flex justify-center items-center"
                    style={{ padding: 'var(--space-4)', fontSize: '1.125rem', borderRadius: 0, width: '100%' }}
                    onClick={stopRecording}
                  >
                    <span className="rec-indicator" style={{ borderRadius: 0 }}><span className="rec-dot" style={{ borderRadius: 0 }} /> Recording</span>
                    <span style={{ marginLeft: 'var(--space-3)' }}>Tap to stop</span>
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary flex justify-center items-center"
                    style={{ padding: 'var(--space-4)', fontSize: '1.125rem', borderRadius: 0, width: '100%' }}
                    onClick={startRecording}
                  >
                    🎙 Record Voice Note instead
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <h3 className="section-title" style={{ fontSize: '1.75rem' }}>Location Details</h3>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="label">Street Address</span>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Near Hazratganj crossing, Lucknow"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    style={{ flex: 1, fontSize: '1.25rem', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 0 }}
                  />
                  <button className="btn btn-secondary" onClick={getLocation} disabled={detecting} style={{ padding: '0 var(--space-6)', borderRadius: 0 }}>
                    {detecting ? 'Locating...' : '📍 Auto-detect'}
                  </button>
                </div>
              </label>
              {geoError && (
                <p className="text-sm" style={{ color: 'var(--error)' }}>{geoError}</p>
              )}
              {lat != null && !geoError && (
                <div className="report-location-confirmed" style={{ borderRadius: 0 }}>
                  <span>✓</span>
                  <span>Location locked · coordinates captured for geo-clustering</span>
                </div>
              )}
              <p className="text-xs text-secondary">
                {lat != null
                  ? <span className="report-coord-display">📐 {lat.toFixed(4)}, {lng.toFixed(4)}</span>
                  : 'We use your location to cluster duplicate reports and route to the right ward.'}
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <h3 className="section-title" style={{ fontSize: '1.75rem', marginBottom: 0 }}>Issue Description</h3>
              <span className="text-xs text-muted">{description.trim().length} chars</span>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="label">What's the issue?</span>
                <textarea
                  rows={6}
                  placeholder="Describe what happened, the current state, and any potential hazards..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ fontSize: '1.125rem', lineHeight: 1.6, padding: 'var(--space-4)', background: 'var(--bg-secondary)', resize: 'vertical', borderRadius: 0 }}
                />
              </label>
              <div className="report-example">
                <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>Quick fill:</span>
                {[
                  'Large pothole flooding the road after rain',
                  'Streetlight not working for a week, area is dark at night',
                  'Garbage piling up near the bus stop',
                ].map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    className="report-example-chip"
                    onClick={() => setDescription(ex)}
                    style={{ borderRadius: 0 }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {classification && (
              <div className="flex items-center gap-4 panel rpg-panel" style={{ borderRadius: 0 }}>
                <span className="font-serif" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent)' }}>AI</span>
                <div>
                  <p className="label" style={{ marginBottom: '2px' }}>AI Classification</p>
                  <p className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--ink-primary)' }}>{capitalize(classification)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-8 animate-fade-up">
            <h3 className="section-title" style={{ fontSize: '1.75rem' }}>Review & Dispatch</h3>

            <div className="report-review-grid">
              {preview && (
                <div className="review-field review-field-full" style={{ textAlign: 'center' }}>
                  <img src={preview} alt="Attached" style={{ maxHeight: 180, borderRadius: 0, margin: '0 auto' }} />
                </div>
              )}
              {mediaType && (
                <div className="review-field">
                  <span className="label">Media</span>
                  <span className="font-serif" style={{ fontSize: '1.1rem' }}>{MEDIA_TYPES[mediaType]}{file ? ` · ${file.name}` : ''}</span>
                </div>
              )}
              {classification && (
                <div className="review-field">
                  <span className="label">AI Classification</span>
                  <span className="font-serif" style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>{capitalize(classification)}</span>
                </div>
              )}
              <div className="review-field">
                <span className="label">Location</span>
                <span className="font-serif" style={{ fontSize: '1.1rem' }}>{address || '—'}</span>
              </div>
              <div className="review-field">
                <span className="label">Coordinates</span>
                <span className="font-mono text-sm" style={{ color: 'var(--accent)' }}>{lat != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'default'}</span>
              </div>
              <div className="review-field review-field-full">
                <span className="label">Description</span>
                <span className="text-secondary" style={{ fontSize: '1.05rem', lineHeight: 1.6 }}>{description || '—'}</span>
              </div>
            </div>

            {!result && (
              <button
                className="btn btn-primary flex justify-center items-center"
                style={{ padding: 'var(--space-4)', fontSize: '1.25rem', borderRadius: 0 }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Dispatching to agent...' : '⚡ Dispatch to Agent'}
              </button>
            )}

            {result && result.error && (
              <div className="flex flex-col gap-4 panel rpg-panel" style={{ borderColor: 'var(--error)', borderRadius: 0 }}>
                <p style={{ color: 'var(--error)', fontSize: '1.125rem' }}>{result.error}</p>
                <div className="flex gap-3">
                  <button className="btn btn-primary" onClick={() => { setResult(null); }} style={{ borderRadius: 0 }}>Try Again</button>
                  <button className="btn btn-secondary" onClick={resetForm} style={{ borderRadius: 0 }}>Start Over</button>
                </div>
              </div>
            )}

            {result && !result.error && (
              <div className="flex flex-col gap-4 panel rpg-panel" style={{ borderColor: 'var(--success)', borderRadius: 0 }}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 32, height: 32, borderRadius: 0, background: result.merged ? 'var(--warning)' : 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>✓</div>
                    <span className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--ink-primary)' }}>
                      {result.merged ? 'Verification Upvote Registered' : 'Report Dispatched'}
                    </span>
                  </div>
                  {result.merged && (
                    <p className="text-secondary text-sm" style={{ lineHeight: 1.4, marginTop: 'var(--space-2)', color: 'var(--ink-secondary)' }}>
                      An active report for this issue already exists at this location. Your report has been merged and registered as an official verification upvote for Ticket #{result.ticket_id}.
                    </p>
                  )}
                </div>
                {result.ticket_id && (
                  <p className="text-secondary text-xs" style={{ letterSpacing: '0.05em', marginTop: 'var(--space-2)' }}>Ticket ID: <span className="font-mono">{result.ticket_id}</span></p>
                )}
                <div className="flex gap-3" style={{ marginTop: 'var(--space-4)' }}>
                  {result.ticket_id && (
                    <Link to={`/ticket/${result.ticket_id}`} className="btn btn-primary" style={{ borderRadius: 0 }}>View Ticket</Link>
                  )}
                  <button className="btn btn-secondary" onClick={resetForm} style={{ borderRadius: 0 }}>Report Another</button>
                  <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ borderRadius: 0 }}>Back to Map</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between items-center animate-fade-up stagger-4" style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border)' }}>
          {step > 0 && !result && (
            <button
              className="btn btn-ghost text-secondary"
              style={{ fontSize: '1.125rem', borderRadius: 0 }}
              onClick={() => setStep(s => s - 1)}
            >
              ← Back
            </button>
          )}
          {step < 3 && !result && (
            <div className="flex flex-col items-end gap-1" style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '1.125rem', padding: 'var(--space-3) var(--space-6)', borderRadius: 0 }}
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
              >
                Continue →
              </button>
              {stepError() && (
                <span className="text-xs" style={{ color: 'var(--error)' }}>{stepError()}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showReveal && (
          <AgentReveal
            steps={agentStream.steps}
            isComplete={agentStream.isComplete}
            startedAt={agentStream.startedAt}
            result={result}
            onClose={handleCloseReveal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ReportPage;
