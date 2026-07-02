// app.js
// App shell with bottom navigation, plus the Week, Log, Food, and Settings
// views. Plain IndexedDB storage. Built to extend (symptom logging and a fuller
// trends view slot into the Log tab later).

(() => {
  const root = document.getElementById('app');
  const APP_VERSION = 'v28';

  const state = {
    dating: { lmp: null, ultrasoundDueDate: null },
    imperial: true,
    babyName: '',
    gender: 'surprise', // 'girl' | 'boy' | 'surprise'
    theme: 'fruit', // size comparison theme: 'fruit' | 'sport'
    view: 'week',
    viewWeek: null,
    prevView: 'week',
    tool: null, // within Tools: 'contraction' | 'kick' | 'birthplan' | 'questions'
    logTab: 'feelings', // within Log: 'feelings' | 'weight' | 'bump'
    logDate: null, // selected day (ISO) for daily logging; defaults to today
    lifeStage: 'pregnancy', // 'pregnancy' | 'baby'
    child: null, // { birthDate, birthTime, gaDays } once baby arrives
    babyDay: null, // selected day (ISO) for the baby Day view
  };

  // Whether the browser granted persistent storage (null until known).
  let persistGranted = null;

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

  // Height is stored canonically in cm. Imperial display is feet/inches.
  function formatHeight(cm) {
    if (cm == null) return null;
    if (state.imperial) {
      const totalIn = cm / 2.54;
      const ft = Math.floor(totalIn / 12);
      const inch = Math.round(totalIn - ft * 12);
      return `${ft}\u2032${inch}\u2033`;
    }
    return Math.round(cm) + ' cm';
  }

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
  // Millisecond timestamp of the day an entry represents (for time-axis charts).
  function entryDateMs(e) {
    if (e.date) return new Date(e.date + 'T00:00:00').getTime();
    return e.createdAt || Date.now();
  }

  // Run after any user log: celebrate milestones, then re-render.
  async function afterLog() {
    await checkMilestones();
    renderApp();
  }

  // Build the feeling/symptom chip groups (shared by the Log tab and the
  // Today card). Logs to the given day and runs afterLog() on tap.
  function feelingChipGroups(week, dayIso, container) {
    for (const category of LOG_CATEGORIES) {
      container.appendChild(el('p', { class: 'chip-group-title', text: category.title }));
      const group = el('div', { class: 'chip-group' });
      for (const option of category.options) {
        group.appendChild(
          el('button', {
            class: `log-chip tone-${option.tone}`,
            onClick: async () => {
              await Store.addEntry({ kind: option.kind, label: option.label, week, date: dayIso });
              toast(`Logged: ${option.label}`);
              afterLog();
            },
          }, [
            option.emoji ? el('span', { class: 'chip-emoji', text: option.emoji }) : null,
            document.createTextNode(option.label),
          ])
        );
      }
      container.appendChild(group);
    }
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

  // Height entry: feet+inches for imperial, single cm field for metric.
  // Resolves to centimeters (or null on cancel).
  function heightDialog(currentCm) {
    return new Promise((resolve) => {
      const overlay = el('div', { class: 'modal-overlay' });
      function close(cm) {
        overlay.remove();
        resolve(cm);
      }
      let inputs;
      if (state.imperial) {
        const totalIn = currentCm != null ? currentCm / 2.54 : null;
        const ftVal = totalIn != null ? Math.floor(totalIn / 12) : '';
        const inVal = totalIn != null ? Math.round(totalIn - Math.floor(totalIn / 12) * 12) : '';
        const ft = el('input', { type: 'number', inputmode: 'numeric', step: '1', placeholder: 'ft', value: ftVal === '' ? null : String(ftVal) });
        const inch = el('input', { type: 'number', inputmode: 'numeric', step: '1', placeholder: 'in', value: inVal === '' ? null : String(inVal) });
        inputs = { ft, inch };
        var rows = el('div', { class: 'modal-input-row' }, [
          ft, el('span', { class: 'modal-unit', text: 'ft' }),
          inch, el('span', { class: 'modal-unit', text: 'in' }),
        ]);
      } else {
        const cm = el('input', { type: 'number', inputmode: 'numeric', step: '1', placeholder: 'cm', value: currentCm != null ? String(Math.round(currentCm)) : null });
        inputs = { cm };
        var rows = el('div', { class: 'modal-input-row' }, [cm, el('span', { class: 'modal-unit', text: 'cm' })]);
      }
      const dialog = el('div', { class: 'modal' }, [
        el('h3', { text: 'Your height' }),
        rows,
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'secondary', text: 'Cancel', onClick: () => close(null) }),
          el('button', {
            class: 'primary compact',
            text: 'Save',
            onClick: () => {
              if (state.imperial) {
                const f = parseFloat(inputs.ft.value) || 0;
                const i = parseFloat(inputs.inch.value) || 0;
                const cm = (f * 12 + i) * 2.54;
                close(cm > 0 ? cm : null);
              } else {
                const cm = parseFloat(inputs.cm.value);
                close(Number.isFinite(cm) && cm > 0 ? cm : null);
              }
            },
          }),
        ]),
      ]);
      overlay.appendChild(dialog);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
      root.appendChild(overlay);
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
    else if (state.view === 'home') renderBabyHome(content);
    else if (state.view === 'day') renderBabyDay(content);
    else if (state.view === 'growth') renderBabyGrowth(content);
    else if (state.view === 'arrival') renderArrivalView(content);

    if (state.view === 'week') {
      maybeArrivalPrompt(content);
      journeyBanner(content);
    }

    const toolsIcon = '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.3L4 17v3h3l5.4-5.3a4 4 0 0 1 5.3-5.4l-2.6 2.6-2-2 2.6-2.6Z"/>';
    const listsIcon = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
    const foodIcon = '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><line x1="6" y1="9" x2="6" y2="22"/><path d="M17 2c-1.5 1-2 3-2 5s.5 4 2 5v10"/>';
    const navItems =
      state.lifeStage === 'baby'
        ? [
            navItem('home', 'Home', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z"/>'),
            navItem('day', 'Day', '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'),
            navItem('tools', 'Tools', toolsIcon),
            navItem('lists', 'Lists', listsIcon),
            navItem('food', 'Food', foodIcon),
          ]
        : [
            navItem('week', 'Week', '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
            navItem('log', 'Log', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
            navItem('tools', 'Tools', toolsIcon),
            navItem('lists', 'Lists', listsIcon),
            navItem('food', 'Food', foodIcon),
          ];
    const nav = el('nav', { class: 'tabbar' }, navItems);

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

  // A brief shower of an emoji with an optional banner. Reused for new weeks,
  // logging streaks, weight-gain milestones, and lively kick sessions.
  function emojiRain(emoji, title, sub, opts = {}) {
    const layer = el('div', { class: 'celebrate-layer' });
    if (title) {
      layer.appendChild(
        el('div', { class: 'celebrate-banner' }, [
          el('div', { class: 'celebrate-week', text: title }),
          sub ? el('div', { class: 'celebrate-sub', text: sub }) : null,
        ])
      );
    }
    const count = opts.count || 20;
    for (let i = 0; i < count; i++) {
      const drop = el('div', { class: 'celebrate-drop', text: emoji });
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDelay = Math.random() * 0.6 + 's';
      drop.style.animationDuration = 1.5 + Math.random() * 1.2 + 's';
      drop.style.fontSize = 1.3 + Math.random() * 1.5 + 'rem';
      layer.appendChild(drop);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.classList.add('fade'), title ? 2200 : 1900);
    setTimeout(() => layer.remove(), title ? 2900 : 2600);
  }

  async function maybeCelebrateNewWeek() {
    if (state.lifeStage === 'baby') return;
    const wk = currentWeek();
    const lastSeen = await Store.getSetting('lastSeenWeek');
    if (lastSeen == null) {
      await Store.setSetting('lastSeenWeek', wk);
      return;
    }
    if (wk > lastSeen && wk >= WEEK_MIN && wk <= WEEK_MAX) {
      await Store.setSetting('lastSeenWeek', wk);
      const compare = comparisonFor(wk, state.theme);
      emojiRain(compare.emoji, `Week ${wk}`, `${babyLabel()} is growing \u2014 here we go!`);
    }
  }

  // Compact "today" tracker shown on the Week (home) page: quick log buttons
  // for weight, bump, feelings, and movements, and a concise read-out of what's
  // already logged today so it's easy to see the day was tracked.
  function todayCard() {
    const dayIso = todayISO();
    const week = currentWeek();
    const card = el('div', { class: 'card today-card' }, [
      el('h3', { class: 'card-title', text: 'Today' }),
    ]);
    const rows = el('div', { class: 'today-rows' });
    card.appendChild(rows);

    function quickLogWeight(kind, dialogTitle, unit, toStored) {
      return async () => {
        const entered = await numberDialog({ title: dialogTitle, unit: unit() });
        if (entered == null) return;
        await Store.addEntry({ kind, value: toStored(entered), week, date: dayIso });
        toast(`Logged ${entered.toFixed(1)} ${unit()}`);
        afterLog();
      };
    }

    function row(label, valueEl, actionEl) {
      return el('div', { class: 'today-row' }, [
        el('span', { class: 'today-label', text: label }),
        el('span', { class: 'today-value' }, [valueEl]),
        actionEl,
      ]);
    }

    function logBtn(text, onClick) {
      return el('button', { class: 'today-log-btn', text, onClick });
    }

    Store.entriesForDate(dayIso).then((entries) => {
      rows.innerHTML = '';

      // Weight
      const w = entries.filter((e) => e.kind === 'weight').sort((a, b) => b.createdAt - a.createdAt)[0];
      rows.appendChild(
        row(
          'Weight',
          w ? el('span', { class: 'today-num', text: fromStoredWeight(w.value).toFixed(1) + ' ' + weightUnit() }) : el('span', { class: 'muted small', text: 'Not logged' }),
          logBtn(w ? 'Update' : 'Log', quickLogWeight('weight', 'Log weight', weightUnit, toStoredWeight))
        )
      );

      // Bump
      const b = entries.filter((e) => e.kind === 'bump').sort((a, b) => b.createdAt - a.createdAt)[0];
      rows.appendChild(
        row(
          'Bump',
          b ? el('span', { class: 'today-num', text: fromStoredBump(b.value).toFixed(1) + ' ' + bumpUnit() }) : el('span', { class: 'muted small', text: 'Not logged' }),
          logBtn(b ? 'Update' : 'Log', quickLogWeight('bump', 'Log bump size', bumpUnit, toStoredBump))
        )
      );

      // Feelings / symptoms — concise list, with an inline picker
      const feels = entries.filter((e) => e.kind === 'feeling' || e.kind === 'symptom');
      const picker = el('div', { class: 'today-picker', style: 'display:none' });
      feelingChipGroups(week, dayIso, picker);
      let valueNode;
      if (feels.length) {
        const shown = feels.slice(0, 6).map((e) => (emojiForLabel(e.label) || '') + ' ' + e.label).join('  ');
        const extra = feels.length > 6 ? `  +${feels.length - 6}` : '';
        valueNode = el('span', { class: 'today-feels small', text: shown + extra });
      } else {
        valueNode = el('span', { class: 'muted small', text: 'Not logged' });
      }
      const feelToggle = logBtn(feels.length ? 'Add' : 'Log', () => {
        picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
      });
      rows.appendChild(row('Feelings', valueNode, feelToggle));
      rows.appendChild(picker);

      // Movements — quick tap logger with a collapsed timestamp list
      const kicks = entries
        .filter((e) => e.kind === 'kick')
        .sort((a, b) => a.createdAt - b.createdAt);
      const kickValue = el('span', {}, [
        kicks.length
          ? el('span', { class: 'today-num', text: `${kicks.length} \ud83d\udc63` })
          : el('span', { class: 'muted small', text: 'None yet' }),
      ]);
      const kickBtn = logBtn('+ Movement', async () => {
        await Store.addEntry({ kind: 'kick', week, date: dayIso });
        toast('Movement logged \ud83d\udc63');
        afterLog();
      });
      rows.appendChild(row('Movements', kickValue, kickBtn));

      // collapsed timestamp list
      if (kicks.length) {
        const tlBody = el('div', { class: 'collapsible-body today-kick-times', style: 'display:none' });
        tlBody.appendChild(
          el('div', { class: 'kick-time-chips' },
            kicks.map((k) =>
              el('span', { class: 'kick-time-chip', text: new Date(k.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })
            )
          )
        );
        const tlToggle = el('button', {
          class: 'collapsible-toggle today-kick-toggle',
          text: `See ${kicks.length} movement time${kicks.length === 1 ? '' : 's'}  \u25be`,
          onClick: () => {
            const open = tlBody.style.display !== 'none';
            tlBody.style.display = open ? 'none' : 'block';
            tlToggle.textContent = (open ? `See ${kicks.length} movement time${kicks.length === 1 ? '' : 's'}  \u25be` : 'Hide times  \u25b4');
          },
        });
        rows.appendChild(tlToggle);
        rows.appendChild(tlBody);
      }
    });

    return card;
  }

  // Turn an item name into an image-file slug, e.g. "a small pumpkin" ->
  // "small-pumpkin". Sport entries can override this with an explicit `img`.
  function comparisonSlug(name) {
    return name
      .replace(/^(a|an)\s+/i, '')
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  // The size-comparison visual for a week. Tries a custom image first
  // (<theme>-<slug>.png in the repo root, e.g. fruit-pomegranate.png); if it
  // isn't present, the themed emoji stays. Art can be added incrementally.
  function comparisonVisual(week) {
    const c = comparisonFor(week, state.theme);
    const holder = el('div', { class: 'hero-emoji', text: c.emoji });
    const key = c.img || comparisonSlug(c.name);
    const img = new Image();
    img.className = 'hero-art';
    img.alt = c.name;
    img.onload = () => {
      holder.textContent = '';
      holder.appendChild(img);
    };
    img.src = `${state.theme}-${key}.png`;
    return holder;
  }

  function renderWeekView(container) {
    const age = ageAt(state.dating);
    const liveWeek = age ? age.weeks : WEEK_MIN;
    const week = state.viewWeek != null ? state.viewWeek : Math.min(liveWeek, WEEK_MAX);
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

    const compare = comparisonFor(info.week, state.theme);
    const compareText = /^(a |an )/i.test(compare.name)
      ? `About the size of ${compare.name}`
      : compare.name.charAt(0).toUpperCase() + compare.name.slice(1);
    const heroChildren = [
      comparisonVisual(info.week),
      el('div', { class: 'hero-week', text: `Week ${info.week}` }),
    ];
    if (babyName()) {
      heroChildren.push(el('div', { class: 'hero-name', text: babyName() }));
    }
    heroChildren.push(el('div', { class: 'hero-fruit', text: compareText }));
    if (measure) {
      heroChildren.push(el('div', { class: 'hero-measure', text: measure + lengthNote }));
    }
    if (trimesterLabel && !isOther) {
      const heroChips = el('div', { class: 'hero-chips' });
      heroChips.appendChild(el('div', { class: 'chip', text: trimesterLabel }));
      heroChildren.push(heroChips);
    }
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
        todayCard(),
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
    feelingChipGroups(week, dayIso, feelingsCard);
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
              afterLog();
            },
          }),
        ])
      );

      const latestEl = el('div', { class: 'measure-latest', text: '\u2014' });
      const note = el('p', { class: 'muted small' });
      card.appendChild(latestEl);
      card.appendChild(note);

      // Optional stat strip (start / current / change) + height — weight only
      const statStrip = opts.showStats ? el('div', { class: 'measure-stats' }) : null;
      const heightRow = opts.showStats ? el('div', { class: 'height-row' }) : null;
      if (statStrip) card.appendChild(statStrip);
      if (heightRow) card.appendChild(heightRow);

      if (opts.help) card.appendChild(opts.help());

      // Optional history table (date / week / value / change)
      const tableHolder = opts.showTable ? el('div', { class: 'measure-table-holder' }) : null;
      if (tableHolder) card.appendChild(tableHolder);

      card.appendChild(trendDisclosure(opts));

      function renderHeight(heightCm) {
        if (!heightRow) return;
        heightRow.innerHTML = '';
        const h = formatHeight(heightCm);
        heightRow.appendChild(el('span', { class: 'muted small', text: 'Height' }));
        heightRow.appendChild(el('span', { class: 'height-val', text: h || 'Not set' }));
        heightRow.appendChild(
          el('button', {
            class: 'link-btn small',
            text: h ? 'Edit' : 'Add',
            onClick: async () => {
              const cm = await heightDialog(heightCm);
              if (cm == null) return;
              await Store.setSetting('height', cm);
              renderHeight(cm);
            },
          })
        );
        // pre-pregnancy / starting weight (optional; defaults to first logged)
        heightRow.appendChild(el('span', { class: 'muted small height-sep', text: 'Start weight' }));
        heightRow.appendChild(
          el('button', {
            class: 'link-btn small',
            text: 'Set',
            onClick: async () => {
              const entered = await numberDialog({ title: 'Starting weight', unit: opts.unit() });
              if (entered == null) return;
              await Store.setSetting('startWeight', opts.toStored(entered));
              renderApp();
            },
          })
        );
      }

      Promise.all([
        Store.entriesOfKind(opts.kind),
        opts.showStats ? Store.getSetting('startWeight') : Promise.resolve(null),
        opts.showStats ? Store.getSetting('height') : Promise.resolve(null),
      ]).then(([entries, startW, heightCm]) => {
        if (entries.length === 0) {
          latestEl.textContent = 'Not logged yet';
          note.textContent = opts.emptyHint;
          if (statStrip) statStrip.style.display = 'none';
          renderHeight(heightCm);
          if (tableHolder) tableHolder.innerHTML = '';
          return;
        }
        const last = entries[entries.length - 1];
        const first = entries[0];
        latestEl.textContent = opts.fromStored(last.value).toFixed(1) + ' ' + opts.unit();
        note.textContent = entries.length < 2 ? 'Log once more to start a trend.' : opts.encourage;

        // stat strip
        if (statStrip) {
          const startStored = startW != null ? startW : first.value;
          const startDisp = opts.fromStored(startStored);
          const currentDisp = opts.fromStored(last.value);
          const change = currentDisp - startDisp;
          const sign = change >= 0 ? '+' : '';
          statStrip.style.display = 'flex';
          statStrip.innerHTML = '';
          const stat = (val, key) => el('div', {}, [
            el('div', { class: 'ms-val', text: val }),
            el('div', { class: 'ms-key muted small', text: key }),
          ]);
          statStrip.appendChild(stat(startDisp.toFixed(1) + ' ' + opts.unit(), startW != null ? 'Start' : 'First logged'));
          statStrip.appendChild(stat(currentDisp.toFixed(1) + ' ' + opts.unit(), 'Current'));
          statStrip.appendChild(stat(sign + change.toFixed(1), 'Change'));
        }
        renderHeight(heightCm);

        // table
        if (tableHolder) {
          tableHolder.innerHTML = '';
          const table = el('table', { class: 'data-table' });
          table.appendChild(
            el('thead', {}, [
              el('tr', {}, [
                el('th', { text: 'Date' }),
                el('th', { text: 'Week' }),
                el('th', { text: opts.title === 'Weight' ? 'Weight' : 'Size' }),
                el('th', { text: 'Change' }),
              ]),
            ])
          );
          const tbody = el('tbody', {});
          // entries are sorted ascending by represented date; change = vs previous
          const rows = entries.map((e, i) => {
            const prev = entries[i - 1];
            const disp = opts.fromStored(e.value);
            const delta = prev != null ? disp - opts.fromStored(prev.value) : null;
            const dateStr = new Date(entryDateMs(e)).toLocaleDateString([], { month: 'short', day: 'numeric' });
            return { e, disp, delta, dateStr };
          });
          rows.reverse().forEach(({ e, disp, delta, dateStr }) => {
            const sign = delta == null ? '' : delta >= 0 ? '+' : '';
            tbody.appendChild(
              el('tr', {}, [
                el('td', { text: dateStr }),
                el('td', { text: e.week != null ? String(e.week) : '\u2014' }),
                el('td', { text: disp.toFixed(1) + ' ' + opts.unit() }),
                el('td', { class: 'td-change', text: delta == null ? '\u2014' : sign + delta.toFixed(1) }),
              ])
            );
          });
          table.appendChild(tbody);
          tableHolder.appendChild(table);
        }
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
        showStats: true,
        showTable: true,
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
        showTable: true,
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
      Store.entriesForDate(dayIso).then((allDayEntries) => {
        const isToday = dayIso === todayISO();
        // movements are tracked separately (on the home card); summarize, don't list each
        const kicks = allDayEntries.filter((e) => e.kind === 'kick');
        const entries = allDayEntries.filter((e) => e.kind !== 'kick');
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
        const subLines = [];
        if (good > 0) subLines.push(`${good} good moment${good === 1 ? '' : 's'} \ud83d\udc9b`);
        if (kicks.length) subLines.push(`${kicks.length} movement${kicks.length === 1 ? '' : 's'} \ud83d\udc63`);
        summary.appendChild(
          el('div', {}, [
            el('div', {
              class: 'summary-line',
              text:
                total === 0 && kicks.length === 0
                  ? (isToday ? 'Nothing logged yet today' : 'Nothing logged that day')
                  : total === 0
                  ? (isToday ? 'Movements logged today' : 'Movements logged that day')
                  : `${total} thing${total === 1 ? '' : 's'} logged ${isToday ? 'today' : 'that day'}`,
            }),
            subLines.length
              ? el('div', { class: 'summary-sub muted small', text: subLines.join('  \u00b7  ') })
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
          x: entryDateMs(e),
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

  // --- Birth plan ---
  function renderBirthPlan(container) {
    const wrap = el('div', { class: 'wrap' }, [toolHeader('Birth plan')]);
    container.appendChild(wrap);

    let plan = { checked: {}, custom: {}, notes: '' };
    const openInfo = new Set();
    const openQ = new Set();
    let previewing = false;
    const persist = () => Store.setSetting('birthPlan', plan);

    const optById = {};
    for (const s of BIRTH_PLAN.sections)
      for (const g of s.groups) for (const o of g.options) optById[o.id] = o;

    wrap.appendChild(
      el('div', { class: 'card bp-intro' }, [
        el('p', { class: 'bp-encourage', text: BIRTH_PLAN.intro }),
        el('p', { class: 'muted small', text: BIRTH_PLAN.disclaimer }),
      ])
    );

    const body = el('div', {});
    wrap.appendChild(body);

    function addOption(id) {
      plan.checked[id] = true;
      persist();
      render();
    }
    function removeOption(id) {
      delete plan.checked[id];
      persist();
      render();
    }
    function removeCustom(sectionId, itemId) {
      plan.custom[sectionId] = (plan.custom[sectionId] || []).filter((i) => i.id !== itemId);
      persist();
      render();
    }

    function chosenRow(opt) {
      const main = el('div', { class: 'bp-row-main' }, [
        el('span', { class: 'bp-row-label', text: opt.label }),
      ]);
      if (opt.info) {
        const expanded = openInfo.has(opt.id);
        main.appendChild(
          el('button', {
            class: 'bp-why' + (expanded ? ' on' : ''),
            text: expanded ? 'Hide' : 'Why?',
            onClick: () => {
              if (openInfo.has(opt.id)) openInfo.delete(opt.id);
              else openInfo.add(opt.id);
              render();
            },
          })
        );
        if (expanded) main.appendChild(el('p', { class: 'bp-info', text: opt.info }));
      }
      const del = el('button', {
        class: 'bp-del',
        text: '\u00d7',
        'aria-label': 'Remove ' + opt.label,
        onClick: () => removeOption(opt.id),
      });
      return el('div', { class: 'bp-row' }, [main, del]);
    }

    function customRow(sectionId, item) {
      const main = el('div', { class: 'bp-row-main' }, [
        el('span', { class: 'bp-row-label', text: item.text }),
      ]);
      const del = el('button', {
        class: 'bp-del',
        text: '\u00d7',
        'aria-label': 'Remove',
        onClick: () => removeCustom(sectionId, item.id),
      });
      return el('div', { class: 'bp-row' }, [main, del]);
    }

    function addControls(section) {
      const sel = el('select', { class: 'bp-select', 'aria-label': 'Add a preference to ' + section.title });
      sel.appendChild(el('option', { value: '' }, '\uff0b  Add a preference\u2026'));
      for (const g of section.groups) {
        const avail = g.options.filter((o) => !plan.checked[o.id]);
        if (!avail.length) continue;
        const og = el('optgroup', { label: g.label });
        for (const o of avail) og.appendChild(el('option', { value: o.id }, o.label));
        sel.appendChild(og);
      }
      sel.addEventListener('change', () => {
        if (sel.value) addOption(sel.value);
      });

      const input = el('input', {
        type: 'text',
        class: 'plan-textarea bp-add-input',
        placeholder: 'Or add your own\u2026',
        autocomplete: 'off',
      });
      const addBtn = el('button', { class: 'primary compact', text: 'Add' });
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        if (!plan.custom[section.id]) plan.custom[section.id] = [];
        plan.custom[section.id].push({ id: uid(), text: v });
        input.value = '';
        persist();
        render();
      };
      addBtn.addEventListener('click', add);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') add();
      });

      return el('div', { class: 'bp-add' }, [sel, el('div', { class: 'q-input-row' }, [input, addBtn])]);
    }

    function renderSection(section) {
      const qOpen = openQ.has(section.id);
      const head = el('div', { class: 'bp-head' }, [
        el('h3', { class: 'card-title bp-title', text: section.title }),
        el('button', {
          class: 'bp-qbtn' + (qOpen ? ' on' : ''),
          text: '?',
          'aria-label': 'Questions to think through for ' + section.title,
          onClick: () => {
            if (openQ.has(section.id)) openQ.delete(section.id);
            else openQ.add(section.id);
            render();
          },
        }),
      ]);
      const card = el('div', { class: 'card bp-section' }, [head]);
      if (section.blurb) card.appendChild(el('p', { class: 'muted small bp-blurb', text: section.blurb }));

      if (qOpen) {
        card.appendChild(
          el('div', { class: 'bp-questions' }, [
            el('p', { class: 'bp-q-intro', text: 'A few things to think through:' }),
            el('ul', { class: 'bp-q-list' }, section.questions.map((q) => el('li', { text: q }))),
          ])
        );
      }

      const rows = [];
      for (const g of section.groups)
        for (const o of g.options) if (plan.checked[o.id]) rows.push(chosenRow(o));
      for (const item of plan.custom[section.id] || []) rows.push(customRow(section.id, item));

      if (rows.length) card.appendChild(el('div', { class: 'bp-list' }, rows));
      else
        card.appendChild(
          el('p', { class: 'bp-empty', text: 'Nothing added yet \u2014 pick from the list below, or add your own.' })
        );

      card.appendChild(addControls(section));
      return card;
    }

    function buildPlanText() {
      const lines = [];
      lines.push(babyName() ? 'Birth preferences for ' + babyName() : 'Birth preferences');
      lines.push('');
      for (const section of BIRTH_PLAN.sections) {
        const chosen = [];
        for (const g of section.groups)
          for (const o of g.options) if (plan.checked[o.id]) chosen.push(o.label);
        for (const item of plan.custom[section.id] || []) chosen.push(item.text);
        if (!chosen.length) continue;
        lines.push(section.title + ':');
        for (const c of chosen) lines.push('  \u2022 ' + c);
        lines.push('');
      }
      if (plan.notes && plan.notes.trim()) {
        lines.push('Anything else:');
        lines.push('  ' + plan.notes.trim());
        lines.push('');
      }
      lines.push(
        '\u2014 We know things may change, and our priority is a safe, healthy birth for baby and me. Thank you for your care.'
      );
      return lines.join('\n');
    }

    function doCopy(text, btn) {
      const done = () => {
        const orig = btn.textContent;
        btn.textContent = 'Copied \u2713';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        done();
      }
    }

    function renderPreview() {
      body.innerHTML = '';
      const text = buildPlanText();
      const ta = el('textarea', { class: 'plan-textarea bp-preview', rows: '18', readonly: 'readonly' });
      ta.value = text;
      const copyBtn = el('button', { class: 'primary', text: 'Copy to clipboard' });
      copyBtn.addEventListener('click', () => doCopy(text, copyBtn));
      body.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { class: 'card-title', text: 'Your birth plan' }),
          el('p', {
            class: 'muted small',
            text: 'Copy this to share with your team, or take a screenshot. You can keep editing anytime.',
          }),
          ta,
          el('div', { class: 'bp-preview-actions' }, [
            copyBtn,
            el('button', {
              class: 'ghost-btn',
              text: '\u2039 Back to editing',
              onClick: () => {
                previewing = false;
                render();
              },
            }),
          ]),
        ])
      );
    }

    function render() {
      if (previewing) return renderPreview();
      body.innerHTML = '';
      for (const section of BIRTH_PLAN.sections) body.appendChild(renderSection(section));

      const notesArea = el('textarea', {
        class: 'plan-textarea',
        rows: '3',
        placeholder: 'Anything else you want your team to know\u2026',
      });
      notesArea.value = plan.notes || '';
      notesArea.addEventListener('input', () => {
        plan.notes = notesArea.value;
      });
      notesArea.addEventListener('blur', persist);
      body.appendChild(
        el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'Anything else' }), notesArea])
      );

      body.appendChild(
        el('button', {
          class: 'primary bp-preview-btn',
          text: 'Preview my plan',
          onClick: () => {
            previewing = true;
            render();
          },
        })
      );
    }

    render();
    Store.getSetting('birthPlan').then((saved) => {
      if (saved) {
        plan = { checked: saved.checked || {}, custom: saved.custom || {}, notes: saved.notes || '' };
        render();
      }
    });
  }

  // ===========================================================================
  // Baby mode — care logging, day timeline, growth, arrival flow, and backup.
  // Activated when life stage flips to 'baby'; pregnancy data stays intact and
  // viewable as the "pregnancy journey".
  // ===========================================================================

  const CHILD_ID = 'c1';
  const ML_PER_OZ = 29.5735;
  const HOUR_MS = 3600000;

  function fmtAmount(ml) {
    if (ml == null) return '';
    return state.imperial ? (ml / ML_PER_OZ).toFixed(1) + ' oz' : Math.round(ml) + ' ml';
  }

  function durShort(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }

  function clockStr(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function timeAgo(ts) {
    return durShort(Date.now() - ts) + ' ago';
  }

  function childBirthDate() {
    return state.child ? new Date(state.child.birthDate + 'T00:00:00') : null;
  }

  function childAgeText() {
    const b = childBirthDate();
    if (!b) return '';
    const d = Math.floor((midnight(new Date()) - midnight(b)) / MS_DAY);
    if (d <= 0) return 'Born today';
    if (d === 1) return '1 day old';
    if (d < 21) return d + ' days old';
    if (d < 112) {
      const w = Math.floor(d / 7);
      const r = d % 7;
      return w + 'w' + (r ? ' ' + r + 'd' : '') + ' old';
    }
    return Math.floor(d / 30.44) + ' months old';
  }

  async function saveEvent(ev) {
    await Store.putEvent({ id: uid(), childId: CHILD_ID, notes: null, ...ev });
  }

  function dayBounds(dayIso) {
    const start = new Date(dayIso + 'T00:00:00').getTime();
    return { start, end: start + MS_DAY };
  }

  // Events overlapping a given day (a sleep that started the evening before
  // still belongs to today's picture). Lower bound widened to catch spans.
  async function eventsForDay(dayIso) {
    const { start, end } = dayBounds(dayIso);
    const rows = await Store.eventsInRange(start - 36 * HOUR_MS, end - 1);
    return rows.filter((e) => e.start < end && (e.end || e.start) >= start);
  }

  function sleepMsInDay(events, dayIso, activeSleep) {
    const { start, end } = dayBounds(dayIso);
    let total = 0;
    for (const e of events) {
      if (e.type !== 'sleep' || !e.end) continue;
      total += Math.max(0, Math.min(e.end, end) - Math.max(e.start, start));
    }
    if (activeSleep) {
      const now = Date.now();
      if (activeSleep.start < end && now >= start) {
        total += Math.max(0, Math.min(now, end) - Math.max(activeSleep.start, start));
      }
    }
    return total;
  }

  function daySummary(events, dayIso, activeSleep) {
    const feeds = events.filter((e) => e.type === 'nurse' || e.type === 'bottle').length;
    const diapers = events.filter((e) => e.type === 'diaper').length;
    const bottleMl = events.filter((e) => e.type === 'bottle').reduce((n, e) => n + (e.amountMl || 0), 0);
    const pumpMl = events.filter((e) => e.type === 'pump').reduce((n, e) => n + (e.amountMl || 0), 0);
    const sleepMs = sleepMsInDay(events, dayIso, activeSleep);
    return { feeds, diapers, bottleMl, pumpMl, sleepMs };
  }

  function summaryLine(sum) {
    return 'Sleep ' + durShort(sum.sleepMs) + ' \u00b7 Feeds ' + sum.feeds + ' \u00b7 Diapers ' + sum.diapers;
  }

  function eventDesc(e) {
    if (e.type === 'nurse') {
      const side = e.side === 'L' ? 'left' : 'right';
      return 'Nursed ' + side + (e.end ? ' \u00b7 ' + durShort(e.end - e.start) : '');
    }
    if (e.type === 'bottle') return 'Bottle \u00b7 ' + fmtAmount(e.amountMl);
    if (e.type === 'pump') {
      const side = e.side === 'L' ? ' left' : e.side === 'R' ? ' right' : '';
      return 'Pumped' + side + ' \u00b7 ' + fmtAmount(e.amountMl);
    }
    if (e.type === 'sleep') return 'Sleep' + (e.end ? ' \u00b7 ' + durShort(e.end - e.start) : '');
    if (e.type === 'diaper') return 'Diaper \u00b7 ' + (e.kind || '');
    return e.type;
  }

  function eventTimeLabel(e) {
    if (e.type === 'sleep' || e.type === 'nurse') {
      return clockStr(e.start) + '\u2013' + (e.end ? clockStr(e.end) : 'now');
    }
    return clockStr(e.start);
  }

  // Two-tap confirmation: first tap arms the button, second tap commits.
  function twoTap(btn, armedText, fn) {
    let armed = false;
    let original = null;
    let timer = null;
    const reset = () => {
      armed = false;
      if (original != null) btn.textContent = original;
      btn.classList.remove('armed');
      if (timer) clearTimeout(timer);
      timer = null;
    };
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        original = btn.textContent;
        btn.textContent = armedText;
        btn.classList.add('armed');
        timer = setTimeout(reset, 3500);
      } else {
        reset();
        fn();
      }
    });
    return btn;
  }

  // --- arrival ---

  function maybeArrivalPrompt(content) {
    if (state.lifeStage !== 'pregnancy') return;
    const age = ageAt(state.dating);
    if (!age || age.weeks < 39) return;
    const due = dueDate(state.dating);
    const overdue = due ? midnight(new Date()) > midnight(due) : false;
    const card = el('div', { class: 'card arrive-card' }, [
      el('h3', { class: 'card-title', text: overdue ? 'Any day now' : 'Almost there' }),
      el('p', {
        class: 'muted small',
        text: (overdue
          ? 'Past the due date is still right on time \u2014 babies keep their own schedule. '
          : 'No pressure \u2014 ') +
          'Whenever ' + babyLabel() + ' arrives, tap below and Bloom grows into a baby tracker. Nothing to reinstall.',
      }),
      el('button', {
        class: 'primary',
        text: 'Baby has arrived',
        onClick: () => {
          state.prevView = 'week';
          state.view = 'arrival';
          renderApp();
        },
      }),
    ]);
    const target = content.firstElementChild || content;
    target.insertBefore(card, target.children[1] || null);
  }

  function journeyBanner(content) {
    if (state.lifeStage !== 'baby') return;
    const card = el('div', { class: 'card arrive-card' }, [
      el('p', { class: 'muted small', text: 'You\u2019re looking back at the pregnancy journey.' }),
      el('button', {
        class: 'secondary compact',
        text: '\u2039 Back to ' + babyLabel(),
        onClick: () => {
          state.view = 'home';
          renderApp();
        },
      }),
    ]);
    const target = content.firstElementChild || content;
    target.insertBefore(card, target.children[1] || null);
  }

  function renderArrivalView(container) {
    const backHeader = el('header', { class: 'app-header tool-header' }, [
      el('button', {
        class: 'back-btn',
        text: '\u2039 Back',
        onClick: () => {
          state.view = state.prevView || 'week';
          renderApp();
        },
      }),
      el('h1', { class: 'app-title', text: 'Baby has arrived' }),
    ]);
    const wrap = el('div', { class: 'wrap' }, [backHeader]);
    container.appendChild(wrap);

    const dateInput = el('input', { type: 'date', value: todayISO(), max: todayISO() });
    const timeInput = el('input', { type: 'time' });
    const error = el('p', { class: 'error' });

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'The big moment' }),
        el('p', {
          class: 'muted small',
          text: 'Congratulations. Enter the birth date and Bloom becomes ' + babyLabel() + '\u2019s tracker \u2014 feeds, sleep, diapers, and growth. Everything can be adjusted later in Settings.',
        }),
        el('label', { class: 'field-label', text: 'Birth date' }),
        dateInput,
        el('label', { class: 'field-label', text: 'Time of birth (optional)' }),
        timeInput,
        error,
        el('button', {
          class: 'primary',
          text: 'Start baby mode',
          onClick: async () => {
            const iso = dateInput.value;
            if (!iso) {
              error.textContent = 'Enter the birth date.';
              return;
            }
            const birth = parseDateInput(iso);
            const due = dueDate(state.dating);
            const gaDays = due
              ? 280 - Math.round((midnight(due) - midnight(birth)) / MS_DAY)
              : null;
            const child = { birthDate: iso, birthTime: timeInput.value || null, gaDays };
            await Store.setSetting('child', child);
            await Store.setSetting('lifeStage', 'baby');
            await Store.setSetting('arrivalSeen', false);
            state.child = child;
            state.lifeStage = 'baby';
            state.babyDay = todayISO();
            state.view = 'home';
            renderApp();
            emojiRain('\ud83c\udf38', 'Welcome, ' + babyLabel(), 'From bloom to blossom.');
          },
        }),
      ])
    );
  }

  // --- baby home ---

  function renderBabyHome(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader(babyLabel())]);
    container.appendChild(wrap);
    const body = el('div', {});
    wrap.appendChild(body);

    const now = Date.now();
    Promise.all([
      Store.getSetting('activeNurse'),
      Store.getSetting('activeSleep'),
      Store.getSetting('arrivalSeen'),
      Store.getSetting('lastBottleMl'),
      Store.getSetting('lastPumpMl'),
      Store.eventsInRange(now - 48 * HOUR_MS, now + 60000),
      Store.allMeasurements(),
    ]).then(([activeNurse, activeSleep, arrivalSeen, lastBottleMl, lastPumpMl, recent, measurements]) => {
      const todayIso = todayISO();
      const { start: dayStart, end: dayEnd } = dayBounds(todayIso);
      const todays = recent.filter((e) => e.start < dayEnd && (e.end || e.start) >= dayStart);

      if (arrivalSeen === false) {
        body.appendChild(
          el('div', { class: 'card welcome-card' }, [
            el('h3', { class: 'card-title', text: 'Welcome, ' + babyLabel() }),
            el('p', {
              class: 'muted small',
              text: 'From bloom to blossom. Log feeds, sleep, and diapers below \u2014 anything can be removed from the Day tab, and the pregnancy journey lives on in Settings.',
            }),
            el('button', {
              class: 'secondary compact',
              text: 'Got it',
              onClick: async () => {
                await Store.setSetting('arrivalSeen', true);
                renderApp();
              },
            }),
          ])
        );
      }

      // --- Right now ---
      const ageLine = el('p', { class: 'muted small', text: childAgeText() });
      const sleepLine = el('p', { class: 'status-line' });
      const feedLine = el('p', { class: 'status-line' });
      const diaperLine = el('p', { class: 'status-line' });

      function refreshStatus() {
        const t = Date.now();
        if (activeSleep) {
          sleepLine.textContent = 'Asleep \u00b7 ' + durShort(t - activeSleep.start);
        } else {
          const ended = recent.filter((e) => e.type === 'sleep' && e.end).sort((a, b) => b.end - a.end)[0];
          sleepLine.textContent = ended ? 'Awake for ' + durShort(t - ended.end) : 'No sleep logged yet';
        }
        const feeds = recent
          .filter((e) => e.type === 'nurse' || e.type === 'bottle')
          .sort((a, b) => (b.end || b.start) - (a.end || a.start));
        if (activeNurse) {
          feedLine.textContent = 'Nursing now \u00b7 ' + (activeNurse.side === 'L' ? 'left' : 'right');
        } else if (feeds.length) {
          const f = feeds[0];
          feedLine.textContent = 'Last feed: ' + eventDesc(f) + ' \u00b7 ' + timeAgo(f.end || f.start);
        } else {
          feedLine.textContent = 'No feeds logged yet';
        }
        const d = todays.filter((e) => e.type === 'diaper');
        const wet = d.filter((e) => e.kind === 'wet' || e.kind === 'both').length;
        const dirty = d.filter((e) => e.kind === 'dirty' || e.kind === 'both').length;
        diaperLine.textContent = 'Diapers today: ' + d.length + (d.length ? ' (' + wet + ' wet \u00b7 ' + dirty + ' dirty)' : '');
      }
      refreshStatus();
      trackInterval(setInterval(refreshStatus, 30000));

      body.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { class: 'card-title', text: 'Right now' }),
          ageLine,
          sleepLine,
          feedLine,
          diaperLine,
        ])
      );

      // --- Log ---
      const logCard = el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'Log' })]);
      body.appendChild(logCard);

      function timerCard(kind, data) {
        const isNurse = kind === 'nurse';
        const box = el('div', { class: 'timer-card' });
        const big = el('p', { class: 'timer-big', text: durShort(Date.now() - data.start) });
        const sub = el('p', { class: 'timer-sub', text: 'Started ' + clockStr(data.start) });
        box.appendChild(
          el('p', { class: 'timer-title', text: isNurse ? 'Nursing \u2014 ' + (data.side === 'L' ? 'Left' : 'Right') : 'Sleeping' })
        );
        box.appendChild(big);
        box.appendChild(sub);
        trackInterval(setInterval(() => {
          big.textContent = durShort(Date.now() - data.start);
        }, 1000));

        const settingKey = isNurse ? 'activeNurse' : 'activeSleep';
        async function shiftStart(mins) {
          const next = Math.min(data.start + mins * 60000, Date.now() - 60000);
          data.start = next;
          await Store.setSetting(settingKey, data);
          sub.textContent = 'Started ' + clockStr(data.start);
          big.textContent = durShort(Date.now() - data.start);
        }
        box.appendChild(
          el('div', { class: 'adjust-row' }, [
            el('button', { class: 'adjust-btn', text: 'Started 5m earlier', onClick: () => shiftStart(-5) }),
            el('button', { class: 'adjust-btn', text: '5m later', onClick: () => shiftStart(5) }),
          ])
        );

        const actions = el('div', { class: 'timer-actions' });
        actions.appendChild(
          el('button', {
            class: 'primary compact',
            text: isNurse ? 'Stop & save' : 'Awake \u2014 save',
            onClick: async () => {
              const ev = isNurse
                ? { type: 'nurse', side: data.side, start: data.start, end: Date.now() }
                : { type: 'sleep', start: data.start, end: Date.now() };
              await saveEvent(ev);
              await Store.setSetting(settingKey, null);
              toast(isNurse ? 'Feed saved' : 'Sleep saved');
              renderApp();
            },
          })
        );
        if (isNurse) {
          actions.appendChild(
            el('button', {
              class: 'secondary compact',
              text: 'Switch side',
              onClick: async () => {
                await saveEvent({ type: 'nurse', side: data.side, start: data.start, end: Date.now() });
                await Store.setSetting('activeNurse', { side: data.side === 'L' ? 'R' : 'L', start: Date.now() });
                renderApp();
              },
            })
          );
        }
        actions.appendChild(
          twoTap(
            el('button', { class: 'ghost-btn compact', text: 'Discard' }),
            'Discard?',
            async () => {
              await Store.setSetting(settingKey, null);
              renderApp();
            }
          )
        );
        box.appendChild(actions);
        return box;
      }

      // Nursing
      if (activeNurse) {
        logCard.appendChild(timerCard('nurse', activeNurse));
      } else {
        const lastNurse = recent.filter((e) => e.type === 'nurse').sort((a, b) => b.start - a.start)[0];
        const suggest = lastNurse ? (lastNurse.side === 'L' ? 'R' : 'L') : null;
        const startNurse = (side) => async () => {
          await Store.setSetting('activeNurse', { side, start: Date.now() });
          renderApp();
        };
        const grid = el('div', { class: 'baby-grid' }, [
          el('button', { class: 'baby-btn' + (suggest === 'L' ? ' suggest' : ''), text: 'Nurse \u00b7 Left', onClick: startNurse('L') }),
          el('button', { class: 'baby-btn' + (suggest === 'R' ? ' suggest' : ''), text: 'Nurse \u00b7 Right', onClick: startNurse('R') }),
        ]);
        logCard.appendChild(grid);
        if (lastNurse) {
          logCard.appendChild(
            el('p', { class: 'baby-caption', text: 'Last side: ' + (lastNurse.side === 'L' ? 'left' : 'right') + ' \u00b7 ' + timeAgo(lastNurse.end || lastNurse.start) })
          );
        }
      }

      // Sleep
      if (activeSleep) {
        logCard.appendChild(timerCard('sleep', activeSleep));
      } else {
        logCard.appendChild(
          el('div', { class: 'baby-grid' }, [
            el('button', {
              class: 'baby-btn full',
              text: 'Start sleep',
              onClick: async () => {
                await Store.setSetting('activeSleep', { start: Date.now() });
                renderApp();
              },
            }),
          ])
        );
      }

      // Bottle / pump entry panels
      function amountPanel(opts) {
        const panel = el('div', { class: 'panel' });
        panel.style.display = 'none';
        let ml = opts.initialMl;
        const step = state.imperial ? ML_PER_OZ / 2 : 10;
        const val = el('span', { class: 'step-val', text: fmtAmount(ml) });
        const bump = (dir) => () => {
          ml = Math.max(step, ml + dir * step);
          val.textContent = fmtAmount(ml);
        };
        panel.appendChild(
          el('div', { class: 'stepper' }, [
            el('button', { class: 'step-btn', text: '\u2212', onClick: bump(-1) }),
            val,
            el('button', { class: 'step-btn', text: '+', onClick: bump(1) }),
          ])
        );
        let side = 'both';
        if (opts.sides) {
          const seg = el('div', { class: 'segmented pump-seg' });
          for (const [key, label] of [['L', 'Left'], ['R', 'Right'], ['both', 'Both']]) {
            const b = el('button', {
              class: 'seg-btn' + (key === side ? ' active' : ''),
              text: label,
              onClick: () => {
                side = key;
                [...seg.children].forEach((c) => c.classList.toggle('active', c.dataset.s === key));
              },
            });
            b.dataset.s = key;
            seg.appendChild(b);
          }
          panel.appendChild(seg);
        }
        panel.appendChild(
          el('div', { class: 'panel-actions' }, [
            el('button', {
              class: 'primary compact',
              text: 'Save',
              onClick: async () => {
                await opts.save(Math.round(ml), side);
                toast(opts.savedText);
                renderApp();
              },
            }),
            el('button', {
              class: 'ghost-btn compact',
              text: 'Close',
              onClick: () => {
                panel.style.display = 'none';
              },
            }),
          ])
        );
        return panel;
      }

      const bottlePanel = amountPanel({
        initialMl: lastBottleMl || 90,
        savedText: 'Bottle saved',
        save: async (ml) => {
          await saveEvent({ type: 'bottle', start: Date.now(), end: null, amountMl: ml });
          await Store.setSetting('lastBottleMl', ml);
        },
      });
      const pumpPanel = amountPanel({
        initialMl: lastPumpMl || 120,
        sides: true,
        savedText: 'Pump saved',
        save: async (ml, side) => {
          await saveEvent({ type: 'pump', start: Date.now(), end: null, amountMl: ml, side });
          await Store.setSetting('lastPumpMl', ml);
        },
      });

      logCard.appendChild(
        el('div', { class: 'baby-grid' }, [
          el('button', {
            class: 'baby-btn',
            text: 'Bottle',
            onClick: () => {
              bottlePanel.style.display = bottlePanel.style.display === 'none' ? '' : 'none';
              pumpPanel.style.display = 'none';
            },
          }),
          el('button', {
            class: 'baby-btn',
            text: 'Pump',
            onClick: () => {
              pumpPanel.style.display = pumpPanel.style.display === 'none' ? '' : 'none';
              bottlePanel.style.display = 'none';
            },
          }),
        ])
      );
      logCard.appendChild(bottlePanel);
      logCard.appendChild(pumpPanel);

      // Diapers
      const diaperBtn = (kind, label) =>
        el('button', {
          class: 'baby-btn',
          text: label,
          onClick: async () => {
            await saveEvent({ type: 'diaper', start: Date.now(), end: null, kind });
            toast('Diaper logged \u00b7 ' + kind);
            renderApp();
          },
        });
      logCard.appendChild(el('p', { class: 'baby-caption', text: 'Diaper' }));
      logCard.appendChild(
        el('div', { class: 'diaper-row' }, [diaperBtn('wet', 'Wet'), diaperBtn('dirty', 'Dirty'), diaperBtn('both', 'Both')])
      );

      // --- Today totals ---
      const sum = daySummary(todays, todayIso, activeSleep);
      const totalsCard = el('div', { class: 'card tap-card' }, [
        el('h3', { class: 'card-title', text: 'Today' }),
        el('p', { class: 'status-line', text: summaryLine(sum) }),
      ]);
      if (sum.bottleMl || sum.pumpMl) {
        totalsCard.appendChild(
          el('p', {
            class: 'muted small',
            text: (sum.bottleMl ? 'Bottles ' + fmtAmount(sum.bottleMl) : '') +
              (sum.bottleMl && sum.pumpMl ? ' \u00b7 ' : '') +
              (sum.pumpMl ? 'Pumped ' + fmtAmount(sum.pumpMl) : ''),
          })
        );
      }
      totalsCard.appendChild(
        el('button', {
          class: 'secondary compact',
          text: 'Open day view',
          onClick: () => {
            state.babyDay = todayIso;
            state.view = 'day';
            renderApp();
          },
        })
      );
      body.appendChild(totalsCard);

      // --- Growth teaser ---
      const lastM = measurements[measurements.length - 1];
      body.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { class: 'card-title', text: 'Growth' }),
          el('p', {
            class: 'muted small',
            text: lastM ? 'Last: ' + measurementText(lastM) : 'No measurements yet \u2014 add weight, length, and head size.',
          }),
          el('button', {
            class: 'secondary compact',
            text: lastM ? 'Add / view' : 'Add first measurement',
            onClick: () => {
              state.view = 'growth';
              renderApp();
            },
          }),
        ])
      );
    });
  }

  // --- day view ---

  function renderBabyDay(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Day')]);
    container.appendChild(wrap);

    const dayIso = state.babyDay || todayISO();
    const isToday = dayIso === todayISO();
    const d = new Date(dayIso + 'T00:00:00');
    const label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + (isToday ? ' \u00b7 Today' : '');

    const go = (n) => () => {
      state.babyDay = isoDate(addDays(new Date(dayIso + 'T00:00:00'), n));
      renderApp();
    };
    wrap.appendChild(
      el('div', { class: 'day-nav' }, [
        el('button', { class: 'day-arrow', text: '\u2039', 'aria-label': 'Previous day', onClick: go(-1) }),
        el('span', { class: 'day-label', text: label }),
        (() => {
          const b = el('button', { class: 'day-arrow', text: '\u203a', 'aria-label': 'Next day', onClick: go(1) });
          if (isToday) b.disabled = true;
          return b;
        })(),
      ])
    );

    const body = el('div', {});
    wrap.appendChild(body);

    Promise.all([
      eventsForDay(dayIso),
      Store.getSetting('activeNurse'),
      Store.getSetting('activeSleep'),
    ]).then(([events, activeNurse, activeSleep]) => {
      const sum = daySummary(events, dayIso, isToday ? activeSleep : null);
      const totals = el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Totals' }),
        el('p', { class: 'status-line', text: summaryLine(sum) }),
      ]);
      if (sum.bottleMl || sum.pumpMl) {
        totals.appendChild(
          el('p', {
            class: 'muted small',
            text: (sum.bottleMl ? 'Bottles ' + fmtAmount(sum.bottleMl) : '') +
              (sum.bottleMl && sum.pumpMl ? ' \u00b7 ' : '') +
              (sum.pumpMl ? 'Pumped ' + fmtAmount(sum.pumpMl) : ''),
          })
        );
      }
      body.appendChild(totals);

      const list = el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'Timeline' })]);
      body.appendChild(list);

      const rows = [];
      if (isToday && activeNurse) rows.push({ live: true, type: 'nurse', side: activeNurse.side, start: activeNurse.start, end: null });
      if (isToday && activeSleep) rows.push({ live: true, type: 'sleep', start: activeSleep.start, end: null });
      for (const e of events) rows.push(e);
      rows.sort((a, b) => a.start - b.start);

      if (!rows.length) {
        list.appendChild(el('p', { class: 'muted small', text: 'Nothing logged this day.' }));
        return;
      }

      for (const e of rows) {
        const main = el('div', { class: 'evt-main' }, [
          el('span', { class: 'evt-time', text: eventTimeLabel(e) + (e.live ? ' \u00b7 in progress' : '') }),
          el('span', { class: 'evt-desc', text: eventDesc(e) }),
        ]);
        const row = el('div', { class: 'evt-row' }, [el('span', { class: 'evt-dot dot-' + e.type }), main]);
        if (!e.live) {
          row.appendChild(
            twoTap(
              el('button', { class: 'evt-del', text: '\u00d7', 'aria-label': 'Delete entry' }),
              'Delete?',
              async () => {
                await Store.deleteEvent(e.id);
                renderApp();
              }
            )
          );
        }
        list.appendChild(row);
      }
    });
  }

  // --- growth ---

  function gToLbOz(g) {
    let totalOz = g / 28.3495;
    let lb = Math.floor(totalOz / 16);
    let oz = totalOz - lb * 16;
    if (oz >= 15.95) {
      lb += 1;
      oz = 0;
    }
    return { lb, oz };
  }

  function measurementText(m) {
    const parts = [];
    if (m.weightG != null) {
      if (state.imperial) {
        const { lb, oz } = gToLbOz(m.weightG);
        parts.push(lb + ' lb ' + oz.toFixed(1) + ' oz');
      } else {
        parts.push((m.weightG / 1000).toFixed(2) + ' kg');
      }
    }
    if (m.lengthCm != null) parts.push(state.imperial ? (m.lengthCm / 2.54).toFixed(1) + ' in' : m.lengthCm.toFixed(1) + ' cm');
    if (m.headCm != null) parts.push('head ' + (state.imperial ? (m.headCm / 2.54).toFixed(1) + ' in' : m.headCm.toFixed(1) + ' cm'));
    return parts.join(' \u00b7 ');
  }

  function renderBabyGrowth(container) {
    const backHeader = el('header', { class: 'app-header tool-header' }, [
      el('button', {
        class: 'back-btn',
        text: '\u2039 Back',
        onClick: () => {
          state.view = 'home';
          renderApp();
        },
      }),
      el('h1', { class: 'app-title', text: 'Growth' }),
    ]);
    const wrap = el('div', { class: 'wrap' }, [backHeader]);
    container.appendChild(wrap);

    const dateInput = el('input', { type: 'date', value: todayISO(), max: todayISO() });
    const error = el('p', { class: 'error' });
    let weightInputs;
    if (state.imperial) {
      const lb = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '1', placeholder: 'lb' });
      const oz = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.1', placeholder: 'oz' });
      weightInputs = {
        row: el('div', { class: 'growth-pair' }, [lb, oz]),
        grams: () => {
          const l = parseFloat(lb.value);
          const o = parseFloat(oz.value);
          if (isNaN(l) && isNaN(o)) return null;
          return Math.round(((isNaN(l) ? 0 : l) * 16 + (isNaN(o) ? 0 : o)) * 28.3495);
        },
      };
    } else {
      const kg = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.01', placeholder: 'kg' });
      weightInputs = {
        row: kg,
        grams: () => {
          const v = parseFloat(kg.value);
          return isNaN(v) ? null : Math.round(v * 1000);
        },
      };
    }
    const lenInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.1', placeholder: state.imperial ? 'in' : 'cm' });
    const headInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.1', placeholder: state.imperial ? 'in' : 'cm' });
    const toCm = (v) => (state.imperial ? v * 2.54 : v);

    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Add measurement' }),
        el('label', { class: 'field-label', text: 'Date' }),
        dateInput,
        el('label', { class: 'field-label', text: 'Weight' }),
        weightInputs.row,
        el('label', { class: 'field-label', text: 'Length' }),
        lenInput,
        el('label', { class: 'field-label', text: 'Head circumference' }),
        headInput,
        error,
        el('button', {
          class: 'primary',
          text: 'Save',
          onClick: async () => {
            const weightG = weightInputs.grams();
            const lenV = parseFloat(lenInput.value);
            const headV = parseFloat(headInput.value);
            const lengthCm = isNaN(lenV) ? null : toCm(lenV);
            const headCm = isNaN(headV) ? null : toCm(headV);
            if (weightG == null && lengthCm == null && headCm == null) {
              error.textContent = 'Enter at least one measurement.';
              return;
            }
            await Store.putMeasurement({ id: uid(), date: dateInput.value || todayISO(), weightG, lengthCm, headCm });
            toast('Measurement saved');
            renderApp();
          },
        }),
        el('p', { class: 'muted small', text: 'WHO percentile curves are coming in an update.' }),
      ])
    );

    const chartCard = el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'Weight trend' })]);
    const canvas = el('canvas', { class: 'chart-canvas' });
    const chartNote = el('p', { class: 'muted small' });
    chartCard.appendChild(canvas);
    chartCard.appendChild(chartNote);
    wrap.appendChild(chartCard);

    const listCard = el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'History' })]);
    wrap.appendChild(listCard);

    Store.allMeasurements().then((rows) => {
      const weights = rows.filter((m) => m.weightG != null);
      if (weights.length < 2) {
        canvas.style.display = 'none';
        chartNote.textContent = weights.length === 0 ? 'No weights yet.' : 'Log once more to see a trend line.';
      } else {
        const points = weights.map((m) => ({
          x: Date.parse(m.date),
          y: state.imperial ? m.weightG / 453.592 : m.weightG / 1000,
          label: '',
        }));
        chartNote.textContent = state.imperial ? 'Weight in lb' : 'Weight in kg';
        requestAnimationFrame(() =>
          drawLineChart(canvas, points, {
            formatValue: (v) => v.toFixed(1),
            accent: accentColor(),
          })
        );
      }

      if (!rows.length) {
        listCard.appendChild(el('p', { class: 'muted small', text: 'Nothing recorded yet.' }));
        return;
      }
      for (const m of [...rows].reverse()) {
        const main = el('div', { class: 'evt-main' }, [
          el('span', { class: 'evt-time', text: prettyDate(new Date(m.date + 'T00:00:00')) }),
          el('span', { class: 'evt-desc', text: measurementText(m) }),
        ]);
        listCard.appendChild(
          el('div', { class: 'evt-row' }, [
            main,
            twoTap(
              el('button', { class: 'evt-del', text: '\u00d7', 'aria-label': 'Delete measurement' }),
              'Delete?',
              async () => {
                await Store.deleteMeasurement(m.id);
                renderApp();
              }
            ),
          ])
        );
      }
    });
  }

  // --- settings cards: life stage + backup ---

  function lifeStageCard() {
    const card = el('div', { class: 'card' }, [el('h3', { class: 'card-title', text: 'Life stage' })]);
    if (state.lifeStage === 'baby' && state.child) {
      const birth = new Date(state.child.birthDate + 'T00:00:00');
      let born = 'Born ' + prettyDate(birth);
      if (state.child.gaDays != null && state.child.gaDays > 0) {
        born += ' \u00b7 ' + Math.floor(state.child.gaDays / 7) + 'w ' + (state.child.gaDays % 7) + 'd at birth';
      }
      card.appendChild(el('p', { class: 'muted small', text: born }));
      card.appendChild(
        el('button', {
          class: 'secondary compact',
          text: 'Pregnancy journey',
          onClick: () => {
            state.viewWeek = null;
            state.view = 'week';
            renderApp();
          },
        })
      );
      card.appendChild(
        twoTap(
          el('button', { class: 'ghost-btn compact stage-switch', text: 'Switch back to pregnancy mode' }),
          'Tap again to switch',
          async () => {
            await Store.setSetting('lifeStage', 'pregnancy');
            state.lifeStage = 'pregnancy';
            state.view = 'week';
            renderApp();
          }
        )
      );
      card.appendChild(
        el('p', { class: 'muted small', text: 'Switching back keeps every log \u2014 nothing is deleted.' })
      );
    } else {
      card.appendChild(
        el('p', {
          class: 'muted small',
          text: 'Bloom is in pregnancy mode. When your baby arrives, flip the switch and the app grows with you \u2014 nothing to reinstall.',
        })
      );
      card.appendChild(
        el('button', {
          class: 'primary compact',
          text: 'Baby has arrived',
          onClick: () => {
            state.prevView = 'settings';
            state.view = 'arrival';
            renderApp();
          },
        })
      );
    }
    return card;
  }

  async function exportBackup(statusEl) {
    statusEl.textContent = 'Preparing backup\u2026';
    try {
      const payload = {
        app: 'bloom',
        format: 1,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data: await Store.exportAll(),
      };
      const json = JSON.stringify(payload);
      const name = 'bloom-backup-' + todayISO() + '.json';
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: 'Bloom backup' });
          statusEl.textContent = 'Backup shared.';
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') {
            statusEl.textContent = '';
            return;
          }
        }
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = el('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      statusEl.textContent = 'Backup downloaded.';
    } catch (e) {
      statusEl.textContent = 'Backup failed \u2014 try again.';
    }
  }

  async function importBackup(file, statusEl) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || payload.app !== 'bloom' || !payload.data) {
        statusEl.textContent = 'That doesn\u2019t look like a Bloom backup.';
        return;
      }
      statusEl.textContent = 'Restoring\u2026';
      await Store.importAll(payload.data);
      statusEl.textContent = 'Restored \u2014 reloading\u2026';
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      statusEl.textContent = 'Import failed \u2014 file unreadable.';
    }
  }

  function backupCard() {
    const status = el('p', { class: 'muted small backup-status' });
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json' });
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) importBackup(fileInput.files[0], status);
      fileInput.value = '';
    });
    const storageLine =
      persistGranted === true
        ? 'Storage: persistent \u2713'
        : persistGranted === false
          ? 'Storage: best-effort \u2014 export backups regularly.'
          : 'Storage: checking\u2026';
    return el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Backup' }),
      el('p', {
        class: 'muted small',
        text: 'Everything lives only on this phone. Export a backup file to iCloud or Files now and then \u2014 it\u2019s also how you move to a new phone.',
      }),
      el('div', { class: 'backup-actions' }, [
        el('button', { class: 'primary compact', text: 'Export backup', onClick: () => exportBackup(status) }),
        twoTap(
          el('button', { class: 'secondary compact', text: 'Import backup' }),
          'Replaces all data \u2014 tap again',
          () => fileInput.click()
        ),
      ]),
      fileInput,
      status,
      el('p', { class: 'muted small', text: storageLine }),
    ]);
  }

  function renderToolsView(container) {
    if (state.tool === 'contraction') return renderContractionTimer(container);
    if (state.tool === 'kick') return renderKickCounter(container);
    if (state.tool === 'birthplan') return renderBirthPlan(container);

    const tools = [
      { key: 'contraction', title: 'Contraction timer', desc: 'Time contractions and see how close together they are.' },
      { key: 'kick', title: 'Kick counter', desc: 'Count baby\u2019s movements, with guidance on what to expect.' },
      { key: 'birthplan', title: 'Birth plan', desc: 'Build your preferences for labor, delivery, and beyond \u2014 with the trade-offs explained.' },
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

    // Big-picture summary (frequency / duration / 5-1-1 readiness)
    const summaryCard = el('div', { class: 'card contraction-summary' });
    wrap.appendChild(summaryCard);

    // Visual timeline: contraction vs rest
    const timelineCard = el('div', { class: 'card', style: 'display:none' }, [
      el('h3', { class: 'card-title', text: 'Timeline' }),
    ]);
    const timelineCanvas = el('canvas', { class: 'contraction-canvas' });
    timelineCard.appendChild(timelineCanvas);
    timelineCard.appendChild(
      el('div', { class: 'timeline-legend muted small' }, [
        el('span', { class: 'legend-swatch contraction' }),
        document.createTextNode(' contraction  '),
        el('span', { class: 'legend-swatch rest' }),
        document.createTextNode(' rest'),
      ])
    );
    wrap.appendChild(timelineCard);

    // Detailed table
    const statsCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Each contraction' }),
    ]);
    const tableWrap = el('div', {});
    statsCard.appendChild(tableWrap);
    wrap.appendChild(statsCard);

    // Guidance
    wrap.appendChild(
      el('div', { class: 'card guidance' }, [
        el('h3', { class: 'card-title', text: 'How to use this' }),
        el('p', { text: 'Tap Start when a contraction begins and Stop when it eases. Bloom records how long each one lasts (length) and how far apart they are, start to start (frequency).' }),
        el('p', { html: 'A common full-term guideline is <strong>5-1-1</strong>: contractions about 5 minutes apart, each lasting about 1 minute, for at least 1 hour. Your provider may give you different instructions \u2014 always follow theirs.' }),
        el('div', { class: 'callout callout-warn' }, [
          el('strong', { text: 'Call your provider ' }),
          document.createTextNode(
            'if your water breaks, you have bleeding, you notice reduced baby movement, or you have regular contractions before 37 weeks \u2014 don\u2019t wait for any pattern. This timer does not diagnose labor.'
          ),
        ]),
      ])
    );

    function fmtMMSS(sec) {
      if (sec == null) return '\u2014';
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    function render() {
      Store.entriesOfKind('contraction').then((all) => {
        const sorted = all.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

        // ----- summary over the last hour -----
        summaryCard.innerHTML = '';
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

          summaryCard.appendChild(el('h3', { class: 'card-title', text: 'Right now (last hour)' }));
          summaryCard.appendChild(
            el('div', { class: 'summary-grid' }, [
              el('div', {}, [el('div', { class: 'sg-val', text: fmtMMSS(avgGap) }), el('div', { class: 'sg-key muted small', text: 'apart (avg)' })]),
              el('div', {}, [el('div', { class: 'sg-val', text: fmtMMSS(avgDur) }), el('div', { class: 'sg-key muted small', text: 'long (avg)' })]),
              el('div', {}, [el('div', { class: 'sg-val', text: String(recent.length) }), el('div', { class: 'sg-key muted small', text: 'in last hour' })]),
            ])
          );
          // 5-1-1 readout
          const near511 = avgGap <= 330 && avgDur >= 45;
          summaryCard.appendChild(
            el('p', {
              class: near511 ? 'small contraction-flag' : 'muted small',
              text: near511
                ? 'These are close to the 5-1-1 pattern. If you haven\u2019t already, this is a good time to check in with your provider.'
                : 'Keep timing \u2014 the pattern will become clearer as you log more.',
            })
          );
        } else {
          summaryCard.appendChild(el('h3', { class: 'card-title', text: 'Right now' }));
          summaryCard.appendChild(el('p', { class: 'muted small', text: 'Time a couple of contractions and your pattern \u2014 how far apart and how long \u2014 will show here.' }));
        }

        // ----- timeline -----
        if (sorted.length >= 1) {
          timelineCard.style.display = 'block';
          requestAnimationFrame(() =>
            drawContractionTimeline(timelineCanvas, all, {
              accent: accentColor(),
              textColor: getCssColor('--muted', '#9a8aa0'),
            })
          );
        } else {
          timelineCard.style.display = 'none';
        }

        // ----- table: start | stop | length | frequency -----
        tableWrap.innerHTML = '';
        if (sorted.length === 0) {
          tableWrap.appendChild(el('p', { class: 'muted small', text: 'No contractions recorded yet.' }));
          return;
        }
        const table = el('table', { class: 'data-table' });
        table.appendChild(
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Start' }),
              el('th', { text: 'Stop' }),
              el('th', { text: 'Length' }),
              el('th', { text: 'Freq.' }),
            ]),
          ])
        );
        const tbody = el('tbody', {});
        sorted.slice(0, 20).forEach((c, i) => {
          const next = sorted[i + 1];
          const gap = next ? (c.startedAt - next.startedAt) / 1000 : null;
          const startT = new Date(c.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const stopT = c.endedAt ? new Date(c.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '\u2014';
          tbody.appendChild(
            el('tr', {}, [
              el('td', { text: startT }),
              el('td', { text: stopT }),
              el('td', { text: fmtMMSS(c.durationSec) }),
              el('td', { text: gap != null ? fmtMMSS(gap) : '\u2014' }),
            ])
          );
        });
        table.appendChild(tbody);
        tableWrap.appendChild(table);

        tableWrap.appendChild(
          el('button', {
            class: 'secondary compact clear-btn',
            text: 'Clear all',
            onClick: async () => {
              if (!confirm('Clear all recorded contractions?')) return;
              for (const c of all) await Store.deleteEntry(c.id);
              render();
            },
          })
        );
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
          date: todayISO(),
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

    // Most recent session, shown the moment you open the tool
    const lastCard = el('div', { class: 'card kick-last', style: 'display:none' });
    wrap.appendChild(lastCard);

    const countLabel = el('div', { class: 'timer-elapsed kick-count' });
    const footprintsRow = el('div', { class: 'footprints' });
    const elapsedLabel = el('div', { class: 'muted small' });
    const bigButton = el('button', { class: 'timer-button' });
    const resetBtn = el('button', { class: 'secondary compact', text: 'Reset session' });

    const card = el('div', { class: 'card timer-card' }, [
      countLabel,
      footprintsRow,
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

    function renderLast() {
      Store.entriesOfKind('kickSession').then((all) => {
        if (all.length === 0) {
          lastCard.style.display = 'none';
          return;
        }
        const last = all.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
        const d = new Date(last.completedAt);
        const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        lastCard.style.display = 'block';
        lastCard.innerHTML = '';
        lastCard.appendChild(el('h3', { class: 'card-title', text: 'Last session' }));
        lastCard.appendChild(
          el('div', { class: 'kick-last-grid' }, [
            el('div', {}, [el('div', { class: 'kl-val', text: dateStr }), el('div', { class: 'kl-key muted small', text: 'Date' })]),
            el('div', {}, [el('div', { class: 'kl-val', text: timeStr }), el('div', { class: 'kl-key muted small', text: 'Time' })]),
            el('div', {}, [el('div', { class: 'kl-val', text: fmtClock(last.durationSec) }), el('div', { class: 'kl-key muted small', text: 'Length' })]),
            el('div', {}, [el('div', { class: 'kl-val', text: String(last.count) }), el('div', { class: 'kl-key muted small', text: 'Movements' })]),
          ])
        );
      });
    }

    function renderHistory() {
      Store.entriesOfKind('kickSession').then((all) => {
        const sorted = all.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        historyList.innerHTML = '';
        if (sorted.length === 0) {
          historyList.appendChild(el('p', { class: 'muted small', text: 'No sessions yet \u2014 your first one will appear here.' }));
          return;
        }
        sorted.slice(0, 10).forEach((s) => {
          const when = new Date(s.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          historyList.appendChild(
            el('div', { class: 'entry-row' }, [
              el('span', { class: 'entry-emoji', text: '\ud83d\udc63' }),
              el('span', { class: 'entry-label', text: `${when} \u00b7 ${s.count} movements in ${fmtClock(s.durationSec)}` }),
              el('button', {
                class: 'entry-delete',
                'aria-label': 'Delete',
                text: '\u00d7',
                onClick: async () => {
                  await Store.deleteEntry(s.id);
                  renderLast();
                  renderHistory();
                },
              }),
            ])
          );
        });
      });
    }

    function paintFootprints(n) {
      footprintsRow.innerHTML = '';
      for (let i = 0; i < TARGET; i++) {
        footprintsRow.appendChild(
          el('span', { class: 'footprint' + (i < n ? ' on' : ''), text: '\ud83d\udc63' })
        );
      }
    }

    function paint() {
      const n = kickSession ? kickSession.times.length : 0;
      countLabel.textContent = `${n} / ${TARGET}`;
      paintFootprints(n);
      bigButton.textContent = kickSession ? 'I felt a movement' : 'Start counting';
      bigButton.classList.toggle('running', !!kickSession);
      elapsedLabel.textContent = kickSession
        ? fmtClock((Date.now() - kickSession.startedAt) / 1000) + ' elapsed'
        : '';
    }

    bigButton.addEventListener('click', async () => {
      if (!kickSession) {
        kickSession = { startedAt: Date.now(), times: [] };
        resultCard.style.display = 'none';
        paint();
        return;
      }
      kickSession.times.push(Date.now());
      const n = kickSession.times.length;

      // mid-session delight when baby is especially active
      if (n === 5 && Date.now() - kickSession.startedAt < 120000) {
        toast('Wow, lots of movement! \ud83c\udf1f');
      }

      if (n >= TARGET) {
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
          date: todayISO(),
        });
        kickSession = null;

        // tiered, encouraging result — easter egg when movement is brisk
        const fast = durationSec <= 300;
        const lively = durationSec <= 600;
        resultCard.style.display = 'block';
        resultCard.innerHTML = '';
        resultCard.appendChild(el('div', { class: 'summary-emoji', text: fast ? '\ud83d\udd7a' : '\ud83d\udc63' }));
        if (fast) {
          resultCard.appendChild(el('p', { class: 'summary-line', text: `${babyLabel()} is moving and grooving!` }));
          resultCard.appendChild(el('p', { class: 'muted small', text: `${TARGET} movements in just ${fmtClock(durationSec)} \u2014 someone\u2019s having a party in there.` }));
          footprintCelebration();
        } else if (lively) {
          resultCard.appendChild(el('p', { class: 'summary-line', text: 'Lots of lovely movement!' }));
          resultCard.appendChild(el('p', { class: 'muted small', text: `${TARGET} movements in ${fmtClock(durationSec)}. A reassuring sign.` }));
        } else {
          resultCard.appendChild(el('p', { class: 'summary-line', text: `You felt ${TARGET} movements in ${fmtClock(durationSec)}.` }));
          resultCard.appendChild(el('p', { class: 'muted small', text: 'A lovely sign. Keep noticing your baby\u2019s usual pattern, and reach out to your provider any time movements drop or you\u2019re unsure.' }));
        }
        paint();
        renderLast();
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
    renderLast();
    renderHistory();
  }

  // A brief shower of footprints for a lively kick session.
  function footprintCelebration() {
    emojiRain('\ud83d\udc63', null, null, { count: 16 });
  }

  // After a log, celebrate streaks and weight-gain milestones (body-positive,
  // never prescriptive). Fires at most one rain per call.
  async function checkMilestones() {
    const entries = await Store.allEntries();
    if (entries.length === 0) return;

    // --- weight-gain milestone: every 5 lb (2 kg) of gain from start ---
    const weights = entries
      .filter((e) => e.kind === 'weight' && e.value != null)
      .sort((a, b) => entryDateMs(a) - entryDateMs(b));
    if (weights.length >= 2) {
      const startStored = await Store.getSetting('startWeight');
      const startKg = startStored != null ? startStored : weights[0].value;
      const gainKg = weights[weights.length - 1].value - startKg;
      const stepKg = state.imperial ? 5 / 2.2046226218 : 2; // every 5 lb or 2 kg
      const milestone = Math.floor(gainKg / stepKg);
      const prev = (await Store.getSetting('celebratedGainStep')) || 0;
      if (milestone > prev && gainKg > 0) {
        await Store.setSetting('celebratedGainStep', milestone);
        const gainDisp = state.imperial ? gainKg * 2.2046226218 : gainKg;
        const unit = state.imperial ? 'lb' : 'kg';
        emojiRain('\ud83c\udf37', `+${gainDisp.toFixed(0)} ${unit}`, 'Your body is doing exactly what it should. ');
        return;
      }
    }

    // --- logging streak: consecutive days up to today with any entry ---
    const days = new Set(entries.map((e) => entryDate(e)));
    let streak = 0;
    let cursor = new Date();
    for (;;) {
      const iso = isoDate(cursor);
      if (days.has(iso)) {
        streak++;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }
    const tiers = [3, 7, 14, 30, 60, 90];
    const reached = tiers.filter((t) => streak >= t).pop() || 0;
    const prevStreak = (await Store.getSetting('celebratedStreak')) || 0;
    if (reached > prevStreak) {
      await Store.setSetting('celebratedStreak', reached);
      emojiRain('\u2b50', `${reached}-day streak!`, 'Look at you, showing up for yourself. ');
    }
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

    wrap.appendChild(lifeStageCard());
    wrap.appendChild(backupCard());

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

    // Size comparison theme
    const themeSeg = el('div', { class: 'segmented theme-seg' });
    for (const [key, label] of [['fruit', '\ud83c\udf4e Fruit'], ['sport', '\u26bd Sports']]) {
      const b = el('button', {
        class: 'seg-btn' + (state.theme === key ? ' active' : ''),
        text: label,
        onClick: () => {
          state.theme = key;
          Store.setSetting('theme', key);
          renderApp();
        },
      });
      b.dataset.t = key;
      themeSeg.appendChild(b);
    }
    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Size comparison' }),
        el('p', { class: 'small', text: 'How to picture your baby\u2019s size each week.' }),
        themeSeg,
      ])
    );

    wrap.appendChild(updateCard());
    wrap.appendChild(installCard());

    wrap.appendChild(
      el('p', {
        class: 'muted small disclaimer',
        text: 'Bloom is informational only and not a substitute for medical care.',
      })
    );

    container.appendChild(wrap);
  }

  // Manual "check for updates": forces a service-worker check and refreshes if a
  // newer version is found, so people don't have to reinstall to the home screen.
  function updateCard() {
    const status = el('div', { class: 'muted small update-status', text: `Version ${APP_VERSION}` });
    const btn = el('button', {
      class: 'secondary compact',
      text: 'Check for updates',
      onClick: async () => {
        if (!('serviceWorker' in navigator)) {
          status.textContent = 'Updates aren\u2019t supported in this browser.';
          return;
        }
        status.textContent = 'Checking\u2026';
        try {
          const reg = window.__bloomSW || (await navigator.serviceWorker.getRegistration());
          if (!reg) {
            status.textContent = 'No update info yet \u2014 reopen the app and try again.';
            return;
          }
          await reg.update();
          // Give the browser a moment to begin installing any new worker.
          setTimeout(() => {
            if (reg.installing || reg.waiting) {
              status.textContent = 'Update found \u2014 refreshing\u2026';
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              setTimeout(() => location.reload(), 900);
            } else {
              status.textContent = `You\u2019re on the latest version (${APP_VERSION}). \u2713`;
            }
          }, 1500);
        } catch (e) {
          status.textContent = 'Couldn\u2019t check right now \u2014 you may be offline.';
        }
      },
    });
    return el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'App updates' }),
      el('p', { class: 'small', text: 'Bloom updates itself when you reopen it. You can also check now \u2014 no need to reinstall.' }),
      el('div', { class: 'update-row' }, [btn, status]),
    ]);
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
    const theme = await Store.getSetting('theme');
    const lifeStage = await Store.getSetting('lifeStage');
    const child = await Store.getSetting('child');
    if (units) state.imperial = units === 'imperial';
    if (theme === 'sport' || theme === 'fruit') state.theme = theme;
    if (baby) {
      state.babyName = baby.name || '';
      state.gender = baby.gender || 'surprise';
    }
    if (lifeStage === 'baby' && child) {
      state.lifeStage = 'baby';
      state.child = child;
      state.view = 'home';
    }
    state.logDate = todayISO();
    state.babyDay = todayISO();

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((granted) => {
        persistGranted = granted;
      }).catch(() => {});
    }

    if (dating && (dating.lmp || dating.ultrasoundDueDate)) {
      state.dating.lmp = dating.lmp ? new Date(dating.lmp) : null;
      state.dating.ultrasoundDueDate = dating.ultrasoundDueDate
        ? new Date(dating.ultrasoundDueDate)
        : null;
      renderApp();
      if (state.lifeStage === 'pregnancy') maybeCelebrateNewWeek();
    } else {
      renderSetup();
    }
  }

  boot();
})();
