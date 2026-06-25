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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (file) formData.append('media', file);
      formData.append('text', description);
      formData.append('address', address);
      formData.append('lat', '26.85');
      formData.append('lng', '80.95');
      formData.append('reporter_id', 'user-1');
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
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-6)' }}>Report an Issue</h2>

      <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-6)' }}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2" style={{ flex: 1 }}>
            <div
              className="flex items-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: i <= step ? 'var(--accent)' : 'var(--bg-surface)',
                color: i <= step ? 'white' : 'var(--ink-muted)',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i <= step ? 'font-medium' : 'text-muted'}`}>{s}</span>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: i < step ? 'var(--accent)' : 'var(--border)',
                borderRadius: 1,
              }} />
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ minHeight: 300 }}>
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8)',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--accent-muted)' : 'transparent',
                transition: 'all 150ms ease-out',
              }}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)' }} />
              ) : (
                <div>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-2)' }}>📷</span>
                  <p className="font-medium">Drop image or video here</p>
                  <p className="text-sm text-muted">or click to browse</p>
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
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
              🎙️ Record Voice
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="font-medium text-sm">Address</label>
            <input
              type="text"
              placeholder="Enter location address..."
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
            <p className="text-xs text-muted">📍 Auto-detect location on submit</p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <label className="font-medium text-sm">Description</label>
            <textarea
              rows={5}
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            {classification && (
              <div className="card card-compact flex items-center gap-3">
                <span>🤖</span>
                <div>
                  <p className="text-sm font-medium">AI Classification</p>
                  <p className="text-sm text-secondary">{capitalize(classification)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h3>Review Your Report</h3>
            <div className="flex flex-col gap-3">
              {preview && (
                <img src={preview} alt="Attached" style={{ maxHeight: 120, borderRadius: 'var(--radius-md)', alignSelf: 'flex-start' }} />
              )}
              <div className="flex gap-2">
                <span className="text-sm text-muted">Address:</span>
                <span className="text-sm">{address || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted">Description:</span>
                <span className="text-sm">{description || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted">Coordinates:</span>
                <span className="text-sm font-mono">26.85, 80.95</span>
              </div>
            </div>
            {!result && (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            )}
            {result && (
              <div className="card" style={{ background: 'var(--bg-surface)' }}>
                {result.error ? (
                  <p style={{ color: 'var(--error)' }}>{result.error}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--success)' }}>✓</span>
                      <span className="font-medium">Report submitted successfully</span>
                    </div>
                    {result.ticket_id && (
                      <p className="text-sm text-secondary">Ticket ID: {result.ticket_id}</p>
                    )}
                    {result.agent_trace && (
                      <div style={{ marginTop: 'var(--space-4)' }}>
                        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink-primary)' }}>Processing Trace:</p>
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

      <div className="flex justify-between" style={{ marginTop: 'var(--space-5)' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          ← Back
        </button>
        {step < 3 && (
          <button
            className="btn btn-primary"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

export default ReportPage;
