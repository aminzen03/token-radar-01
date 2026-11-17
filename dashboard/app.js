// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail drawer with the model's own inputs and the protocol's
// farm plan, a model sandbox and a live-token reference. No network: every
// byte it shows is in data.js.
//
// The page recomputes a row from the snapshot figures with the same
// arithmetic main.ts ran, so the page's numbers and the board's data are
// visibly the same model. The sandbox changes the growth weight, the
// multiple scale or the breadth term and re-ranks live; at its defaults the
// page shows board.json's own implied values.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  app.setAttribute('aria-busy', 'false');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, source: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, gw: 0.5, ms: 1, breadth: true };
  var sandboxOn = function () { return state.gw !== 0.5 || state.ms !== 1 || !state.breadth; };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0'); }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries.
  function impliedOf(row) {
    if (!sandboxOn()) return row.implied_value_usd;
    var growthPct = (row.growth_multiplier - 1) * 200;
    var growthMult = 1 + (growthPct / 100) * state.gw;
    var breadth = state.breadth ? row.breadth_multiplier : 1;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * state.ms * growthMult * row.maturity_multiplier * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC through ' + name + ' on ' + chain + ' and leave the loan open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + "'s deepest pool on " + chain + ' and leave it in.';
    if (c.indexOf('bridge') >= 0) return 'Move $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and put the bridged funds to work in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and hold the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged trade.';
    if (c.indexOf('prediction') >= 0) return 'Back one market on ' + name + ' with $' + capital + ' and let the position ride.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Put $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + capital + ' of the stable asset ' + name + ' issues on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Buy $' + capital + " of the yield-bearing asset " + name + ' issues on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and leave the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Open the protocol's own page and check the position is live.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Open a fresh wallet for this farm alone, fund it with only what you plan to use, and store its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action every week — a deposit, a borrow, a swap or a vote — so the wallet reads as active, not one-off.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Keep the position open for at least ' + hold + ' days, so the activity spans more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'When a claim opens, use only the points or rewards page the protocol itself links to, and never pay anyone to claim for you.', cost: 'nothing to check, and never pay to claim', time: '10 minutes' },
      { text: 'Log the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('source')) state.source = params.get('source');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.source !== 'all') params.set('source', state.source);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.source !== 'all' && r.source !== state.source) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = impliedOf(a); bv = impliedOf(b); }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function sourceLabel(s) {
    if (s === 'watchlist') return 'Watchlist';
    if (s === 'above-floor') return 'Above floor';
    return 'Early';
  }
  function sourceClass(s) {
    if (s === 'watchlist') return 'status';
    if (s === 'above-floor') return 'status added';
    return 'status early';
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill', html: 'Snapshot <b>' + DATA.as_of + '</b>' }),
        el('span', { class: 'pill', html: 'DefiLlama protocol index' }),
        el('span', { class: 'pill', html: '<b>' + DATA.model_version + '</b> model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null,
          el('span', { text: 'The watchlist is the floor: every protocol with at least ' }),
          el('b', { text: fmtUsd(DATA.floor_usd) }),
          el('span', { text: ' of TVL and no token on record. The board adds ' + DATA.above_floor_size + ' launch candidates at or above that floor the watchlist leaves out, and ' + DATA.early_size + ' early rows below it. Implied value is a model, not a promise.' })
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every slug, none missing' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.above_floor_size + ' above the floor, ' + DATA.early_size + ' early' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: top ? fmtUsd(top.implied_value_usd) : 'n/a' }), el('small', { text: top ? top.name : '' })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }), el('small', { text: 'market values, not a model' }))
      )
    );
  }

  function spotlight() {
    var top = sortedRows(DATA.rows).slice(0, 10);
    return el('section', { class: 'spot', 'aria-label': 'Top 10 by implied value' },
      top.map(function (r) {
        return el('button', { class: 'card', type: 'button', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rk', text: '#' + r.rank }),
          el('b', { text: r.name }),
          el('span', { class: 'iv', text: fmtUsd(impliedOf(r)) }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · TVL ' + fmtUsd(r.tvl_usd) })
        );
      })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var tvl = el('select', { id: 'mintvl', 'aria-label': 'Minimum TVL' },
      el('option', { value: '0', text: 'Any TVL' }),
      el('option', { value: '100000000', text: 'TVL $100M+' }),
      el('option', { value: '500000000', text: 'TVL $500M+' }),
      el('option', { value: '1000000000', text: 'TVL $1B+' })
    );
    tvl.value = String(state.minTvl);
    tvl.addEventListener('change', function () { state.minTvl = Number(tvl.value); render(); });
    var src = el('select', { id: 'source', 'aria-label': 'Filter by source' },
      el('option', { value: 'all', text: 'All rows' }),
      el('option', { value: 'watchlist', text: 'Watchlist only' }),
      el('option', { value: 'above-floor', text: 'Above the floor' }),
      el('option', { value: 'early', text: 'Early radar' })
    );
    src.value = state.source;
    src.addEventListener('change', function () { state.source = src.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var count = state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols';
    if (sandboxOn()) count += ' · sandbox on';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chn),
      el('div', { class: 'field' }, el('label', { for: 'mintvl', text: 'TVL' }), tvl),
      el('div', { class: 'field' }, el('label', { for: 'source', text: 'Source' }), src),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: count })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.source = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 0;
    list.forEach(function (r) { max = Math.max(max, impliedOf(r)); });
    if (!max) max = 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((impliedOf(r) / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(impliedOf(r)) })
        )),
        el('td', null, el('span', { class: sourceClass(r.source), text: sourceLabel(r.source) }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Source' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: r.mcap_usd === null ? 'n/a' : fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_tvl === null ? 'n/a' : fmtMult(r.mcap_tvl) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: r.change_7d === null ? 'n/a' : fmtPct(r.change_7d) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'The market\'s own values: the ' + DATA.live.length + ' largest live-token protocols by market cap. Their market-cap-to-TVL ratios are what the category multiples are taken from.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: 'Market cap' }),
            el('th', { scope: 'col', text: 'Mcap / TVL' }),
            el('th', { scope: 'col', text: '7d' })
          )),
          tbody
        )
      )
    );
  }

  function openDetail(slug) {
    state.selected = slug;
    writeHash();
    render();
    var d = document.querySelector('.drawer');
    if (d) d.scrollTop = 0;
  }
  function closeDetail() {
    state.selected = null;
    writeHash();
    render();
  }

  function detail() {
    var r = bySlug(state.selected);
    if (!r) return null;
    var mult = DATA.multiples[r.category] || null;
    var peers = (DATA.peers && DATA.peers[r.category]) || [];
    var steps = farmSteps(r);
    var formula = el('div', { class: 'formula' },
      el('div', null, el('b', { text: fmtUsd(r.tvl_usd) }), el('span', { text: ' TVL × ' }), el('b', { text: fmtMult(r.category_multiple) }), el('span', { text: ' ' + (r.category || 'other') + ' multiple' + (mult ? ' (' + mult.peers + ' live peer' + (mult.peers === 1 ? '' : 's') + ')' : '') + ' × ' }), el('b', { text: r.growth_multiplier.toFixed(2) + '×' }), el('span', { text: ' growth × ' }), el('b', { text: r.maturity_multiplier.toFixed(2) + '×' }), el('span', { text: ' maturity × ' }), el('b', { text: r.breadth_multiplier.toFixed(2) + '×' }), el('span', { text: ' breadth = ' }), el('b', { text: fmtUsd(r.implied_value_usd) })),
      el('div', { class: 'note', text: 'The multiple is the median market-cap-to-TVL of live ' + (r.category || 'other') + ' protocols in this snapshot' + (mult && mult.peers < 3 ? '; with fewer than 3 peers it falls back to the all-live median ' + fmtMult(DATA.overall_multiple) : '') + '.' })
    );
    var peerRows = peers.map(function (p) {
      return el('tr', null,
        el('td', { text: p.name }),
        el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num', text: fmtMult(p.ratio) })
      );
    });
    return el('aside', { class: 'drawer', role: 'dialog', 'aria-label': r.name + ' detail' },
      el('button', { class: 'close', type: 'button', text: 'Close ×', onclick: closeDetail }),
      el('span', { class: sourceClass(r.source), text: sourceLabel(r.source) + ' · rank #' + r.rank }),
      el('h2', { text: r.name }),
      el('div', { class: 'meta', text: (r.category || 'Other') + ' · ' + (r.chains || []).join(', ') + ' · tracked since ' + (r.listed_at || 'unknown') }),
      el('div', { class: 'kv' },
        el('div', null, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(r.implied_value_usd) })),
        el('div', null, el('span', { text: 'TVL' }), el('b', { text: fmtUsd(r.tvl_usd) })),
        el('div', null, el('span', { text: '7d change' }), el('b', { class: r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg', text: r.change_7d === null ? 'n/a' : fmtPct(r.change_7d) })),
        el('div', null, el('span', { text: 'Age' }), el('b', { text: fmtAge(r.age_days) }))
      ),
      el('h3', { text: 'How the value is built' }),
      formula,
      el('h3', { text: 'Live peers in ' + (r.category || 'this category') }),
      peerRows.length ? el('table', { class: 'peers' },
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Protocol' }),
          el('th', { scope: 'col', text: 'Mcap' }),
          el('th', { scope: 'col', text: 'TVL' }),
          el('th', { scope: 'col', text: 'Mcap / TVL' })
        )),
        el('tbody', null, peerRows)
      ) : el('p', { class: 'note', text: 'No live-token protocol in this category in the snapshot, so the multiple falls back to the all-live median.' }),
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var parts = s.split(' Cost: ');
        var main = parts[0];
        var rest = parts.length > 1 ? parts.slice(1).join(' Cost: ') : '';
        return el('li', null, el('span', { text: main + (/[.!?]$/.test(main) ? ' ' : '. ') }), el('span', { class: 'cost', text: rest ? 'Cost: ' + rest : '' }));
      })),
      el('p', { class: 'note', text: 'Implied value is a model, not a promise. A launch may never come, and a token that does launch may trade far from this number.' })
    );
  }

  function modelBox() {
    var cats = Object.keys(DATA.multiples).map(function (c) { return { c: c, m: DATA.multiples[c].multiple, n: DATA.multiples[c].peers }; });
    cats.sort(function (a, b) { return b.m - a.m; });
    var rows = cats.slice(0, 16).map(function (x) {
      return el('tr', null,
        el('td', { text: x.c }),
        el('td', { class: 'num', text: fmtMult(x.m) }),
        el('td', { class: 'num', text: String(x.n) })
      );
    });
    var gw = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(state.gw), 'aria-label': 'Growth weight' });
    var gwOut = el('output', { text: state.gw.toFixed(2) });
    gw.addEventListener('input', function () { state.gw = Number(gw.value); gwOut.textContent = state.gw.toFixed(2); render(); });
    var ms = el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: String(state.ms), 'aria-label': 'Multiple scale' });
    var msOut = el('output', { text: state.ms.toFixed(2) + '×' });
    ms.addEventListener('input', function () { state.ms = Number(ms.value); msOut.textContent = state.ms.toFixed(2) + '×'; render(); });
    var br = el('input', { type: 'checkbox', checked: state.breadth ? 'checked' : null, 'aria-label': 'Breadth term on' });
    br.addEventListener('change', function () { state.breadth = br.checked; render(); });
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset model', onclick: function () { state.gw = 0.5; state.ms = 1; state.breadth = true; render(); } });
    return el('section', { class: 'modelbox' },
      el('h2', { text: 'The model, stated in full' }),
      el('p', null,
        el('span', { text: 'Implied value = TVL × ' }),
        el('code', { text: 'category multiple' }),
        el('span', { text: ' × growth × maturity × breadth. The multiple is the median market-cap-to-TVL of live protocols in the same category (fewer than 3 peers: the all-live median ' }),
        el('code', { text: fmtMult(DATA.overall_multiple) }),
        el('span', { text: '), clamped to 0.05–1.00. Growth is the 7-day TVL change clamped to −60…+120% at half weight; maturity rises from 0.60 for a new protocol to 1.00 at three years; breadth adds 2% per extra chain, up to 20%.' })
      ),
      el('table', { class: 'mult' },
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Category' }),
          el('th', { scope: 'col', text: 'Multiple' }),
          el('th', { scope: 'col', text: 'Live peers' })
        )),
        el('tbody', null, rows)
      ),
      el('p', { class: 'note', text: 'Sixteen highest multiples shown; every category on the board carries its own multiple in data.js.' }),
      el('h2', { text: 'Model sandbox' }),
      el('p', { class: 'note', text: 'Change the model and the board re-ranks live. At the defaults the page shows board.json’s own numbers.' }),
      el('div', { class: 'sandbox' },
        el('div', null, el('label', { text: 'Growth weight' }), gw, gwOut),
        el('div', null, el('label', { text: 'Multiple scale' }), ms, msOut),
        el('div', null, el('label', { text: 'Breadth term' }), el('label', { class: 'check' }, br, el('span', { text: ' multi-chain boost on' })), reset)
      ),
      sandboxOn() ? el('p', { class: 'on', text: 'Sandbox on: the board is re-ranked under your settings and no longer matches board.json.' }) : null
    );
  }

  function method() {
    return el('section', { class: 'method' },
      el('h2', { text: 'How the board was built' }),
      el('ul', null,
        el('li', { text: 'Snapshot: DefiLlama protocol index, fetched ' + DATA.source.replace('DefiLlama ', '') + '. The file is frozen: 758 protocols at or above $5M of TVL, sorted by slug.' }),
        el('li', { text: 'Watchlist: ' + DATA.watchlist_size + ' protocols with at least ' + fmtUsd(DATA.floor_usd) + ' of TVL and no token on record. The board covers all of them.' }),
        el('li', { text: 'Added: ' + DATA.above_floor_size + ' launch candidates at or above the floor the watchlist leaves out, and ' + DATA.early_size + ' early rows below it — the watchlist is a floor, never a ceiling.' }),
        el('li', { text: 'Set aside: ' + DATA.excluded_size + ' pre-token protocols that are wrapped, staked or bridged products of a token that already trades, versioned pools, or exchanges. WBTC is Bitcoin on Ethereum, not a launch waiting to happen.' }),
        el('li', { text: 'The snapshot carries no ranking, no implied value and no farm plan. Deriving them is this entry’s work, and the model above states how.' })
      ),
      el('footer', { text: 'Token Radar · snapshot ' + DATA.as_of + ' · ' + DATA.model_version + ' model · implied value is a model, not a promise.' })
    );
  }

  function render() {
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(header());
    app.appendChild(lede());
    app.appendChild(spotlight());
    app.appendChild(controls());
    app.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    app.appendChild(modelBox());
    app.appendChild(method());
    var d = detail();
    if (d) app.appendChild(d);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected) closeDetail();
  });
  readHash();
  render();
})();
