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
let selectedIds = new Set();
let lastMessage = '';
let lastMessageRecipient = null;

const app = document.querySelector('#app');

let db = null;
let customersRef = null;

/* ================================
   FIREBASE / CLOUD
   ================================ */

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
          updatedAt: x.updatedAt || '',
          calledAt: x.calledAt || ''
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

  customers = customers.map(x => ({
    ...x,
    calledAt: x.calledAt || ''
  }));
}

/* ================================
   LOCAL SAVE
   ================================ */

const saveLocal = () => {
  localStorage.setItem(KEY, JSON.stringify(customers));
};

/* ================================
   ESCAPE HTML
   ================================ */

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

/* ================================
   TODAY
   ================================ */

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

/* ================================
   CALLED STATUS
   ================================ */

function wasCalledToday(customer) {
  if (!customer.calledAt) return false;

  return String(customer.calledAt).slice(0, 10) === getToday();
}

/* ================================
   RENDER
   ================================ */

function render() {

  const active = customers.filter(
    x => String(x.status).toLowerCase() === 'active'
  ).length;

  const inactive = customers.length - active;

  const today = getToday();

  const due = customers.filter(
    x => x.followup === today
  ).length;

  const calledToday = customers.filter(
    x => wasCalledToday(x)
  ).length;

  const notCalledToday = customers.length - calledToday;

  let rows = customers
    .filter(x => {

      const status = String(x.status || '').toLowerCase();

      const called = wasCalledToday(x);

      return (
        filter === 'all' ||
        status === filter ||
        (filter === 'today' && x.followup === today) ||
        (filter === 'overdue' &&
          x.followup &&
          x.followup < today) ||
        (filter === 'called' && called) ||
        (filter === 'notcalled' && !called)
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

        <button
          class="btn"
          style="
            margin-left:auto;
            padding:7px 12px;
            font-size:13px;
            min-height:auto;
          "
          onclick="openForm()">
          ＋ Customer
        </button>

      </div>

      <div class="search">

        <input
          id="q"
          value="${esc(query)}"
          placeholder="Search customer, phone, site, area, brand…">

        <button onclick="doSearch()">
          Search
        </button>

      </div>

    </header>

    <main class="wrap">

      <div class="filters">

        ${[
          ['all', 'All'],
          ['active', 'Active'],
          ['inactive', 'Inactive'],
          ['today', 'Today Follow-up'],
          ['overdue', 'Overdue'],
          ['called', 'Called Today'],
          ['notcalled', 'Not Called']
        ]
          .map(
            ([k, l]) =>
              `<button
                class="chip ${filter === k ? 'active' : ''}"
                onclick="setFilter('${k}')">
                ${l}
              </button>`
          )
          .join('')}

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
          <b>${calledToday}</b>
          <span>Called today</span>
        </div>

        <div class="stat">
          <b>${notCalledToday}</b>
          <span>Not called</span>
        </div>

        <div class="stat">
          <b>${due}</b>
          <span>Today's follow-up</span>
        </div>

      </div>

      <!-- CUSTOMER TOOLS -->

      <section class="tools card">

        <div class="tool-head">

          <div>
            <b>Customer tools</b>
            <span class="muted">
              ${selectedIds.size} selected
            </span>
          </div>

          <div style="position:relative">

            <button
              class="btn"
              style="
                font-size:22px;
                padding:3px 11px;
                line-height:1;
                min-width:44px;
              "
              onclick="toggleToolsMenu()"
              aria-label="Customer tools">
              ⋮
            </button>

            <div
              id="toolsMenu"
              style="
                display:none;
                position:absolute;
                right:0;
                top:46px;
                z-index:1000;
                min-width:210px;
                background:#fff;
                border:1px solid #ddd;
                border-radius:12px;
                padding:7px;
                box-shadow:0 8px 25px rgba(0,0,0,.16);
              ">

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="openMessageGenerator();closeToolsMenu()">
                ✨ Message Generator
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="selectVisible();closeToolsMenu()">
                ☑️ Select All
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="clearSelected();closeToolsMenu()">
                🧹 Clear
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="exportSelected('xlsx');closeToolsMenu()">
                📊 Export Excel
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left"
                onclick="exportSelected('pdf');closeToolsMenu()">
                📄 Export PDF
              </button>

            </div>

          </div>

        </div>

      </section>

      <!-- CUSTOMER LIST -->

      <section class="list">

        ${
          rows.length
            ? rows.map(card).join('')
            : `
              <div class="card empty">

                No customers found.

                <br><br>

                <button
                  class="btn primary"
                  onclick="openForm()">
                  Add first customer
                </button>

              </div>
            `
        }

      </section>

    </main>

    <nav class="bottom">

      <button
        class="nav on"
        onclick="setFilter('all')">
        <strong>⌂</strong>
        Home
      </button>

      <button
        class="nav"
        onclick="openForm()">
        <strong>＋</strong>
        Add
      </button>

      <button
        class="nav"
        onclick="openBulk()">
        <strong>✉</strong>
        SMS
      </button>

      <button
        class="nav"
        onclick="showInfo()">
        <strong>☁</strong>
        Sync
      </button>

    </nav>

  `;
}

/* ================================
   CUSTOMER CARD
   ================================ */

function card(x) {

  const status =
    String(x.status || 'active').toLowerCase();

  const called = wasCalledToday(x);

  return `

    <article class="card">

      <div class="row">

        <div class="name-wrap">

          <input
            class="customer-pick"
            type="checkbox"
            ${selectedIds.has(x.id) ? 'checked' : ''}
            onchange="
              toggleSelected(
                '${esc(x.id)}',
                this.checked
              )
            ">

          <div>

            <div class="name">
              ${esc(x.name)}
            </div>

            <div class="muted">
              ${esc(x.phone)}
              ${x.site ? ' • ' + esc(x.site) : ''}
            </div>

          </div>

        </div>

        <div style="text-align:right">

          <span class="badge ${status}">
            ${esc(status)}
          </span>

          <div
            style="
              margin-top:5px;
              font-size:12px;
              font-weight:600;
              ${called ? 'opacity:.9' : 'opacity:.65'}
            ">

            ${
              called
                ? '✓ Called today'
                : '○ Not called'
            }

          </div>

        </div>

      </div>

      <div
        class="muted"
        style="margin-top:8px">

        ${esc(x.address || 'No address')}

        ${x.stage
          ? ' • Stage: ' + esc(x.stage)
          : ''}

      </div>

      <div
        class="muted"
        style="margin-top:5px">

        Steel:
        ${esc(x.steel || '—')}

        · Cement:
        ${esc(x.cement || '—')}

        · Paint:
        ${esc(x.paint || '—')}

      </div>

      ${
        x.followup
          ? `
            <div
              class="muted"
              style="margin-top:6px">

              Follow-up:
              <b>${esc(x.followup)}</b>

            </div>
          `
          : ''
      }

      <div class="actions">

        <button
          class="btn"
          onclick="callCustomer('${esc(x.id)}')">
          📞 Call
        </button>

        <a
          class="btn green"
          target="_blank"
          href="https://wa.me/91${esc(x.phone)
            .replace(/\D/g, '')
            .replace(/^91/, '')}">
          WhatsApp
        </a>

        <button
          class="btn"
          onclick="smsOne('${esc(x.phone)}')">
          SMS
        </button>

        <button
          class="btn"
          onclick="openForm('${esc(x.id)}')">
          Edit
        </button>

      </div>

    </article>

  `;
}

/* ================================
   CUSTOMER CALL TRACKING
   ================================ */

window.callCustomer = async id => {

  const customer =
    customers.find(x => x.id === id);

  if (!customer) {
    return alert('Customer not found.');
  }

  const phone =
    String(customer.phone || '').replace(/\D/g, '');

  if (!phone) {
    return alert('This customer does not have a phone number.');
  }

  const calledAt =
    new Date().toISOString();

  try {

    if (CLOUD_ENABLED && db) {

      await updateDoc(
        doc(db, 'customers', id),
        {
          calledAt,
          updatedAt: calledAt
        }
      );

    } else {

      customers =
        customers.map(x =>
          x.id === id
            ? {
                ...x,
                calledAt,
                updatedAt: calledAt
              }
            : x
        );

      saveLocal();
      render();

    }

    window.location.href =
      `tel:${phone}`;

  } catch (error) {

    console.error('Call tracking error:', error);

    window.location.href =
      `tel:${phone}`;

  }

};

/* ================================
   SEARCH
   ================================ */

window.doSearch = () => {

  query =
    document.querySelector('#q').value;

  render();

};

window.setFilter = k => {

  filter = k;

  render();

};

/* ================================
   SMS
   ================================ */

window.smsOne = p => {

  location.href =
    `sms:${p}?body=${encodeURIComponent(
      'Dear Customer, please contact us if you have any requirements. Thank you.'
    )}`;

};

/* ================================
   TOOLS MENU
   ================================ */

window.toggleToolsMenu = () => {

  const menu =
    document.querySelector('#toolsMenu');

  if (!menu) return;

  menu.style.display =
    menu.style.display === 'none'
      ? 'block'
      : 'none';

};

window.closeToolsMenu = () => {

  const menu =
    document.querySelector('#toolsMenu');

  if (menu) {
    menu.style.display = 'none';
  }

};

/* ================================
   ADD / EDIT CUSTOMER
   ================================ */

window.openForm = (id = null) => {

  editing = id
    ? customers.find(x => x.id === id)
    : null;

  const x = editing || {};

  app.insertAdjacentHTML(
    'beforeend',
    `

    <div
      class="modal"
      id="modal">

      <div class="sheet">

        <h2>
          ${
            editing
              ? 'Edit Customer'
              : 'Add Customer'
          }
        </h2>

        <div class="grid">

          <div class="field">

            <label>Name *</label>

            <input
              id="f_name"
              value="${esc(x.name)}">

          </div>

          <div class="field">

            <label>Mobile *</label>

            <input
              id="f_phone"
              inputmode="tel"
              value="${esc(x.phone)}">

          </div>

          <div class="field">

            <label>Site name</label>

            <input
              id="f_site"
              value="${esc(x.site)}">

          </div>

          <div class="field">

            <label>Status</label>

            <select id="f_status">

              <option
                value="active"
                ${
                  String(x.status).toLowerCase() !== 'inactive'
                    ? 'selected'
                    : ''
                }>
                Active
              </option>

              <option
                value="inactive"
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

            <label>
              Address / Site location
            </label>

            <input
              id="f_address"
              value="${esc(x.address)}">

          </div>

          <div class="field">

            <label>
              Construction stage / level
            </label>

            <input
              id="f_stage"
              value="${esc(x.stage)}"
              placeholder="Foundation / 1st floor / slab…">

          </div>

          <div class="field">

            <label>
              Follow-up date
            </label>

            <input
              id="f_followup"
              type="date"
              value="${esc(x.followup)}">

          </div>

          <div class="field">

            <label>Steel brand</label>

            <input
              id="f_steel"
              value="${esc(x.steel)}">

          </div>

          <div class="field">

            <label>Cement brand</label>

            <input
              id="f_cement"
              value="${esc(x.cement)}">

          </div>

          <div class="field">

            <label>Paint brand</label>

            <input
              id="f_paint"
              value="${esc(x.paint)}">

          </div>

          <div class="field">

            <label>Requirement</label>

            <input
              id="f_requirement"
              value="${esc(x.requirement)}">

          </div>

          <div class="field full">

            <label>Notes</label>

            <textarea id="f_notes">${esc(x.notes)}</textarea>

          </div>

        </div>

        <div class="sheet-actions">

          <button
            class="btn"
            onclick="closeModal()">
            Cancel
          </button>

          ${
            editing
              ? `
                <button
                  class="btn"
                  style="
                    background:#dc2626;
                    color:white;
                    border-color:#dc2626;
                  "
                  onclick="deleteCustomer('${esc(editing.id)}')">
                  🗑️ Delete Customer
                </button>
              `
              : ''
          }

          <button
            class="btn primary"
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

/* ================================
   SAVE CUSTOMER
   ================================ */

window.saveCustomer = async () => {

  const g = id =>
    document.querySelector(id).value.trim();

  if (!g('#f_name') || !g('#f_phone')) {
    return alert(
      'Name and mobile are required.'
    );
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

    calledAt:
      editing?.calledAt || '',

    updatedAt:
      new Date().toISOString()

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

        customers =
          customers.map(x =>
            x.id === editing.id
              ? data
              : x
          );

      } else {

        data.id =
          crypto.randomUUID();

        customers.push(data);

      }

      saveLocal();
      render();

    }

    closeModal();

    editing = null;

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

window.deleteCustomer = async id => {

  const customer =
    customers.find(x => x.id === id);

  if (!customer) {
    return alert(
      'Customer not found.'
    );
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

      selectedIds.delete(id);

      editing = null;

      closeModal();

      toast(
        'Customer permanently deleted'
      );

    } else {

      customers =
        customers.filter(
          x => x.id !== id
        );

      selectedIds.delete(id);

      editing = null;

      closeModal();

      saveLocal();
      render();

      toast('Customer deleted');

    }

  } catch (error) {

    console.error(
      'Delete error:',
      error
    );

    alert(
      'Could not delete customer from Firebase. ' +
      'Please check your Firestore rules.'
    );

  }

};

/* ================================
   SELECT
   ================================ */

window.toggleSelected = (
  id,
  checked
) => {

  if (checked) {
