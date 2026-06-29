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
  };

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
    root.innerHTML = '';
    const content = el('div', { class: 'content' });
    if (state.view === 'week') renderWeekView(content);
    else if (state.view === 'log') renderLogView(content);
    else if (state.view === 'trends') renderTrendsView(content);
    else if (state.view === 'food') renderFoodView(content);
    else if (state.view === 'settings') renderSettingsView(content);

    const nav = el('nav', { class: 'tabbar' }, [
      navItem('week', 'Week', '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
      navItem('log', 'Log', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
      navItem('trends', 'Trends', '<line x1="3" y1="21" x2="21" y2="21"/><polyline points="4 15 9 9 13 13 20 5"/>'),
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
    wrap.appendChild(feelingsCard);

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
            ? 'Log once more to start a trend (see the Trends tab).'
            : opts.encourage + ' See the Trends tab for your chart.';
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
  // Trends view (everything over time)
  // ---------------------------------------------------------------------------

  function renderTrendsView(container) {
    const wrap = el('div', { class: 'wrap' }, [viewHeader('Trends')]);
    container.appendChild(wrap);

    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim() || '#b5739d';

    // Weight + bump line charts over the whole journey.
    const lineCard = (opts) => {
      const card = el('div', { class: 'card' }, [
        el('h3', { class: 'card-title', text: opts.title }),
      ]);
      const canvas = el('canvas', { class: 'chart-canvas tall' });
      const note = el('p', { class: 'muted small' });
      card.appendChild(canvas);
      card.appendChild(note);

      Store.entriesOfKind(opts.kind).then((entries) => {
        if (entries.length < 2) {
          canvas.style.display = 'none';
          note.textContent =
            entries.length === 0
              ? `No ${opts.noun} logged yet. Add entries from the Log tab.`
              : `Log ${opts.noun} once more to see a trend line.`;
          return;
        }
        const first = entries[0];
        const last = entries[entries.length - 1];
        const change = opts.fromStored(last.value) - opts.fromStored(first.value);
        const sign = change >= 0 ? '+' : '';
        note.textContent = `${opts.fromStored(last.value).toFixed(1)} ${opts.unit()} now \u00b7 ${sign}${change.toFixed(1)} ${opts.unit()} since you started logging.`;
        const points = entries.map((e) => ({
          x: e.createdAt,
          y: opts.fromStored(e.value),
          label: e.week != null ? `wk ${e.week}` : '',
        }));
        requestAnimationFrame(() =>
          drawLineChart(canvas, points, {
            formatValue: (v) => Math.round(v) + '',
            accent,
          })
        );
      });
      return card;
    };

    wrap.appendChild(
      lineCard({
        title: 'Weight over time',
        kind: 'weight',
        noun: 'weight',
        unit: weightUnit,
        fromStored: fromStoredWeight,
      })
    );
    wrap.appendChild(
      lineCard({
        title: 'Bump size over time',
        kind: 'bump',
        noun: 'a bump measurement',
        unit: bumpUnit,
        fromStored: fromStoredBump,
      })
    );

    // Feelings & symptoms over time: stacked bars per week (good / neutral / tough).
    const feelCard = el('div', { class: 'card' }, [
      el('h3', { class: 'card-title', text: 'How you\u2019ve been feeling' }),
    ]);
    const feelCanvas = el('canvas', { class: 'chart-canvas tall' });
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
    const feelNote = el('p', { class: 'muted small' });
    feelCard.appendChild(feelCanvas);
    feelCard.appendChild(legend);
    feelCard.appendChild(feelNote);
    wrap.appendChild(feelCard);

    const toneColors = {
      good: getCssColor('--good', '#6bbf73'),
      neutral: '#b0b6bc',
      tough: '#d9a066',
    };

    Store.allEntries().then((all) => {
      const fs = all.filter((e) => e.kind === 'feeling' || e.kind === 'symptom');
      if (fs.length === 0) {
        feelCanvas.style.display = 'none';
        legend.style.display = 'none';
        feelNote.textContent =
          'Once you log how you\u2019re feeling, your weeks will show here.';
        return;
      }
      // group by week
      const byWeek = {};
      for (const e of fs) {
        const wk = e.week != null ? e.week : 0;
        if (!byWeek[wk]) byWeek[wk] = { good: 0, neutral: 0, tough: 0 };
        const tone = e.label ? toneForLabel(e.label) : 'neutral';
        byWeek[wk][tone]++;
      }
      const weeks = Object.keys(byWeek)
        .map(Number)
        .sort((a, b) => a - b);
      const groups = weeks.map((wk) => ({
        label: `${wk}`,
        segments: [
          { value: byWeek[wk].good, color: toneColors.good },
          { value: byWeek[wk].neutral, color: toneColors.neutral },
          { value: byWeek[wk].tough, color: toneColors.tough },
        ],
      }));
      const goodTotal = fs.filter(
        (e) => e.label && toneForLabel(e.label) === 'good'
      ).length;
      feelNote.textContent = `${goodTotal} good moment${goodTotal === 1 ? '' : 's'} logged across ${weeks.length} week${weeks.length === 1 ? '' : 's'}. Bars show entries per week.`;
      requestAnimationFrame(() => drawStackedBars(feelCanvas, groups));
    });

    wrap.appendChild(
      el('p', {
        class: 'muted small disclaimer',
        text:
          'These charts are a personal keepsake of your own entries, not a ' +
          'medical record or assessment.',
      })
    );
  }

  function getCssColor(varName, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return v || fallback;
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
