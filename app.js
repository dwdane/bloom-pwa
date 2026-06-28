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
    else if (state.view === 'food') renderFoodView(content);
    else if (state.view === 'settings') renderSettingsView(content);

    const nav = el('nav', { class: 'tabbar' }, [
      navItem('week', 'Week', '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'),
      navItem('log', 'Log', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
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

    async function save() {
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
      state.view = 'week';
      renderApp();
    }

    const card = el('div', { class: 'card setup' }, [
      el('h2', { text: 'Welcome to Bloom' }),
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
      el('button', { class: 'primary', text: 'Start', onClick: save }),
      el('p', {
        class: 'muted small',
        text: 'Everything stays on this device. Nothing is uploaded.',
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
      const canvas = el('canvas', { class: 'chart-canvas' });
      const note = el('p', { class: 'muted small' });
      card.appendChild(latestEl);
      card.appendChild(canvas);
      card.appendChild(note);

      Store.entriesOfKind(opts.kind).then((entries) => {
        if (entries.length === 0) {
          latestEl.textContent = 'Not logged yet';
          note.textContent = 'Tap Add to record your first measurement.';
          canvas.style.display = 'none';
          return;
        }
        const last = entries[entries.length - 1];
        latestEl.textContent =
          opts.fromStored(last.value).toFixed(1) + ' ' + opts.unit();
        if (entries.length < 2) {
          note.textContent = 'Log once more to see your trend.';
          canvas.style.display = 'none';
          return;
        }
        note.textContent = opts.encourage;
        const points = entries.map((e) => ({
          x: e.createdAt,
          y: opts.fromStored(e.value),
          label: e.week != null ? `wk ${e.week}` : '',
        }));
        requestAnimationFrame(() =>
          drawLineChart(canvas, points, {
            formatValue: (v) => Math.round(v) + '',
            accent:
              getComputedStyle(document.documentElement)
                .getPropertyValue('--accent')
                .trim() || '#b5739d',
          })
        );
      });

      return card;
    };

    container.appendChild(
      el('div', { class: 'wrap' }, [
        viewHeader('Log'),
        el('p', { class: 'muted small section-intro', text: `Week ${week}` }),
        measureCard({
          title: 'Weight',
          dialogTitle: 'Log weight',
          kind: 'weight',
          unit: weightUnit,
          toStored: toStoredWeight,
          fromStored: fromStoredWeight,
          encourage: 'Every pound is your body doing its job beautifully.',
        }),
        measureCard({
          title: 'Bump size',
          dialogTitle: 'Log bump size',
          kind: 'bump',
          unit: bumpUnit,
          toStored: toStoredBump,
          fromStored: fromStoredBump,
          encourage: 'Look how much room your little one is making.',
        }),
        el('p', {
          class: 'muted small disclaimer',
          text: 'Symptom and feeling tracking is coming in a later update.',
        }),
      ])
    );
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
      el('p', {
        class: 'muted small disclaimer',
        text: 'A companion to the Bloom app. All data stays on this device.',
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
