// birthPlan.js — content for the Birth plan tool. Each stage carries reflective
// questions (the "?" prompt), a curated set of options grouped into common,
// also-consider, and easy-to-forget, plus balanced "why it matters" notes on the
// medical choices. Includes an emotional-readiness stage and a practical checklist.
// Educational only; not medical advice.

const BIRTH_PLAN = {
  intro:
    'A birth plan is a compass, not a contract. Think of it in three layers: your ' +
    'preferences (what you’re hoping for), your priorities (what matters most), and ' +
    'your back-up choices (what helps if things change). It isn’t a test you can ' +
    'fail — it’s a way to walk in informed, heard, and ready for whatever the day ' +
    'brings. Your body knows how to do this, and you won’t be doing it alone.',

  disclaimer:
    'General information to help you think things through and talk with your care ' +
    'team — not medical advice. Every pregnancy is different, so discuss your choices ' +
    'with your provider and check what your birth place allows.',

  sections: [
    {
      id: 'atmosphere',
      title: 'Support & the room',
      blurb: 'Who’s with you, and how the space feels.',
      questions: [
        'Who do you most want in the room — and is there anyone you’d rather not have?',
        'Do you want the space calm and dim, or bright and lively?',
        'When it gets hard, do you want to be talked through it, or left to focus inward?',
        'How do you feel about students or observers being present?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'a-support', label: 'My partner or support person stays with me throughout' },
            { id: 'a-doula', label: 'My doula is present' },
            { id: 'a-calm', label: 'Keep the room calm — low voices, few people' },
            { id: 'a-dim', label: 'Dim the lights' },
            { id: 'a-music', label: 'My own music or playlist' },
            { id: 'a-move', label: 'Freedom to move around during labor' },
            { id: 'a-photos', label: 'Photos and video are welcome' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'a-clothes', label: 'My own clothes or gown instead of a hospital one' },
            { id: 'a-glasses', label: 'Let me keep my glasses or contacts on' },
            { id: 'a-ask', label: 'Explain things before doing them, and ask before exams' },
            { id: 'a-name', label: 'Use my name and encourage me between contractions' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'a-students', label: 'My preference on students or observers being present' },
            {
              id: 'a-nooffer',
              label: 'Please don’t offer pain medication — I’ll ask if I want it',
              info:
                'If you’re aiming for an unmedicated birth, being offered meds can make it ' +
                'harder to stay focused. Noting it here tells your team to wait for you to ask.',
            },
            {
              id: 'a-words',
              label: 'Use words like “pressure” or “power” instead of “pain”',
              info:
                'Language shapes experience. Reframing sensations as intensity or pressure ' +
                'rather than pain can quiet the fear-tension-pain loop for some people.',
            },
            { id: 'a-noprogress', label: 'Keep it positive — don’t announce my dilation numbers unless I ask' },
            { id: 'a-candles', label: 'Battery candles or string lights for a calmer space' },
            { id: 'a-scent', label: 'Aromatherapy or my own scent, if allowed' },
          ],
        },
      ],
    },

    {
      id: 'labor',
      title: 'Labor & comfort',
      blurb: 'How you’d like to cope, and where you land on pain relief. It’s completely normal to change your mind — a Plan A and a Plan B both belong here.',
      questions: [
        'What’s your Plan A for coping with contractions — and your Plan B if it’s more than expected?',
        'How do you feel about pain medication: a firm no, a firm yes, or keeping your options open?',
        'What’s helped you get through intense or uncomfortable things before?',
        'How will you signal you’ve changed your mind — a word, a gesture?',
      ],
      groups: [
        {
          label: 'Comfort & movement',
          options: [
            { id: 'l-move', label: 'Freedom to move and change positions' },
            { id: 'l-ball', label: 'A birth ball or peanut ball' },
            { id: 'l-water', label: 'A shower or tub for comfort' },
            { id: 'l-comfort', label: 'Hands-on comfort — massage, counter-pressure, warm compresses' },
            {
              id: 'l-eat',
              label: 'Eat and drink lightly as I choose',
              info:
                'Many hospitals limit food during labor in case anesthesia is needed, but light ' +
                'snacks and fluids are increasingly supported for low-risk labors. Ask what yours allows.',
            },
            {
              id: 'l-intermittent',
              label: 'Intermittent monitoring so I can move',
              info:
                'Continuous monitoring watches baby every second and matters for higher-risk labors, ' +
                'but for low-risk labors it can keep you in bed and is linked to more interventions ' +
                'without better outcomes. Intermittent checks still watch baby while letting you move.',
            },
            {
              id: 'l-lock',
              label: 'A saline lock instead of continuous IV fluids',
              info:
                'A capped IV keeps a line ready for emergencies while leaving you free to move. ' +
                'Continuous fluids may be recommended if you’re dehydrated, having an epidural, or may need medication.',
            },
          ],
        },
        {
          label: 'Pain relief — my approach',
          options: [
            { id: 'l-unmed', label: 'Planning unmedicated — please don’t offer meds, I’ll ask' },
            { id: 'l-breathing', label: 'Breathing, relaxation, or hypnobirthing tracks' },
            { id: 'l-tens', label: 'A TENS unit' },
            {
              id: 'l-nitrous',
              label: 'Nitrous oxide (laughing gas) available',
              info:
                'You breathe it during contractions and control it yourself; it takes the edge off and ' +
                'clears within minutes. It doesn’t remove pain completely and can cause nausea or lightheadedness.',
            },
            {
              id: 'l-ivmeds',
              label: 'IV pain medication if I ask',
              info:
                'Opioid medication can take the edge off and help you rest, but it can make you drowsy ' +
                'and, given close to delivery, may briefly affect baby’s breathing — so it’s usually avoided near pushing.',
            },
            {
              id: 'l-epidural',
              label: 'An epidural — now, or when I ask',
              info:
                'The most effective pain relief, and it lets you rest. It limits mobility, needs continuous ' +
                'monitoring and usually a catheter, can lower your blood pressure, and is linked to a somewhat ' +
                'higher chance of a vacuum- or forceps-assisted birth. It does not raise your chance of a C-section.',
            },
          ],
        },
        {
          label: 'If interventions come up',
          options: [
            {
              id: 'l-augment',
              label: 'Let labor progress on its own; avoid Pitocin unless needed',
              info:
                'Pitocin can restart a stalled labor, but contractions may become stronger and closer ' +
                'together, which can increase the need for pain relief and requires continuous monitoring.',
            },
            {
              id: 'l-arom',
              label: 'Avoid breaking my water unless there’s a reason',
              info:
                'Breaking the water may shorten labor, but it starts a clock (infection risk rises the ' +
                'longer it’s broken), contractions often intensify, and there’s a small risk of cord problems.',
            },
            { id: 'l-induction', label: 'Talk me through any induction or augmentation first' },
            { id: 'l-exams', label: 'Keep vaginal exams to a minimum' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'l-planb', label: 'A clear Plan B for pain relief if I change my mind (totally normal)' },
            { id: 'l-codeword', label: 'A code word for “I really want the epidural now”' },
            { id: 'l-stall', label: 'Suggest position changes if labor stalls' },
            { id: 'l-packs', label: 'Warm or cold packs, and my own pillow or blanket' },
            { id: 'l-affirm', label: 'Read my birth affirmations to me when it’s hard' },
          ],
        },
      ],
    },

    {
      id: 'pushing',
      title: 'Pushing & birth',
      blurb: 'Bringing your baby into the world.',
      questions: [
        'Who do you want to catch the baby, or to announce the sex?',
        'How do you feel about a mirror, or reaching down to touch your baby as they’re born?',
        'What matters most in the very first moment you meet your baby?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'p-position', label: 'Push in whatever position feels right (upright, side-lying, hands & knees, squat)' },
            {
              id: 'p-spontaneous',
              label: 'Follow my own urge to push rather than coached counting',
              info:
                'Pushing with your body’s urges (rather than holding your breath and pushing to a count) ' +
                'can be less exhausting and gentler on the pelvic floor. Coached pushing may be used if baby needs to come quickly.',
            },
            {
              id: 'p-perineal',
              label: 'Warm compresses and perineal support to reduce tearing',
              info: 'Warm compresses and hands-on support as baby crowns can lower the chance of a serious tear.',
            },
            {
              id: 'p-episiotomy',
              label: 'Avoid an episiotomy unless truly necessary',
              info:
                'An episiotomy is a surgical cut to widen the opening. Routine use is no longer recommended — ' +
                'it doesn’t prevent tearing and can lead to a deeper injury with longer healing. It’s occasionally ' +
                'needed to speed delivery or for an assisted birth.',
            },
            { id: 'p-skin', label: 'Baby straight onto my chest — immediate skin-to-skin' },
            {
              id: 'p-delayedcord',
              label: 'Delay cord clamping until it stops pulsing',
              info:
                'Waiting 30–60+ seconds lets more blood and iron pass to baby (helpful for iron stores, ' +
                'especially in preemies). It slightly raises the chance of newborn jaundice and usually isn’t compatible with cord blood banking.',
            },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'p-mirror', label: 'A mirror to see baby crowning' },
            { id: 'p-reach', label: 'Let me reach down and help lift my baby up' },
            { id: 'p-catch', label: 'My partner helps catch the baby' },
            { id: 'p-cut', label: 'My partner cuts the cord' },
            { id: 'p-announce', label: 'Let me or my partner announce the sex' },
            {
              id: 'p-assist',
              label: 'If help is needed, talk me through vacuum or forceps first',
              info:
                'A vacuum or forceps can help baby out quickly if you’re exhausted or baby is in distress, ' +
                'avoiding a C-section, but they carry a higher chance of tearing and temporary marks or bruising on baby.',
            },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'p-notime', label: 'No time limit on pushing if baby and I are doing fine' },
            { id: 'p-labordown', label: 'Let me rest and “labor down” before pushing if baby isn’t crowning yet' },
            {
              id: 'p-cordblood',
              label: 'Cord blood or tissue banking is arranged',
              info: 'Cord blood can be banked privately or donated publicly for possible future medical use. ' +
                'It has to be arranged ahead of time and usually means clamping the cord sooner.',
            },
          ],
        },
      ],
    },

    {
      id: 'cesarean',
      title: 'If plans change',
      blurb: 'Worth filling in even for a planned vaginal birth — feeling ready for a change is its own kind of calm. Your preferences still matter in the OR.',
      questions: [
        'If a C-section became necessary, what would help you still feel present and in control?',
        'What matters most to you regardless of how the birth happens?',
        'Who makes decisions with your team if you can’t speak for yourself?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'c-explain', label: 'Talk me through what’s happening as it happens' },
            { id: 'c-partner', label: 'My partner stays with me the whole time' },
            {
              id: 'c-drape',
              label: 'A clear or lowered drape so I can see baby born',
              info:
                'A “gentle” or family-centered cesarean can include a clear drape, slower delivery, and ' +
                'skin-to-skin in the OR when you and baby are stable — making a surgical birth feel more connected.',
            },
            { id: 'c-skin', label: 'Skin-to-skin in the OR if baby and I are stable' },
            { id: 'c-delayedcord', label: 'Delayed cord clamping if possible' },
            { id: 'c-together', label: 'Keep baby with me or my partner during recovery' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'c-hand', label: 'Keep one hand or arm free (not both strapped) for skin-to-skin' },
            { id: 'c-glasses', label: 'Let me keep my glasses on' },
            { id: 'c-calm', label: 'Keep the room calm and explain before touching' },
            { id: 'c-feed', label: 'Help me breastfeed in recovery as soon as possible' },
            { id: 'c-doula', label: 'My doula or a second support person in the OR, if allowed' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'c-whowith', label: 'Who goes with the baby if we’re separated' },
            { id: 'c-narrate', label: 'Narrate as baby is born, even behind the drape' },
            { id: 'c-photos', label: 'Photos of the birth and first moments in the OR' },
            { id: 'c-still', label: 'My birth preferences still apply — please glance at them' },
          ],
        },
      ],
    },

    {
      id: 'newborn',
      title: 'Baby’s first hour & care',
      blurb: 'The “golden hour” and the routine newborn steps.',
      questions: [
        'Do you want the first hour uninterrupted, or the routine procedures done and dusted?',
        'Have you decided on vitamin K, eye ointment, hepatitis B, and (if a boy) circumcision?',
        'If baby needs extra care, who goes with them?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'n-golden', label: 'Uninterrupted skin-to-skin — delay routine procedures (the “golden hour”)' },
            { id: 'n-weigh', label: 'Delay weighing and measuring until after the first feed' },
            { id: 'n-bedside', label: 'Newborn checks done on my chest or at the bedside' },
            { id: 'n-rooming', label: 'Rooming-in — baby stays in my room' },
            {
              id: 'n-bath',
              label: 'Delay baby’s first bath',
              info:
                'Waiting a day or so keeps baby warmer, protects the skin’s natural coating (vernix), ' +
                'and can help breastfeeding and blood-sugar stability.',
            },
          ],
        },
        {
          label: 'Procedures — note your choice',
          options: [
            {
              id: 'n-vitk',
              label: 'Vitamin K — injection',
              info:
                'A single injection prevents a rare but serious bleeding disorder (VKDB). An oral version ' +
                'exists but is less reliable and needs repeat doses; declining raises the risk of dangerous bleeding.',
            },
            {
              id: 'n-eye',
              label: 'Eye ointment — give or decline',
              info:
                'Antibiotic eye ointment prevents serious eye infection from bacteria passed during birth. ' +
                'Some low-risk families decline, but it’s required by law in some states.',
            },
            { id: 'n-hepb', label: 'Hepatitis B vaccine — at birth or delay' },
            {
              id: 'n-circ',
              label: 'Circumcision (if a boy): yes / no / decide later',
              info:
                'A personal decision shaped by culture, religion, and preference. If you choose it, ask about ' +
                'pain relief for baby and timing, and discuss the risks and benefits with your provider.',
            },
            {
              id: 'n-cordblood',
              label: 'Bank or donate cord blood',
              info: 'Arranged ahead of time; it usually means clamping the cord sooner.',
            },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'n-partnerskin', label: 'If I can’t hold baby, my partner does skin-to-skin' },
            { id: 'n-accompany', label: 'Who accompanies baby if they go to the nursery or NICU' },
            { id: 'n-eyelater', label: 'Delay eye ointment until after we’ve bonded (not skip)' },
            { id: 'n-screening', label: 'Timing of newborn screening and the hearing test' },
            { id: 'n-partnerthere', label: 'My partner is present for all procedures' },
          ],
        },
      ],
    },

    {
      id: 'feeding',
      title: 'Feeding',
      blurb: 'Your feeding hope — and how you want to be supported if it’s harder than expected.',
      questions: [
        'What’s your feeding hope, and how do you want to be supported if it doesn’t come easily?',
        'How do you feel about pacifiers or supplementing in the early days?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'f-breast', label: 'I plan to breastfeed — help me get started' },
            { id: 'f-lactation', label: 'Lactation or feeding support, please' },
            { id: 'f-formula', label: 'I plan to formula or combo feed — please support my choice' },
            { id: 'f-skin', label: 'Skin-to-skin to encourage feeding' },
            { id: 'f-demand', label: 'Feed on demand' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'f-noask', label: 'No formula, sugar water, or pacifier without asking me first' },
            { id: 'f-hardplan', label: 'If breastfeeding is hard, I want a clear support plan' },
            { id: 'f-pump', label: 'Help me pump or hand-express if baby and I are separated' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'f-donor', label: 'Donor milk — okay or not okay if supplementing is needed' },
            { id: 'f-nobottle', label: 'Avoid bottles or artificial nipples early (cup or syringe if needed)' },
          ],
        },
      ],
    },

    {
      id: 'postpartum',
      title: 'My recovery',
      blurb: 'You, not just the baby. The first hours and days matter for your healing too.',
      questions: [
        'Who is looking after YOU — not just the baby — in the first days?',
        'What would make the hospital stay and first week at home feel supported?',
        'What signs would you want someone watching for in your mood?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            {
              id: 'pp-placenta',
              label: 'Active management of the placenta (Pitocin injection)',
              info:
                'A quick Pitocin injection after birth helps deliver the placenta and reduces heavy bleeding. ' +
                'A natural (physiological) delivery avoids the medication but carries a somewhat higher bleeding risk.',
            },
            { id: 'pp-bonding', label: 'Protected bonding time — keep us together' },
            { id: 'pp-feedhelp', label: 'Hands-on help with breastfeeding positioning' },
            { id: 'pp-pain', label: 'Keep me comfortable — stay ahead of my pain relief' },
            { id: 'pp-visitors', label: 'My rules on visitors (note them below)' },
            { id: 'pp-quiet', label: 'Quiet time for just us before guests' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'pp-placentakeep', label: 'See or keep my placenta' },
            { id: 'pp-meal', label: 'A real meal soon after — I’ll likely be starving' },
            { id: 'pp-privacy', label: 'Privacy for feeding and recovery' },
            { id: 'pp-gatekeep', label: 'Someone to handle and gatekeep visitors' },
            { id: 'pp-sleep', label: 'Let me sleep — partner or nurse takes a shift with baby' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'pp-pericare', label: 'Perineal care ready: peri bottle, ice packs, spray, stool softener' },
            { id: 'pp-mood', label: 'Check in on my mood, not just the baby’s needs' },
            { id: 'pp-warning', label: 'Walk me through postpartum warning signs before discharge' },
            { id: 'pp-doula', label: 'Postpartum doula or help lined up at home' },
            { id: 'pp-iron', label: 'Iron-rich food and postnatal vitamins after the blood loss' },
          ],
        },
      ],
    },

    {
      id: 'heart',
      title: 'Heart & headspace',
      blurb: 'The part most plans skip. Birth is physical and emotional — preparing your heart matters as much as packing the bag. Naming what you hope for and what scares you takes some of the fear’s power away. However your birth unfolds, a good birth is one where you felt safe, respected, and supported.',
      questions: [
        'What are you most looking forward to about meeting your baby?',
        'What are you most afraid of — and what’s one thing that would help with that fear?',
        'What does support look like to you when things get really hard?',
        'What words do you most want to hear in the hard moments?',
        'If the birth doesn’t go the way you hoped, what would still make it feel okay?',
        'What’s one thing you can control, no matter what?',
      ],
      groups: [
        {
          label: 'How I want to be supported',
          options: [
            { id: 'h-strong', label: 'Remind me I’m strong and doing great' },
            { id: 'h-between', label: 'Encourage me between contractions' },
            { id: 'h-loud', label: 'Give me space to be loud or make noise — it helps me cope' },
            { id: 'h-hold', label: 'Hold space — comfort me, don’t rush to fix it' },
            { id: 'h-reset', label: 'Help me reset with breathing if I start to panic' },
            { id: 'h-informed', label: 'Keep me informed so I feel part of every decision' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'h-inward', label: 'Let me go quiet and inward without interruption' },
            { id: 'h-advocate', label: 'Advocate for me if I can’t speak for myself' },
            { id: 'h-reframe', label: 'Use “power” and “pressure,” not “pain”' },
            { id: 'h-affirm', label: 'Read my affirmations to me when I’m struggling' },
            { id: 'h-why', label: 'Remind me why I’m doing this — bring me back to baby' },
          ],
        },
        {
          label: 'Affirmations to carry',
          options: [
            { id: 'h-af1', label: '“I’m strong, and I can do hard things.”' },
            { id: 'h-af2', label: '“My body knows how to do this.”' },
            { id: 'h-af3', label: '“I’m allowed to be both scared and ready.”' },
            { id: 'h-af4', label: '“Whatever this brings, I won’t be alone.”' },
            { id: 'h-af5', label: '“Each wave brings me closer to my baby.”' },
          ],
        },
      ],
    },

    {
      id: 'logistics',
      title: 'Before the big day',
      blurb: 'Not part of the birth itself, but the stuff that makes the day smoother — and the easiest to forget.',
      questions: [
        'Is the bag packed, the car seat installed, and the route and parking sorted?',
        'Who’s on call for pets, older kids, and the “we’re heading in” text?',
      ],
      groups: [
        {
          label: 'Most common',
          options: [
            { id: 'g-bag', label: 'Hospital bag packed (mine, baby’s, partner’s)' },
            { id: 'g-carseat', label: 'Car seat installed and checked' },
            { id: 'g-route', label: 'Route, parking, and after-hours entrance known' },
            { id: 'g-ped', label: 'Pediatrician chosen' },
            { id: 'g-prereg', label: 'Pre-registered at the hospital' },
          ],
        },
        {
          label: 'Also consider',
          options: [
            { id: 'g-charger', label: 'Phone charger with a long cable' },
            { id: 'g-snacks', label: 'Snacks and drinks for me and my support' },
            { id: 'g-docs', label: 'Insurance card, ID, and birth plan copies' },
            { id: 'g-outfits', label: 'Going-home outfits for me and baby' },
          ],
        },
        {
          label: 'Easy to forget',
          options: [
            { id: 'g-care', label: 'Care lined up for pets or older kids' },
            { id: 'g-meals', label: 'Freezer meals or help arranged for the first weeks' },
            { id: 'g-comfort', label: 'My own pillow, towel, robe, and flip-flops for the shower' },
            { id: 'g-calllist', label: 'The “we’re heading in” call list' },
          ],
        },
      ],
    },
  ],
};
