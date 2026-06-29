// app.js
// App shell with bottom navigation, plus the Week, Log, Food, and Settings
// views. Plain IndexedDB storage. Built to extend (symptom logging and a fuller
// trends view slot into the Log tab later).

(() => {
  const root = document.getElementById('app');

  const state = {
    dating: { lmp: null, ultrasoundDueDate: null },
    imperial: false,
    view: 'week',
    viewWeek: null,
    tool: null, // within Tools: 'contraction' | 'kick' | 'birthplan' | 'questions'
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
    else if (state.view === 'food') renderFoodView(content);
    else if (state.view === 'settings') renderSettingsView(content);

    const nav = el('nav', { class: 'tabbar' }, [
      navItem('week', 'Week', '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
      navItem('log', 'Log', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
      navItem('tools', 'Tools', '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.3L4 17v3h3l5.4-5.3a4 4 0 0 1 5.3-5.4l-2.6 2.6-2-2 2.6-2.6Z"/>'),
      navItem('food', 'Food', '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><line x1="6" y1="9" x2="6" y2="22"/><path d="M17 2c-1.5 1-2 3-2 5s.5 4 2 5v10"/>'),
      navItem('settings', 'Settings', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
    ]);

    root.appendChild(content);
    root.appendChild(nav);
  }

  function viewHeader(title) {
    return el('header', { class: 'app-header' }, [
      el('h1', { class: 'app-title', text: title }),
    ]);
  }

  function renderSetup() {
    root.innerHTML = '';
    const lmpInput = el('input', { type: 'date', max: isoDate(new Date()) });
    const dueInput = el('input', { type: 'date' });
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
      await Store.setSetting('dating', {
        lmp: lmp ? lmp.getTime() : null,
        ultrasoundDueDate: due ? due.getTime() : null,
      });
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

    root.appendChild(el('div', { class: 'wrap' }, [viewHeader('Bloom'), card]));
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

    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-emoji', text: info.emoji }),
      el('div', { class: 'hero-week', text: `Week ${info.week}` }),
      el('div', { class: 'hero-fruit', text: `About the size of ${info.fruit}` }),
      measure ? el('div', { class: 'hero-measure', text: measure + lengthNote }) : null,
      trimesterLabel && !isOther ? el('div', { class: 'chip', text: trimesterLabel }) : null,
    ]);

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
      el('h3', { class: 'card-title', text: 'Baby this week' }),
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
    const week = currentWeek();
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Log')]);
    container.appendChild(wrap);

    // --- this-week summary (filled async) ---
    const summary = el('div', { class: 'card week-summary' });
    wrap.appendChild(summary);

    // --- feelings / symptoms ---
    const feelingsCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: `How are you feeling? \u00b7 week ${week}` }),
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
            text: option.label,
            onClick: async () => {
              await Store.addEntry({
                kind: option.kind,
                label: option.label,
                week,
              });
              toast(`Logged: ${option.label}`);
              renderApp();
            },
          })
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
    wrap.appendChild(feelingsCard);

    // --- things that may help (relief tips for this week's tough symptoms) ---
    const reliefCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Things that may help' }),
    ]);
    const reliefBody = el('div', {});
    reliefCard.appendChild(reliefBody);
    wrap.appendChild(reliefCard);

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

    wrap.appendChild(
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
    wrap.appendChild(
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

    // --- recent entries for this week (deletable) ---
    const recentCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'This week\u2019s entries' }),
    ]);
    const recentList = el('div', { class: 'entry-list' });
    recentCard.appendChild(recentList);
    wrap.appendChild(recentCard);

    // folded-in trend: how you've been feeling over time (collapsible)
    wrap.appendChild(feelingsTrendCard());

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
      Store.entriesForWeek(week).then((entries) => {
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
                  ? 'Nothing logged yet this week'
                  : `${total} thing${total === 1 ? '' : 's'} logged this week`,
            }),
            good > 0
              ? el('div', {
                  class: 'summary-sub muted small',
                  text: `${good} ${good === 1 ? 'was a' : 'were'} good moment${good === 1 ? '' : 's'}`,
                })
              : null,
          ])
        );

        // relief tips for distinct symptoms/feelings logged this week that have advice
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
          recentList.appendChild(
            el('div', { class: 'entry-row' }, [
              el('span', { class: `entry-dot tone-${tone}` }),
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
    if (state.tool === 'birthplan') return renderBirthPlan(container);
    if (state.tool === 'questions') return renderDoctorQuestions(container);

    const tools = [
      { key: 'contraction', title: 'Contraction timer', desc: 'Time contractions and see how close together they are.' },
      { key: 'kick', title: 'Kick counter', desc: 'Count baby\u2019s movements, with guidance on what to expect.' },
      { key: 'birthplan', title: 'Birth plan', desc: 'Build your preferences and a hospital-bag checklist.' },
      { key: 'questions', title: 'Questions for your doctor', desc: 'Jot down questions for your next appointment.' },
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

  // --- Birth plan ---
  function renderBirthPlan(container) {
    const wrap = el('div', { class: 'wrap' }, [toolHeader('Birth plan')]);
    container.appendChild(wrap);

    wrap.appendChild(
      el('p', {
        class: 'muted small section-intro',
        text: 'A birth plan shares your preferences with your care team. It\u2019s a guide, not a guarantee \u2014 staying flexible on the day is normal and healthy.',
      })
    );

    Promise.all([
      Store.getSetting('birthPlan'),
      Store.getSetting('birthPlanBag'),
    ]).then(([savedPlan, savedBag]) => {
      const plan = savedPlan || {};
      const bag = savedBag || {};

      const persistPlan = () => Store.setSetting('birthPlan', plan);
      const persistBag = () => Store.setSetting('birthPlanBag', bag);

      for (const section of BIRTH_PLAN_SECTIONS) {
        const card = el('div', { class: 'card' }, [
          el('h3', { class: 'card-title', text: section.title }),
        ]);
        if (!plan[section.key]) plan[section.key] = { selected: [], note: '' };
        const entry = plan[section.key];

        if (section.type === 'select') {
          const group = el('div', { class: 'chip-group' });
          for (const opt of section.options) {
            const chip = el('button', {
              class: 'plan-chip' + (entry.selected.includes(opt) ? ' selected' : ''),
              text: opt,
              onClick: () => {
                const idx = entry.selected.indexOf(opt);
                if (idx >= 0) entry.selected.splice(idx, 1);
                else entry.selected.push(opt);
                chip.classList.toggle('selected');
                persistPlan();
              },
            });
            group.appendChild(chip);
          }
          card.appendChild(group);
        } else {
          const ta = el('textarea', {
            class: 'plan-textarea',
            rows: '3',
            placeholder: section.placeholder || '',
          });
          ta.value = entry.note || '';
          ta.addEventListener('input', () => {
            entry.note = ta.value;
          });
          ta.addEventListener('blur', persistPlan);
          card.appendChild(ta);
        }
        wrap.appendChild(card);
      }

      // Hospital bag checklist
      const bagCard = el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: 'Hospital bag checklist' }),
      ]);
      for (const group of HOSPITAL_BAG) {
        bagCard.appendChild(el('p', { class: 'chip-group-title', text: group.group }));
        for (const item of group.items) {
          const id = group.group + '|' + item;
          const row = el('label', { class: 'check-row' }, [
            el('input', {
              type: 'checkbox',
              checked: bag[id] ? 'checked' : null,
              onChange: (e) => {
                bag[id] = e.target.checked;
                persistBag();
              },
            }),
            el('span', { text: item }),
          ]);
          bagCard.appendChild(row);
        }
      }
      wrap.appendChild(bagCard);

      wrap.appendChild(
        el('p', {
          class: 'muted small disclaimer',
          text: 'Saved on this device as you go. Bring it to an appointment to talk through with your provider.',
        })
      );
    });
  }

  // --- Doctor questions ---
  function renderDoctorQuestions(container) {
    const wrap = el('div', { class: 'wrap' }, [toolHeader('Questions for your doctor')]);
    container.appendChild(wrap);

    const input = el('input', {
      type: 'text',
      class: 'food-search',
      placeholder: 'Add a question\u2026',
      autocomplete: 'off',
    });
    const addBtn = el('button', { class: 'primary compact', text: 'Add' });
    const inputRow = el('div', { class: 'q-input-row' }, [input, addBtn]);

    const card = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Your questions' }),
      inputRow,
    ]);
    const listEl = el('div', { class: 'entry-list' });
    card.appendChild(listEl);
    wrap.appendChild(card);

    const suggestions = [
      'Is my weight gain on track?',
      'What foods or activities should I avoid now?',
      'What symptoms should I call about?',
      'When is my next scan or test?',
      'What are my options for pain relief?',
    ];
    const suggCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'Common questions to add' }),
    ]);
    const suggWrap = el('div', { class: 'chip-group' });
    suggCard.appendChild(suggWrap);
    wrap.appendChild(suggCard);

    let questions = [];

    function persist() {
      return Store.setSetting('doctorQuestions', questions);
    }

    function renderList() {
      listEl.innerHTML = '';
      if (questions.length === 0) {
        listEl.appendChild(el('p', { class: 'muted small', text: 'No questions yet. Add one above, or tap a suggestion.' }));
        return;
      }
      questions.forEach((q) => {
        const checkbox = el('input', {
          type: 'checkbox',
          checked: q.answered ? 'checked' : null,
          onChange: (e) => {
            q.answered = e.target.checked;
            persist();
            label.classList.toggle('done', q.answered);
          },
        });
        const label = el('span', {
          class: 'entry-label' + (q.answered ? ' done' : ''),
          text: q.text,
        });
        listEl.appendChild(
          el('div', { class: 'entry-row' }, [
            checkbox,
            label,
            el('button', {
              class: 'entry-delete',
              'aria-label': 'Delete',
              text: '\u00d7',
              onClick: async () => {
                questions = questions.filter((x) => x.id !== q.id);
                await persist();
                renderList();
              },
            }),
          ])
        );
      });
    }

    function addQuestion(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      questions.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), text: trimmed, answered: false });
      persist();
      renderList();
    }

    addBtn.addEventListener('click', () => {
      addQuestion(input.value);
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addQuestion(input.value);
        input.value = '';
      }
    });

    for (const s of suggestions) {
      suggWrap.appendChild(
        el('button', {
          class: 'log-chip tone-neutral',
          text: '+ ' + s,
          onClick: () => addQuestion(s),
        })
      );
    }

    Store.getSetting('doctorQuestions').then((saved) => {
      questions = Array.isArray(saved) ? saved : [];
      renderList();
    });
  }

  function renderFoodView(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Can I eat this?')]);
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
      item.source ? el('p', { class: 'muted small', text: `\u2014 ${item.source}` }) : null,
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
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Settings')]);

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
        ]),
      ])
    );

    wrap.appendChild(
      el('p', {
        class: 'muted small disclaimer',
        text: 'Bloom is informational only and not a substitute for medical care.',
      })
    );

    container.appendChild(wrap);
  }

  async function boot() {
    const dating = await Store.getSetting('dating');
    const units = await Store.getSetting('units');
    if (units === 'imperial') state.imperial = true;

    if (dating && (dating.lmp || dating.ultrasoundDueDate)) {
      state.dating.lmp = dating.lmp ? new Date(dating.lmp) : null;
      state.dating.ultrasoundDueDate = dating.ultrasoundDueDate
        ? new Date(dating.ultrasoundDueDate)
        : null;
      renderApp();
    } else {
      renderSetup();
    }
  }

  boot();
})();
