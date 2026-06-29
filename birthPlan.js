// birthPlan.js
// Template for a flexible birth-plan builder and a hospital-bag checklist. A
// birth plan is a set of preferences to share with your care team, not a
// contract — things can change on the day, and that's normal. Options are
// phrased neutrally so they fit many kinds of birth.

const BIRTH_PLAN_SECTIONS = [
  {
    key: 'priorities',
    title: 'What matters most to me',
    type: 'text',
    placeholder: 'In a sentence or two, what would make this feel right for you?',
  },
  {
    key: 'support',
    title: 'Support & environment',
    type: 'select',
    options: [
      'Partner with me throughout',
      'Doula present',
      'Dim, calm lighting',
      'My own music or playlist',
      'Minimal interruptions',
      'Photos or video welcome',
      'Quiet voices around me',
    ],
  },
  {
    key: 'pain',
    title: 'Comfort & pain relief',
    type: 'select',
    options: [
      'Open to all options',
      'Prefer unmedicated if possible',
      'Epidural',
      'Gas and air / nitrous',
      'Water or birth pool',
      'Massage & counter-pressure',
      'Freedom to move for comfort',
      'Please ask me in the moment',
    ],
  },
  {
    key: 'labor',
    title: 'During labor',
    type: 'select',
    options: [
      'Freedom to move around',
      'Intermittent monitoring if possible',
      'Stay hydrated / snacks if allowed',
      'Use a birth ball',
      'As few vaginal exams as possible',
      'Explain interventions before they happen',
    ],
  },
  {
    key: 'delivery',
    title: 'Pushing & delivery',
    type: 'select',
    options: [
      'Whatever position feels right',
      'Upright or squatting',
      'A mirror to see baby arrive',
      'Partner announces the sex',
      'Tear naturally rather than an episiotomy if possible',
      'Follow my body rather than directed pushing',
    ],
  },
  {
    key: 'afterbirth',
    title: 'Right after birth',
    type: 'select',
    options: [
      'Immediate skin-to-skin',
      'Delayed cord clamping',
      'Partner cuts the cord',
      'Delay weighing for the first cuddle',
      'Keep the placenta',
    ],
  },
  {
    key: 'feeding',
    title: 'Feeding',
    type: 'select',
    options: [
      'Breastfeed',
      'Formula feed',
      'Combination feeding',
      'Lactation support, please',
      'Ask before any formula or pacifier',
    ],
  },
  {
    key: 'newborn',
    title: 'Newborn care',
    type: 'select',
    options: [
      'Vitamin K injection',
      'Discuss vitamin K options first',
      'Eye ointment',
      'Delay the first bath',
      'We\u2019d like to be present for exams',
      'Discuss vaccine timing',
    ],
  },
  {
    key: 'cesarean',
    title: 'If a cesarean is needed',
    type: 'select',
    options: [
      'Partner present',
      'Lower the screen so I can watch',
      'Skin-to-skin in the operating room',
      'Explain each step as it happens',
      'Calm, quiet environment',
    ],
  },
  {
    key: 'notes',
    title: 'Anything else',
    type: 'text',
    placeholder: 'Other wishes, worries, or notes for the team\u2026',
  },
];

const HOSPITAL_BAG = [
  {
    group: 'For you',
    items: [
      'Photo ID and hospital paperwork',
      'Insurance / maternity notes',
      'A copy of your birth plan',
      'Comfortable going-home outfit',
      'Robe, slippers, warm socks',
      'Toiletries and lip balm',
      'Phone and a long charger',
      'Snacks and a water bottle',
      'Nursing bras',
      'Maternity pads',
      'Hair ties',
      'Your own pillow',
    ],
  },
  {
    group: 'For your partner',
    items: [
      'Snacks and drinks',
      'Change of clothes',
      'Phone and charger',
      'Toiletries',
      'Cash or cards',
    ],
  },
  {
    group: 'For baby',
    items: [
      'Going-home outfit',
      'Swaddle or blanket',
      'Hat, socks, and mittens',
      'Installed, rear-facing car seat',
      'Newborn diapers',
      'A few muslin cloths',
    ],
  },
];
