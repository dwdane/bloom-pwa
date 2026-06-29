// logOptions.js
// The loggable feelings and symptoms, ported from the native Bloom app.
// Positive feelings lead by design — most days have good moments worth
// remembering, and seeing them reflected back is part of feeling supported.
// Tones: 'good' | 'neutral' | 'tough'.

const LOG_CATEGORIES = [
  {
    title: 'Good moments',
    options: [
      { label: 'Happy', kind: 'feeling', tone: 'good' },
      { label: 'Energetic', kind: 'feeling', tone: 'good' },
      { label: 'Excited', kind: 'feeling', tone: 'good' },
      { label: 'Calm', kind: 'feeling', tone: 'good' },
      { label: 'Grateful', kind: 'feeling', tone: 'good' },
      { label: 'Connected', kind: 'feeling', tone: 'good' },
      { label: 'Rested', kind: 'feeling', tone: 'good' },
      { label: 'Glowing', kind: 'feeling', tone: 'good' },
      { label: 'Baby kicks', kind: 'feeling', tone: 'good' },
    ],
  },
  {
    title: 'Mood',
    options: [
      { label: 'Emotional', kind: 'feeling', tone: 'neutral' },
      { label: 'Anxious', kind: 'feeling', tone: 'tough' },
      { label: 'Irritable', kind: 'feeling', tone: 'tough' },
      { label: 'Overwhelmed', kind: 'feeling', tone: 'tough' },
      { label: 'Foggy', kind: 'feeling', tone: 'neutral' },
    ],
  },
  {
    title: 'Body',
    options: [
      { label: 'Nausea', kind: 'symptom', tone: 'tough' },
      { label: 'Fatigue', kind: 'symptom', tone: 'tough' },
      { label: 'Headache', kind: 'symptom', tone: 'tough' },
      { label: 'Heartburn', kind: 'symptom', tone: 'tough' },
      { label: 'Back pain', kind: 'symptom', tone: 'tough' },
      { label: 'Cramping', kind: 'symptom', tone: 'tough' },
      { label: 'Swelling', kind: 'symptom', tone: 'tough' },
      { label: 'Insomnia', kind: 'symptom', tone: 'tough' },
      { label: 'Cravings', kind: 'symptom', tone: 'neutral' },
      { label: 'Constipation', kind: 'symptom', tone: 'tough' },
      { label: 'Dizziness', kind: 'symptom', tone: 'tough' },
      { label: 'Congestion', kind: 'symptom', tone: 'tough' },
    ],
  },
];

// Resolve the tone for a stored label, so past entries colour consistently.
function toneForLabel(label) {
  for (const category of LOG_CATEGORIES) {
    for (const option of category.options) {
      if (option.label === label) return option.tone;
    }
  }
  return 'neutral';
}
