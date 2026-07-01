// birthPlan.js — content for the Birth plan tool: sections, common choices,
// balanced "why it matters" notes, easy-to-forget reminders, and encouragement.

const BIRTH_PLAN = {
  encouragement:
    'A birth plan is a compass, not a contract. It tells your team what matters ' +
    'to you \u2014 but birth is unpredictable, and staying flexible is a strength, ' +
    'not a failure. Your body was built for this, you\u2019ll be surrounded by ' +
    'people whose job is to keep you and your baby safe, and there\u2019s no single ' +
    'right way to bring a baby into the world. However your birth unfolds, you are ' +
    'strong enough for it \u2014 and at the end of it, you meet your baby.',

  disclaimer:
    'This is general information to help you think things through and talk with ' +
    'your care team \u2014 not medical advice. Every pregnancy is different, so ' +
    'discuss your choices with your provider.',

  sections: [
    {
      id: 'atmosphere',
      title: 'Atmosphere & support',
      blurb: 'Who\u2019s with you, and the feel of the room.',
      options: [
        { id: 'a-support', label: 'My partner or support person stays with me throughout' },
        { id: 'a-doula', label: 'My doula is present' },
        { id: 'a-calm', label: 'Keep the room calm \u2014 low voices, few interruptions' },
        { id: 'a-dim', label: 'Dim the lights' },
        { id: 'a-music', label: 'My own music or playlist' },
        { id: 'a-clothes', label: 'Freedom to wear my own clothes' },
        { id: 'a-photos', label: 'Photos and video are welcome' },
        { id: 'a-ask', label: 'Please explain things before doing them, and ask before exams' },
      ],
    },
    {
      id: 'labor',
      title: 'Labor, comfort & pain relief',
      blurb:
        'How you\u2019d like to handle labor and pain. It\u2019s completely normal ' +
        'to change your mind \u2014 it can help to note a plan A and a plan B.',
      options: [
        { id: 'l-move', label: 'Freedom to move and change positions' },
        { id: 'l-ball', label: 'Access to a birth ball' },
        { id: 'l-water', label: 'Use a shower or tub for comfort' },
        {
          id: 'l-eat',
          label: 'Eat and drink lightly as I choose',
          info:
            'Many hospitals limit food during labor in case anesthesia is needed, ' +
            'but light snacks and fluids are increasingly supported for low-risk ' +
            'labors. Ask what your birth place allows.',
        },
        {
          id: 'l-intermittent',
          label: 'Intermittent monitoring so I can move',
          info:
            'Continuous monitoring watches baby every second and matters for ' +
            'higher-risk labors, but for low-risk labors it can keep you in bed and ' +
            'is linked to more interventions without better outcomes. Intermittent ' +
            'checks still keep an eye on baby while letting you move.',
        },
        {
          id: 'l-lock',
          label: 'A saline lock instead of continuous IV fluids',
          info:
            'A capped IV keeps a line ready for emergencies while leaving you free ' +
            'to move. Continuous fluids may be recommended if you\u2019re dehydrated, ' +
            'having an epidural, or may need medication.',
        },
        { id: 'l-unmed', label: 'I\u2019m planning an unmedicated birth \u2014 please don\u2019t offer meds, I\u2019ll ask' },
        {
          id: 'l-nitrous',
          label: 'Nitrous oxide (laughing gas) available',
          info:
            'You breathe it during contractions and control it yourself; it takes ' +
            'the edge off and clears within minutes. It doesn\u2019t remove pain ' +
            'completely and can cause nausea or lightheadedness.',
        },
        {
          id: 'l-iv-meds',
          label: 'IV pain medication if I ask',
          info:
            'Opioid medication can take the edge off and help you rest, but it can ' +
            'make you drowsy and, given close to delivery, may briefly affect ' +
            'baby\u2019s breathing \u2014 so it\u2019s usually avoided near pushing.',
        },
        {
          id: 'l-epidural',
          label: 'I\u2019d like an epidural (now, or when I ask)',
          info:
            'The most effective pain relief, and it lets you rest. It limits ' +
            'mobility, needs continuous monitoring and usually a catheter, can lower ' +
            'your blood pressure, and is linked to a somewhat higher chance of a ' +
            'vacuum- or forceps-assisted birth. It does not raise your chance of a ' +
            'C-section.',
        },
        { id: 'l-comfort', label: 'Hands-on comfort \u2014 massage, counter-pressure, warm compresses' },
        {
          id: 'l-augment',
          label: 'Let labor progress on its own; avoid Pitocin unless needed',
          info:
            'Pitocin can restart a stalled labor, but contractions may become ' +
            'stronger and closer together, which can increase the need for pain ' +
            'relief and requires continuous monitoring.',
        },
        {
          id: 'l-arom',
          label: 'Avoid breaking my water unless there\u2019s a reason',
          info:
            'Breaking the water may shorten labor, but it starts a clock (infection ' +
            'risk rises the longer it\u2019s broken), contractions often intensify, ' +
            'and there\u2019s a small risk of cord problems.',
        },
        { id: 'l-exams', label: 'Keep vaginal exams to a minimum' },
      ],
    },
    {
      id: 'pushing',
      title: 'Pushing & delivery',
      blurb: 'Bringing baby into the world.',
      options: [
        { id: 'p-position', label: 'Push in whatever position feels right (upright, side-lying, hands & knees)' },
        {
          id: 'p-spontaneous',
          label: 'Follow my own urge to push rather than coached counting',
          info:
            'Pushing with your body\u2019s urges (rather than being told to hold ' +
            'your breath and push to a count) can be less exhausting and gentler on ' +
            'the pelvic floor. Coached pushing may be used if baby needs to be born ' +
            'quickly.',
        },
        {
          id: 'p-perineal',
          label: 'Warm compresses and perineal support to reduce tearing',
          info:
            'Warm compresses and hands-on support as baby crowns can lower the ' +
            'chance of a serious tear.',
        },
        {
          id: 'p-episiotomy',
          label: 'Avoid an episiotomy unless truly necessary',
          info:
            'An episiotomy is a surgical cut to widen the opening. Routine use ' +
            'is no longer recommended \u2014 it doesn\u2019t prevent tearing and can ' +
            'lead to a deeper injury with longer healing. It\u2019s occasionally ' +
            'needed to speed delivery or for an assisted birth.',
        },
        { id: 'p-mirror', label: 'I\u2019d like a mirror to see baby crowning' },
        { id: 'p-partner-catch', label: 'My partner wants to help catch baby or be hands-on' },
        {
          id: 'p-delayed-cord',
          label: 'Delay cord clamping until it stops pulsing',
          info:
            'Waiting 30\u201360+ seconds lets more blood and iron pass to baby ' +
            '(helpful for iron stores, especially in preemies). It slightly raises ' +
            'the chance of newborn jaundice and usually isn\u2019t compatible with ' +
            'cord blood banking.',
        },
        { id: 'p-partner-cut', label: 'My partner would like to cut the cord' },
        { id: 'p-skin', label: 'Baby straight onto my chest \u2014 immediate skin-to-skin' },
        {
          id: 'p-assist',
          label: 'If help is needed, talk me through vacuum/forceps options first',
          info:
            'A vacuum or forceps can help baby out quickly if you\u2019re exhausted ' +
            'or baby is in distress, avoiding a C-section, but they carry a higher ' +
            'chance of tearing and temporary marks or bruising on baby.',
        },
      ],
    },
    {
      id: 'cesarean',
      title: 'If a C-section is needed',
      blurb:
        'Worth filling in even if you\u2019re planning a vaginal birth \u2014 ' +
        'sometimes plans change, and having your preferences ready helps you feel ' +
        'in control if they do.',
      options: [
        { id: 'c-explain', label: 'Talk me through what\u2019s happening as it happens' },
        { id: 'c-partner', label: 'My partner stays with me the whole time' },
        {
          id: 'c-drape',
          label: 'Lower the drape or use a clear drape so I can see baby born',
          info:
            'A \u201cgentle\u201d or family-centered cesarean can include a clear ' +
            'drape, slower delivery, and skin-to-skin in the OR when you and baby ' +
            'are stable \u2014 making a surgical birth feel more connected.',
        },
        { id: 'c-skin', label: 'Skin-to-skin in the OR if baby and I are stable' },
        { id: 'c-delayed-cord', label: 'Delayed cord clamping if possible' },
        { id: 'c-hand', label: 'Keep a hand free (not both arms strapped) for skin-to-skin' },
        { id: 'c-together', label: 'Keep baby with me or my partner during recovery' },
      ],
    },
    {
      id: 'newborn',
      title: 'Baby\u2019s first hour & newborn care',
      blurb: 'The \u201cgolden hour\u201d and the routine steps for baby.',
      options: [
        { id: 'n-goldenhour', label: 'Uninterrupted skin-to-skin \u2014 delay routine procedures a bit' },
        { id: 'n-delayweigh', label: 'Delay weighing and measuring until after the first feed' },
        { id: 'n-breastfeed', label: 'I plan to breastfeed \u2014 help getting started, please' },
        { id: 'n-lactation', label: 'I\u2019d like lactation / feeding support' },
        { id: 'n-formula', label: 'I plan to formula or combo feed \u2014 please support my choice' },
        { id: 'n-nopacifier', label: 'If breastfeeding, no formula or pacifier without asking me first' },
        {
          id: 'n-bath',
          label: 'Delay baby\u2019s first bath',
          info:
            'Waiting a day or so to bathe keeps baby warmer, protects the skin\u2019s ' +
            'natural coating (vernix), and can help breastfeeding and blood-sugar ' +
            'stability.',
        },
        {
          id: 'n-vitk',
          label: 'Vitamin K for baby \u2014 injection (note your choice)',
          info:
            'A single injection prevents a rare but serious bleeding disorder ' +
            '(VKDB). An oral version exists but is less reliable and needs repeat ' +
            'doses; declining raises the risk of dangerous bleeding. Discuss with ' +
            'your provider.',
        },
        {
          id: 'n-eye',
          label: 'Eye ointment \u2014 give or decline (note your choice)',
          info:
            'Antibiotic eye ointment prevents serious eye infection from bacteria ' +
            'passed during birth. Some low-risk families decline, but it\u2019s ' +
            'required by law in some states.',
        },
        { id: 'n-hepb', label: 'Hepatitis B vaccine \u2014 give at birth or delay' },
        { id: 'n-rooming', label: 'Baby stays in my room (rooming-in)' },
        {
          id: 'n-circ',
          label: 'Circumcision (if a boy): yes / no / decide later',
          info:
            'A personal decision shaped by culture, religion, and preference. If ' +
            'you choose it, ask about pain relief for baby and timing, and discuss ' +
            'the risks and benefits with your provider.',
        },
        {
          id: 'n-cord-blood',
          label: 'Bank or donate cord blood',
          info:
            'Cord blood can be banked privately or donated publicly for possible ' +
            'future medical use. It has to be arranged ahead of time and usually ' +
            'means clamping the cord sooner.',
        },
      ],
    },
    {
      id: 'postpartum',
      title: 'You after birth',
      blurb: 'Your recovery and the first hours as a new family.',
      options: [
        {
          id: 'pp-placenta-active',
          label: 'Active management of the placenta (Pitocin injection)',
          info:
            'A quick Pitocin injection after birth helps deliver the placenta and ' +
            'reduces heavy bleeding. A natural (physiological) delivery avoids the ' +
            'medication but carries a somewhat higher bleeding risk.',
        },
        { id: 'pp-placenta-keep', label: 'I\u2019d like to see or keep my placenta' },
        { id: 'pp-bonding', label: 'Protected bonding time \u2014 keep us together' },
        { id: 'pp-feeding-help', label: 'Hands-on help with breastfeeding positioning' },
        { id: 'pp-pain', label: 'Keep me comfortable \u2014 stay on top of my pain relief' },
        { id: 'pp-visitors', label: 'My rules on visitors (note them below)' },
        { id: 'pp-quiet', label: 'Quiet time for just us before guests' },
      ],
    },
  ],

  forgotten: [
    'A plan for if a C-section becomes necessary \u2014 not just the birth you\u2019re hoping for.',
    'Your own recovery and postpartum preferences, not only the birth itself.',
    'A \u201cplan B\u201d for pain relief, in case you change your mind in the moment (totally normal).',
    'Who speaks for you if you can\u2019t \u2014 name your decision-maker.',
    'Timing and consent for newborn procedures (weighing, bath, vitamin K, eye ointment).',
    'A feeding plan, and asking for lactation help early.',
    'Photos and video consent, and who cuts the cord.',
    'What you\u2019d want if baby needs the NICU.',
    'A line saying you\u2019re flexible and safety comes first \u2014 it takes pressure off everyone.',
    'The practical stuff: hospital bag packed, car seat installed, care lined up for pets or older kids.',
  ],
};
