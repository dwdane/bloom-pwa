// app.js
// App shell with bottom navigation, plus the Week, Log, Food, and Settings
// views. Plain IndexedDB storage. Built to extend (symptom logging and a fuller
// trends view slot into the Log tab later).

(() => {
  const root = document.getElementById('app');

  const state = {
    dating: { lmp: null, ultrasoundDueDate: null },
    imperial: true,
    babyName: '',
    gender: 'surprise', // 'girl' | 'boy' | 'surprise'
    view: 'week',
    viewWeek: null,
    prevView: 'week',
    tool: null, // within Tools: 'contraction' | 'kick' | 'birthplan' | 'questions'
    logTab: 'feelings', // within Log: 'feelings' | 'weight' | 'bump'
    logDate: null, // selected day (ISO) for daily logging; defaults to today
  };

  // Live timers (contraction/kick displays) that must be stopped when the view
  // is torn down, so they don't fire against removed DOM nodes.
  let activeIntervals = [];
  function trackInterval(id) {
    activeIntervals.push(id);
    return id;
  }
  function clearActiveIntervals() {
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];
  }

  // In-progress tool state, kept at module scope so navigating away and back
  // resumes rather than losing a contraction or kick session mid-count.
  let contractionStart = null;
  let kickSession = null;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(
        typeof child === 'string' ? document.createTextNode(child) : child
      );
    }
    return node;
  }

  const parseDateInput = (v) => {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const isoDate = (date) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  };
  const prettyDate = (date) =>
    date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const weightUnit = () => (state.imperial ? 'lb' : 'kg');
  const bumpUnit = () => (state.imperial ? 'in' : 'cm');
  const toStoredWeight = (v) => (state.imperial ? v / 2.2046226218 : v);
  const fromStoredWeight = (kg) => (state.imperial ? kg * 2.2046226218 : kg);
  const toStoredBump = (v) => (state.imperial ? v * 2.54 : v);
  const fromStoredBump = (cm) => (state.imperial ? cm / 2.54 : cm);

  function currentWeek() {
    const age = ageAt(state.dating);
    return age ? age.weeks : WEEK_MIN;
  }

  // --- baby identity helpers ---
  const babyName = () => (state.babyName || '').trim();
  const babyLabel = () => babyName() || 'Baby';
  function babyPronoun() {
    if (state.gender === 'girl') return { subj: 'she', poss: 'her', obj: 'her' };
    if (state.gender === 'boy') return { subj: 'he', poss: 'his', obj: 'him' };
    return { subj: 'they', poss: 'their', obj: 'them' };
  }
  function genderChipText() {
    if (state.gender === 'girl') return "It's a girl";
    if (state.gender === 'boy') return "It's a boy";
    return 'Team surprise';
  }
  function genderEmoji() {
    if (state.gender === 'girl') return '\ud83c\udf80'; // ribbon
    if (state.gender === 'boy') return '\ud83d\udc99'; // blue heart
    return '\ud83d\udc9b'; // yellow heart
  }

  // --- day-level date math for the calendar strip ---
  const MS_DAY = 86400000;
  function midnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(d, n) {
    const r = midnight(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function pregnancyStart() {
    const due = dueDate(state.dating);
    return due ? addDays(due, -280) : null;
  }
  function weekOfDate(date) {
    const start = pregnancyStart();
    if (!start) return WEEK_MIN;
    const days = Math.floor((midnight(date) - start) / MS_DAY);
    return Math.floor(days / 7);
  }
  // The seven calendar dates (Date objects) that make up gestational week W.
  function datesOfWeek(week) {
    const start = pregnancyStart();
    if (!start) return [];
    return Array.from({ length: 7 }, (_, d) => addDays(start, week * 7 + d));
  }
  function todayISO() {
    return isoDate(new Date());
  }
  function selectedDate() {
    return state.logDate || todayISO();
  }
  // The date a stored entry belongs to (explicit date, or derived from creation).
  function entryDate(e) {
    if (e.date) return e.date;
    if (e.createdAt) return isoDate(new Date(e.createdAt));
    return todayISO();
  }

  function numberDialog({ title, unit, placeholder }) {
    return new Promise((resolve) => {
      const input = el('input', {
        type: 'number',
        inputmode: 'decimal',
        step: '0.1',
        placeholder: placeholder || '0.0',
      });
      const overlay = el('div', { class: 'modal-overlay' });
      function close(value) {
        overlay.remove();
        resolve(value);
      }
      const dialog = el('div', { class: 'modal' }, [
        el('h3', { text: title }),
        el('div', { class: 'modal-input-row' }, [
          input,
          el('span', { class: 'modal-unit', text: unit }),
        ]),
        el('div', { class: 'modal-actions' }, [
          el('button', {
            class: 'secondary',
            text: 'Cancel',
            onClick: () => close(null),
          }),
          el('button', {
            class: 'primary compact',
            text: 'Save',
            onClick: () => {
              const n = parseFloat(input.value);
              close(Number.isFinite(n) ? n : null);
            },
          }),
        ]),
      ]);
      overlay.appendChild(dialog);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
      root.appendChild(overlay);
      input.focus();
    });
  }

  function toast(message) {
    const t = el('div', { class: 'toast', text: message });
    root.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 200);
    }, 1400);
  }

  function navItem(view, label, iconPath) {
    const active = state.view === view;
    return el(
      'button',
      {
        class: 'nav-item' + (active ? ' active' : ''),
        onClick: () => {
          if (state.view !== view) {
            state.view = view;
            state.tool = null;
            renderApp();
          }
        },
      },
      [
        el('span', {
          class: 'nav-icon',
          html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>`,
        }),
        el('span', { class: 'nav-label', text: label }),
      ]
    );
  }

  function renderApp() {
    clearActiveIntervals();
    root.innerHTML = '';
    const content = el('div', { class: 'content' });
    if (state.view === 'week') renderWeekView(content);
    else if (state.view === 'log') renderLogView(content);
    else if (state.view === 'tools') renderToolsView(content);
    else if (state.view === 'lists') renderListsView(content);
    else if (state.view === 'food') renderFoodView(content);
    else if (state.view === 'settings') renderSettingsView(content);

    const nav = el('nav', { class: 'tabbar' }, [
      navItem('week', 'Week', '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
      navItem('log', 'Log', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
      navItem('tools', 'Tools', '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.3L4 17v3h3l5.4-5.3a4 4 0 0 1 5.3-5.4l-2.6 2.6-2-2 2.6-2.6Z"/>'),
      navItem('lists', 'Lists', '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
      navItem('food', 'Food', '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><line x1="6" y1="9" x2="6" y2="22"/><path d="M17 2c-1.5 1-2 3-2 5s.5 4 2 5v10"/>'),
    ]);

    root.appendChild(content);
    root.appendChild(nav);
  }

  function viewHeader(title, opts = {}) {
    const children = [el('h1', { class: 'app-title', text: title })];
    if (!opts.noGear) {
      children.push(
        el('button', {
          class: 'gear-btn',
          'aria-label': 'Settings',
          html:
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
          onClick: () => {
            state.prevView = state.view;
            state.view = 'settings';
            state.tool = null;
            renderApp();
          },
        })
      );
    }
    return el('header', { class: 'app-header has-gear' }, children);
  }

  function renderSetup() {
    root.innerHTML = '';
    const lmpInput = el('input', { type: 'date', max: isoDate(new Date()) });
    const dueInput = el('input', { type: 'date' });
    const nameInput = el('input', { type: 'text', placeholder: 'Baby\u2019s name or nickname', autocomplete: 'off' });
    let pickedGender = 'surprise';
    const genderSeg = el('div', { class: 'segmented gender-seg' });
    for (const [key, label] of [['girl', 'Girl'], ['boy', 'Boy'], ['surprise', 'Surprise']]) {
      const b = el('button', {
        class: 'seg-btn' + (key === 'surprise' ? ' active' : ''),
        text: label,
        onClick: () => {
          pickedGender = key;
          [...genderSeg.children].forEach((c) => c.classList.toggle('active', c.dataset.g === key));
        },
      });
      b.dataset.g = key;
      genderSeg.appendChild(b);
    }
    const error = el('p', { class: 'error' });

    const ackBox = el('input', { type: 'checkbox', id: 'ack' });
    const startBtn = el('button', {
      class: 'primary',
      text: 'Start',
      disabled: '',
    });
    ackBox.addEventListener('change', () => {
      if (ackBox.checked) startBtn.removeAttribute('disabled');
      else startBtn.setAttribute('disabled', '');
    });

    async function save() {
      if (!ackBox.checked) return;
      const lmp = parseDateInput(lmpInput.value);
      const due = parseDateInput(dueInput.value);
      if (!lmp && !due) {
        error.textContent = 'Enter your last period date or your due date.';
        return;
      }
      state.dating.lmp = lmp;
      state.dating.ultrasoundDueDate = due;
      state.babyName = nameInput.value.trim();
      state.gender = pickedGender;
      await Store.setSetting('dating', {
        lmp: lmp ? lmp.getTime() : null,
        ultrasoundDueDate: due ? due.getTime() : null,
      });
      await Store.setSetting('baby', { name: state.babyName, gender: state.gender });
      await Store.setSetting('acknowledgedDisclaimer', true);
      state.view = 'week';
      renderApp();
    }
    startBtn.addEventListener('click', save);

    const ackRow = el('label', { class: 'ack-row' }, [
      ackBox,
      el('span', {
        class: 'small',
        html:
          'I understand Bloom is for general information only, is not medical ' +
          'advice, and does not replace my healthcare provider. ' +
          '(<a href="disclaimer.html">Disclaimer</a>)',
      }),
    ]);

    const card = el('div', { class: 'card setup' }, [
      el('h2', { text: 'Welcome to Bloom' }),
      el('div', { class: 'callout callout-privacy' }, [
        el('strong', { text: 'Private by design. ' }),
        document.createTextNode(
          'Everything you enter stays on this device and is never sent ' +
          'anywhere, ever. There are no accounts and no servers — not even we ' +
          'can see your information.'
        ),
      ]),
      el('div', { class: 'callout callout-warn' }, [
        el('strong', { text: 'Not medical advice. ' }),
        document.createTextNode(
          'Bloom is for general information only and does not replace your ' +
          'doctor or midwife. For any concern, contact your provider; in an ' +
          'emergency, call your local emergency number.'
        ),
      ]),
      el('p', {
        class: 'muted',
        text:
          'Enter one of these to begin. An ultrasound due date is most ' +
          'accurate — otherwise your last period works.',
      }),
      el('label', { class: 'field-label', text: 'First day of last period' }),
      lmpInput,
      el('label', {
        class: 'field-label',
        text: 'Ultrasound due date (optional, preferred if known)',
      }),
      dueInput,
      el('label', { class: 'field-label', text: 'Baby\u2019s name (optional)' }),
      nameInput,
      el('label', { class: 'field-label', text: 'Do you know the sex? (optional)' }),
      genderSeg,
      error,
      ackRow,
      startBtn,
      el('p', {
        class: 'muted small',
        html:
          'Read the <a href="privacy.html">Privacy Policy</a>, ' +
          '<a href="terms.html">Terms</a>, and ' +
          '<a href="disclaimer.html">Disclaimer</a>.',
      }),
    ]);

    const openSource = el('p', { class: 'muted small setup-os' }, [
      document.createTextNode('Bloom is open source — '),
      el('a', { href: 'https://github.com/dwdane/bloom-pwa/', target: '_blank', rel: 'noopener' }, ['view the code on GitHub']),
      document.createTextNode('.'),
    ]);

    root.appendChild(
      el('div', { class: 'wrap' }, [
        viewHeader('Bloom', { noGear: true }),
        card,
        installCard(),
        openSource,
      ])
    );
  }

  // ---------------------------------------------------------------------------
  // Calendar day strip (Flo-style): the seven days of a gestational week, with
  // today and the selected day highlighted. Reused on the Week and Log tabs.
  // ---------------------------------------------------------------------------

  function calendarStrip(displayWeek, selectedIso, onSelectDay, onWeekChange) {
    const dates = datesOfWeek(displayWeek);
    const tIso = todayISO();
    const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const header = el('div', { class: 'cal-header' }, [
      onWeekChange
        ? el('button', {
            class: 'cal-nav',
            text: '\u2039',
            disabled: displayWeek <= WEEK_MIN ? '' : null,
            onClick: () => onWeekChange(displayWeek - 1),
          })
        : el('span', {}),
      el('span', { class: 'cal-week-label', text: `Week ${displayWeek}` }),
      onWeekChange
        ? el('button', {
            class: 'cal-nav',
            text: '\u203a',
            disabled: displayWeek >= WEEK_MAX ? '' : null,
            onClick: () => onWeekChange(displayWeek + 1),
          })
        : el('span', {}),
    ]);

    const days = el('div', { class: 'cal-days' });
    for (const d of dates) {
      const iso = isoDate(d);
      const cls =
        'cal-day' +
        (iso === selectedIso ? ' selected' : '') +
        (iso === tIso ? ' today' : '') +
        (iso > tIso ? ' future' : '');
      days.appendChild(
        el('button', { class: cls, onClick: () => onSelectDay(iso) }, [
          el('span', { class: 'cal-dow', text: dow[d.getDay()] }),
          el('span', { class: 'cal-date', text: String(d.getDate()) }),
        ])
      );
    }

    return el('div', { class: 'cal-strip' }, [header, days]);
  }

  function prettyDayLabel(iso) {
    if (iso === todayISO()) return 'Today';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  // ---------------------------------------------------------------------------
  // New-week celebration: a brief shower of the current fruit emoji the first
  // time the app is opened on a new gestational week.
  // ---------------------------------------------------------------------------

  async function maybeCelebrateNewWeek() {
    const wk = currentWeek();
    const lastSeen = await Store.getSetting('lastSeenWeek');
    if (lastSeen == null) {
      await Store.setSetting('lastSeenWeek', wk);
      return;
    }
    if (wk > lastSeen && wk >= WEEK_MIN && wk <= WEEK_MAX) {
      await Store.setSetting('lastSeenWeek', wk);
      const info = weekContentFor(wk);
      celebrateWeek(wk, info.emoji);
    }
  }

  function celebrateWeek(week, emoji) {
    const layer = el('div', { class: 'celebrate-layer' });
    const banner = el('div', { class: 'celebrate-banner' }, [
      el('div', { class: 'celebrate-week', text: `Week ${week}` }),
      el('div', { class: 'celebrate-sub', text: `${babyLabel()} is growing \u2014 here we go!` }),
    ]);
    layer.appendChild(banner);

    const count = 22;
    for (let i = 0; i < count; i++) {
      const drop = el('div', { class: 'celebrate-drop', text: emoji });
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDelay = Math.random() * 0.6 + 's';
      drop.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
      drop.style.fontSize = 1.4 + Math.random() * 1.6 + 'rem';
      layer.appendChild(drop);
    }

    document.body.appendChild(layer);
    setTimeout(() => layer.classList.add('fade'), 2200);
    setTimeout(() => layer.remove(), 2900);
  }

  function renderWeekView(container) {
    const age = ageAt(state.dating);
    const liveWeek = age ? age.weeks : WEEK_MIN;
    const week = state.viewWeek != null ? state.viewWeek : liveWeek;
    const info = weekContentFor(week);
    const due = dueDate(state.dating);
    const remaining = daysRemaining(state.dating);
    const isOther = state.viewWeek != null && state.viewWeek !== liveWeek;

    const lengthStr = formatLength(info.lengthCm, state.imperial);
    const weightStr = formatWeight(info.weightG, state.imperial);
    const measure = [lengthStr, weightStr].filter(Boolean).join(' · ');
    const lengthNote = info.headToHeel ? ' (head to heel)' : '';
    const trimesterLabel = age
      ? ['', 'First trimester', 'Second trimester', 'Third trimester'][age.trimester]
      : '';

    const heroChildren = [
      el('div', { class: 'hero-emoji', text: info.emoji }),
      el('div', { class: 'hero-week', text: `Week ${info.week}` }),
    ];
    if (babyName()) {
      heroChildren.push(el('div', { class: 'hero-name', text: babyName() }));
    }
    heroChildren.push(
      el('div', { class: 'hero-fruit', text: `About the size of ${info.fruit}` })
    );
    if (measure) {
      heroChildren.push(el('div', { class: 'hero-measure', text: measure + lengthNote }));
    }
    const heroChips = el('div', { class: 'hero-chips' });
    if (trimesterLabel && !isOther) {
      heroChips.appendChild(el('div', { class: 'chip', text: trimesterLabel }));
    }
    heroChips.appendChild(
      el('div', { class: `chip gender-chip ${state.gender}` }, [
        document.createTextNode(genderEmoji() + ' ' + genderChipText()),
      ])
    );
    heroChildren.push(heroChips);
    const hero = el('div', { class: 'card hero' }, heroChildren);

    // calendar day strip for the viewed week; tap a day to log it
    const strip = pregnancyStart()
      ? calendarStrip(
          week,
          week === liveWeek ? todayISO() : isoDate(datesOfWeek(week)[0] || new Date()),
          (iso) => {
            state.logDate = iso;
            state.view = 'log';
            state.logTab = 'feelings';
            renderApp();
          },
          (w) => {
            state.viewWeek = Math.max(WEEK_MIN, Math.min(WEEK_MAX, w));
            renderApp();
          }
        )
      : null;

    const nav = el('div', { class: 'week-nav' }, [
      el('button', {
        class: 'nav-btn',
        text: '‹',
        disabled: week <= WEEK_MIN ? '' : null,
        onClick: () => {
          state.viewWeek = Math.max(WEEK_MIN, week - 1);
          renderApp();
        },
      }),
      isOther
        ? el('button', {
            class: 'secondary',
            text: 'Back to this week',
            onClick: () => {
              state.viewWeek = null;
              renderApp();
            },
          })
        : el('span', { class: 'muted small', text: 'This week' }),
      el('button', {
        class: 'nav-btn',
        text: '›',
        disabled: week >= WEEK_MAX ? '' : null,
        onClick: () => {
          state.viewWeek = Math.min(WEEK_MAX, week + 1);
          renderApp();
        },
      }),
    ]);

    let progress = null;
    if (age && due) {
      const pct = Math.max(0, Math.min(100, (age.days / 280) * 100));
      progress = el('div', { class: 'card' }, [
        el('div', { class: 'progress-row' }, [
          el('span', { text: `${age.weeks}w ${age.remainderDays}d` }),
          el('span', {
            class: 'muted',
            text:
              remaining != null && remaining >= 0
                ? `${remaining} days to go`
                : 'Due date passed',
          }),
        ]),
        el('div', { class: 'progress-track' }, [
          el('div', { class: 'progress-fill', style: `width:${pct}%` }),
        ]),
        el('div', { class: 'muted small', text: `Due ${prettyDate(due)}` }),
      ]);
    }

    const babyCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: `${babyLabel()} this week` }),
      el('p', { text: info.baby }),
    ]);

    const bodyBody = el('div', { class: 'collapsible-body' }, [el('p', { text: info.body })]);
    bodyBody.style.display = 'none';
    const bodyToggle = el('button', {
      class: 'collapsible-toggle',
      text: 'Your body this week  \u25be',
      onClick: () => {
        const open = bodyBody.style.display !== 'none';
        bodyBody.style.display = open ? 'none' : 'block';
        bodyToggle.textContent = open ? 'Your body this week  \u25be' : 'Your body this week  \u25b4';
      },
    });
    const bodyCard = el('div', { class: 'card collapsible' }, [bodyToggle, bodyBody]);

    const encouragement = el('div', { class: 'card encouragement' }, [
      el('p', { text: info.encouragement }),
    ]);

    let factIndex = 0;
    const factText = el('p', { class: 'fact-text' });
    const factSource = el('p', { class: 'fact-source muted small' });
    const showFact = () => {
      const f = info.facts[factIndex % info.facts.length];
      factText.textContent = f.text;
      factSource.textContent = f.source ? `\u2014 ${f.source}` : '';
    };
    let factsCard = null;
    if (info.facts.length) {
      showFact();
      factsCard = el('div', { class: 'card facts' }, [
        el('h3', { class: 'card-title', text: 'Did you know?' }),
        factText,
        factSource,
        info.facts.length > 1
          ? el('button', {
              class: 'secondary',
              text: 'What else?',
              onClick: () => {
                factIndex++;
                showFact();
              },
            })
          : null,
      ]);
    }

    container.appendChild(
      el('div', { class: 'wrap' }, [
        viewHeader('Bloom'),
        hero,
        strip,
        nav,
        progress,
        babyCard,
        bodyCard,
        encouragement,
        factsCard,
        el('p', {
          class: 'muted small disclaimer',
          text:
            'Sizes are averages and every pregnancy varies. Informational ' +
            'only, not a substitute for your provider.',
        }),
      ])
    );
  }

  function renderLogView(container) {
    const dayIso = selectedDate();
    const week = pregnancyStart() ? weekOfDate(new Date(dayIso + 'T00:00:00')) : currentWeek();
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Log')]);
    container.appendChild(wrap);

    // calendar strip: pick the day to log
    if (pregnancyStart()) {
      wrap.appendChild(
        calendarStrip(
          week,
          dayIso,
          (iso) => {
            if (iso > todayISO()) return; // don't log the future
            state.logDate = iso;
            renderApp();
          },
          (w) => {
            // shift the selected day by a week, keeping the weekday
            const cur = new Date(dayIso + 'T00:00:00');
            const shifted = addDays(cur, (w - week) * 7);
            state.logDate = isoDate(shifted > new Date() ? new Date() : shifted);
            renderApp();
          }
        )
      );
    }
    wrap.appendChild(
      el('p', { class: 'day-label', text: `${prettyDayLabel(dayIso)} \u00b7 week ${week}` })
    );

    // --- this-day summary (filled async) ---
    const summary = el('div', { class: 'card week-summary' });
    wrap.appendChild(summary);

    // --- sub-tabs: Feelings / Weight / Bump ---
    const sectFeelings = el('div', {});
    const sectWeight = el('div', {});
    const sectBump = el('div', {});
    const sections = { feelings: sectFeelings, weight: sectWeight, bump: sectBump };

    function showLogTab(which) {
      state.logTab = which;
      for (const key of Object.keys(sections)) {
        sections[key].style.display = key === which ? 'block' : 'none';
      }
      [...seg.children].forEach((b) =>
        b.classList.toggle('active', b.dataset.tab === which)
      );
    }

    const seg = el('div', { class: 'segmented' });
    for (const [key, label] of [['feelings', 'Feelings'], ['weight', 'Weight'], ['bump', 'Bump']]) {
      const btn = el('button', {
        class: 'seg-btn',
        text: label,
        onClick: () => showLogTab(key),
      });
      btn.dataset.tab = key;
      seg.appendChild(btn);
    }
    wrap.appendChild(seg);
    wrap.appendChild(sectFeelings);
    wrap.appendChild(sectWeight);
    wrap.appendChild(sectBump);

    // --- feelings / symptoms ---
    const dayWord = dayIso === todayISO() ? 'today' : 'that day';
    const feelingsCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: `How are you feeling ${dayWord}?` }),
    ]);
    for (const category of LOG_CATEGORIES) {
      feelingsCard.appendChild(
        el('p', { class: 'chip-group-title', text: category.title })
      );
      const group = el('div', { class: 'chip-group' });
      for (const option of category.options) {
        group.appendChild(
          el('button', {
            class: `log-chip tone-${option.tone}`,
            onClick: async () => {
              await Store.addEntry({
                kind: option.kind,
                label: option.label,
                week,
                date: dayIso,
              });
              toast(`Logged: ${option.label}`);
              renderApp();
            },
          }, [
            option.emoji ? el('span', { class: 'chip-emoji', text: option.emoji }) : null,
            document.createTextNode(option.label),
          ])
        );
      }
      feelingsCard.appendChild(group);
    }
    // movement note + a relief disclosure live with feelings
    const moveBody = el('div', { class: 'collapsible-body' }, [
      el('p', { text: MOVEMENT_INFO.whatItFeelsLike }),
      el('p', { class: 'muted small', html: 'Tracking movements in detail? The <strong>Kick counter</strong> in Tools has guidance and a counter.' }),
    ]);
    moveBody.style.display = 'none';
    const moveToggle = el('button', {
      class: 'measure-help-toggle',
      text: 'What do baby\u2019s first movements feel like?  \u25be',
      onClick: () => {
        const open = moveBody.style.display !== 'none';
        moveBody.style.display = open ? 'none' : 'block';
        moveToggle.textContent = open
          ? 'What do baby\u2019s first movements feel like?  \u25be'
          : 'What do baby\u2019s first movements feel like?  \u25b4';
      },
    });
    feelingsCard.appendChild(el('div', { class: 'measure-help-wrap' }, [moveToggle, moveBody]));
    sectFeelings.appendChild(feelingsCard);

    // --- things that may help (relief tips for this week's tough symptoms) ---
    const reliefCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Things that may help' }),
    ]);
    const reliefBody = el('div', {});
    reliefCard.appendChild(reliefBody);
    sectFeelings.appendChild(reliefCard);

    // --- measurements (weight + bump): latest value + add; charts live in Trends ---
    const measureCard = (opts) => {
      const card = el('div', { class: 'card' });
      card.appendChild(
        el('div', { class: 'measure-head' }, [
          el('h3', { class: 'card-title', text: opts.title }),
          el('button', {
            class: 'secondary compact',
            text: 'Add',
            onClick: async () => {
              const entered = await numberDialog({
                title: opts.dialogTitle,
                unit: opts.unit(),
              });
              if (entered == null) return;
              await Store.addEntry({
                kind: opts.kind,
                value: opts.toStored(entered),
                week,
                date: dayIso,
              });
              toast(`Logged ${entered.toFixed(1)} ${opts.unit()}`);
              renderApp();
            },
          }),
        ])
      );

      const latestEl = el('div', { class: 'measure-latest', text: '\u2014' });
      const note = el('p', { class: 'muted small' });
      card.appendChild(latestEl);
      card.appendChild(note);
      if (opts.help) card.appendChild(opts.help());
      card.appendChild(trendDisclosure(opts));

      Store.entriesOfKind(opts.kind).then((entries) => {
        if (entries.length === 0) {
          latestEl.textContent = 'Not logged yet';
          note.textContent = opts.emptyHint;
          return;
        }
        const last = entries[entries.length - 1];
        latestEl.textContent =
          opts.fromStored(last.value).toFixed(1) + ' ' + opts.unit();
        note.textContent =
          entries.length < 2
            ? 'Log once more to start a trend.'
            : opts.encourage;
      });

      return card;
    };

    // disclosure: how to measure your bump
    const bumpHelp = () => {
      const body = el('div', { class: 'collapsible-body measure-help' }, [
        el('p', { text: 'For a simple at-home keepsake measurement of your bump:' }),
        el('ul', {}, [
          el('li', { text: 'Use a soft fabric tape measure, standing up and relaxed — don’t hold your belly in.' }),
          el('li', { text: 'Wrap it around the widest part of your belly, usually level with your belly button.' }),
          el('li', { text: 'Keep the tape level all the way around, snug but not tight.' }),
          el('li', { text: 'Measure at a similar time of day and the same spot each week so your trend is consistent.' }),
        ]),
        el('p', {
          class: 'muted small',
          text:
            'This is just for your own interest. It is not the same as the ' +
            'fundal-height measurement your provider takes at appointments, ' +
            'and it isn’t a medical assessment.',
        }),
      ]);
      body.style.display = 'none';
      const toggle = el('button', {
        class: 'measure-help-toggle',
        text: 'How to measure your bump  \u25be',
        onClick: () => {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          toggle.textContent = open
            ? 'How to measure your bump  \u25be'
            : 'How to measure your bump  \u25b4';
        },
      });
      return el('div', { class: 'measure-help-wrap' }, [toggle, body]);
    };

    sectWeight.appendChild(
      measureCard({
        title: 'Weight',
        dialogTitle: 'Log weight',
        kind: 'weight',
        unit: weightUnit,
        toStored: toStoredWeight,
        fromStored: fromStoredWeight,
        emptyHint: 'Tap Add to record your first measurement.',
        encourage: 'Every pound is your body doing its job beautifully.',
      })
    );
    sectBump.appendChild(
      measureCard({
        title: 'Bump size',
        dialogTitle: 'Log bump size',
        kind: 'bump',
        unit: bumpUnit,
        toStored: toStoredBump,
        fromStored: fromStoredBump,
        emptyHint: 'Tap Add to record your first measurement.',
        encourage: 'Look how much room your little one is making.',
        help: bumpHelp,
      })
    );

    // --- entries for the selected day (deletable) — lives under Feelings ---
    const recentCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: dayIso === todayISO() ? 'Logged today' : 'Logged that day' }),
    ]);
    const recentList = el('div', { class: 'entry-list' });
    recentCard.appendChild(recentList);
    sectFeelings.appendChild(recentCard);

    // folded-in trend: how you've been feeling over time (collapsible)
    sectFeelings.appendChild(feelingsTrendCard());

    function describeEntry(e) {
      if (e.kind === 'weight' && e.value != null) {
        return fromStoredWeight(e.value).toFixed(1) + ' ' + weightUnit() + ' \u00b7 weight';
      }
      if (e.kind === 'bump' && e.value != null) {
        return fromStoredBump(e.value).toFixed(1) + ' ' + bumpUnit() + ' \u00b7 bump';
      }
      return e.label || e.kind;
    }

    function refreshWeekData() {
      Store.entriesForDate(dayIso).then((entries) => {
        const isToday = dayIso === todayISO();
        // summary
        const feelingSymptom = entries.filter(
          (e) => e.kind === 'feeling' || e.kind === 'symptom'
        );
        const good = feelingSymptom.filter(
          (e) => e.label && toneForLabel(e.label) === 'good'
        ).length;
        summary.innerHTML = '';
        summary.appendChild(el('div', { class: 'summary-emoji', text: '\ud83c\udf3c' }));
        const total = entries.length;
        summary.appendChild(
          el('div', {}, [
            el('div', {
              class: 'summary-line',
              text:
                total === 0
                  ? (isToday ? 'Nothing logged yet today' : 'Nothing logged that day')
                  : `${total} thing${total === 1 ? '' : 's'} logged ${isToday ? 'today' : 'that day'}`,
            }),
            good > 0
              ? el('div', {
                  class: 'summary-sub muted small',
                  text: `${good} good moment${good === 1 ? '' : 's'} \ud83d\udc9b`,
                })
              : null,
          ])
        );

        // relief tips for distinct symptoms/feelings logged that day that have advice
        reliefBody.innerHTML = '';
        const labels = [];
        for (const e of feelingSymptom) {
          if (e.label && !labels.includes(e.label) && reliefFor(e.label)) labels.push(e.label);
        }
        if (labels.length === 0) {
          reliefBody.appendChild(
            el('p', {
              class: 'muted small',
              text: 'Log how you\u2019re feeling above, and any gentle ideas that might help will show here.',
            })
          );
        } else {
          for (const label of labels) {
            const r = reliefFor(label);
            const body = el('div', { class: 'collapsible-body' });
            const ul = el('ul', { class: 'relief-list' });
            for (const tip of r.tips) ul.appendChild(el('li', { text: tip }));
            body.appendChild(ul);
            if (r.whenToCall) {
              body.appendChild(
                el('p', { class: 'relief-call small' }, [
                  el('strong', { text: 'When to call: ' }),
                  document.createTextNode(r.whenToCall),
                ])
              );
            }
            body.style.display = 'none';
            const toggle = el('button', {
              class: 'relief-toggle',
              text: label + '  \u25be',
              onClick: () => {
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                toggle.textContent = open ? label + '  \u25be' : label + '  \u25b4';
              },
            });
            reliefBody.appendChild(el('div', { class: 'relief-item' }, [toggle, body]));
          }
        }

        // recent list (newest first)
        const sorted = entries
          .slice()
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        recentList.innerHTML = '';
        if (sorted.length === 0) {
          recentList.appendChild(
            el('p', { class: 'muted small', text: 'Tap anything above to start logging.' })
          );
          return;
        }
        for (const e of sorted) {
          const tone = e.label ? toneForLabel(e.label) : 'neutral';
          const em = e.label ? emojiForLabel(e.label) : '';
          recentList.appendChild(
            el('div', { class: 'entry-row' }, [
              em
                ? el('span', { class: 'entry-emoji', text: em })
                : el('span', { class: `entry-dot tone-${tone}` }),
              el('span', { class: 'entry-label', text: describeEntry(e) }),
              el('button', {
                class: 'entry-delete',
                'aria-label': 'Delete entry',
                text: '\u00d7',
                onClick: async () => {
                  await Store.deleteEntry(e.id);
                  refreshWeekData();
                },
              }),
            ])
          );
        }
      });
    }
    refreshWeekData();
    showLogTab(state.logTab);
  }

  // ---------------------------------------------------------------------------
  // Shared chart helpers (used by the folded-in trends in the Log tab)
  // ---------------------------------------------------------------------------

  function accentColor() {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim() || '#b5739d'
    );
  }

  function getCssColor(varName, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return v || fallback;
  }

  // A collapsible line-chart card for a measurement kind (weight/bump).
  function trendDisclosure(opts) {
    const body = el('div', { class: 'collapsible-body' });
    body.style.display = 'none';
    const canvas = el('canvas', { class: 'chart-canvas' });
    const note = el('p', { class: 'muted small' });
    body.appendChild(canvas);
    body.appendChild(note);

    let drawn = false;
    function draw() {
      Store.entriesOfKind(opts.kind).then((entries) => {
        if (entries.length < 2) {
          canvas.style.display = 'none';
          note.textContent =
            entries.length === 0
              ? 'No entries yet.'
              : 'Log once more to see a trend line.';
          return;
        }
        const first = entries[0];
        const last = entries[entries.length - 1];
        const change = opts.fromStored(last.value) - opts.fromStored(first.value);
        const sign = change >= 0 ? '+' : '';
        note.textContent = `${sign}${change.toFixed(1)} ${opts.unit()} since you started logging.`;
        const points = entries.map((e) => ({
          x: e.createdAt,
          y: opts.fromStored(e.value),
          label: e.week != null ? `wk ${e.week}` : '',
        }));
        requestAnimationFrame(() =>
          drawLineChart(canvas, points, {
            formatValue: (v) => Math.round(v) + '',
            accent: accentColor(),
          })
        );
      });
    }

    const toggle = el('button', {
      class: 'measure-help-toggle',
      text: 'Show trend  \u25be',
      onClick: () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        toggle.textContent = open ? 'Show trend  \u25be' : 'Hide trend  \u25b4';
        if (!open && !drawn) {
          drawn = true;
          draw();
        } else if (!open) {
          draw();
        }
      },
    });
    return el('div', { class: 'trend-disclosure' }, [toggle, body]);
  }

  // A collapsible "how you've been feeling over time" stacked-bar card.
  function feelingsTrendCard() {
    const card = el('div', { class: 'card collapsible' });
    const body = el('div', { class: 'collapsible-body' });
    body.style.display = 'none';
    const canvas = el('canvas', { class: 'chart-canvas' });
    const legend = el('div', { class: 'chart-legend' }, [
      el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-dot tone-good' }),
        document.createTextNode('Good'),
      ]),
      el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-dot tone-neutral' }),
        document.createTextNode('Neutral'),
      ]),
      el('span', { class: 'legend-item' }, [
        el('span', { class: 'legend-dot tone-tough' }),
        document.createTextNode('Tough'),
      ]),
    ]);
    const note = el('p', { class: 'muted small' });
    body.appendChild(canvas);
    body.appendChild(legend);
    body.appendChild(note);

    const toneColors = {
      good: getCssColor('--good', '#6bbf73'),
      neutral: '#b0b6bc',
      tough: '#d9a066',
    };

    function draw() {
      Store.allEntries().then((all) => {
        const fs = all.filter((e) => e.kind === 'feeling' || e.kind === 'symptom');
        if (fs.length === 0) {
          canvas.style.display = 'none';
          legend.style.display = 'none';
          note.textContent = 'Once you log how you\u2019re feeling, your weeks will show here.';
          return;
        }
        canvas.style.display = 'block';
        legend.style.display = 'flex';
        const byWeek = {};
        for (const e of fs) {
          const wk = e.week != null ? e.week : 0;
          if (!byWeek[wk]) byWeek[wk] = { good: 0, neutral: 0, tough: 0 };
          byWeek[wk][e.label ? toneForLabel(e.label) : 'neutral']++;
        }
        const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
        const groups = weeks.map((wk) => ({
          label: `${wk}`,
          segments: [
            { value: byWeek[wk].good, color: toneColors.good },
            { value: byWeek[wk].neutral, color: toneColors.neutral },
            { value: byWeek[wk].tough, color: toneColors.tough },
          ],
        }));
        const good = fs.filter((e) => e.label && toneForLabel(e.label) === 'good').length;
        note.textContent = `${good} good moment${good === 1 ? '' : 's'} across ${weeks.length} week${weeks.length === 1 ? '' : 's'}.`;
        requestAnimationFrame(() => drawStackedBars(canvas, groups));
      });
    }

    const toggle = el('button', {
      class: 'collapsible-toggle',
      text: 'How you\u2019ve been feeling over time  \u25be',
      onClick: () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        toggle.textContent = open
          ? 'How you\u2019ve been feeling over time  \u25be'
          : 'How you\u2019ve been feeling over time  \u25b4';
        if (!open) draw();
      },
    });
    card.appendChild(toggle);
    card.appendChild(body);
    return card;
  }

  // ---------------------------------------------------------------------------
  // Tools tab: hub + individual tools
  // ---------------------------------------------------------------------------

  function renderToolsView(container) {
    if (state.tool === 'contraction') return renderContractionTimer(container);
    if (state.tool === 'kick') return renderKickCounter(container);

    const tools = [
      { key: 'contraction', title: 'Contraction timer', desc: 'Time contractions and see how close together they are.' },
      { key: 'kick', title: 'Kick counter', desc: 'Count baby\u2019s movements, with guidance on what to expect.' },
    ];

    const list = el('div', { class: 'tool-list' });
    for (const t of tools) {
      list.appendChild(
        el('button', {
          class: 'tool-card',
          onClick: () => {
            state.tool = t.key;
            renderApp();
          },
        }, [
          el('div', { class: 'tool-card-title', text: t.title }),
          el('div', { class: 'tool-card-desc muted small', text: t.desc }),
        ])
      );
    }

    container.appendChild(el('div', { class: 'wrap' }, [viewHeader('Tools'), list]));
  }

  function toolHeader(title) {
    return el('header', { class: 'app-header tool-header' }, [
      el('button', {
        class: 'back-btn',
        text: '\u2039 Tools',
        onClick: () => {
          state.tool = null;
          renderApp();
        },
      }),
      el('h1', { class: 'app-title', text: title }),
    ]);
  }

  function fmtClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  // --- Contraction timer ---
  function renderContractionTimer(container) {
    const wrap = el('div', { class: 'wrap' }, [toolHeader('Contraction timer')]);
    container.appendChild(wrap);

    const bigButton = el('button', { class: 'timer-button' });
    const elapsedLabel = el('div', { class: 'timer-elapsed' });
    const sinceLabel = el('div', { class: 'muted small timer-since' });

    const timerCard = el('div', { class: 'card timer-card' }, [
      elapsedLabel,
      bigButton,
      sinceLabel,
    ]);
    wrap.appendChild(timerCard);

    const statsCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Recent contractions' }),
    ]);
    const statsSummary = el('div', { class: 'timer-summary' });
    const listEl = el('div', { class: 'entry-list' });
    statsCard.appendChild(statsSummary);
    statsCard.appendChild(listEl);
    wrap.appendChild(statsCard);

    // Guidance
    wrap.appendChild(
      el('div', { class: 'card guidance' }, [
        el('h3', { class: 'card-title', text: 'How to use this' }),
        el('p', { text: 'Tap Start when a contraction begins and Stop when it eases. Bloom records how long each one lasts and how far apart they are (start to start).' }),
        el('p', { html: 'A common full-term guideline is <strong>5-1-1</strong>: contractions about 5 minutes apart, each lasting about 1 minute, for at least 1 hour. Your provider may give you different instructions \u2014 always follow theirs.' }),
        el('div', { class: 'callout callout-warn' }, [
          el('strong', { text: 'Call your provider ' }),
          document.createTextNode(
            'if your water breaks, you have bleeding, you notice reduced baby movement, or you have regular contractions before 37 weeks \u2014 don\u2019t wait for any pattern. This timer does not diagnose labor.'
          ),
        ]),
      ])
    );

    function render() {
      Store.entriesOfKind('contraction').then((all) => {
        const sorted = all.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

        // summary over the last hour
        const hourAgo = Date.now() - 3600000;
        const recent = sorted.filter((c) => (c.startedAt || 0) >= hourAgo);
        if (recent.length >= 2) {
          const durs = recent.map((c) => c.durationSec).filter((n) => n != null);
          const avgDur = durs.reduce((a, b) => a + b, 0) / durs.length;
          const gaps = [];
          for (let i = 0; i < recent.length - 1; i++) {
            gaps.push((recent[i].startedAt - recent[i + 1].startedAt) / 1000);
          }
          const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          statsSummary.textContent = `Last hour: ${recent.length} contractions, about ${fmtClock(avgGap)} apart, lasting ~${fmtClock(avgDur)}.`;
        } else {
          statsSummary.textContent = 'Time a few contractions to see your pattern.';
        }

        // list with frequency
        listEl.innerHTML = '';
        if (sorted.length === 0) {
          listEl.appendChild(el('p', { class: 'muted small', text: 'No contractions recorded yet.' }));
        } else {
          sorted.slice(0, 12).forEach((c, i) => {
            const next = sorted[i + 1];
            const gap = next ? (c.startedAt - next.startedAt) / 1000 : null;
            const time = new Date(c.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const parts = [`${fmtClock(c.durationSec)} long`];
            if (gap != null) parts.push(`${fmtClock(gap)} apart`);
            listEl.appendChild(
              el('div', { class: 'entry-row' }, [
                el('span', { class: 'entry-label', text: `${time} \u00b7 ${parts.join(' \u00b7 ')}` }),
              ])
            );
          });
        }

        if (sorted.length > 0) {
          listEl.appendChild(
            el('button', {
              class: 'secondary compact clear-btn',
              text: 'Clear all',
              onClick: async () => {
                for (const c of all) await Store.deleteEntry(c.id);
                render();
              },
            })
          );
        }
      });
    }

    function paintButton() {
      if (contractionStart) {
        bigButton.textContent = 'Stop';
        bigButton.classList.add('running');
        sinceLabel.textContent = 'Contraction in progress\u2026';
      } else {
        bigButton.textContent = 'Start contraction';
        bigButton.classList.remove('running');
        elapsedLabel.textContent = '';
      }
    }

    bigButton.addEventListener('click', async () => {
      if (!contractionStart) {
        contractionStart = Date.now();
        paintButton();
      } else {
        const startedAt = contractionStart;
        const endedAt = Date.now();
        contractionStart = null;
        await Store.addEntry({
          kind: 'contraction',
          startedAt,
          endedAt,
          durationSec: Math.round((endedAt - startedAt) / 1000),
          week: currentWeek(),
        });
        paintButton();
        render();
      }
    });

    // live tick: elapsed during a contraction, and time since last otherwise
    let lastStartedAt = null;
    Store.entriesOfKind('contraction').then((all) => {
      const sorted = all.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      lastStartedAt = sorted.length ? sorted[0].startedAt : null;
    });

    trackInterval(
      setInterval(() => {
        if (contractionStart) {
          elapsedLabel.textContent = fmtClock((Date.now() - contractionStart) / 1000);
        } else if (lastStartedAt) {
          sinceLabel.textContent = `${fmtClock((Date.now() - lastStartedAt) / 1000)} since last started`;
        }
      }, 1000)
    );

    paintButton();
    render();
  }

  // --- Kick counter ---
  function renderKickCounter(container) {
    const wrap = el('div', { class: 'wrap' }, [toolHeader('Kick counter')]);
    container.appendChild(wrap);

    const TARGET = 10;
    const countLabel = el('div', { class: 'timer-elapsed kick-count' });
    const elapsedLabel = el('div', { class: 'muted small' });
    const bigButton = el('button', { class: 'timer-button' });
    const resetBtn = el('button', { class: 'secondary compact', text: 'Reset session' });

    const card = el('div', { class: 'card timer-card' }, [
      countLabel,
      elapsedLabel,
      bigButton,
      resetBtn,
    ]);
    wrap.appendChild(card);

    const resultCard = el('div', { class: 'card', style: 'display:none' });
    wrap.appendChild(resultCard);

    // Movement guidance
    wrap.appendChild(
      el('div', { class: 'card guidance' }, [
        el('h3', { class: 'card-title', text: 'What movements feel like' }),
        el('p', { text: MOVEMENT_INFO.whatItFeelsLike }),
        el('h3', { class: 'card-title', text: 'When and how to count' }),
        el('p', { text: MOVEMENT_INFO.whenToCount }),
        el('p', { text: 'Tap the button each time you feel a movement. Reaching ' + TARGET + ' is a reassuring sign; most people get there well within two hours.' }),
        el('div', { class: 'callout callout-warn' }, [
          el('strong', { text: 'Important: ' }),
          document.createTextNode(MOVEMENT_INFO.warning),
        ]),
      ])
    );

    const historyCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Past sessions' }),
    ]);
    const historyList = el('div', { class: 'entry-list' });
    historyCard.appendChild(historyList);
    wrap.appendChild(historyCard);

    function renderHistory() {
      Store.entriesOfKind('kickSession').then((all) => {
        const sorted = all.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        historyList.innerHTML = '';
        if (sorted.length === 0) {
          historyList.appendChild(el('p', { class: 'muted small', text: 'No sessions yet.' }));
          return;
        }
        sorted.slice(0, 10).forEach((s) => {
          const when = new Date(s.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          historyList.appendChild(
            el('div', { class: 'entry-row' }, [
              el('span', { class: 'entry-label', text: `${when} \u00b7 ${s.count} movements in ${fmtClock(s.durationSec)}` }),
              el('button', {
                class: 'entry-delete',
                'aria-label': 'Delete',
                text: '\u00d7',
                onClick: async () => {
                  await Store.deleteEntry(s.id);
                  renderHistory();
                },
              }),
            ])
          );
        });
      });
    }

    function paint() {
      const n = kickSession ? kickSession.times.length : 0;
      countLabel.textContent = `${n} / ${TARGET}`;
      bigButton.textContent = kickSession ? 'I felt a movement' : 'Start counting';
      bigButton.classList.toggle('running', !!kickSession);
      if (kickSession) {
        elapsedLabel.textContent = fmtClock((Date.now() - kickSession.startedAt) / 1000) + ' elapsed';
      } else {
        elapsedLabel.textContent = '';
      }
    }

    bigButton.addEventListener('click', async () => {
      if (!kickSession) {
        kickSession = { startedAt: Date.now(), times: [] };
        resultCard.style.display = 'none';
        paint();
        return;
      }
      kickSession.times.push(Date.now());
      if (kickSession.times.length >= TARGET) {
        const startedAt = kickSession.startedAt;
        const completedAt = Date.now();
        const durationSec = Math.round((completedAt - startedAt) / 1000);
        await Store.addEntry({
          kind: 'kickSession',
          startedAt,
          completedAt,
          count: TARGET,
          durationSec,
          week: currentWeek(),
        });
        kickSession = null;
        resultCard.style.display = 'block';
        resultCard.innerHTML = '';
        resultCard.appendChild(el('div', { class: 'summary-emoji', text: '\ud83d\udc63' }));
        resultCard.appendChild(el('p', { class: 'summary-line', text: `You felt ${TARGET} movements in ${fmtClock(durationSec)}.` }));
        resultCard.appendChild(el('p', { class: 'muted small', text: 'A lovely sign. Keep noticing your baby\u2019s usual pattern, and reach out to your provider any time movements drop or you\u2019re unsure.' }));
        paint();
        renderHistory();
      } else {
        paint();
      }
    });

    resetBtn.addEventListener('click', () => {
      kickSession = null;
      resultCard.style.display = 'none';
      paint();
    });

    trackInterval(
      setInterval(() => {
        if (kickSession) {
          elapsedLabel.textContent = fmtClock((Date.now() - kickSession.startedAt) / 1000) + ' elapsed';
        }
      }, 1000)
    );

    paint();
    renderHistory();
  }

  // ---------------------------------------------------------------------------
  // Lists tab: flexible, named, collapsible checklists + a free-notes pad.
  // Replaces the old rigid birth-plan / questions / packing screens. Data shape:
  //   lists: [{ id, name, collapsed, items: [{ id, text, done }] }]
  //   notes: free-text string
  // Stored in settings as 'userLists' and 'userNotes'.
  // ---------------------------------------------------------------------------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function renderListsView(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Lists & notes')]);
    container.appendChild(wrap);

    wrap.appendChild(
      el('p', {
        class: 'muted small section-intro',
        text: 'Make these your own \u2014 add anything, check it off, or delete it. The starter items are just here so nothing slips through the cracks. You\u2019ve got this.',
      })
    );

    // Free notes pad
    const notesCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Notes' }),
    ]);
    const notesArea = el('textarea', {
      class: 'plan-textarea',
      rows: '4',
      placeholder: 'A place for anything \u2014 thoughts, reminders, names you\u2019re considering\u2026',
    });
    notesCard.appendChild(notesArea);
    wrap.appendChild(notesCard);

    const listsHolder = el('div', {});
    wrap.appendChild(listsHolder);

    // Add-list controls
    const addWrap = el('div', { class: 'card add-list-card' }, [
      el('h3', { class: 'card-title', text: 'Add a list' }),
    ]);
    const newNameInput = el('input', {
      type: 'text',
      class: 'food-search',
      placeholder: 'Name a new list (e.g. \u201cThings to ask mom\u201d)',
      autocomplete: 'off',
    });
    const newNameBtn = el('button', { class: 'primary compact', text: 'Create' });
    addWrap.appendChild(el('div', { class: 'q-input-row' }, [newNameInput, newNameBtn]));
    const templateRow = el('div', {});
    addWrap.appendChild(el('p', { class: 'chip-group-title', text: 'Or start from a template' }));
    addWrap.appendChild(templateRow);
    wrap.appendChild(addWrap);

    let lists = [];
    let notes = '';

    const persistLists = () => Store.setSetting('userLists', lists);
    const persistNotes = () => Store.setSetting('userNotes', notes);

    notesArea.addEventListener('input', () => {
      notes = notesArea.value;
    });
    notesArea.addEventListener('blur', persistNotes);

    function renderTemplateChips() {
      templateRow.innerHTML = '';
      const existingNames = lists.map((l) => l.name.toLowerCase());
      const available = LIST_TEMPLATES.filter(
        (t) => !existingNames.includes(t.name.toLowerCase())
      );
      if (available.length === 0) {
        templateRow.appendChild(el('p', { class: 'muted small', text: 'All templates added \u2014 build your own above.' }));
        return;
      }
      const chips = el('div', { class: 'chip-group' });
      for (const t of available) {
        chips.appendChild(
          el('button', {
            class: 'log-chip tone-neutral',
            text: '+ ' + t.name,
            onClick: () => {
              lists.unshift({
                id: uid(),
                name: t.name,
                collapsed: false,
                items: t.items.map((text) => ({ id: uid(), text, done: false })),
              });
              persistLists();
              renderLists();
            },
          })
        );
      }
      templateRow.appendChild(chips);
    }

    function renderLists() {
      listsHolder.innerHTML = '';
      if (lists.length === 0) {
        listsHolder.appendChild(
          el('div', { class: 'card' }, [
            el('p', { class: 'muted small', text: 'No lists yet. Create one below, or tap a template to get a head start.' }),
          ])
        );
      }
      for (const list of lists) {
        listsHolder.appendChild(renderOneList(list));
      }
      renderTemplateChips();
    }

    function renderOneList(list) {
      const card = el('div', { class: 'card list-card' });
      const done = list.items.filter((i) => i.done).length;

      const header = el('div', { class: 'list-head' }, [
        el('button', {
          class: 'list-toggle',
          onClick: () => {
            list.collapsed = !list.collapsed;
            persistLists();
            renderLists();
          },
        }, [
          el('span', { class: 'list-caret', text: list.collapsed ? '\u25b8' : '\u25be' }),
          el('span', { class: 'list-name', text: list.name }),
          el('span', { class: 'list-count muted small', text: `${done}/${list.items.length}` }),
        ]),
        el('button', {
          class: 'list-delete',
          'aria-label': 'Delete list',
          text: '\u2715',
          onClick: () => {
            if (confirm(`Delete the \u201c${list.name}\u201d list?`)) {
              lists = lists.filter((l) => l.id !== list.id);
              persistLists();
              renderLists();
            }
          },
        }),
      ]);
      card.appendChild(header);

      if (list.collapsed) return card;

      const body = el('div', { class: 'list-body' });

      // items
      for (const item of list.items) {
        const cb = el('input', {
          type: 'checkbox',
          checked: item.done ? 'checked' : null,
          onChange: (e) => {
            item.done = e.target.checked;
            persistLists();
            txt.classList.toggle('done', item.done);
            count.textContent = `${list.items.filter((i) => i.done).length}/${list.items.length}`;
          },
        });
        const txt = el('span', { class: 'entry-label' + (item.done ? ' done' : ''), text: item.text });
        const count = header.querySelector('.list-count');
        body.appendChild(
          el('div', { class: 'entry-row' }, [
            cb,
            txt,
            el('button', {
              class: 'entry-delete',
              'aria-label': 'Delete item',
              text: '\u00d7',
              onClick: () => {
                list.items = list.items.filter((i) => i.id !== item.id);
                persistLists();
                renderLists();
              },
            }),
          ])
        );
      }

      // add item
      const addInput = el('input', {
        type: 'text',
        class: 'food-search list-add-input',
        placeholder: 'Add an item\u2026',
        autocomplete: 'off',
      });
      const addBtn = el('button', { class: 'secondary compact', text: 'Add' });
      function addItem() {
        const text = addInput.value.trim();
        if (!text) return;
        list.items.push({ id: uid(), text, done: false });
        addInput.value = '';
        persistLists();
        renderLists();
      }
      addBtn.addEventListener('click', addItem);
      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addItem();
      });
      body.appendChild(el('div', { class: 'q-input-row list-add-row' }, [addInput, addBtn]));

      card.appendChild(body);
      return card;
    }

    function createNamed(name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      lists.unshift({ id: uid(), name: trimmed, collapsed: false, items: [] });
      persistLists();
      renderLists();
    }
    newNameBtn.addEventListener('click', () => {
      createNamed(newNameInput.value);
      newNameInput.value = '';
    });
    newNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        createNamed(newNameInput.value);
        newNameInput.value = '';
      }
    });

    Promise.all([Store.getSetting('userLists'), Store.getSetting('userNotes')]).then(
      ([savedLists, savedNotes]) => {
        lists = Array.isArray(savedLists) ? savedLists : [];
        notes = typeof savedNotes === 'string' ? savedNotes : '';
        notesArea.value = notes;
        renderLists();
      }
    );
  }

  function renderFoodView(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Can I eat this?')]);
    wrap.appendChild(
      el('div', { class: 'callout callout-warn food-disclaimer' }, [
        document.createTextNode(
          'General guidance only \u2014 always follow the advice of your doctor or ' +
          'midwife, who knows your pregnancy. Recommendations can vary by country ' +
          'and your own health.'
        ),
      ])
    );
    const input = el('input', {
      type: 'search',
      class: 'food-search',
      placeholder: 'Search a food or drink\u2026',
      autocomplete: 'off',
    });
    const results = el('div', { class: 'food-results' });

    function render(query) {
      results.innerHTML = '';
      const matches = foodSearch(query);
      if (matches.length === 0) {
        results.appendChild(
          el('p', {
            class: 'muted',
            text: 'No match. Try another term, or check with your provider.',
          })
        );
        return;
      }
      for (const item of matches) results.appendChild(foodCard(item));
    }

    input.addEventListener('input', () => render(input.value));
    wrap.appendChild(input);
    wrap.appendChild(results);
    container.appendChild(wrap);
    render('');
  }

  function foodCard(item) {
    const meta = VERDICT_META[item.verdict] || VERDICT_META.caution;
    const details = el('div', { class: 'food-details' }, [
      el('p', { text: item.why }),
      item.safeWhen
        ? el('p', { class: 'food-safewhen' }, [
            el('strong', { text: 'Make it safer: ' }),
            document.createTextNode(item.safeWhen),
          ])
        : null,
      item.source
        ? el('p', { class: 'muted small food-source', text: `Source: ${expandSource(item.source)}` })
        : null,
    ]);
    details.style.display = 'none';

    return el('div', { class: `card food-card ${meta.cls}` }, [
      el(
        'div',
        {
          class: 'food-top',
          onClick: () => {
            const open = details.style.display !== 'none';
            details.style.display = open ? 'none' : 'block';
          },
        },
        [
          el('div', { class: 'food-head' }, [
            el('span', { class: `verdict-badge ${meta.cls}`, text: meta.label }),
            el('span', { class: 'food-name', text: item.name }),
          ]),
          el('p', { class: 'food-summary', text: item.summary }),
        ]
      ),
      details,
    ]);
  }

  function renderSettingsView(container) {
    const backHeader = el('header', { class: 'app-header tool-header' }, [
      el('button', {
        class: 'back-btn',
        text: '\u2039 Back',
        onClick: () => {
          state.view = state.prevView || 'week';
          renderApp();
        },
      }),
      el('h1', { class: 'app-title', text: 'Settings' }),
    ]);
    const wrap = el('div', { class: 'wrap' }, [backHeader]);

    const unitToggle = (label, isImperial) =>
      el('button', {
        class: 'unit-btn' + (state.imperial === isImperial ? ' active' : ''),
        text: label,
        onClick: async () => {
          if (state.imperial === isImperial) return;
          state.imperial = isImperial;
          await Store.setSetting('units', isImperial ? 'imperial' : 'metric');
          renderApp();
        },
      });

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Units' }),
        el('div', { class: 'unit-row' }, [
          unitToggle('Metric (kg, cm)', false),
          unitToggle('Imperial (lb, in)', true),
        ]),
      ])
    );

    // Baby name + sex
    const nameField = el('input', {
      type: 'text',
      placeholder: 'Baby\u2019s name or nickname',
      autocomplete: 'off',
      value: state.babyName || null,
    });
    const genderSeg = el('div', { class: 'segmented gender-seg' });
    function persistBaby() {
      Store.setSetting('baby', { name: state.babyName, gender: state.gender });
    }
    for (const [key, label] of [['girl', 'Girl'], ['boy', 'Boy'], ['surprise', 'Surprise']]) {
      const b = el('button', {
        class: 'seg-btn' + (state.gender === key ? ' active' : ''),
        text: label,
        onClick: () => {
          state.gender = key;
          [...genderSeg.children].forEach((c) => c.classList.toggle('active', c.dataset.g === key));
          persistBaby();
        },
      });
      b.dataset.g = key;
      genderSeg.appendChild(b);
    }
    nameField.addEventListener('input', () => {
      state.babyName = nameField.value.trim();
    });
    nameField.addEventListener('blur', persistBaby);

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Baby' }),
        el('label', { class: 'field-label', text: 'Name (used throughout the app)' }),
        nameField,
        el('label', { class: 'field-label', text: 'Sex' }),
        genderSeg,
      ])
    );

    const lmpInput = el('input', {
      type: 'date',
      max: isoDate(new Date()),
      value: state.dating.lmp ? isoDate(state.dating.lmp) : null,
    });
    const dueInput = el('input', {
      type: 'date',
      value: state.dating.ultrasoundDueDate ? isoDate(state.dating.ultrasoundDueDate) : null,
    });
    const dueNow = dueDate(state.dating);

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Your dates' }),
        dueNow
          ? el('p', { class: 'muted small', text: `Estimated due date: ${prettyDate(dueNow)}` })
          : null,
        el('label', { class: 'field-label', text: 'First day of last period' }),
        lmpInput,
        el('label', { class: 'field-label', text: 'Ultrasound due date (preferred if known)' }),
        dueInput,
        el('button', {
          class: 'primary',
          text: 'Save dates',
          onClick: async () => {
            const lmp = parseDateInput(lmpInput.value);
            const due = parseDateInput(dueInput.value);
            if (!lmp && !due) {
              toast('Enter at least one date');
              return;
            }
            state.dating.lmp = lmp;
            state.dating.ultrasoundDueDate = due;
            await Store.setSetting('dating', {
              lmp: lmp ? lmp.getTime() : null,
              ultrasoundDueDate: due ? due.getTime() : null,
            });
            toast('Dates saved');
            renderApp();
          },
        }),
        el('p', {
          class: 'muted small',
          text: 'When an ultrasound date is set, it takes precedence over the last-period estimate.',
        }),
      ])
    );

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'About & privacy' }),
        el('p', {
          class: 'small',
          text:
            'Bloom is a private, on-device companion. Your records never leave ' +
            'this phone — there are no accounts and no servers.',
        }),
        el('div', { class: 'link-list' }, [
          el('a', { class: 'link-row', href: 'privacy.html' }, ['Privacy policy']),
          el('a', { class: 'link-row', href: 'terms.html' }, ['Terms of use']),
          el('a', { class: 'link-row', href: 'disclaimer.html' }, ['Medical disclaimer']),
          el('a', {
            class: 'link-row',
            href: 'https://github.com/dwdane/bloom-pwa/',
            target: '_blank',
            rel: 'noopener',
          }, ['View the source on GitHub (open source)']),
        ]),
      ])
    );

    wrap.appendChild(installCard());

    wrap.appendChild(
      el('p', {
        class: 'muted small disclaimer',
        text: 'Bloom is informational only and not a substitute for medical care.',
      })
    );

    container.appendChild(wrap);
  }

  // Reusable collapsible "how to install" instructions, used on the welcome
  // screen (recipients open a link, not an app store) and in Settings.
  function installCard() {
    const body = el('div', { class: 'collapsible-body' }, [
      el('p', { class: 'chip-group-title', text: 'iPhone or iPad (use Safari)' }),
      el('ul', { class: 'relief-list' }, [
        el('li', { text: 'Open this page in Safari, then tap the Share button (the square with an upward arrow).' }),
        el('li', { text: 'Scroll down and tap \u201cAdd to Home Screen,\u201d then tap Add.' }),
        el('li', { text: 'Open Bloom from its new home-screen icon.' }),
      ]),
      el('p', { class: 'chip-group-title', text: 'Android (use Chrome)' }),
      el('ul', { class: 'relief-list' }, [
        el('li', { text: 'Open this page in Chrome and tap the \u22ee menu.' }),
        el('li', { text: 'Tap \u201cInstall app\u201d (or \u201cAdd to Home screen\u201d) and confirm.' }),
      ]),
      el('p', { class: 'chip-group-title', text: 'Computer (Chrome or Edge)' }),
      el('ul', { class: 'relief-list' }, [
        el('li', { text: 'Click the install icon in the address bar, or use the browser menu \u2192 Install Bloom.' }),
      ]),
      el('p', { class: 'muted small', text: 'Installing keeps your data safer on iPhone and lets Bloom work offline.' }),
    ]);
    body.style.display = 'none';
    const toggle = el('button', {
      class: 'collapsible-toggle',
      text: 'How to install Bloom as an app  \u25be',
      onClick: () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        toggle.textContent = open
          ? 'How to install Bloom as an app  \u25be'
          : 'How to install Bloom as an app  \u25b4';
      },
    });
    return el('div', { class: 'card collapsible' }, [toggle, body]);
  }

  async function boot() {
    const dating = await Store.getSetting('dating');
    const units = await Store.getSetting('units');
    const baby = await Store.getSetting('baby');
    if (units) state.imperial = units === 'imperial';
    if (baby) {
      state.babyName = baby.name || '';
      state.gender = baby.gender || 'surprise';
    }
    state.logDate = todayISO();

    if (dating && (dating.lmp || dating.ultrasoundDueDate)) {
      state.dating.lmp = dating.lmp ? new Date(dating.lmp) : null;
      state.dating.ultrasoundDueDate = dating.ultrasoundDueDate
        ? new Date(dating.ultrasoundDueDate)
        : null;
      renderApp();
      maybeCelebrateNewWeek();
    } else {
      renderSetup();
    }
  }

  boot();
})();
