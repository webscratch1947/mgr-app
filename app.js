/* MGR ALL IN ONE SERVICES — App logic (plain JS, no TypeScript) */
(function () {
  'use strict';

  /* ── Supabase client ── */
  var db = null;
  function getDB() {
    if (db) return db;
    var cfg = window.__MGR_CFG__ || {};
    if (!cfg.url || !cfg.anon) return null;
    db = supabase.createClient(cfg.url, cfg.anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return db;
  }
  function rzpKey() { return (window.__MGR_CFG__ || {}).rzp || ''; }
  function apiBase() { return (window.__MGR_CFG__ || {}).apiBase || ''; }

  /* ── App state ── */
  var state = {
    user: null,          // { authId, dbId, email, name, phone, address, role }
    vendorStatus: 'none', // 'none' | 'pending' | 'approved'
    bookings: [],
    activeView: 'home',
    activeCat: 'All',
    detailService: null,
    bookService: null,
    nav: ['home']
  };

  /* ── Helpers ── */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };

  function uniqueBy(arr, keyFn) {
    var out = [];
    (arr || []).forEach(function (item) {
      var key = keyFn(item);
      if (key && out.indexOf(key) === -1) out.push(key);
    });
    return out;
  }

  function svcPrice(s) {
    /* AC Service & Repair is always free — no platform charge */
    if (s && (s.name === 'AC Service & Repair' || s.service_name === 'AC Service & Repair')) return 0;
    if (s && s.price === 0) return 0;
    var price = Number(s && s.price != null ? s.price : (s && s.service_price != null ? s.service_price : window.MGR_PLATFORM_CHARGE));
    return Number.isFinite(price) && price > 0 ? price : 99;
  }

  function isFree(s) { return s && svcPrice(s) === 0; }

  function priceLabel(value) {
    var amount = Number(value);
    if (amount === 0) return 'FREE';
    if (!Number.isFinite(amount)) amount = 99;
    return 'Rs. ' + amount;
  }

  function normalizeService(s) {
    return {
      id: Number(s.id),
      name: s.name || 'Service',
      cat: s.cat || s.category || s.service_category || 'Services',
      img: s.img || s.image_url || s.service_image || '',
      price: svcPrice(s),
      rating: Number(s.rating || 4.8),
      desc: s.desc || s.description || '',
      badge: s.badge || ''
    };
  }

  function rebuildServiceMeta() {
    window.MGR_SERVICES = (window.MGR_SERVICES || []).map(normalizeService);
    window.MGR_CATEGORIES = ['All'].concat(uniqueBy(window.MGR_SERVICES, function (s) { return s.cat; }));
  }

  async function loadServiceCatalog() {
    var c = getDB();
    if (c) {
      try {
        var res = await c
          .from('services')
          .select('id,name,category,image_url,price,rating,description,badge,sort_order,is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });
        if (!res.error && Array.isArray(res.data) && res.data.length) {
          window.MGR_SERVICES = res.data.map(normalizeService);
          rebuildServiceMeta();
          return true;
        }
        if (res.error && res.error.code !== '42P01') console.warn('Supabase service catalog sync failed:', res.error.message || res.error);
      } catch (e) {
        console.warn('Supabase service catalog sync failed:', e);
      }
    }
    rebuildServiceMeta();
    return false;
  }

  function refreshCatalogViews() {
    if (state.activeView === 'home') renderHome();
    if (state.activeView === 'browse') renderBrowse();
    if (state.activeView === 'detail' && state.detailService) {
      var det = (window.MGR_SERVICES || []).find(function (s) { return String(s.id) === String(state.detailService.id); });
      if (det) openServiceDetail(det);
    }
    if (state.activeView === 'book' && state.bookService) {
      var book = (window.MGR_SERVICES || []).find(function (s) { return String(s.id) === String(state.bookService.id); });
      if (book) openBookingForm(book);
    }
  }


  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    $('#toastHost').appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2400);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 2750);
  }

  function modal(opts) {
    var host = $('#modalHost'); host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'modal-overlay';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      (opts.title ? '<h3>' + esc(opts.title) + '</h3>' : '') +
      '<div>' + (opts.body || '') + '</div>' +
      '<div class="modal-actions"></div></div>';
    var close = function () { wrap.remove(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    host.appendChild(wrap);
    (opts.actions || [{ label: 'Close', kind: 'btn-outline' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (a.kind || 'btn-outline'); b.textContent = a.label;
      b.addEventListener('click', function () {
        try { (a.onClick || function () { })(close); } catch (e) { console.error(e); }
        if (!a.keepOpen) close();
      });
      wrap.querySelector('.modal-actions').appendChild(b);
    });
    return { close: close };
  }

  /* ── Auth helpers ── */
  function emailValid(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  async function fetchUserRow(authId) {
    var c = getDB(); if (!c || !authId) return null;
    var res = await c.from('users').select('*').eq('auth_id', authId).maybeSingle();
    return res.data || null;
  }

  async function ensureUserRow(authUser, extra) {
    var c = getDB(); if (!c || !authUser) return null;
    var row = await fetchUserRow(authUser.id);
    if (!row) {
      var ins = {
        auth_id: authUser.id,
        email: authUser.email,
        full_name: (extra && extra.name) || (authUser.user_metadata && authUser.user_metadata.full_name) || '',
        phone: (extra && extra.phone) || ''
      };
      var ins_res = await c.from('users').insert(ins).select('*').single();
      if (!ins_res.error) row = ins_res.data;
      else row = await fetchUserRow(authUser.id);
    }
    return row;
  }

  function setUserFromRow(authUser, row) {
    if (!row) { state.user = null; syncProfileUI(); return; }
    state.user = {
      authId: authUser.id,
      dbId: row.id,
      email: row.email || authUser.email,
      name: row.full_name || '',
      phone: row.phone || '',
      address: row.address || '',
      role: row.role || 'user'
    };
    syncProfileUI();
    refreshVendorState();
  }

  async function refreshVendorState() {
    var c = getDB();
    if (!c || !state.user) { state.vendorStatus = 'none'; syncSidebarVendor(); return; }
    if (state.user.role === 'vendor' || state.user.role === 'admin') { state.vendorStatus = 'approved'; syncSidebarVendor(); return; }
    try {
      var vr = await c.from('vendors').select('id').eq('user_id', state.user.dbId).maybeSingle();
      if (vr.data) { state.vendorStatus = 'approved'; syncSidebarVendor(); return; }
      var rr = await c.from('vendor_requests').select('status').eq('user_id', state.user.dbId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      state.vendorStatus = (rr.data && rr.data.status === 'pending') ? 'pending' : 'none';
    } catch (e) { state.vendorStatus = 'none'; }
    syncSidebarVendor();
  }

  /* ── Sidebar vendor section sync ── */
  /* Also syncs the Customer/Vendor role pills based on the active view */
  function syncSidebarVendor() {
    var become = $('#sbBecomeVendor');
    var pending = $('#sbVendorPending');
    var panel = $('#sbVendorPanel');
    var reviews = $('#sbVendorReviews');
    var cPill = $('#sbRoleCustomer');
    var vPill = $('#sbRoleVendor');
    if (!become || !pending || !panel) return;

    var s = state.vendorStatus || 'none';
    become.style.display = (s === 'none') ? 'flex' : 'none';
    pending.style.display = (s === 'pending') ? 'flex' : 'none';
    panel.style.display = (s === 'approved') ? 'flex' : 'none';
    if (reviews) reviews.style.display = (s === 'approved') ? 'flex' : 'none';

    /* Sync role pills: if on vendor-panel view → Vendor pill active; else → Customer pill active */
    var onVendorView = (state.activeView === 'vendor-panel');
    if (cPill) cPill.classList.toggle('active', !onVendorView);
    if (vPill) vPill.classList.toggle('active', onVendorView);
  }

  async function doLogin(email, pass) {
    var c = getDB();
    if (!c) return { ok: false, error: 'Supabase not configured.' };
    var res = await c.auth.signInWithPassword({ email: email, password: pass });
    if (res.error) return { ok: false, error: res.error.message };
    var row = await ensureUserRow(res.data.user);
    setUserFromRow(res.data.user, row);
    return { ok: true };
  }

  async function doRegister(opts) {
    var c = getDB();
    if (!c) return { ok: false, error: 'Supabase not configured.' };
    var res = await c.auth.signUp({ email: opts.email, password: opts.pass, options: { data: { full_name: opts.name } } });
    if (res.error) return { ok: false, error: res.error.message };
    if (!res.data.user) return { ok: false, error: 'Check your email to confirm sign up, then log in.' };
    var row = await ensureUserRow(res.data.user, { name: opts.name, phone: opts.phone });
    setUserFromRow(res.data.user, row);
    return { ok: true };
  }

  function showAuth() { $('#authScreen').style.display = 'flex'; $('#app').style.display = 'none'; }
  function showApp() { $('#authScreen').style.display = 'none'; $('#app').style.display = 'flex'; }

  function hideSplash() {
    var s = document.getElementById('splashScreen');
    if (s) { s.classList.add('hidden'); setTimeout(function () { if (s.parentNode) s.remove(); }, 450); }
  }

  /* ── Bookings ── */
  async function loadBookings() {
    var c = getDB();
    if (!c || !state.user) { state.bookings = []; return []; }
    var ids = uniqueBy([state.user.dbId, state.user.authId], function (v) { return v ? String(v) : ''; });
    var res = ids.length > 1
      ? await c.from('bookings').select('*').in('user_id', ids).order('created_at', { ascending: false })
      : await c.from('bookings').select('*').eq('user_id', ids[0]).order('created_at', { ascending: false });
    if (res.error) { state.bookings = []; return []; }
    var bookings = res.data || [];
    var bookingIds = bookings.map(function (b) { return b.id; }).filter(Boolean);
    var assignmentByBooking = {};
    if (bookingIds.length) {
      var asn = await c.from('assignments')
        .select('booking_id, id, status, entry_code, entry_confirmed, completion_code, completion_confirmed, rating, review')
        .in('booking_id', bookingIds);
      if (!asn.error) {
        (asn.data || []).forEach(function (a) { assignmentByBooking[String(a.booking_id)] = a; });
      }
    }
    state.bookings = bookings.map(function (b) {
      var a = assignmentByBooking[String(b.id)] || null;
      if (!a) return b;
      return Object.assign({}, b, {
        _assignmentId: a.id || '',
        _assignmentStatus: a.status || '',
        _entryCode: a.entry_code || '',
        _entryConfirmed: !!a.entry_confirmed,
        _completionCode: a.completion_code || '',
        _completionConfirmed: !!a.completion_confirmed,
        _rated: !!a.rating
      });
    });
    return state.bookings;
  }

  async function saveBookingRow(svc, form, paymentId, paymentStatus, code) {
    var c = getDB(); if (!c || !state.user) throw new Error('Not signed in.');
    var payload = {
      user_id: state.user.dbId,
      service_name: svc.name,
      service_category: svc.cat,
      service_price: svcPrice(svc),
      service_image: svc.img,
      booking_date: form.date,
      booking_time: form.time || '10:00',
      address: form.address,
      notes: form.notes || '',
      status: 'pending',
      payment_id: paymentId || '',
      payment_status: paymentStatus || 'pending',
      verification_code: code || ''
    };
    var res = await c.from('bookings').insert(payload);
    if (res.error && /column .* does not exist/i.test(res.error.message || '')) {
      var minimal = { user_id: payload.user_id, service_name: payload.service_name, service_category: payload.service_category, service_price: svcPrice(svc), service_image: payload.service_image, booking_date: payload.booking_date, booking_time: payload.booking_time, address: payload.address, notes: payload.notes, status: 'pending' };
      res = await c.from('bookings').insert(minimal);
    }
    if (res.error) throw new Error(res.error.message);
  }

  async function cancelBooking(id) {
    var c = getDB();
    if (c && state.user) await c.from('bookings').update({ status: 'cancelled' }).eq('id', id).eq('user_id', state.user.dbId);
    for (var i = 0; i < state.bookings.length; i++) { if (state.bookings[i].id === id) { state.bookings[i].status = 'cancelled'; break; } }
    renderBookings(); toast('Booking cancelled');
  }

  /* ── Service card HTML ── */
  function svcCardHTML(s) {
    var free = isFree(s);
    var priceHtml = free
      ? '<span class="price free-price">FREE <small>booking</small></span>'
      : '<span class="price">' + priceLabel(svcPrice(s)) + ' <small>platform</small></span>';
    return '<div class="svc-card" data-svc="' + s.id + '">' +
      '<img class="thumb" loading="lazy" src="' + esc(s.img) + '" alt="' + esc(s.name) + '" />' +
      '<div class="body"><h4>' + esc(s.name) + '</h4>' +
      '<div class="meta">★ ' + s.rating + ' · ' + esc(s.cat) + '</div>' +
      '<div class="price-row">' + priceHtml + (s.badge ? ' <span class="svc-badge">' + esc(s.badge) + '</span>' : '') + '</div>' +
      '<button class="book-btn" data-book="' + s.id + '" type="button">Book</button>' +
      '</div></div>';
  }

  function bindSvcCards(scope) {
    $$(scope + ' [data-svc]').forEach(function (card) {
      var open = function () {
        var svc = (window.MGR_SERVICES || []).find(function (s) { return s.id === Number(card.dataset.svc); });
        if (svc) openServiceDetail(svc);
      };
      var img = card.querySelector('.thumb'); if (img) img.addEventListener('click', open);
      var h4 = card.querySelector('h4'); if (h4) h4.addEventListener('click', open);
    });
    $$(scope + ' [data-book]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var svc = (window.MGR_SERVICES || []).find(function (s) { return s.id === Number(btn.dataset.book); });
        if (!svc) return;
        if (!state.user) { showAuth(); setAuthMode('login'); return; }
        openBookingForm(svc);
      });
    });
  }

  /* ── Render functions ── */
  function renderHome() {
    var u = state.user;
    $('#greetUser').textContent = u && u.name ? 'Hi ' + u.name.split(' ')[0] : 'Welcome';
    var popular = (window.MGR_SERVICES || []).slice(0, 6);
    $('#popularGrid').innerHTML = popular.map(svcCardHTML).join('');
    bindSvcCards('#popularGrid');
  }

  function renderBrowse() {
    var cats = window.MGR_CATEGORIES || [];
    $('#browseChips').innerHTML = cats.map(function (c) {
      return '<button class="cat-chip ' + (c === state.activeCat ? 'active' : '') + '" data-cat="' + esc(c) + '" type="button">' + esc(c) + '</button>';
    }).join('');
    $$('#browseChips .cat-chip').forEach(function (b) {
      b.addEventListener('click', function () { state.activeCat = b.dataset.cat; renderBrowse(); });
    });
    var q = ($('#browseSearch').value || '').trim().toLowerCase();
    var list = window.MGR_SERVICES || [];
    if (state.activeCat !== 'All') list = list.filter(function (s) { return s.cat === state.activeCat; });
    if (q) list = list.filter(function (s) { return s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q); });
    $('#browseGrid').innerHTML = list.length ? list.map(svcCardHTML).join('') :
      '<div class="empty"><h4>No services found</h4><p>Try a different search.</p></div>';
    bindSvcCards('#browseGrid');
  }

  async function confirmEntryCode(bookingId, assignmentId) {
    var c = getDB(); if (!c) return;
    var res = await c.from('assignments').update({ entry_confirmed: true, status: 'accepted' }).eq('id', assignmentId);
    if (res.error) return toast('Confirm failed: ' + res.error.message, 'error');
    await c.from('bookings').update({ status: 'in_progress' }).eq('id', bookingId);
    toast('Vendor confirmed! Work is now in progress.', 'success');
    renderBookings();
  }

  async function submitRating(bookingId, assignmentId) {
    modal({
      title: 'Rate your experience',
      body: '<div style="text-align:center;margin-bottom:12px;">' +
        '<div id="starRow" style="font-size:32px;cursor:pointer;letter-spacing:4px;">' +
        '<span data-star="1">☆</span><span data-star="2">☆</span><span data-star="3">☆</span><span data-star="4">☆</span><span data-star="5">☆</span>' +
        '</div></div>' +
        '<div class="field"><label>Review (optional)</label><textarea id="ratingText" rows="3" placeholder="Share your experience…" style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:10px;font-family:inherit;font-size:14px;"></textarea></div>',
      actions: [
        { label: 'Skip', kind: 'btn-outline' },
        {
          label: 'Submit rating', kind: 'btn-primary', keepOpen: true, onClick: async function (close) {
            var stars = document.querySelectorAll('#starRow span');
            var rating = 0;
            stars.forEach(function (s) { if (s.textContent === '★') rating = parseInt(s.dataset.star, 10); });
            if (!rating) return toast('Please select a star rating', 'error');
            var review = document.getElementById('ratingText').value.trim();
            var c2 = getDB(); if (!c2) { close(); return; }
            await c2.from('assignments').update({ rating: rating, review: review }).eq('id', assignmentId);
            toast('Thank you for your rating!', 'success');
            close();
            renderBookings();
          }
        }
      ]
    });
    // Wire star clicking after modal renders
    setTimeout(function () {
      var stars = document.querySelectorAll('#starRow span');
      stars.forEach(function (star) {
        star.addEventListener('click', function () {
          var val = parseInt(star.dataset.star, 10);
          stars.forEach(function (s) { s.textContent = parseInt(s.dataset.star, 10) <= val ? '★' : '☆'; });
        });
        star.addEventListener('mouseover', function () {
          var val = parseInt(star.dataset.star, 10);
          stars.forEach(function (s) { s.textContent = parseInt(s.dataset.star, 10) <= val ? '★' : '☆'; });
        });
      });
    }, 50);
  }

  async function renderBookings() {
    var list_el = $('#bookingsList');
    if (!state.user) {
      list_el.innerHTML = '<div class="empty"><h4>Please sign in</h4><p>Log in to see your bookings.</p></div>'; return;
    }
    list_el.innerHTML = '<div class="loader">Loading…</div>';
    var list = await loadBookings();
    if (!list.length) {
      list_el.innerHTML = '<div class="empty"><h4>No bookings yet</h4><p>Browse services and book your first one.</p></div>'; return;
    }
    list_el.innerHTML = list.map(function (b) {
      var dt = new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      var aStatus = b._assignmentStatus || '';
      var bStatus = b.status || 'pending';

      // --- Entry code block + Confirm Vendor button ---
      var codeBlock = '';
      if (aStatus === 'accepted' && b._entryCode && !b._entryConfirmed) {
        codeBlock = '<div class="vcode">' +
          '<small>🔒 Entry Verification Code</small>' +
          '<div class="vcode-val">' + esc(b._entryCode) + '</div>' +
          '<div class="vcode-hint">Ask the vendor for this code. Match it. Then tap confirm.</div>' +
          '<button class="btn btn-primary" style="width:100%;margin-top:10px;" data-confirm-entry="' + esc(b.id) + '" data-asn-id="' + esc(b._assignmentId) + '" type="button">✅ Confirm Vendor ✓</button>' +
          '</div>';
      } else if (b._entryConfirmed && bStatus !== 'completed') {
        codeBlock = '<div class="vcode vcode-ok"><small>✅ Vendor confirmed — work in progress</small></div>';
      } else if (bStatus === 'pending' || bStatus === 'confirmed' || bStatus === 'assigned' || aStatus === 'assigned' || aStatus === 'pending') {
        codeBlock = '<div class="vcode vcode-pending"><small>Verification code</small><span>Visible after the vendor accepts your booking</span></div>';
      }

      // --- Completion code block ---
      var completionBlock = '';
      if (b._entryConfirmed && b._completionCode && !b._completionConfirmed && bStatus !== 'completed') {
        completionBlock = '<div class="vcode vcode-complete">' +
          '<small>� Completion Code</small>' +
          '<div class="vcode-val">' + esc(b._completionCode) + '</div>' +
          '<div class="vcode-hint">Show this code to the vendor to finalize the job.</div>' +
          '</div>';
      }

      // --- Rating block ---
      var ratingBlock = '';
      if (bStatus === 'completed' && !b._rated) {
        ratingBlock = '<div class="vcode vcode-ok" style="background:#f0fdf4;border-color:#86efac;">' +
          '<small>✅ Service completed!</small>' +
          '<button class="btn btn-primary btn-sm" style="margin-top:8px;width:100%;" data-rate-booking="' + esc(b.id) + '" data-rate-asn="' + esc(b._assignmentId) + '" type="button">� Rate your experience</button>' +
          '</div>';
      } else if (bStatus === 'completed' && b._rated) {
        ratingBlock = '<div class="vcode vcode-ok" style="background:#f0fdf4;border-color:#86efac;"><small>✅ Service completed — Thank you for rating!</small></div>';
      }

      var canCancel = bStatus === 'pending' || bStatus === 'confirmed';
      return '<div class="booking-card">' +
        '<div class="row"><div><h4>' + esc(b.service_name) + '</h4><div class="cat">' + esc(b.service_category) + '</div></div>' +
        '<span class="badge ' + esc(bStatus) + '">' + esc(bStatus.replace('_', ' ')) + '</span></div>' +
        '<div class="meta"><span>Date: ' + esc(b.booking_date || '') + ' · ' + esc(b.booking_time || '') + '</span>' +
        '<span>Address: ' + esc(b.address || '') + '</span>' +
        '<span>' + priceLabel(b.service_price) + ' platform charge' + (b.payment_id ? ' - Paid' : '') + '</span>' +
        '<span style="color:var(--muted)">Booked ' + dt + '</span></div>' +
        codeBlock + completionBlock + ratingBlock +
        (canCancel ? '<div class="actions"><button class="btn btn-outline btn-sm" data-cancel="' + esc(b.id) + '" type="button">Cancel booking</button></div>' : '') +
        '</div>';
    }).join('');

    // Wire cancel buttons
    $$('[data-cancel]').forEach(function (b) {
      b.addEventListener('click', function () {
        modal({
          title: 'Cancel this booking?',
          body: '<p>Once cancelled, you need to re-book.</p>',
          actions: [
            { label: 'Keep booking', kind: 'btn-outline' },
            { label: 'Cancel booking', kind: 'btn-danger', onClick: function () { cancelBooking(b.dataset.cancel); } }
          ]
        });
      });
    });

    // Wire Confirm Vendor buttons
    $$('[data-confirm-entry]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modal({
          title: 'Confirm vendor entry?',
          body: '<p>Make sure the vendor has shown you the correct code before confirming.</p>',
          actions: [
            { label: 'Cancel', kind: 'btn-outline' },
            { label: 'Confirm ✓', kind: 'btn-primary', onClick: function () { confirmEntryCode(btn.dataset.confirmEntry, btn.dataset.asnId); } }
          ]
        });
      });
    });

    // Wire rate buttons
    $$('[data-rate-booking]').forEach(function (btn) {
      btn.addEventListener('click', function () { submitRating(btn.dataset.rateBooking, btn.dataset.rateAsn); });
    });
  }

  function syncProfileUI() {
    var u = state.user;
    var initial = u ? (u.name || u.email || 'M').trim().charAt(0).toUpperCase() : 'M';
    $('#profAvatar').textContent = initial;
    $('#profName').textContent = u ? (u.name && u.name.trim() ? u.name : 'Add your name') : 'Not signed in';
    $('#profEmail').textContent = u ? (u.email || '') : '';
    var ph = $('#profPhone'); if (ph) ph.textContent = u && u.phone ? '📱 ' + u.phone : '';
    $('#sbAvatar').textContent = initial;
    $('#sbName').textContent = u ? (u.name && u.name.trim() ? u.name : 'Add your name') : 'Guest';
    $('#sbEmail').textContent = u ? (u.email || '') : '';
  }

  /* ── Navigation ── */
  /* Top-level views (no back button): home, browse, bookings, profile, vendor-panel */
  var TOP_VIEWS = ['home', 'browse', 'bookings', 'profile', 'vendor-panel', 'vendor-reviews'];

  function syncBottomNav(name) {
    var TOP_NAV = ['home', 'browse', 'bookings', 'profile'];
    var PARENT = { detail: 'browse', book: 'browse', vendor: 'profile', success: 'bookings' };
    var active = TOP_NAV.includes(name) ? name : (PARENT[name] || '');
    $$('#bottomNav .bn-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.go === active); });
    var bn = $('#bottomNav');
    if (bn) bn.classList.toggle('hide', name === 'detail');
    var app = $('#app');
    if (app) app.classList.toggle('no-bottom-nav', name === 'detail');
  }

  function switchView(name, opts) {
    opts = opts || {};
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var target = document.querySelector('#view-' + name);
    if (target) target.classList.add('active');
    state.activeView = name;

    /* Back button: only for non-top views */
    if (TOP_VIEWS.includes(name)) {
      state.nav = [name];
      $('#backBtn').style.display = 'none';
    } else {
      if (!opts.replace) state.nav.push(name);
      $('#backBtn').style.display = '';
    }

    if (name === 'home') renderHome();
    if (name === 'browse') renderBrowse();
    if (name === 'bookings') renderBookings();
    if (name === 'profile') syncProfileUI();
    if (name === 'vendor-panel') { loadVendorJobs(); }
    if (name === 'vendor-reviews') { loadVendorReviewsPage(); }
    if (name === 'vendor') renderVendorApplyView();

    /* Always sync role pills when switching views */
    syncSidebarVendor();
    syncBottomNav(name);
    closeSidebar();
    window.scrollTo({ top: 0 });
  }

  function goBack() {
    if (state.nav.length > 1) state.nav.pop();
    switchView(state.nav[state.nav.length - 1] || 'home', { replace: true });
  }

  /* ── Service detail ── */
  function openServiceDetail(svc) {
    state.detailService = svc;
    $('#detImg').src = svc.img; $('#detImg').alt = svc.name;
    $('#detName').textContent = svc.name;
    $('#detCat').textContent = svc.cat;
    $('#detRating').textContent = '★ ' + svc.rating;
    $('#detDesc').textContent = svc.desc;
    if (isFree(svc)) {
    $('#detDisclaimer').innerHTML = '<b style="color:#16a34a;">🎉 FREE Booking!</b> No platform charge for this service. The vendor will visit, assess, and quote transparently before any work begins.';
  } else {
    $('#detDisclaimer').innerHTML = '<b>' + priceLabel(svcPrice(svc)) + '</b> is our platform charge. The vendor visits, assesses, and gives a transparent quote before any work begins.';
  }
    switchView('detail');
  }

  /* ── Booking form ── */
  function openBookingForm(svc) {
    state.bookService = svc;
    $('#bookSvcName').textContent = svc.name;
    $('#bookSvcCat').textContent = svc.cat + ' · ★ ' + svc.rating;
    if (isFree(svc)) {
      $('#bookDisclaimer').innerHTML = '<b style="color:#16a34a;">🎉 FREE Booking!</b> No platform charge for this service. Final price decided after the vendor visit.';
      var submit = $('#bookSubmit'); if (submit) { submit.textContent = 'Confirm FREE Booking'; submit.style.background = '#16a34a'; }
    } else {
      $('#bookDisclaimer').innerHTML = '<b>' + priceLabel(svcPrice(svc)) + '</b> is the platform charge. Final price decided after the vendor visit.';
      var submit = $('#bookSubmit'); if (submit) { submit.textContent = 'Confirm booking - ' + priceLabel(svcPrice(svc)); submit.style.background = ''; }
    }
    ['bookName', 'bookPhone', 'bookAddr', 'bookDate', 'bookNotes'].forEach(function (id) {
      var el = $('#' + id); if (el) el.value = '';
    });
    // Reset time picker to default 9:00 AM
    var bth = $('#bookTimeHour'); if (bth) bth.value = '09';
    var btm = $('#bookTimeMin'); if (btm) btm.value = '00';
    var btp = $('#bookTimeAmPm'); if (btp) btp.value = 'AM';
    if (window.syncTimePicker) window.syncTimePicker();
    switchView('book');
  }

  /* ── Razorpay payment flow ── */
  async function submitBooking() {
    if (!state.user) { showAuth(); setAuthMode('login'); return; }
    var name = $('#bookName').value.trim();
    var phone = $('#bookPhone').value.trim();
    var addr = $('#bookAddr').value.trim();
    var date = $('#bookDate').value;
    var time = $('#bookTime').value;
    var notes = $('#bookNotes').value.trim();
    var svc = state.bookService;

    if (!name) return toast('Please enter your name', 'error');
    if (!/^\+?\d[\d\s-]{7,}$/.test(phone)) return toast('Valid phone number required', 'error');
    if (!addr) return toast('Please enter your address', 'error');
    if (!date) return toast('Please pick a date', 'error');

    var c = getDB();
    var key = rzpKey();
    var code = genCode();
    var form = { name: name, phone: phone, address: addr, date: date, time: time, notes: notes };

    /* ── FREE service: skip payment entirely ── */
    if (isFree(svc)) {
      var btn0 = $('#bookSubmit');
      btn0.textContent = 'Booking…'; btn0.disabled = true;
      try { await saveBookingRow(svc, form, '', 'free', code); }
      catch (e) { btn0.textContent = 'Confirm FREE Booking'; btn0.disabled = false; return toast('Save failed: ' + e.message, 'error'); }
      btn0.textContent = 'Confirm FREE Booking'; btn0.disabled = false;
      showSuccess(svc.name); return;
    }

    if (!key) {
      try { await saveBookingRow(svc, form, '', 'unpaid', code); }
      catch (e) { return toast('Save failed: ' + e.message, 'error'); }
      showSuccess(svc.name); return;
    }

    var btn = $('#bookSubmit');
    btn.textContent = 'Processing…'; btn.disabled = true;

    var order = null;
    try {
      if (c) {
        var ef = await c.functions.invoke('create-razorpay-order', { body: { amount: svcPrice(svc), currency: 'INR', receipt: 'rcpt_' + Date.now(), notes: { service: svc.name, user_id: state.user.dbId } } });
        if (!ef.error && ef.data) order = ef.data;
      }
      if (!order) {
        var r = await fetch(apiBase() + '/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: svcPrice(svc), currency: 'INR', receipt: 'rcpt_' + Date.now(), notes: { service: svc.name, user_id: state.user.dbId } }) });
        if (r.ok) order = await r.json();
      }
    } catch (e) { console.warn('payment order error:', e); }

    btn.textContent = 'Confirm booking - ' + priceLabel(svcPrice(svc)); btn.disabled = false;

    if (!order || !order.id) {
      return toast('Payment unavailable. Check your internet or try again.', 'error');
    }

    new window.Razorpay({
      key: key, amount: order.amount, currency: order.currency || 'INR',
      name: 'MGR All In One Services', description: svc.name, order_id: order.id,
      prefill: { name: state.user.name || name, email: state.user.email || '', contact: state.user.phone || phone },
      theme: { color: '#e63946' },
      handler: async function (response) {
        var verified = false;
        try {
          if (c) {
            var ef2 = await c.functions.invoke('verify-razorpay-payment', { body: { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature } });
            if (!ef2.error && ef2.data && ef2.data.success) verified = true;
          }
          if (!verified) {
            var v2 = await fetch(apiBase() + '/api/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }) });
            if (v2.ok) verified = (await v2.json()).success === true;
          }
        } catch (e) { verified = false; }

        if (!verified) return toast('Payment verification failed. Contact support.', 'error');
        try { await saveBookingRow(svc, form, response.razorpay_payment_id, 'paid', code); }
        catch (e) { return toast('Booking save failed: ' + e.message, 'error'); }
        showSuccess(svc.name);
      },
      modal: { ondismiss: function () { toast('Payment cancelled.', 'error'); } }
    }).open();
  }

  function genCode() { var s = ''; for (var i = 0; i < 6; i++) s += Math.floor(Math.random() * 10); return s; }

  function showSuccess(svcName) {
    $('#successTitle').textContent = 'Booking placed!';
    $('#successMsg').textContent = 'Your ' + svcName + ' booking has been received. A vendor will review and accept it shortly — you\'ll see your verification code in "My bookings" once they accept.';
    $('#successCodeWrap').style.display = 'none';
    switchView('success', { replace: true });
    toast('Booking placed!', 'success');
  }

  /* ── Auth wiring ── */
  function setAuthMode(mode) {
    var isSignup = mode === 'signup';
    $('#tabLogin').classList.toggle('active', !isSignup);
    $('#tabSignup').classList.toggle('active', isSignup);
    $('#nameField').style.display = isSignup ? '' : 'none';
    $('#phoneField').style.display = isSignup ? '' : 'none';
    $('#authSubmit').textContent = isSignup ? 'Create account' : 'Log In';
    $('#authPass').setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    $('#authError').style.display = 'none';
  }

  var RESET_REDIRECT_URL = 'https://mgrallinoneservices.com/forgetpassword.html';

  function parseResetParams() {
    var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    var queryParams = new URLSearchParams(window.location.search || '');
    return {
      accessToken: hashParams.get('access_token') || queryParams.get('access_token'),
      refreshToken: hashParams.get('refresh_token') || queryParams.get('refresh_token'),
      code: queryParams.get('code') || hashParams.get('code'),
      tokenHash: queryParams.get('token_hash') || hashParams.get('token_hash'),
      type: queryParams.get('type') || hashParams.get('type'),
      error: queryParams.get('error') || hashParams.get('error'),
      errorCode: queryParams.get('error_code') || hashParams.get('error_code'),
      errorDescription: queryParams.get('error_description') || hashParams.get('error_description')
    };
  }

  function hasRecoveryParams() {
    var p = parseResetParams();
    return !!(p.accessToken || p.code || (p.tokenHash && p.type === 'recovery') || p.type === 'recovery' || p.error || p.errorCode);
  }

  function showResetPanel() {
    showAuth();
    $('#authForm').style.display = 'none';
    $('#forgotPanel').style.display = 'none';
    $('#resetPanel').style.display = '';
    var tabs = $('#authScreen').querySelector('.auth-tabs');
    if (tabs) tabs.style.display = 'none';
  }

  function showResetError(message) {
    showResetPanel();
    var msgEl = $('#resetMsg');
    msgEl.textContent = message || 'This reset link has expired or was already used. Please request a new one.';
    msgEl.style.color = '#e63946';
    msgEl.style.display = '';
    $('#resetSubmit').disabled = true;
  }

  async function establishRecoverySessionFromUrl(c) {
    var p = parseResetParams();
    if (p.error || p.errorCode) {
      return { ok: false, reason: p.errorDescription || 'This reset link has expired or is no longer valid.' };
    }
    if (p.accessToken && p.refreshToken) {
      var sessionRes = await c.auth.setSession({ access_token: p.accessToken, refresh_token: p.refreshToken });
      if (sessionRes.error) return { ok: false, reason: sessionRes.error.message || 'Invalid reset link.' };
    } else if (p.code) {
      var codeRes = await c.auth.exchangeCodeForSession(p.code);
      if (codeRes.error) return { ok: false, reason: codeRes.error.message || 'Invalid reset link.' };
    } else if (p.tokenHash && p.type === 'recovery') {
      var otpRes = await c.auth.verifyOtp({ type: 'recovery', token_hash: p.tokenHash });
      if (otpRes.error) return { ok: false, reason: otpRes.error.message || 'Invalid reset link.' };
    }

    var userRes = await c.auth.getUser();
    if (userRes.error || !userRes.data || !userRes.data.user) {
      return { ok: false, reason: (userRes.error && userRes.error.message) || 'Unable to verify this reset link.' };
    }
    return { ok: true, user: userRes.data.user };
  }

  function wireAuth() {
    $('#tabLogin').addEventListener('click', function () { setAuthMode('login'); });
    $('#tabSignup').addEventListener('click', function () { setAuthMode('signup'); });

    /* ── Forgot password ── */
    function showForgot() {
      $('#authForm').style.display = 'none';
      $('#forgotPanel').style.display = '';
      $('#forgotEmail').value = $('#authEmail').value || '';
      $('#forgotMsg').style.display = 'none';
    }
    function hideForgot() {
      $('#forgotPanel').style.display = 'none';
      $('#authForm').style.display = '';
    }
    $('#forgotBtn').addEventListener('click', showForgot);
    $('#forgotBack').addEventListener('click', hideForgot);
    $('#forgotSubmit').addEventListener('click', async function () {
      var c = getDB();
      var email = $('#forgotEmail').value.trim();
      var msgEl = $('#forgotMsg');
      msgEl.style.display = 'none';
      var showMsg = function (m, isErr) {
        msgEl.textContent = m;
        msgEl.style.color = isErr ? '#e63946' : '#22863a';
        msgEl.style.display = '';
      };
      if (!emailValid(email)) return showMsg('Please enter a valid email.', true);
      if (!c) return showMsg('Service not configured.', true);
      var btn = $('#forgotSubmit');
      btn.textContent = 'Sending…'; btn.disabled = true;
      try {
        /* Check if a user with this email exists in our users table */
        var check = await c.from('users').select('id').eq('email', email).maybeSingle();
        if (!check.data) {
          btn.textContent = 'Send reset link'; btn.disabled = false;
          return showMsg('No account found with this email.', true);
        }
        var res = await c.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT_URL });
        btn.textContent = 'Send reset link'; btn.disabled = false;
        if (res.error) return showMsg(res.error.message, true);
        showMsg('Reset link sent. Open it from Gmail to reset your password on the secure MGR website, then return here and log in.', false);
      } catch (e) {
        btn.textContent = 'Send reset link'; btn.disabled = false;
        showMsg('Something went wrong. Try again.', true);
      }
    });
    $('#authForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var mode = $('#tabSignup').classList.contains('active') ? 'signup' : 'login';
      var email = $('#authEmail').value.trim();
      var pass = $('#authPass').value;
      var errEl = $('#authError');
      errEl.style.display = 'none';
      var showErr = function (m) { errEl.textContent = m; errEl.style.display = ''; };
      if (!emailValid(email)) return showErr('Please enter a valid email.');
      if (pass.length < 6) return showErr('Password must be at least 6 characters.');

      var btn = $('#authSubmit');
      btn.textContent = 'Please wait…'; btn.disabled = true;

      var res;
      if (mode === 'signup') {
        var name = $('#authName').value.trim();
        var phone = $('#authPhone').value.trim();
        if (!name) { btn.textContent = 'Create account'; btn.disabled = false; return showErr('Please enter your name.'); }
        if (!/^\+?\d[\d\s-]{7,}$/.test(phone)) { btn.textContent = 'Create account'; btn.disabled = false; return showErr('Valid phone required.'); }
        res = await doRegister({ name: name, phone: phone, email: email, pass: pass });
      } else {
        res = await doLogin(email, pass);
      }

      btn.textContent = mode === 'signup' ? 'Create account' : 'Log In';
      btn.disabled = false;
      if (!res.ok) return showErr(res.error);
      $('#authPass').value = '';
      showApp(); switchView('home');
      toast(mode === 'signup' ? 'Welcome to MGR!' : 'Welcome back!', 'success');
    });

    /* ── Reset password submit ── */
    $('#resetSubmit').addEventListener('click', async function () {
      var c = getDB();
      var pass = $('#resetPass').value;
      var confirm = $('#resetPassConfirm').value;
      var msgEl = $('#resetMsg');
      msgEl.style.display = 'none';
      var showMsg = function (m, isErr) {
        msgEl.textContent = m;
        msgEl.style.color = isErr ? '#e63946' : '#22863a';
        msgEl.style.display = '';
      };
      if (pass.length < 6) return showMsg('Password must be at least 6 characters.', true);
      if (pass !== confirm) return showMsg('Passwords do not match.', true);
      if (!c) return showMsg('Service not configured.', true);
      var btn = $('#resetSubmit');
      btn.textContent = 'Updating…'; btn.disabled = true;
      try {
        var res = await c.auth.updateUser({ password: pass });
        btn.textContent = 'Update password'; btn.disabled = false;
        if (res.error) return showMsg(res.error.message, true);
        showMsg('Password updated. Redirecting to login...', false);
        setTimeout(function () {
          $('#resetPanel').style.display = 'none';
          var tabs = $('#authScreen').querySelector('.auth-tabs');
          if (tabs) tabs.style.display = '';
          $('#authForm').style.display = '';
          setAuthMode('login');
          $('#resetPass').value = '';
          $('#resetPassConfirm').value = '';
          /* Sign out so they log in fresh */
          c.auth.signOut();
        }, 2000);
      } catch (e) {
        btn.textContent = 'Update password'; btn.disabled = false;
        showMsg('Something went wrong. Try again.', true);
      }
    });

    $$('.password-eye').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-toggle-password'));
        if (!input) return;
        var hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ── Sidebar ── */
  function openSidebar() {
    $('#sbDrawer').classList.add('open');
    $('#sbOverlay').classList.add('open');
    $('#sbDrawer').setAttribute('aria-hidden', 'false');
    /* Always sync vendor section + role pills when opening sidebar */
    syncSidebarVendor();
  }
  function closeSidebar() {
    $('#sbDrawer').classList.remove('open');
    $('#sbOverlay').classList.remove('open');
    $('#sbDrawer').setAttribute('aria-hidden', 'true');
  }

  function wireSidebar() {
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sbClose').addEventListener('click', closeSidebar);
    $('#sbOverlay').addEventListener('click', closeSidebar);

    /* Navigate links inside sidebar */
    $('#sbDrawer').addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (t && $('#sbDrawer').contains(t)) { closeSidebar(); switchView(t.dataset.go); }
    });

    /* Sign out */
    $('#sbSignOut').addEventListener('click', async function () {
      var c = getDB(); if (c) await c.auth.signOut();
      state.user = null; state.vendorStatus = 'none';
      closeSidebar(); showAuth(); setAuthMode('login');
    });

    /* Role pills: Customer */
    $('#sbRoleCustomer').addEventListener('click', function () {
      switchView('home');
    });

    /* Role pills: Vendor */
    $('#sbRoleVendor').addEventListener('click', async function () {
      await refreshVendorState();
      var s = state.vendorStatus;
      if (s === 'approved') {
        switchView('vendor-panel');
      } else if (s === 'pending') {
        toast('Your vendor request is pending review. We\'ll notify you once approved.', 'info');
      } else {
        switchView('vendor');
      }
    });
  }

  function wireBottomNav() {
    var nav = $('#bottomNav');
    if (!nav) return;
    nav.addEventListener('click', function (e) {
      var tab = e.target.closest('.bn-tab');
      if (tab && nav.contains(tab) && tab.dataset.go) switchView(tab.dataset.go);
    });
  }

  function wireTopBar() {
    $('#backBtn').addEventListener('click', goBack);
    $('#topLogo').addEventListener('click', function (e) { e.preventDefault(); switchView('home'); });
    var seeAll = $('#seeAllSvc'); if (seeAll) seeAll.addEventListener('click', function (e) { e.preventDefault(); state.activeCat = 'All'; switchView('browse'); });
    $('#homeSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { state.activeCat = 'All'; switchView('browse'); $('#browseSearch').value = $('#homeSearch').value; renderBrowse(); }
    });
    $('#browseSearch').addEventListener('input', renderBrowse);
  }

  function wireDetail() {
    $('#detBook').addEventListener('click', function () {
      if (!state.user) { showAuth(); setAuthMode('login'); return; }
      openBookingForm(state.detailService);
    });
    $('#bookSubmit').addEventListener('click', submitBooking);
  }

  function wireSuccess() {
    $('#goBookings').addEventListener('click', function () { switchView('bookings', { replace: true }); });
    $('#goHome').addEventListener('click', function () { switchView('home', { replace: true }); });
  }

  function wireProfile() {
    $('#rowEditProfile').addEventListener('click', function () {
      var u = state.user || {};
      modal({
        title: 'Edit profile',
        body: '<div class="field"><label>Name</label><input id="m_name" type="text" value="' + esc(u.name || '') + '"/></div>' +
          '<div class="field"><label>Phone</label><input id="m_phone" type="tel" value="' + esc(u.phone || '') + '"/></div>',
        actions: [
          { label: 'Cancel', kind: 'btn-outline' },
          {
            label: 'Save', kind: 'btn-primary', keepOpen: true, onClick: async function (close) {
              var name = document.getElementById('m_name').value.trim();
              var phone = document.getElementById('m_phone').value.trim();
              var c = getDB();
              if (c && state.user && state.user.dbId)
                await c.from('users').update({ full_name: name, phone: phone }).eq('id', state.user.dbId);
              state.user = Object.assign({}, state.user, { name: name, phone: phone });
              syncProfileUI(); toast('Profile updated', 'success'); close();
            }
          }
        ]
      });
    });

    $('#rowAddress').addEventListener('click', function () {
      var cur = (state.user && state.user.address) || '';
      modal({
        title: 'Saved address',
        body: '<div class="field"><label>Default address</label><textarea id="m_addr" rows="3">' + esc(cur) + '</textarea></div>',
        actions: [
          { label: 'Cancel', kind: 'btn-outline' },
          {
            label: 'Save', kind: 'btn-primary', keepOpen: true, onClick: async function (close) {
              var v = document.getElementById('m_addr').value.trim();
              var c = getDB();
              if (c && state.user && state.user.dbId)
                await c.from('users').update({ address: v }).eq('id', state.user.dbId);
              if (state.user) state.user.address = v;
              toast('Address saved', 'success'); close();
            }
          }
        ]
      });
    });

    $('#rowVendor').addEventListener('click', function () { switchView('vendor'); });
    var rb2 = $('#rowBookings2'); if (rb2) rb2.addEventListener('click', function () { switchView('bookings'); });

    $('#rowSupport').addEventListener('click', function () {
      modal({
        title: 'Help & Support',
        body: '<p>For booking issues, vendor queries or refunds, contact MGR support.</p>' +
          '<p style="margin-top:10px;">Email: mgrallinoneservices@gmail.com<br/>Hours: 9 AM – 9 PM</p>',
        actions: [{ label: 'OK', kind: 'btn-primary' }]
      });
    });

    $('#rowAbout').addEventListener('click', function () {
      modal({
        title: 'About MGR All In One Services',
        body: '<p>MGR connects households across India with verified professionals for cleaning, repair, beauty, painting, pest control and more.</p>' +
          '<p style="margin-top:10px;font-size:13px;color:var(--muted)">App version 1.2.0</p>',
        actions: [{ label: 'Close', kind: 'btn-outline' }]
      });
    });

    $('#rowLogout').addEventListener('click', function () {
      modal({
        title: 'Sign out?',
        body: '<p>You will be taken back to the login screen.</p>',
        actions: [
          { label: 'Cancel', kind: 'btn-outline' },
          {
            label: 'Sign out', kind: 'btn-danger', onClick: async function () {
              var c = getDB(); if (c) await c.auth.signOut();
              state.user = null; showAuth(); setAuthMode('login');
            }
          }
        ]
      });
    });
  }

  function wireBookForm() {
    // Sync the hidden bookTime field from the AM/PM dropdowns
    function syncTimePicker() {
      var h = ($('#bookTimeHour') && $('#bookTimeHour').value) || '09';
      var m = ($('#bookTimeMin') && $('#bookTimeMin').value) || '00';
      var p = ($('#bookTimeAmPm') && $('#bookTimeAmPm').value) || 'AM';
      var hNum = parseInt(h, 10);
      var h24;
      if (p === 'AM') { h24 = (hNum === 12) ? 0 : hNum; }
      else { h24 = (hNum === 12) ? 12 : hNum + 12; }
      var h24s = (h24 < 10 ? '0' : '') + h24;
      var hidden = $('#bookTime'); if (hidden) hidden.value = h24s + ':' + m;
    }
    window.syncTimePicker = syncTimePicker;
    var hr = $('#bookTimeHour'), mn = $('#bookTimeMin'), ap = $('#bookTimeAmPm');
    if (hr) hr.addEventListener('change', syncTimePicker);
    if (mn) mn.addEventListener('change', syncTimePicker);
    if (ap) ap.addEventListener('change', syncTimePicker);
    syncTimePicker(); // init

    var btn = $('#bookUseProfile'); if (!btn) return;
    btn.addEventListener('click', function () {
      if (!state.user) return toast('Sign in to use your saved details.', 'info');
      $('#bookName').value = state.user.name || '';
      $('#bookPhone').value = state.user.phone || '';
      $('#bookAddr').value = state.user.address || '';
      toast('Filled from your profile.', 'success');
    });
  }

  /* ── Vendor apply form ── */
  function renderVendorApplyView() {
    var notice = $('#vendorPendingNotice');
    var form = $('#vendorForm');
    if (!notice || !form) return;
    if (state.vendorStatus === 'pending') {
      notice.style.display = 'flex';
      form.style.display = 'none';
    } else if (state.vendorStatus === 'approved') {
      switchView('vendor-panel', { replace: true }); return;
    } else {
      notice.style.display = 'none';
      form.style.display = '';
    }
    /* Build skills grid with ALL services as toggleable chips */
    var grid = $('#skillsGrid');
    if (grid && !grid.dataset.built) {
      grid.dataset.built = '1';
      var allSkills = (window.MGR_SERVICES || []).map(function (s) { return s.name; });
      grid.innerHTML = allSkills.map(function (sk) {
        return '<button type="button" class="skill-chip" data-skill="' + esc(sk) + '">' + esc(sk) + '</button>';
      }).join('');
      grid.addEventListener('click', function (e) {
        var chip = e.target.closest('.skill-chip');
        if (chip) chip.classList.toggle('selected');
      });
    }
  }

  function wireVendor() {
    $('#vSubmit').addEventListener('click', async function () {
      var v = {
        full_name: $('#vName').value.trim(),
        phone: $('#vPhone').value.trim(),
        email: $('#vEmail').value.trim(),
        address: $('#vAddr').value.trim(),
        years: parseInt($('#vExp').value, 10) || 0,
        about: $('#vAbout').value.trim()
      };
      /* Read multi-selected skills from chips */
      var selectedChips = $$('#skillsGrid .skill-chip.selected');
      var skills = selectedChips.map(function (c) { return c.dataset.skill; });

      if (!v.full_name || !v.phone || !v.email || !v.address) return toast('Please fill all required fields', 'error');
      if (!emailValid(v.email)) return toast('Valid email required', 'error');
      if (!skills.length) return toast('Please select at least one skill', 'error');

      var c = getDB();
      if (c && state.user) {
        var res = await c.from('vendor_requests').insert({
          user_id: state.user.dbId,
          full_name: v.full_name, email: v.email, phone: v.phone, address: v.address,
          skills: skills, years_experience: v.years, experience: v.about, status: 'pending'
        });
        if (res.error) return toast('Submit failed: ' + res.error.message, 'error');
      }
      state.vendorStatus = 'pending';
      syncSidebarVendor();
      $('#successTitle').textContent = 'Application received!';
      $('#successMsg').textContent = 'Thanks ' + v.full_name.split(' ')[0] + '. We\'ll review and reach out within 2–3 business days.';
      $('#successCodeWrap').style.display = 'none';
      ['vName', 'vPhone', 'vEmail', 'vAddr', 'vExp', 'vAbout'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      $$('#skillsGrid .skill-chip').forEach(function (c) { c.classList.remove('selected'); });
      switchView('success', { replace: true });
    });
  }

  /* ── Vendor Panel (My Jobs) ── */
  var vendorRow = null;
  var allVendorJobs = [];
  var vpFilter = 'all';

  async function getVendorRow() {
    if (vendorRow) return vendorRow;
    var c = getDB(); if (!c || !state.user) return null;
    var r = await c.from('vendors').select('*').eq('user_id', state.user.dbId).maybeSingle();
    if (r.data) { vendorRow = r.data; return vendorRow; }
    if (state.user.email) {
      r = await c.from('vendors').select('*').eq('email', state.user.email).maybeSingle();
      if (r.data) {
        try { await c.from('vendors').update({ user_id: state.user.dbId }).eq('id', r.data.id); } catch (e) { }
        vendorRow = r.data; return vendorRow;
      }
    }
    return null;
  }

  async function loadVendorJobs() {
    var list = $('#vpList'); if (!list) return;
    var revEl = $('#vpReviews'); if (revEl) revEl.style.display = 'none';
    list.style.display = '';
    list.innerHTML = '<div class="vp-empty">Loading your jobs…</div>';
    var c = getDB();
    if (!c) { list.innerHTML = '<div class="vp-empty">Backend not configured.</div>'; return; }
    var v = await getVendorRow();
    if (!v) {
      list.innerHTML = '<div class="vp-empty"><b>Vendor profile not linked yet.</b><br/><br/>Your application may still be under review. Try signing out and back in, or contact admin.</div>'; return;
    }
    try {
      var res = await c.from('assignments')
        .select('*, bookings(*, users(full_name, phone))')
        .eq('vendor_id', v.id)
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      allVendorJobs = res.data || [];
      renderVendorJobs();
    } catch (e) {
      list.innerHTML = '<div class="vp-empty" style="color:#b91c1c;">Failed to load jobs: ' + esc(e.message || 'Unknown') +
        '<br/><br/><button class="btn btn-outline btn-sm" id="vpRetry">Retry</button></div>';
      var retry = $('#vpRetry'); if (retry) retry.addEventListener('click', loadVendorJobs);
    }
  }

  function renderVendorJobs() {
    var el = $('#vpList'); if (!el) return;
    var jobs = (allVendorJobs || []).filter(function (j) { return j.status !== 'cancelled' && j.status !== 'rejected'; });
    if (vpFilter === 'pending') jobs = jobs.filter(function (j) { return j.status === 'pending' || j.status === 'assigned'; });
    else if (vpFilter === 'accepted') jobs = jobs.filter(function (j) { return j.status === 'accepted'; });
    else if (vpFilter === 'completed') jobs = jobs.filter(function (j) { return j.status === 'completed'; });

    if (!jobs.length) { el.innerHTML = '<div class="vp-empty">No ' + (vpFilter === 'all' ? '' : vpFilter + ' ') + 'jobs found.</div>'; return; }

    var colorMap = { pending: 'vp-b-yel', assigned: 'vp-b-yel', accepted: 'vp-b-blu', completed: 'vp-b-grn', rejected: 'vp-b-red', cancelled: 'vp-b-red' };
    var labelMap = { pending: 'Pending', assigned: 'Assigned', accepted: 'Accepted', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' };

    el.innerHTML = jobs.map(function (j) {
      var b = j.bookings || {};
      var sk = j.status || 'pending';
      var cust = (b.users && b.users.full_name) ? b.users.full_name : '';
      var phone = (b.users && b.users.phone) ? b.users.phone : '';

      var codeBlock = '';
      if (sk === 'accepted' && j.entry_code && !j.entry_confirmed) {
        codeBlock = '<div class="vp-code"><div class="vp-code-lbl">YOUR VERIFICATION CODE</div><div class="vp-code-val">' + esc(j.entry_code) + '</div><div class="vp-code-help">Tell the customer this code. They confirm it on their dashboard.</div></div>';
      } else if (j.entry_confirmed && sk !== 'completed') {
        codeBlock = '<div class="vp-info-ok">Customer confirmed your verification code.</div>';
      }

      var waitBlock = '';
      if (sk === 'accepted' && j.completion_code && !j.completion_confirmed) {
        waitBlock = '<div class="vp-info-warn">Work marked done. Ask the customer for the completion code to finalize.</div>';
      }

      var actions = '';
      if (sk === 'pending' || sk === 'assigned') {
        actions = '<button class="btn btn-primary btn-sm" data-vpa="accept" data-id="' + j.id + '">Accept Job</button>' +
          '<button class="btn btn-outline btn-sm" data-vpa="reject" data-id="' + j.id + '">Reject</button>';
      } else if (sk === 'accepted') {
        if (!j.completion_code) {
          actions = '<button class="btn btn-primary btn-sm" data-vpa="done" data-id="' + j.id + '">Mark Work Done</button>';
        } else if (!j.completion_confirmed) {
          actions = '<button class="btn btn-primary btn-sm" data-vpa="enter-code" data-id="' + j.id + '">Enter Customer Code</button>';
        }
      }

      return '<div class="vp-card">' +
        '<div class="vp-card-head"><div style="min-width:0;flex:1;"><div class="vp-svc">' + esc(b.service_name || 'Service') + '</div><div class="vp-cat">' + esc(b.service_category || '') + '</div></div>' +
        '<span class="vp-badge ' + (colorMap[sk] || 'vp-b-gry') + '">' + (labelMap[sk] || sk) + '</span></div>' +
        (cust ? '<div class="vp-cust">Customer: ' + esc(cust) + (phone ? '<small>· ' + esc(phone) + '</small>' : '') + '</div>' : '') +
        '<div class="vp-meta"><span>' + esc(b.booking_date || 'N/A') + '</span><span>' + esc(b.booking_time || 'N/A') + '</span><span>' + esc(b.address || 'No address') + '</span><span class="vp-price">₹' + (b.service_price != null ? b.service_price : 99) + '</span></div>' +
        codeBlock + waitBlock +
        (actions ? '<div class="vp-actions">' + actions + '</div>' : '') +
        '</div>';
    }).join('');
  }

  async function vpAccept(id) {
    var c = getDB(); if (!c) return;
    var asn = await c.from('assignments').select('entry_code').eq('id', id).maybeSingle();
    if (!asn.data || !asn.data.entry_code) return toast('Missing verification code. Ask admin to reassign.', 'error');
    var res = await c.from('assignments').update({ status: 'accepted' }).eq('id', id);
    if (res.error) return toast('Accept failed: ' + res.error.message, 'error');
    toast('Job accepted! Verification code is ready.', 'success'); loadVendorJobs();
  }

  async function vpReject(id) {
    modal({
      title: 'Reject this job?',
      body: '<div class="field">' +
        '<label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);">Reason for rejection</label>' +
        '<textarea id="vpRejectReason" rows="3" placeholder="e.g. Not available on this date…" ' +
        'style="width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:12px;font-size:14px;font-family:inherit;margin-top:6px;outline:none;resize:none;"></textarea>' +
        '</div>',
      actions: [
        { label: 'Cancel', kind: 'btn-outline' },
        {
          label: 'Reject job', kind: 'btn-danger', keepOpen: true, onClick: async function (close) {
            var reason = (document.getElementById('vpRejectReason').value || '').trim();
            if (!reason) {
              document.getElementById('vpRejectReason').style.borderColor = '#e63946';
              return toast('Please enter a reason', 'error');
            }
            var c = getDB(); if (!c) { close(); return; }
            var asn = await c.from('assignments').select('booking_id').eq('id', id).maybeSingle();
            var res = await c.from('assignments').update({ status: 'rejected', rejection_reason: reason }).eq('id', id);
            if (res.error) { close(); return toast('Reject failed: ' + res.error.message, 'error'); }
            if (asn.data && asn.data.booking_id) {
              await c.from('bookings').update({ status: 'pending' }).eq('id', asn.data.booking_id);
            }
            close();
            toast('Job rejected.', 'info');
            loadVendorJobs();
          }
        }
      ]
    });
    setTimeout(function () { var el = document.getElementById('vpRejectReason'); if (el) el.focus(); }, 50);
  }

  async function vpMarkDone(id) {
    var code = Math.random().toString(36).toUpperCase().slice(2, 8);
    var c = getDB(); if (!c) return;
    var res = await c.from('assignments').update({ completion_code: code }).eq('id', id);
    if (res.error) return toast('Failed: ' + res.error.message, 'error');
    toast('Marked done. Ask the customer for the completion code.', 'success'); loadVendorJobs();
  }

  async function vpEnterCode(id) {
    modal({
      title: 'Enter Completion Code',
      body: '<p style="font-size:14px;color:var(--muted);margin-bottom:14px;">Ask the customer to open their Bookings tab and read you the completion code.</p>' +
        '<div class="field">' +
        '<label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);">Completion Code</label>' +
        '<input id="vpCodeInput" type="text" placeholder="e.g. AB3X9Y" autocomplete="off" ' +
        'style="width:100%;padding:14px 16px;border:2px solid var(--border);border-radius:12px;font-size:22px;font-weight:800;letter-spacing:.18em;text-align:center;text-transform:uppercase;font-family:monospace,sans-serif;margin-top:6px;outline:none;" />' +
        '</div>',
      actions: [
        { label: 'Cancel', kind: 'btn-outline' },
        {
          label: 'Verify & Complete', kind: 'btn-primary', keepOpen: true, onClick: async function (close) {
            var code = (document.getElementById('vpCodeInput').value || '').trim();
            if (!code) return toast('Please enter the code', 'error');
            var c = getDB(); if (!c) { close(); return; }
            var asn = await c.from('assignments').select('completion_code, booking_id').eq('id', id).maybeSingle();
            if (!asn.data || !asn.data.completion_code) {
              return toast('No completion code set yet. Ask the customer to refresh their app.', 'error');
            }
            if (code.toUpperCase() !== asn.data.completion_code.toUpperCase()) {
              document.getElementById('vpCodeInput').style.borderColor = '#e63946';
              return toast('Wrong code — ask the customer to read it again.', 'error');
            }
            await c.from('assignments').update({ status: 'completed', completion_confirmed: true }).eq('id', id);
            if (asn.data.booking_id) await c.from('bookings').update({ status: 'completed' }).eq('id', asn.data.booking_id);
            close();
            toast('Job completed! Great work. 🎉', 'success');
            loadVendorJobs();
          }
        }
      ]
    });
    setTimeout(function () {
      var inp = document.getElementById('vpCodeInput');
      if (inp) {
        inp.focus();
        inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase(); inp.style.borderColor = ''; });
      }
    }, 50);
  }

  async function loadVendorReviews() {
    var el = $('#vpReviews'); if (!el) return;
    el.innerHTML = '<div class="vp-empty">Loading reviews…</div>';
    var c = getDB(); if (!c) { el.innerHTML = '<div class="vp-empty">Backend not configured.</div>'; return; }
    var v = await getVendorRow();
    if (!v) { el.innerHTML = '<div class="vp-empty">Vendor profile not found.</div>'; return; }

    try {
      var res = await c.from('assignments')
        .select('rating, review, bookings(service_name, booking_date)')
        .eq('vendor_id', v.id)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      var rows = (res.data || []).filter(function (r) { return r.rating; });

      if (!rows.length) {
        el.innerHTML = '<div class="vp-empty"><div style="font-size:32px;margin-bottom:10px;">�</div><h4 style="color:var(--ink);margin-bottom:6px;">No reviews yet</h4><p>Completed jobs will show customer ratings here.</p></div>';
        return;
      }

      // Calculate stats
      var total = rows.length;
      var sum = rows.reduce(function (s, r) { return s + (r.rating || 0); }, 0);
      var avg = (sum / total).toFixed(1);
      var dist = [0, 0, 0, 0, 0]; // index 0=1★ … 4=5★
      rows.forEach(function (r) { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
      var maxDist = Math.max.apply(null, dist) || 1;

      var starsHtml = function (n) {
        var s = '';
        for (var i = 1; i <= 5; i++) s += '<span style="color:' + (i <= n ? '#f59e0b' : '#e2e8f0') + ';font-size:16px;">★</span>';
        return s;
      };

      var distRows = '';
      for (var star = 5; star >= 1; star--) {
        var count = dist[star - 1];
        var pct = Math.round((count / maxDist) * 100);
        distRows += '<div class="vpr-dist-row">' +
          '<span class="vpr-dist-label">' + star + '★</span>' +
          '<div class="vpr-dist-bar-wrap"><div class="vpr-dist-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="vpr-dist-count">' + count + '</span>' +
          '</div>';
      }

      var reviewCards = rows.map(function (r) {
        var b = r.bookings || {};
        var svc = b.service_name || '';
        var date = b.booking_date || '';
        return '<div class="vpr-card">' +
          '<div class="vpr-card-top">' +
          starsHtml(r.rating) +
          '<span class="vpr-rating-num">' + r.rating + '/5</span>' +
          '</div>' +
          (r.review ? '<div class="vpr-review-text">"' + esc(r.review) + '"</div>' : '') +
          '<div class="vpr-meta">' + (svc ? esc(svc) : '') + (date ? ' · ' + esc(date) : '') + '</div>' +
          '</div>';
      }).join('');

      el.innerHTML =
        '<div class="vpr-summary">' +
        '<div class="vpr-avg">' +
        '<div class="vpr-avg-num">' + avg + '</div>' +
        '<div>' + starsHtml(Math.round(avg)) + '</div>' +
        '<div class="vpr-avg-sub">' + total + ' rating' + (total !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="vpr-dist">' + distRows + '</div>' +
        '</div>' +
        '<div class="vpr-section-label">Customer Reviews</div>' +
        reviewCards;
    } catch (e) {
      el.innerHTML = '<div class="vp-empty" style="color:#b91c1c;">Failed to load reviews: ' + esc(e.message) + '</div>';
    }
  }

  async function loadVendorReviewsPage() {
    var el = $('#vrContent'); if (!el) return;
    el.innerHTML = '<div class="vp-empty">Loading reviews…</div>';
    var c = getDB(); if (!c) { el.innerHTML = '<div class="vp-empty">Backend not configured.</div>'; return; }
    var v = await getVendorRow();
    if (!v) { el.innerHTML = '<div class="vp-empty">Vendor profile not found.</div>'; return; }

    try {
      var res = await c.from('assignments')
        .select('rating, review, bookings(service_name, booking_date)')
        .eq('vendor_id', v.id)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false });
      if (res.error) throw res.error;
      var rows = (res.data || []).filter(function (r) { return r.rating; });

      if (!rows.length) {
        el.innerHTML = '<div class="vp-empty"><div style="font-size:40px;margin-bottom:12px;">�</div><h4 style="color:var(--ink);margin-bottom:6px;">No reviews yet</h4><p>Completed jobs will show customer ratings here.</p></div>';
        return;
      }

      var total = rows.length;
      var sum = rows.reduce(function (s, r) { return s + (r.rating || 0); }, 0);
      var avg = (sum / total).toFixed(1);
      var dist = [0, 0, 0, 0, 0];
      rows.forEach(function (r) { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
      var maxDist = Math.max.apply(null, dist) || 1;

      function starsHtml(n) {
        var s = ''; for (var i = 1; i <= 5; i++) s += '<span style="color:' + (i <= n ? '#f59e0b' : '#e2e8f0') + ';font-size:18px;">★</span>'; return s;
      }

      var distRows = '';
      for (var star = 5; star >= 1; star--) {
        var cnt = dist[star - 1], pct = Math.round((cnt / maxDist) * 100);
        distRows += '<div class="vpr-dist-row">' +
          '<span class="vpr-dist-label">' + star + '★</span>' +
          '<div class="vpr-dist-bar-wrap"><div class="vpr-dist-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="vpr-dist-count">' + cnt + '</span></div>';
      }

      var cards = rows.map(function (r) {
        var b = r.bookings || {};
        return '<div class="vpr-card">' +
          '<div class="vpr-card-top">' + starsHtml(r.rating) + '<span class="vpr-rating-num">' + r.rating + '/5</span></div>' +
          (r.review ? '<div class="vpr-review-text">"' + esc(r.review) + '"</div>' : '') +
          '<div class="vpr-meta">' + (b.service_name ? esc(b.service_name) : '') +
          (b.booking_date ? ' · ' + esc(b.booking_date) : '') +
          '</div></div>';
      }).join('');

      el.innerHTML =
        '<div class="vpr-summary">' +
        '<div class="vpr-avg">' +
        '<div class="vpr-avg-num">' + avg + '</div>' +
        '<div>' + starsHtml(Math.round(parseFloat(avg))) + '</div>' +
        '<div class="vpr-avg-sub">' + total + ' rating' + (total !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="vpr-dist">' + distRows + '</div>' +
        '</div>' +
        '<div class="vpr-section-label">Customer Reviews</div>' +
        cards;
    } catch (e) {
      el.innerHTML = '<div class="vp-empty" style="color:#b91c1c;">Failed: ' + esc(e.message) + '</div>';
    }
  }

  function wireVendorPanel() {
    var refresh = $('#vpRefresh'); if (refresh) refresh.addEventListener('click', function () {
      if (vpFilter === 'reviews') loadVendorReviews(); else loadVendorJobs();
    });
    var vrRefresh = $('#vrRefresh'); if (vrRefresh) vrRefresh.addEventListener('click', loadVendorReviewsPage);
    $$('.vp-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        vpFilter = b.dataset.vp;
        $$('.vp-tab').forEach(function (t) { t.classList.toggle('active', t === b); });
        var listEl = $('#vpList');
        var revEl = $('#vpReviews');
        if (vpFilter === 'reviews') {
          if (listEl) listEl.style.display = 'none';
          if (revEl) revEl.style.display = '';
          loadVendorReviews();
        } else {
          if (listEl) listEl.style.display = '';
          if (revEl) revEl.style.display = 'none';
          renderVendorJobs();
        }
      });
    });
    var list = $('#vpList'); if (!list) return;
    list.addEventListener('click', function (e) {
      var t = e.target.closest('[data-vpa]'); if (!t) return;
      var id = t.dataset.id, action = t.dataset.vpa;
      if (action === 'accept') vpAccept(id);
      else if (action === 'reject') vpReject(id);
      else if (action === 'done') vpMarkDone(id);
      else if (action === 'enter-code') vpEnterCode(id);
    });
  }

  /* ── Realtime Listeners ── */
  var _rtChannels = [];

  function startRealtimeListeners() {
    var c = getDB(); if (!c) return;
    // Clean up existing channels
    _rtChannels.forEach(function (ch) { try { c.removeChannel(ch); } catch (e) { } });
    _rtChannels = [];

    // Watch vendor_requests — fires when admin approves/rejects
    var chVR = c.channel('app-rt-vendor-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_requests' }, function (payload) {
        if (!state.user) return;
        var row = payload.new || payload.old || {};
        if (row.user_id && String(row.user_id) === String(state.user.dbId)) {
          refreshVendorState();
        }
      })
      .subscribe();
    _rtChannels.push(chVR);

    // Watch vendors table — fires when admin creates a vendor record
    var chV = c.channel('app-rt-vendors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, function (payload) {
        if (!state.user) return;
        var row = payload.new || {};
        if (row.user_id && String(row.user_id) === String(state.user.dbId)) {
          vendorRow = null; // reset cached vendor row
          refreshVendorState();
        }
      })
      .subscribe();
    _rtChannels.push(chV);

    // Watch users table — fires when admin bans/unbans a user or changes role
    var chU = c.channel('app-rt-users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, async function (payload) {
        if (!state.user) return;
        var row = payload.new || {};
        if (String(row.id) !== String(state.user.dbId)) return;
        // Update role
        if (row.role && row.role !== state.user.role) {
          state.user.role = row.role;
          refreshVendorState();
        }
        // Handle ban: sign out the user if banned
        if (row.is_banned) {
          toast('Your account has been suspended. Please contact support.', 'error');
          setTimeout(async function () {
            var c2 = getDB(); if (c2) await c2.auth.signOut();
            state.user = null; state.vendorStatus = 'none';
            syncProfileUI(); syncSidebarVendor(); showAuth(); setAuthMode('login');
          }, 2000);
        }
      })
      .subscribe();
    _rtChannels.push(chU);

    // Watch bookings — fires when vendor accepts/updates a booking
    var chB = c.channel('app-rt-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, function (payload) {
        if (!state.user) return;
        var row = payload.new || {};
        var userIds = uniqueBy([state.user.dbId, state.user.authId], function (v) { return v ? String(v) : ''; });
        if (userIds.indexOf(String(row.user_id)) === -1) return;
        if (state.activeView === 'bookings') renderBookings();
        else toast('Your booking status has been updated!', 'info');
      })
      .subscribe();
    _rtChannels.push(chB);

    // Watch assignments — fires when entry_code set, entry_confirmed, completion_code set, completed
    var chA = c.channel('app-rt-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, function () {
        if (!state.user) return;
        if (state.activeView === 'bookings') renderBookings();
      })
      .subscribe();
    _rtChannels.push(chA);
  }

  /* ── Boot ── */
  async function boot() {
    var c = getDB();
    rebuildServiceMeta();
    await loadServiceCatalog();
    setInterval(function () { loadServiceCatalog().then(refreshCatalogViews); }, 5 * 60 * 1000);
    window.addEventListener('focus', function () { loadServiceCatalog().then(refreshCatalogViews); });

    var isRecoveryLink = hasRecoveryParams();

    if (isRecoveryLink) {
      wireAuth(); wireTopBar(); wireSidebar(); wireBottomNav(); wireDetail(); wireSuccess(); wireProfile(); wireVendor(); wireBookForm(); wireVendorPanel();
      if (!c) {
        showResetError('Service not configured. Please check the app Supabase settings.');
      } else {
        try {
          var recovery = await establishRecoverySessionFromUrl(c);
          if (recovery.ok) {
            showResetPanel();
            $('#resetSubmit').disabled = false;
            var msgEl0 = $('#resetMsg');
            if (msgEl0) msgEl0.style.display = 'none';
          } else {
            showResetError(recovery.reason);
          }
        } catch (e) {
          showResetError('This reset link has expired or was already used. Please request a new one.');
        }
      }
      if (history.replaceState) history.replaceState(null, '', window.location.pathname);
      startRealtimeListeners();
      hideSplash();
      return;
    }

    if (c) {
      var sess = await c.auth.getSession();
      if (sess.data && sess.data.session && sess.data.session.user) {
        var row = await ensureUserRow(sess.data.session.user);
        setUserFromRow(sess.data.session.user, row);
      }

      /* Listen for auth state changes */
      c.auth.onAuthStateChange(async function (event, session) {
        if (event === 'PASSWORD_RECOVERY') {
          showResetPanel();
          $('#resetSubmit').disabled = false;
          if (history.replaceState) history.replaceState(null, '', window.location.pathname);
        } else if (event === 'SIGNED_IN' && session && session.user) {
          if ($('#resetPanel') && $('#resetPanel').style.display !== 'none') return;
          var row2 = await ensureUserRow(session.user);
          setUserFromRow(session.user, row2);
        } else if (event === 'SIGNED_OUT') {
          state.user = null; state.vendorStatus = 'none';
          syncProfileUI(); syncSidebarVendor();
        }
      });

      /* ── Realtime: watch vendor_requests + vendors + users for live updates ── */
      startRealtimeListeners();
    } else {
      console.warn('MGR: Supabase not configured — check window.__MGR_CFG__');
    }

    wireAuth(); wireTopBar(); wireSidebar(); wireBottomNav(); wireDetail(); wireSuccess(); wireProfile(); wireVendor(); wireBookForm(); wireVendorPanel();

    if (state.user) { showApp(); switchView('home'); }
    else { showAuth(); setAuthMode('login'); }
    hideSplash();

    document.addEventListener('backbutton', function (e) {
      if (state.nav.length > 1) { e.preventDefault && e.preventDefault(); goBack(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
