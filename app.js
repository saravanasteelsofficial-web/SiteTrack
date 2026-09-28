import { CLOUD_ENABLED, FIREBASE_CONFIG } from './config.js';

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const KEY = 'sitetrack_customers_v1';

let customers = [];
let filter = 'all';
let query = '';
let editing = null;

const app = document.querySelector('#app');

let db = null;
let customersRef = null;

if (CLOUD_ENABLED) {
  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(firebaseApp);
  customersRef = collection(db, 'customers');

  onSnapshot(
    customersRef,
    snapshot => {
      customers = snapshot.docs.map(d => {
        const x = d.data();

        return {
          id: d.id,
          name: x.name || '',
          phone: x.phone || x.whatsapp || '',
          site: x.site || '',
          status: String(x.status || 'active').toLowerCase(),
          address: x.address || '',
          stage: x.stage || x.siteLevel || '',
          followup: x.followup || x.followUpDate || '',
          steel: x.steel || x.brand || '',
          cement: x.cement || '',
          paint: x.paint || '',
          requirement: x.requirement || '',
          notes: x.notes || '',
          updatedAt: x.updatedAt || ''
        };
      });

      render();
    },
    error => {
      console.error('Firestore error:', error);
      alert('Cloud database connection error. Please check Firebase settings.');
    }
  );
} else {
  customers = JSON.parse(localStorage.getItem(KEY) || '[]');
}

const saveLocal = () => {
  localStorage.setItem(KEY, JSON.stringify(customers));
};

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

function render() {
  const active = customers.filter(
    x => String(x.status).toLowerCase() === 'active'
  ).length;

  const inactive = customers.length - active;

  const today = new Date().toISOString().slice(0, 10);

  const due = customers.filter(
    x => x.followup === today
  ).length;

  let rows = customers
    .filter(x => {
      const status = String(x.status || '').toLowerCase();

      return (
        filter === 'all' ||
        status === filter ||
        (filter === 'today' && x.followup === today) ||
        (filter === 'overdue' &&
          x.followup &&
          x.followup < today)
      );
    })
    .filter(x => {
      const q = query.toLowerCase();

      return (
        !q ||
        [
          x.name,
          x.phone,
          x.address,
          x.site,
          x.steel,
          x.cement,
          x.paint,
          x.stage,
          x.requirement
        ].some(v =>
          String(v || '').toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

  app.innerHTML = `
    <header class="top">
      <div class="bar">
        <div class="brand">
          <img src="icon-192.png">
          <div>
            SiteTrack
            <small>Saravana Steel Company</small>
          </div>
        </div>

        <button class="btn" style="margin-left:auto"
          onclick="openForm()">＋ Customer</button>
      </div>

      <div class="search">
        <input id="q"
          value="${esc(query)}"
          placeholder="Search customer, phone, site, area, brand…">

        <button onclick="doSearch()">Search</button>
      </div>
    </header>

    <main class="wrap">

      <div class="filters">
        ${
          [
            ['all', 'All'],
            ['active', 'Active'],
            ['inactive', 'Inactive'],
            ['today', 'Today Follow-up'],
            ['overdue', 'Overdue']
          ]
            .map(
              ([k, l]) =>
                `<button class="chip ${
                  filter === k ? 'active' : ''
                }"
                onclick="setFilter('${k}')">${l}</button>`
            )
            .join('')
        }
      </div>

      <div class="stats">

        <div class="stat">
          <b>${customers.length}</b>
          <span>Total customers</span>
        </div>

        <div class="stat">
          <b>${active}</b>
          <span>Active</span>
        </div>

        <div class="stat">
          <b>${due}</b>
          <span>Today's follow-up</span>
        </div>

      </div>

      <section class="list">
        ${
          rows.length
            ? rows.map(card).join('')
            : `
              <div class="card empty">
                No customers found.
                <br><br>
                <button class="btn primary"
                  onclick="openForm()">
                  Add first customer
                </button>
              </div>
            `
        }
      </section>

    </main>

    <nav class="bottom">

      <button class="nav on"
        onclick="setFilter('all')">
        <strong>⌂</strong>Home
      </button>

      <button class="nav"
        onclick="openForm()">
        <strong>＋</strong>Add
      </button>

      <button class="nav"
        onclick="openBulk()">
        <strong>✉</strong>SMS
      </button>

      <button class="nav"
        onclick="showInfo()">
        <strong>☁</strong>Sync
      </button>

    </nav>
  `;
}

function card(x) {
  const status = String(x.status || 'active').toLowerCase();

  return `
    <article class="card">

      <div class="row">

        <div>
          <div class="name">${esc(x.name)}</div>

          <div class="muted">
            ${esc(x.phone)}
            ${x.site ? '• ' + esc(x.site) : ''}
          </div>
        </div>

        <span class="badge ${status}">
          ${esc(status)}
        </span>

      </div>

      <div class="muted" style="margin-top:8px">
        ${esc(x.address || 'No address')}
        ${x.stage ? '• Stage: ' + esc(x.stage) : ''}
      </div>

      <div class="muted" style="margin-top:5px">
        Steel: ${esc(x.steel || '—')}
        · Cement: ${esc(x.cement || '—')}
        · Paint: ${esc(x.paint || '—')}
      </div>

      ${
        x.followup
          ? `
            <div class="muted" style="margin-top:6px">
              Follow-up:
              <b>${esc(x.followup)}</b>
            </div>
          `
          : ''
      }

      <div class="actions">

        <a class="btn"
          href="tel:${esc(x.phone)}">
          📞 Call
        </a>

        <a class="btn green"
          target="_blank"
          href="https://wa.me/91${esc(x.phone)
            .replace(/\D/g, '')
            .replace(/^91/, '')}">
          WhatsApp
        </a>

        <button class="btn"
          onclick="smsOne('${esc(x.phone)}')">
          SMS
        </button>

        <button class="btn"
          onclick="openForm('${esc(x.id)}')">
          Edit
        </button>

        <button class="btn"
          onclick="deleteCustomer('${esc(x.id)}')">
          🗑️ Delete
        </button>

      </div>

    </article>
  `;
}

window.doSearch = () => {
  query = document.querySelector('#q').value;
  render();
};

window.setFilter = k => {
  filter = k;
  render();
};

window.smsOne = p => {
  location.href =
    `sms:${p}?body=${encodeURIComponent(
      'Dear Customer, please contact us if you have any requirements. Thank you.'
    )}`;
};

window.openForm = (id = null) => {

  editing = id
    ? customers.find(x => x.id === id)
    : null;

  const x = editing || {};

  app.insertAdjacentHTML(
    'beforeend',
    `
    <div class="modal" id="modal">

      <div class="sheet">

        <h2>
          ${editing ? 'Edit Customer' : 'Add Customer'}
        </h2>

        <div class="grid">

          <div class="field">
            <label>Name *</label>
            <input id="f_name"
              value="${esc(x.name)}">
          </div>

          <div class="field">
            <label>Mobile *</label>
            <input id="f_phone"
              inputmode="tel"
              value="${esc(x.phone)}">
          </div>

          <div class="field">
            <label>Site name</label>
            <input id="f_site"
              value="${esc(x.site)}">
          </div>

          <div class="field">
            <label>Status</label>

            <select id="f_status">

              <option value="active"
                ${
                  String(x.status).toLowerCase() !== 'inactive'
                    ? 'selected'
                    : ''
                }>
                Active
              </option>

              <option value="inactive"
                ${
                  String(x.status).toLowerCase() === 'inactive'
                    ? 'selected'
                    : ''
                }>
                Inactive
              </option>

            </select>
          </div>

          <div class="field full">
            <label>Address / Site location</label>
            <input id="f_address"
              value="${esc(x.address)}">
          </div>

          <div class="field">
            <label>Construction stage / level</label>
            <input id="f_stage"
              value="${esc(x.stage)}"
              placeholder="Foundation / 1st floor / slab…">
          </div>

          <div class="field">
            <label>Follow-up date</label>
            <input id="f_followup"
              type="date"
              value="${esc(x.followup)}">
          </div>

          <div class="field">
            <label>Steel brand</label>
            <input id="f_steel"
              value="${esc(x.steel)}">
          </div>

          <div class="field">
            <label>Cement brand</label>
            <input id="f_cement"
              value="${esc(x.cement)}">
          </div>

          <div class="field">
            <label>Paint brand</label>
            <input id="f_paint"
              value="${esc(x.paint)}">
          </div>

          <div class="field">
            <label>Requirement</label>
            <input id="f_requirement"
              value="${esc(x.requirement)}">
          </div>

          <div class="field full">
            <label>Notes</label>
            <textarea id="f_notes">${esc(x.notes)}</textarea>
          </div>

        </div>

        <div class="sheet-actions">

          <button class="btn"
            onclick="closeModal()">
            Cancel
          </button>

          <button class="btn primary"
            onclick="saveCustomer()">
            Save Customer
          </button>

        </div>

      </div>

    </div>
    `
  );
};

window.closeModal = () =>
  document.querySelector('#modal')?.remove();

window.saveCustomer = async () => {

  const g = id =>
    document.querySelector(id).value.trim();

  if (!g('#f_name') || !g('#f_phone')) {
    return alert('Name and mobile are required.');
  }

  const data = {
    name: g('#f_name'),
    phone: g('#f_phone'),
    whatsapp: g('#f_phone'),
    site: g('#f_site'),
    status: g('#f_status'),
    address: g('#f_address'),
    stage: g('#f_stage'),
    siteLevel: g('#f_stage'),
    followup: g('#f_followup'),
    followUpDate: g('#f_followup'),
    steel: g('#f_steel'),
    cement: g('#f_cement'),
    paint: g('#f_paint'),
    requirement: g('#f_requirement'),
    notes: g('#f_notes'),
    updatedAt: new Date().toISOString()
  };

  try {

    if (CLOUD_ENABLED && db) {

      if (editing) {

        await updateDoc(
          doc(db, 'customers', editing.id),
          data
        );

      } else {

        await addDoc(
          customersRef,
          data
        );
      }

    } else {

      if (editing) {

        data.id = editing.id;

        customers = customers.map(x =>
          x.id === editing.id ? data : x
        );

      } else {

        data.id = crypto.randomUUID();
        customers.push(data);

      }

      saveLocal();
      render();
    }

    closeModal();
    toast('Customer saved');

  } catch (error) {

    console.error(error);

    alert(
      'Could not save customer to Firebase. Please check Firestore rules.'
    );
  }
};


/* ================================
   DELETE CUSTOMER
   ================================ */

window.deleteCustomer = async (id) => {

  const customer = customers.find(
    x => x.id === id
  );

  if (!customer) {
    return alert('Customer not found.');
  }

  const confirmed = confirm(
    `Delete "${customer.name}" permanently?\n\n` +
    `All customer data will be deleted from the cloud database.\n\n` +
    `This action cannot be undone.`
  );

  if (!confirmed) return;

  try {

    if (CLOUD_ENABLED && db) {

      await deleteDoc(
        doc(db, 'customers', id)
      );

      toast('Customer permanently deleted');

    } else {

      customers = customers.filter(
        x => x.id !== id
      );

      saveLocal();
      render();

      toast('Customer deleted');

    }

  } catch (error) {

    console.error('Delete error:', error);

    alert(
      'Could not delete customer from Firebase. ' +
      'Please check your Firestore rules.'
    );
  }
};


window.openBulk = () => {

  const active = customers.filter(
    x => String(x.status).toLowerCase() === 'active'
  );

  app.insertAdjacentHTML(
    'beforeend',
    `
    <div class="modal" id="modal">

      <div class="sheet">

        <h2>Bulk normal SMS</h2>

        <p class="muted">
          Select customers. Android will open the SMS composer
          with the selected numbers.
          Carrier/device limits may apply.
        </p>

        <div class="field">

          <label>Message</label>

          <textarea id="bulkmsg">
Dear Customer, please contact us if you have any requirements. Thank you.
          </textarea>

        </div>

        <div class="list">

          ${
            active.length
              ? active
                  .map(
                    x =>
                      `
                      <label class="card" style="display:block">

                        <input
                          type="checkbox"
                          class="bulkpick"
                          value="${esc(x.phone)}"
                          checked>

                        ${esc(x.name)}
                        —
                        ${esc(x.phone)}

                      </label>
                      `
                  )
                  .join('')
              : `
                <div class="empty">
                  No active customers.
                </div>
              `
          }

        </div>

        <div class="sheet-actions">

          <button class="btn"
            onclick="closeModal()">
            Cancel
          </button>

          <button class="btn primary"
            onclick="sendBulk()">
            Open SMS
          </button>

        </div>

      </div>

    </div>
    `
  );
};

window.sendBulk = () => {

  const nums = [
    ...document.querySelectorAll('.bulkpick:checked')
  ].map(x =>
    x.value.replace(/\D/g, '')
  );

  const msg =
    document.querySelector('#bulkmsg').value;

  if (!nums.length) return;

  location.href =
    `sms:${nums.join(',')}?body=${encodeURIComponent(msg)}`;
};

window.showInfo = () => {

  alert(
    CLOUD_ENABLED
      ? '☁️ Firebase Cloud Sync is connected. Customer data is stored in Firestore.'
      : 'Cloud sync is not configured.'
  );
};

function toast(t) {

  const e = document.createElement('div');

  e.className = 'toast';
  e.textContent = t;

  document.body.append(e);

  setTimeout(
    () => e.remove(),
    1800
  );
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});
}

render();
