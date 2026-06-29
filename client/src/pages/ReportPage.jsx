import { useState, useRef, useEffect } from'react';
import { useNavigate, Link, useSearchParams } from'react-router-dom';
import { AnimatePresence } from'framer-motion';
import { submitReport, fetchWithTimeout } from'../services/api';
import { capitalize } from'../utils/formatters';
import { useToast } from'../hooks/useToast.jsx';
import { useAgentStream } from'../hooks/useAgentStream.js';
import AgentReveal from'../components/agent/AgentReveal.jsx';
import { PageShell } from'../components/ui/PixelKit';

const STEPS = ['Location','Media','Details','Review'];

const MEDIA_TYPES = {
  image:'Image',
  video:'Video',
  audio:'Voice Note',
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
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const queryLat = parseFloat(searchParams.get('lat'));
    const queryLng = parseFloat(searchParams.get('lng'));
    const queryCategory = searchParams.get('category');
    const queryWard = searchParams.get('ward');

    if (!Number.isNaN(queryLat) && !Number.isNaN(queryLng)) {
      setLat(queryLat);
      setLng(queryLng);
      if (queryCategory) setClassification(queryCategory);
      setStep(1); // Advance to Media step directly since location is already locked!
      
      // Auto-fetch geocoding address proxy
      (async () => {
        try {
          const res = await fetch(`/api/reports/geocode/proxy?lat=${queryLat}&lng=${queryLng}`);
          if (res.ok) {
            const data = await res.json();
            const readable = data.results?.[0]?.formatted_address ||'';
            setAddress(readable ||`Lucknow Ward ${queryWard ||''} Area`);
          } else {
            setAddress(`Lucknow Ward ${queryWard ||''} Area`);
          }
        } catch {
          setAddress(`Lucknow Ward ${queryWard ||''} Area`);
        }
      })();
    }
  }, [searchParams]);

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
    if (!('geolocation'in navigator)) {
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
          const res = await fetchWithTimeout(
           `/api/reports/geocode/proxy?lat=${latitude}&lng=${longitude}`,
            { headers: {'Accept-Language':'en'} }
          );
          if (res.ok) {
            const data = await res.json();
            const readable = data.results?.[0]?.formatted_address ||'';
            if (readable) {
              setAddress(readable);
            } else {
              setAddress(`Lucknow Area (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})`);
            }
          } else {
            setAddress(`Lucknow Area (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})`);
          }
        } catch {
          setAddress(`Lucknow Area (Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})`);
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
        const audioBlob = new Blob(audioChunksRef.current, { type:'audio/webm'});
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setFile(new File([audioBlob],'voice_report.webm', { type:'audio/webm'}));
        setPreview(null);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
    } catch {
      toast('Microphone access denied or unavailable','error');
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
          toast('Please complete this step first','error');
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
    const reportId =`report-${Date.now()}`;
    setActiveReportId(reportId);

    const formData = new FormData();
    if (file) formData.append('media', file);
    formData.append('text', description);
    formData.append('address', address);
    formData.append('lat', lat != null ? lat.toString() :'26.85');
    formData.append('lng', lng != null ? lng.toString() :'80.95');
    formData.append('reporter_name','Anonymous');
    formData.append('report_id', reportId);

    let res;
    try {
      res = await submitReport(formData);
    } catch (err) {
      const errMsg = err.message ||'Submission failed. Please check your connection and try again.';
      setResult({ error: errMsg });
      toast(errMsg,'error');
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
        s => s && (s.step ==='create_ticket'|| s.step ==='merge_into_ticket') && s.status ==='success'
      );
      if (completeStep && completeStep.output) {
        setResult(prev => ({
          ...prev,
          ticket_id: completeStep.output.ticket_id || completeStep.output.ticketId,
          merged: completeStep.step ==='merge_into_ticket',
        }));
      }
    }
  }, [agentStream.isComplete, agentStream.steps]);

  const handleCloseReveal = () => {
    setSubmitting(false);
    setActiveReportId(null);
    if (result?.success && result?.merged) {
      toast('Report merged into existing ticket','success');
    } else if (result?.success) {
      toast('Report submitted successfully','success');
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
    if (stepIndex === 0) return address.trim().length > 0;
    if (stepIndex === 1) return true;
    if (stepIndex === 2) return description.trim().length > 0;
    return true;
  };

  const stepError = () => {
    if (step === 0 && address.trim().length === 0) return'A location is required';
    if (step === 2 && description.trim().length === 0) return'A description is required';
    return'';
  };

  const mediaType = file ? (file.type.startsWith('video') ?'video': file.type.startsWith('audio') ?'audio':'image') : null;

  return (
    <PageShell 
      title="Report a Civic Issue"
      subtitle="AI-assisted classification, geocode deduplication, and automated ward dispatch"
    >

      <div className="rpg-panel-sandstone animate-fade-up stagger-2" style={{ padding:'6px', marginBottom:'var(--space-6)', borderRadius: 0 }}>
        <div className="card pixel-border" style={{ background:'#fcf8ee', border:'2px solid #85613c', padding:'16px 20px', color:'#291d12'}}>
          <div className="hero-panel-row">
            <span className="info-pill" style={{ borderRadius: 0, background:'#fffbeb', border:'1px solid #85613c', color:'#b45309', fontWeight: 600 }}>AI AI Classifies Troubles</span>
            <span className="info-pill" style={{ borderRadius: 0, background:'#fffbeb', border:'1px solid #85613c', color:'#b45309', fontWeight: 600 }}>Scans duplicate reports</span>
            <span className="info-pill" style={{ borderRadius: 0, background:'#fffbeb', border:'1px solid #85613c', color:'#b45309', fontWeight: 600 }}>Dispatches to Ward Hero</span>
          </div>
          <p style={{ marginTop:'var(--space-3)', color:'#4a3522', fontWeight: 500, fontSize:'0.9rem', lineHeight: 1.5 }}>Report local troubles to the Town Council. The Sentinel AI understands the problem, checks for similar reports, and alerts the nearest active wards immediately.
          </p>
        </div>
      </div>

      <div className="report-step-rail animate-fade-up stagger-2" style={{ marginBottom:'var(--space-6)'}}>
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s} className="report-step">
              <button
                type="button"
                onClick={() => goToStep(i)}
                aria-label={`Go to step ${i + 1}: ${s}`}
                className="font-pixel"
                disabled={!!result}
                style={{
                  borderRadius: 0,
                  width:'32px',
                  height:'32px',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:'11px',
                  cursor:'pointer',
                  background: isDone ?'#16803d': (isActive ?'#b45309':'#fffbeb'),
                  border: isDone ?'2px solid #14532d': (isActive ?'2px solid #513a23':'2px solid #85613c'),
                  color: (isDone || isActive) ?'#fff':'#85613c',
                  outline:'none',
                  fontWeight:'bold',
                  boxShadow:'1px 1px 0 rgba(0,0,0,0.15)'
                }}
              >
                {isDone ?'✓': i + 1}
              </button>
              <button
                type="button"
                onClick={() => goToStep(i)}
                className="font-pixel"
                disabled={!!result}
                style={{
                  background:'transparent',
                  border:'none',
                  cursor:'pointer',
                  fontSize:'9px',
                  color: isActive ?'#b45309':'#6b5139',
                  fontWeight: isActive ?'800':'600',
                  outline:'none'
                }}
              >
                {s.toUpperCase()}
              </button>
              {i < STEPS.length - 1 && (
                <div 
                  style={{ 
                    height:'3px',
                    flex: 1,
                    background: isDone ?'#16803d':'#85613c',
                    opacity: isDone ? 1 : 0.45,
                    margin:'0 8px'
                  }} 
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="rpg-panel-sandstone animate-fade-up stagger-3" style={{ padding:'6px', minHeight: 320, position:'relative', borderRadius: 0 }}>
        <div className="card pixel-border" style={{ background:'#fcf8ee', border:'2px solid #85613c', padding:'24px 28px', color:'#291d12', minHeight:'308px', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          
          <div style={{ flex: 1 }}>
            {step === 0 && (
              <div className="flex flex-col gap-6 animate-fade-up">
                <h3 className="font-pixel" style={{ fontSize:'14px', color:'#291d12', borderBottom:'2px solid #85613c', paddingBottom:'6px', marginBottom:'12px'}}>LOCATION DETAILS</h3>
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="font-pixel" style={{ fontSize:'10px', color:'#6b5139', fontWeight: 600 }}>STREET ADDRESS</span>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="e.g. Near Hazratganj crossing, Lucknow"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        style={{
                          flex: 1,
                          fontSize:'11px',
                          fontFamily:'var(--font-sans)',
                          padding:'10px 14px',
                          background:'#fffbeb',
                          border:'2px solid #85613c',
                          color:'#291d12',
                          outline:'none',
                          borderRadius: 0
                        }}
                      />
                      <button 
                        className="font-pixel"
                        onClick={getLocation} 
                        disabled={detecting} 
                        style={{ 
                          padding:'10px 16px', 
                          borderRadius: 0,
                          background:'#b45309',
                          border:'2px solid #513a23',
                          color:'#fff',
                          fontSize:'8px',
                          cursor:'pointer'
                        }}
                      >
                        {detecting ?'LOCATING...':'AUTO-DETECT'}
                      </button>
                    </div>
                  </label>
                  {geoError && (
                    <p className="text-sm" style={{ color:'var(--error)'}}>{geoError}</p>
                  )}
                  {lat != null && !geoError && (
                    <div className="card pixel-border" style={{ background:'#ecfdf5', border:'2px solid #059669', color:'#047857', padding:'10px 14px', display:'flex', gap:'8px', alignItems:'center', fontSize:'9px', fontWeight: 600 }}>
                      <span>✓</span>
                      <span>Location locked · coordinates captured for geo-clustering</span>
                    </div>
                  )}
                  <p className="text-xs" style={{ color:'#6b5139', margin: 0 }}>
                    {lat != null
                      ? <span className="font-mono" style={{ color:'#b45309', fontWeight: 600 }}> {lat.toFixed(4)}, {lng.toFixed(4)}</span>
                      :'Coordinates are used to cluster duplicate reports and route them to active Wards.'}
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-6 animate-fade-up">
                <div className="flex items-center justify-between" style={{ borderBottom:'2px solid #85613c', paddingBottom:'6px', marginBottom:'12px'}}>
                  <h3 className="font-pixel" style={{ fontSize:'14px', color:'#291d12', margin: 0 }}>UPLOAD EVIDENCE</h3>
                  <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>OPTIONAL · POWERS SENTINEL AI</span>
                </div>
                
                <div
                  className={`dropzone ${dragOver ?'dragover':''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !file && fileRef.current?.click()}
                  style={{
                    cursor: file ?'default':'pointer',
                    borderRadius: 0,
                    border:'2px dashed #85613c',
                    background:'#fffbeb',
                    padding:'24px',
                    textAlign:'center',
                    transition:'all 0.2s ease',
                    outline:'none'
                  }}
                >
                  {preview && mediaType ==='image'? (
                    <div style={{ position:'relative'}}>
                      <img src={preview} alt="Preview"style={{ maxHeight: 200, borderRadius: 0, margin:'0 auto', display:'block', border:'1px solid #85613c'}} />
                      <button
                        type="button"
                        className="font-pixel"
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        style={{ position:'absolute', top:'8px', right:'8px', borderRadius: 0, background:'#b91c1c', color:'#fff', border:'none', padding:'6px 10px', fontSize:'7px', cursor:'pointer'}}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : preview && mediaType ==='video'? (
                    <div style={{ position:'relative'}}>
                      <video src={preview} controls style={{ maxHeight: 200, borderRadius: 0, margin:'0 auto', display:'block', maxWidth:'100%', border:'1px solid #85613c'}} />
                      <button
                        type="button"
                        className="font-pixel"
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        style={{ position:'absolute', top:'8px', right:'8px', borderRadius: 0, background:'#b91c1c', color:'#fff', border:'none', padding:'6px 10px', fontSize:'7px', cursor:'pointer'}}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : audioUrl && mediaType ==='audio'&& !recording ? (
                    <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <div style={{ width:'48px', height:'48px', borderRadius: 0, background:'#ecdcb9', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #85613c'}}>
                        <svg width="22"height="22"viewBox="0 0 24 24"fill="none"stroke="#b45309"strokeWidth="1.5"strokeLinecap="round"strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6"cy="18"r="3"/><circle cx="18"cy="16"r="3"/></svg>
                      </div>
                      <audio src={audioUrl} controls style={{ width:'100%', maxWidth: 320 }} />
                      <p className="font-mono text-xs" style={{ color:'#6b5139', fontSize:'8px'}}>{file?.name ||'audio file'}</p>
                      <button className="font-pixel" onClick={removeFile} style={{ borderRadius: 0, background:'transparent', border:'none', color:'#b91c1c', fontSize:'8px', cursor:'pointer'}}>✕ Remove</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div style={{ width:'56px', height:'56px', borderRadius: 0, background:'#fcf8ee', border:'2px solid #85613c', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px'}}>
                        <svg width="26"height="26"viewBox="0 0 24 24"fill="none"stroke="#b45309"strokeWidth="1.5"strokeLinecap="round"strokeLinejoin="round"><rect x="3"y="3"width="18"height="18"rx="2"ry="2"></rect><circle cx="8.5"cy="8.5"r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      </div>
                      <p className="font-pixel" style={{ fontSize:'11px', color:'#291d12', marginBottom:'4px'}}>DRAG & DROP EVIDENCE</p>
                      <p className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>OR CLICK TO BROWSE · JPG, PNG, MP4, MP3, WAV</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    style={{ display:'none'}}
                    onChange={e => handleFile(e.target.files[0])}
                  />
                </div>

                {!(audioUrl && mediaType ==='audio'&& !recording) && (
                  <>
                    <div className="flex items-center gap-4"aria-hidden="true"style={{ margin:'8px 0'}}>
                      <div style={{ flex: 1, height: 1, background:'#85613c', opacity: 0.3 }} />
                      <span className="font-pixel" style={{ fontSize:'7px', color:'#6b5139', letterSpacing:'0.1em'}}>OR</span>
                      <div style={{ flex: 1, height: 1, background:'#85613c', opacity: 0.3 }} />
                    </div>

                    {audioUrl && recording === false ? null : recording ? (
                      <button
                        className="font-pixel flex justify-center items-center"
                        style={{ padding:'12px', fontSize:'9px', borderRadius: 0, width:'100%', background:'#b91c1c', border:'2px solid #7f1d1d', color:'#fff', cursor:'pointer'}}
                        onClick={stopRecording}
                      >
                        <span className="rec-indicator"><span className="rec-dot" style={{ borderRadius: 0 }} />RECORDING...</span>
                        <span style={{ marginLeft:'12px', opacity: 0.8 }}>TAP TO STOP</span>
                      </button>
                    ) : (
                      <button
                        className="font-pixel flex justify-center items-center"
                        style={{ padding:'12px', fontSize:'9px', borderRadius: 0, width:'100%', background:'#fffbeb', border:'2px solid #85613c', color:'#b45309', cursor:'pointer'}}
                        onClick={startRecording}
                      >RECORD VOICE NOTE INSTEAD
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-6 animate-fade-up">
                <div className="flex items-center justify-between" style={{ borderBottom:'2px solid #85613c', paddingBottom:'6px', marginBottom:'12px'}}>
                  <h3 className="font-pixel" style={{ fontSize:'14px', color:'#291d12', margin: 0 }}>ISSUE DESCRIPTION</h3>
                  <span className="font-pixel text-muted" style={{ fontSize:'7.5px'}}>{description.trim().length} CHARS</span>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="font-pixel" style={{ fontSize:'10px', color:'#6b5139', fontWeight: 600 }}>WHAT IS THE TROUBLE?</span>
                    <textarea
                      rows={6}
                      placeholder="Describe what happened, the current state, and any potential hazards..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      style={{
                        fontSize:'11px',
                        fontFamily:'var(--font-sans)',
                        lineHeight: 1.6,
                        padding:'12px 14px',
                        background:'#fffbeb',
                        border:'2px solid #85613c',
                        color:'#291d12',
                        resize:'vertical',
                        borderRadius: 0,
                        outline:'none'
                      }}
                    />
                  </label>
                  <div className="report-example" style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center', marginTop:'4px'}}>
                    <span className="font-pixel" style={{ fontSize:'7px', color:'#6b5139', marginRight:'4px'}}>Quick fill:</span>
                    {[
                     'Large pothole flooding the road after rain',
                     'Streetlight not working, Hazratganj area is dark at night',
                     'Garbage pile near the main ward bus stop',
                    ].map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        className="font-pixel"
                        onClick={() => setDescription(ex)}
                        style={{
                          borderRadius: 0,
                          background:'#fffbeb',
                          border:'1px solid #85613c',
                          padding:'6px 10px',
                          fontSize:'7.5px',
                          color:'#b45309',
                          cursor:'pointer'
                        }}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {classification && (
                  <div className="card pixel-border" style={{ background:'#fffbeb', border:'2px solid #b45309', padding:'10px 14px', display:'flex', gap:'12px', alignItems:'center', borderRadius: 0, marginTop:'8px'}}>
                    <span className="font-pixel" style={{ fontSize:'14px', color:'#b45309', fontWeight: 800 }}>AI AI</span>
                    <div>
                      <p className="font-pixel" style={{ fontSize:'8px', color:'#6b5139', margin: 0 }}>AUTO-CLASSIFIED CATEGORY</p>
                      <p className="font-pixel" style={{ fontSize:'11px', color:'#291d12', fontWeight: 700, margin: 0 }}>{capitalize(classification)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-8 animate-fade-up">
                <h3 className="font-pixel" style={{ fontSize:'14px', color:'#291d12', borderBottom:'2px solid #85613c', paddingBottom:'6px', marginBottom:'12px'}}>REVIEW & DISPATCH</h3>

                <div className="report-review-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  {preview && (
                    <div className="review-field review-field-full" style={{ gridColumn:'span 2', textAlign:'center', background:'#fffbeb', border:'1px solid #85613c', padding:'8px'}}>
                      <img src={preview} alt="Attached"style={{ maxHeight: 150, borderRadius: 0, margin:'0 auto', border:'1px solid #85613c'}} />
                    </div>
                  )}
                  {mediaType && (
                    <div className="review-field" style={{ background:'#fffbeb', border:'1px solid #85613c', padding:'8px 12px', display:'flex', flexDirection:'column'}}>
                      <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>MEDIA TYPE</span>
                      <span className="font-pixel" style={{ fontSize:'10px', color:'#291d12', fontWeight: 600 }}>{MEDIA_TYPES[mediaType]}</span>
                    </div>
                  )}
                  {classification && (
                    <div className="review-field" style={{ background:'#fffbeb', border:'1px solid #85613c', padding:'8px 12px', display:'flex', flexDirection:'column'}}>
                      <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>CLASSIFICATION</span>
                      <span className="font-pixel" style={{ fontSize:'10px', color:'#b45309', fontWeight: 600 }}>{capitalize(classification)}</span>
                    </div>
                  )}
                  <div className="review-field" style={{ background:'#fffbeb', border:'1px solid #85613c', padding:'8px 12px', display:'flex', flexDirection:'column'}}>
                    <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>LOCATION</span>
                    <span className="font-pixel" style={{ fontSize:'10px', color:'#291d12', fontWeight: 600 }}>{address ||'—'}</span>
                  </div>
                  <div className="review-field" style={{ background:'#fffbeb', border:'1px solid #85613c', padding:'8px 12px', display:'flex', flexDirection:'column'}}>
                    <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>COORDINATES</span>
                    <span className="font-mono" style={{ fontSize:'10px', color:'#b45309', fontWeight: 600 }}>{lat != null ?`${lat.toFixed(4)}, ${lng.toFixed(4)}`:'Captured'}</span>
                  </div>
                  <div className="review-field review-field-full" style={{ gridColumn:'span 2', background:'#fffbeb', border:'1px solid #85613c', padding:'8px 12px', display:'flex', flexDirection:'column'}}>
                    <span className="font-pixel" style={{ fontSize:'7.5px', color:'#6b5139'}}>DESCRIPTION</span>
                    <span style={{ fontSize:'10px', color:'#4a3522', fontWeight: 500, lineHeight: 1.4 }}>{description ||'—'}</span>
                  </div>
                </div>

                {!result && (
                  <button
                    className="font-pixel"
                    style={{
                      padding:'14px',
                      fontSize:'11px',
                      background:'#b45309',
                      border:'2px solid #513a23',
                      color:'#fff',
                      cursor:'pointer',
                      width:'100%',
                      boxShadow:'1px 1px 0 rgba(0,0,0,0.15)'
                    }}
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ?'DISPATCHING TO WARD HERO...':'DISPATCH QUEST TO GUILD BOARD'}
                  </button>
                )}

                {result && result.error && (
                  <div className="card pixel-border" style={{ background:'#fef2f2', border:'2px solid #b91c1c', padding:'14px', color:'#991b1b', borderRadius: 0 }}>
                    <p className="font-pixel" style={{ fontSize:'10px', margin:'0 0 12px 0'}}>{result.error}</p>
                    <div className="flex gap-3">
                      <button className="font-pixel" onClick={() => { setResult(null); }} style={{ padding:'8px 14px', background:'#b91c1c', border:'1px solid #7f1d1d', color:'#fff', cursor:'pointer', fontSize:'9px'}}>TRY AGAIN</button>
                      <button className="font-pixel" onClick={resetForm} style={{ padding:'8px 14px', background:'#fff', border:'1px solid #b91c1c', color:'#b91c1c', cursor:'pointer', fontSize:'9px'}}>START OVER</button>
                    </div>
                  </div>
                )}

                {result && !result.error && (
                  <div className="card pixel-border" style={{ background:'#fffbeb', border:'2px solid #b45309', padding:'16px', color:'#291d12', borderRadius: 0 }}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div style={{ width: 32, height: 32, borderRadius: 0, background: result.merged ?'#d97706':'#16803d', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight: 600 }}>✓</div>
                        <span className="font-pixel" style={{ fontSize:'13px', color:'#291d12'}}>
                          {result.merged ?'VERIFICATION REPORT MERGED':'QUEST DISPATCHED TO BOARD'}
                        </span>
                      </div>
                      {result.merged && (
                        <p style={{ fontSize:'9.5px', color:'#4a3522', lineHeight: 1.4, marginTop:'8px', fontWeight: 500 }}>An active quest for this trouble already exists at this location. Your report has been merged and registered as an official verification upvote for Quest #{result.ticket_id}.
                        </p>
                      )}
                    </div>
                    {result.ticket_id && (
                      <p className="font-pixel" style={{ fontSize:'8px', color:'#6b5139', marginTop:'8px'}}>QUEST ID: <span className="font-mono">{result.ticket_id}</span></p>
                    )}
                    <div className="flex gap-3" style={{ marginTop:'16px'}}>
                      {result.ticket_id && (
                        <Link to={`/ticket/${result.ticket_id}`} className="font-pixel" style={{ padding:'8px 14px', background:'#b45309', border:'1px solid #513a23', color:'#fff', textDecoration:'none', fontSize:'9px'}}>VIEW QUEST</Link>
                      )}
                      <button className="font-pixel" onClick={resetForm} style={{ padding:'8px 14px', background:'#fffbeb', border:'1px solid #85613c', color:'#b45309', cursor:'pointer', fontSize:'9px'}}>REPORT ANOTHER</button>
                      <button className="font-pixel" onClick={() => navigate('/')} style={{ padding:'8px 14px', background:'transparent', border:'none', color:'#6b5139', cursor:'pointer', fontSize:'9px'}}>BACK TO BOARD</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center animate-fade-up stagger-4" style={{ marginTop:'var(--space-8)', paddingTop:'var(--space-6)', borderTop:'2px solid #85613c'}}>
            {step > 0 && !result && (
              <button
                className="font-pixel"
                style={{ fontSize:'10px', color:'#6b5139', background:'transparent', border:'none', cursor:'pointer'}}
                onClick={() => setStep(s => s - 1)}
              >
                ← BACK
              </button>
            )}
            {step < 3 && !result && (
              <div className="flex flex-col items-end gap-1" style={{ marginLeft:'auto'}}>
                <button
                  className="font-pixel"
                  style={{ 
                    fontSize:'10px', 
                    padding:'10px 18px', 
                    borderRadius: 0,
                    background:'#b45309',
                    border:'2px solid #513a23',
                    color:'#fff',
                    cursor:'pointer'
                  }}
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canNext()}
                >CONTINUE →
                </button>
                {stepError() && (
                  <span className="font-pixel" style={{ fontSize:'7.5px', color:'var(--error)'}}>{stepError().toUpperCase()}</span>
                )}
              </div>
            )}
          </div>

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
    </PageShell>
  );
}

export default ReportPage;
