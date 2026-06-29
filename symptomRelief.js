// symptomRelief.js
// Gentle, general comfort measures for common pregnancy symptoms, plus guidance
// about baby movements. These are everyday self-care ideas, not medical advice
// or treatment. Where a symptom can sometimes signal something that needs
// attention, a "whenToCall" note is included. Sources: ACOG, Mayo Clinic, NHS.

const SYMPTOM_RELIEF = {
  Nausea: {
    tips: [
      'Eat small amounts often instead of large meals, so your stomach is never empty.',
      'Keep plain crackers by the bed and nibble a few before getting up.',
      'Try ginger — tea, ginger ale, or candied ginger.',
      'Sip fluids steadily through the day rather than a lot at once.',
      'Notice your triggers (smells, foods) and go easy on them.',
    ],
    whenToCall:
      'If you can\u2019t keep fluids down, are losing weight, or feel very unwell, contact your provider \u2014 there is safe help for severe nausea.',
  },
  Fatigue: {
    tips: [
      'Rest when you can, even a short 20-minute nap.',
      'Go easy on yourself \u2014 first-trimester tiredness is your body working hard.',
      'Gentle movement like a short walk can lift energy.',
      'Iron-rich foods may help; ask your provider before any supplement.',
    ],
  },
  Headache: {
    tips: [
      'Drink water \u2014 mild dehydration is a common trigger.',
      'Eat regularly to keep blood sugar steady.',
      'Rest in a quiet, dim room and try a cool compress.',
      'Watch posture and take screen breaks.',
    ],
    whenToCall:
      'A severe or persistent headache \u2014 especially with vision changes, swelling, or upper-belly pain \u2014 can signal high blood pressure. Contact your provider.',
  },
  Heartburn: {
    tips: [
      'Eat smaller, more frequent meals.',
      'Avoid spicy, fatty, or acidic foods if they set it off.',
      'Stay upright for an hour or so after eating; don\u2019t lie down right away.',
      'Prop your head and shoulders up when resting.',
      'Ask your provider which antacids are right for you.',
    ],
  },
  'Back pain': {
    tips: [
      'Sleep on your side with a pillow between your knees.',
      'A body pillow can take pressure off your back and hips.',
      'Keep good posture and wear supportive, low shoes.',
      'Try gentle prenatal stretches or a warm (not hot) compress.',
      'Avoid heavy lifting; bend at the knees.',
    ],
    whenToCall:
      'Severe, sudden, or rhythmic lower-back pain \u2014 or back pain with bleeding or fluid \u2014 should be checked by your provider.',
  },
  Cramping: {
    tips: [
      'Mild stretching cramps are common as ligaments stretch.',
      'Change position slowly and rest.',
      'Stay hydrated and try a warm bath.',
    ],
    whenToCall:
      'Call your provider if cramping is severe, regular, or comes with bleeding, fluid, or reduced baby movement.',
  },
  Swelling: {
    tips: [
      'Put your feet up when you can, and rest on your left side.',
      'Stay well hydrated \u2014 it actually helps reduce fluid retention.',
      'Wear comfortable shoes and avoid standing for long stretches.',
      'Gentle movement and ankle circles keep circulation going.',
    ],
    whenToCall:
      'Sudden or severe swelling in your face or hands, or swelling with headache or vision changes, needs prompt attention \u2014 contact your provider.',
  },
  Insomnia: {
    tips: [
      'Keep a consistent wind-down routine.',
      'A body pillow and side sleeping can make you more comfortable.',
      'Limit screens and caffeine later in the day.',
      'Try slow breathing or a warm bath before bed.',
      'If you\u2019re wide awake, rest your body even if sleep doesn\u2019t come.',
    ],
  },
  Cravings: {
    tips: [
      'Cravings are normal \u2014 enjoy treats in reasonable amounts.',
      'Pair a craving with something nourishing where you can.',
      'Stay hydrated; thirst can masquerade as hunger.',
    ],
    whenToCall:
      'Cravings for non-food items (ice, chalk, dirt) can signal a deficiency \u2014 mention it to your provider.',
  },
  Constipation: {
    tips: [
      'Build up fiber gradually \u2014 fruit, vegetables, whole grains.',
      'Drink plenty of water through the day.',
      'Gentle, regular activity helps things move.',
      'Ask your provider about safe options if it persists.',
    ],
  },
  Dizziness: {
    tips: [
      'Stand up slowly from sitting or lying down.',
      'Eat regularly and stay hydrated.',
      'Rest on your left side rather than flat on your back.',
      'Avoid getting overheated.',
    ],
    whenToCall:
      'Fainting, or dizziness with a racing heart, bleeding, or belly pain, should be checked promptly by your provider.',
  },
  Congestion: {
    tips: [
      'A "stuffy" nose is common in pregnancy (pregnancy rhinitis).',
      'Try a humidifier and saline spray or rinse.',
      'Stay hydrated and prop your head up at night.',
    ],
  },
  Emotional: {
    tips: [
      'Big feelings are normal \u2014 be gentle with yourself.',
      'Talk to someone you trust about how you\u2019re doing.',
      'Rest, gentle movement, and time outdoors can steady things.',
    ],
  },
  Anxious: {
    tips: [
      'Try slow breathing: in for four, out for six.',
      'Share what\u2019s on your mind with someone close.',
      'Limit doom-scrolling; gentle movement and routine help.',
    ],
    whenToCall:
      'If anxiety is frequent or overwhelming, you\u2019re not alone \u2014 please reach out to your provider. Perinatal mental-health support is available and effective.',
  },
  Irritable: {
    tips: [
      'Hormones can shorten the fuse \u2014 it\u2019s not a failing.',
      'Step away for a breather when you can.',
      'Protect rest and downtime; tiredness makes everything harder.',
    ],
  },
  Overwhelmed: {
    tips: [
      'Pick one small next thing rather than the whole list.',
      'Accept help when it\u2019s offered, and ask when it isn\u2019t.',
      'Rest is productive right now, too.',
    ],
    whenToCall:
      'If you often feel unable to cope, please talk to your provider \u2014 support helps, and reaching out is a strength.',
  },
  Foggy: {
    tips: [
      '"Pregnancy brain" is real and temporary.',
      'Lean on lists, reminders, and notes (this app included).',
      'Protect sleep where you can \u2014 it sharpens focus.',
    ],
  },
};

// What early movements feel like and how to think about them.
const MOVEMENT_INFO = {
  whatItFeelsLike:
    'First movements \u2014 sometimes called "quickening" \u2014 often arrive around ' +
    '16 to 25 weeks. Early on they can feel like flutters, bubbles, popcorn, or a ' +
    'light swishing, and they come and go. If this is your first pregnancy, you may ' +
    'notice them a little later. Over the weeks they grow into stronger, more ' +
    'regular kicks and rolls.',
  whenToCount:
    'Getting to know your baby\u2019s usual pattern matters more than any exact number. ' +
    'Movements become more predictable later in pregnancy, so dedicated counting is ' +
    'usually more useful then. A good time is when your baby is normally active \u2014 ' +
    'often after a meal or when you\u2019re resting on your left side.',
  warning:
    'If your baby is moving less than usual, the pattern changes a lot, or you\u2019re ' +
    'simply worried, contact your provider or maternity unit right away \u2014 do not ' +
    'wait until tomorrow, and do not rely on this app to reassure you. Trust your ' +
    'instincts; they would always rather hear from you.',
};

function reliefFor(label) {
  return SYMPTOM_RELIEF[label] || null;
}
