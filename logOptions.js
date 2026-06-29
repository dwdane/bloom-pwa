// logOptions.js
// The loggable feelings and symptoms, ported from the native Bloom app.
// Positive feelings lead by design — most days have good moments worth
// remembering, and seeing them reflected back is part of feeling supported.
// Tones: 'good' | 'neutral' | 'tough'.

const LOG_CATEGORIES = [
  {
    title: 'Good moments',
    options: [
      { label: 'Happy', emoji: '😊', kind: 'feeling', tone: 'good' },
      { label: 'Energetic', emoji: '⚡', kind: 'feeling', tone: 'good' },
      { label: 'Excited', emoji: '🤩', kind: 'feeling', tone: 'good' },
      { label: 'Calm', emoji: '😌', kind: 'feeling', tone: 'good' },
      { label: 'Grateful', emoji: '🙏', kind: 'feeling', tone: 'good' },
      { label: 'Connected', emoji: '💞', kind: 'feeling', tone: 'good' },
      { label: 'Rested', emoji: '🛌', kind: 'feeling', tone: 'good' },
      { label: 'Glowing', emoji: '✨', kind: 'feeling', tone: 'good' },
      { label: 'Baby kicks', emoji: '🦶', kind: 'feeling', tone: 'good' },
    ],
  },
  {
    title: 'Mood',
    options: [
      { label: 'Emotional', emoji: '🥹', kind: 'feeling', tone: 'neutral' },
      { label: 'Anxious', emoji: '😰', kind: 'feeling', tone: 'tough' },
      { label: 'Irritable', emoji: '😤', kind: 'feeling', tone: 'tough' },
      { label: 'Overwhelmed', emoji: '😵‍💫', kind: 'feeling', tone: 'tough' },
      { label: 'Foggy', emoji: '🌫️', kind: 'feeling', tone: 'neutral' },
    ],
  },
  {
    title: 'Body',
    options: [
      { label: 'Nausea', emoji: '🤢', kind: 'symptom', tone: 'tough' },
      { label: 'Fatigue', emoji: '🥱', kind: 'symptom', tone: 'tough' },
      { label: 'Headache', emoji: '🤕', kind: 'symptom', tone: 'tough' },
      { label: 'Heartburn', emoji: '🔥', kind: 'symptom', tone: 'tough' },
      { label: 'Back pain', emoji: '💢', kind: 'symptom', tone: 'tough' },
      { label: 'Cramping', emoji: '😣', kind: 'symptom', tone: 'tough' },
      { label: 'Swelling', emoji: '🫧', kind: 'symptom', tone: 'tough' },
      { label: 'Insomnia', emoji: '🌙', kind: 'symptom', tone: 'tough' },
      { label: 'Cravings', emoji: '🍫', kind: 'symptom', tone: 'neutral' },
      { label: 'Constipation', emoji: '🚽', kind: 'symptom', tone: 'tough' },
      { label: 'Dizziness', emoji: '💫', kind: 'symptom', tone: 'tough' },
      { label: 'Congestion', emoji: '🤧', kind: 'symptom', tone: 'tough' },
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

// Emoji for a stored label, so past entries show their icon consistently.
function emojiForLabel(label) {
  for (const category of LOG_CATEGORIES) {
    for (const option of category.options) {
      if (option.label === label) return option.emoji || '';
    }
  }
  return '';
}
