import React, { useState } from 'react';

const TOPICS = [
  'Immigration',
  'Gun policy',
  'Healthcare',
  'Climate & energy',
  'Policing & criminal justice',
  'Economic inequality',
  'Free speech & censorship',
  'Gender & identity',
];

const POSITIONS = [
  { value: 'progressive', label: 'Left / Progressive' },
  { value: 'conservative', label: 'Right / Conservative' },
  { value: 'libertarian', label: 'Libertarian' },
  { value: 'other', label: "Doesn't fit a label" },
];

const INTENSITIES = [
  { value: 'core', label: "It's central to who I am", description: 'Full Socratic pressure' },
  { value: 'strong', label: "I feel strongly but I'm open to challenge", description: 'Strong pushback' },
  { value: 'leaning', label: 'I lean this way but I\'m uncertain', description: 'Moderate challenge' },
  { value: 'curious', label: 'I mostly want to understand the other side', description: 'Exploratory mode' },
];

export default function Survey({ onComplete }) {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [position, setPosition] = useState('');
  const [intensity, setIntensity] = useState('');

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else {
      onComplete({
        topic: topic === 'custom' ? customTopic : topic,
        position,
        intensity,
      });
    }
  };

  const canAdvance =
    (step === 0 && topic && (topic !== 'custom' || customTopic.trim())) ||
    (step === 1 && position) ||
    (step === 2 && intensity);

  return (
    <div className="screen survey-screen">
      <div className="survey-content">
        <div className="survey-progress">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`progress-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="survey-step">
            <h2>What do you want to spar about?</h2>
            <p className="survey-hint">Pick the issue you feel strongest about.</p>
            <div className="option-grid">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  className={`option-btn ${topic === t ? 'selected' : ''}`}
                  onClick={() => setTopic(t)}
                >
                  {t}
                </button>
              ))}
              <button
                className={`option-btn ${topic === 'custom' ? 'selected' : ''}`}
                onClick={() => setTopic('custom')}
              >
                Other...
              </button>
            </div>
            {topic === 'custom' && (
              <input
                className="text-input"
                type="text"
                placeholder="Name your topic"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                autoFocus
              />
            )}
          </div>
        )}

        {step === 1 && (
          <div className="survey-step">
            <h2>Where do you land on {topic === 'custom' ? customTopic : topic}?</h2>
            <p className="survey-hint">The Bridge will take the opposing position.</p>
            <div className="option-list">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  className={`option-btn-wide ${position === p.value ? 'selected' : ''}`}
                  onClick={() => setPosition(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="survey-step">
            <h2>How strongly do you hold this view?</h2>
            <p className="survey-hint">This calibrates how hard The Bridge pushes back.</p>
            <div className="option-list">
              {INTENSITIES.map((i) => (
                <button
                  key={i.value}
                  className={`option-btn-wide ${intensity === i.value ? 'selected' : ''}`}
                  onClick={() => setIntensity(i.value)}
                >
                  <span className="option-main">{i.label}</span>
                  <span className="option-sub">{i.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="survey-nav">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn btn-primary" disabled={!canAdvance} onClick={handleNext}>
            {step === 2 ? 'Start Session' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
