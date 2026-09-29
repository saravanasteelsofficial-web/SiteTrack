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
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }

  render();

};

window.selectVisible = () => {

  const visible =
    getVisibleCustomers();

  visible.forEach(x =>
    selectedIds.add(x.id)
  );

  render();

};

window.clearSelected = () => {

  selectedIds.clear();

  render();

};

/* ================================
   GET VISIBLE CUSTOMERS
   ================================ */

function getVisibleCustomers() {

  const today =
    getToday();

  return customers.filter(x => {

    const status =
      String(
        x.status || ''
      ).toLowerCase();

    const called =
      wasCalledToday(x);

    const matchesFilter =
      filter === 'all' ||
      status === filter ||
      (
        filter === 'today' &&
        x.followup === today
      ) ||
      (
        filter === 'overdue' &&
        x.followup &&
        x.followup < today
      ) ||
      (
        filter === 'called' &&
        called
      ) ||
      (
        filter === 'notcalled' &&
        !called
      );

    const q =
      query.toLowerCase();

    const matchesQuery =
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
        String(v || '')
          .toLowerCase()
          .includes(q)
      );

    return (
      matchesFilter &&
      matchesQuery
    );

  });

}

/* ================================
   EXPORT DATA
   ================================ */

function exportRows() {

  return customers
    .filter(x =>
      selectedIds.has(x.id)
    )
    .map(x => ({

      'Customer Name':
        x.name || '',

      'Mobile':
        x.phone || '',

      'Site Name':
        x.site || '',

      'Status':
        x.status || '',

      'Address / Location':
        x.address || '',

      'Construction Stage':
        x.stage || '',

      'Follow-up Date':
        x.followup || '',

      'Steel Brand':
        x.steel || '',

      'Cement Brand':
        x.cement || '',

      'Paint Brand':
        x.paint || '',

      'Requirement':
        x.requirement || '',

      'Called Today':
        wasCalledToday(x)
          ? 'Yes'
          : 'No',

      'Notes':
        x.notes || ''

    }));

}

/* ================================
   EXCEL / PDF EXPORT
   ================================ */

window.exportSelected = (
  format = 'xlsx'
) => {

  const rows =
    exportRows();

  if (!rows.length) {

    return alert(
      'Please select at least one customer to export.'
    );

  }

  const stamp =
    new Date()
      .toISOString()
      .slice(0, 10);

  if (format === 'xlsx') {

    if (!window.XLSX) {

      return alert(
        'Excel export library is not loaded. Please check your internet connection.'
      );

    }

    const ws =
      XLSX.utils.json_to_sheet(rows);

    const wb =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Customers'
    );

    XLSX.writeFile(
      wb,
      `SiteTrack-customers-${stamp}.xlsx`
    );

    toast(
      `${rows.length} customer(s) exported to Excel`
    );

    return;
  }

  if (format === 'pdf') {

    if (
      !window.jspdf ||
      !window.jspdf.jsPDF
    ) {

      return alert(
        'PDF library is not loaded. Please check your internet connection.'
      );

    }

    const {
      jsPDF
    } = window.jspdf;

    const pdf =
      new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

    const headers = [
      '#',
      'Customer',
      'Mobile',
      'Site',
      'Status',
      'Stage',
      'Follow-up',
      'Steel',
      'Cement',
      'Paint',
      'Called'
    ];

    const body =
      rows.map(
        (r, index) => [

          index + 1,

          r['Customer Name'],

          r['Mobile'],

          r['Site Name'],

          r['Status'],

          r['Construction Stage'],

          r['Follow-up Date'],

          r['Steel Brand'],

          r['Cement Brand'],

          r['Paint Brand'],

          r['Called Today']

        ]
      );

    pdf.setFontSize(18);

    pdf.text(
      'SiteTrack',
      14,
      14
    );

    pdf.setFontSize(10);

    pdf.text(
      'Saravana Steel Company',
      14,
      20
    );

    pdf.text(
      `Customer List • ${stamp}`,
      14,
      26
    );

    pdf.text(
      `Total Customers: ${rows.length}`,
      14,
      32
    );

    if (
      typeof pdf.autoTable !== 'function'
    ) {

      return alert(
        'PDF table plugin is not loaded. Please refresh the app and try again.'
      );

    }

    pdf.autoTable({

      head: [headers],

      body,

      startY: 37,

      theme: 'grid',

      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle'
      },

      headStyles: {
        fontSize: 7,
        fontStyle: 'bold'
      },

      columnStyles: {

        0: {
          cellWidth: 8
        },

        1: {
          cellWidth: 32
        },

        2: {
          cellWidth: 25
        },

        3: {
          cellWidth: 28
        },

        4: {
          cellWidth: 17
        },

        5: {
          cellWidth: 25
        },

        6: {
          cellWidth: 23
        },

        7: {
          cellWidth: 25
        },

        8: {
          cellWidth: 25
        },

        9: {
          cellWidth: 25
        },

        10: {
          cellWidth: 15
        }

      },

      margin: {
        left: 8,
        right: 8
      },

      didDrawPage: data => {

        pdf.setFontSize(7);

        pdf.text(
          `SiteTrack - Customer List`,
          8,
          203
        );

        pdf.text(
          `Page ${data.pageNumber}`,
          275,
          203
        );

      }

    });

    pdf.save(
      `SiteTrack-customers-${stamp}.pdf`
    );

    toast(
      `${rows.length} customer(s) exported to PDF`
    );

  }

};

/* ================================
   MESSAGE GENERATOR
   ================================ */

window.openMessageGenerator = () => {

  app.insertAdjacentHTML(
    'beforeend',
    `

    <div
      class="modal"
      id="modal">

      <div class="sheet">

        <h2>
          ✉️ Customer Message Generator
        </h2>

        <p class="muted">
          Create a ready-to-send message from the customer's saved details.
          Works without any AI service or paid add-on.
        </p>

        <div class="field">

          <label>
            Message type
          </label>

          <select id="messageType">

            <option value="followup">
              📅 Follow-up
            </option>

            <option value="requirement">
              🧾 Requirement enquiry
            </option>

            <option value="site">
              🏗️ Site progress
            </option>

            <option value="steel">
              🔩 Steel enquiry
            </option>

            <option value="cement">
              🧱 Cement enquiry
            </option>

            <option value="paint">
              🎨 Paint enquiry
            </option>

            <option value="custom">
              ✍️ Custom
            </option>

          </select>

        </div>

        <div class="field">

          <label>
            Custom purpose / extra details
            (optional)
          </label>

          <input
            id="messageExtra"
            placeholder="Example: Ask about tomorrow's delivery requirement">

        </div>

        <div class="field">

          <label>
            Selected customer
          </label>

          <div
            id="messageCustomer"
            class="card muted">
            Select one customer first.
          </div>

        </div>

        <div
          id="messageResult"
          class="message-result muted">

          Your message will appear here.

        </div>

        <div class="sheet-actions">

          <button
            class="btn"
            onclick="closeModal()">
            Close
          </button>

          <button
            class="btn"
            onclick="generateNormalMessage()">
            Generate Message
          </button>

          <button
            class="btn primary"
            onclick="generateNormalMessage(true)">
            Generate & Show
          </button>

        </div>

      </div>

    </div>

    `
  );

  const selected =
    customers.filter(
      x => selectedIds.has(x.id)
    );

  const target =
    selected.length === 1
      ? selected[0]
      : null;

  const box =
    document.querySelector(
      '#messageCustomer'
    );

  if (target) {

    lastMessageRecipient =
      target;

    box.innerHTML =
      `<b>${esc(target.name || 'Customer')}</b>
      <br>
      ${esc(target.phone || '')}
      ${
        target.site
          ? ' • ' + esc(target.site)
          : ''
      }`;

  } else if (selected.length > 1) {

    box.textContent =
      'Please keep one customer selected for a personalized message.';

  }

};

/* ================================
   BUILD NORMAL MESSAGE
   ================================ */

function buildNormalMessage(
  customer,
  type,
  extra = ''
) {

  const name =
    customer.name || 'Customer';

  const site =
    customer.site || 'your site';

  const stage =
    customer.stage || '';

  const req =
    customer.requirement || '';

  const follow =
    customer.followup || '';

  const steel =
    customer.steel || '';

  const cement =
    customer.cement || '';

  const paint =
    customer.paint || '';

  const suffix =
    extra
      ? ` ${extra.trim()}`
      : '';

  switch (type) {

    case 'followup':

      return `Dear ${name}, greetings from Saravana Steel Company. This is a friendly follow-up regarding ${site}${follow ? `, scheduled for ${follow}` : ''}. Please let us know your current requirement. Thank you.${suffix}`;

    case 'requirement':

      return `Dear ${name}, greetings from Saravana Steel Company. We are checking on your material requirement for ${site}. ${req ? `Our notes mention: ${req}. ` : ''}Please share any updated requirement for steel, cement or paint. Thank you.${suffix}`;

    case 'site':

      return `Dear ${name}, greetings from Saravana Steel Company. We are following up on the progress of ${site}${stage ? `, currently noted at ${stage}` : ''}. Please let us know if you need any materials or a quotation. Thank you.${suffix}`;

    case 'steel':

      return `Dear ${name}, greetings from Saravana Steel Company. We are checking whether you have any steel requirement for ${site}${steel ? ` (brand noted: ${steel})` : ''}. Please send the required sizes and quantity. Thank you.${suffix}`;

    case 'cement':

      return `Dear ${name}, greetings from Saravana Steel Company. We are checking your cement requirement for ${site}${cement ? ` (brand noted: ${cement})` : ''}. Please share the required quantity and delivery requirement. Thank you.${suffix}`;

    case 'paint':

      return `Dear ${name}, greetings from Saravana Steel Company. We are checking your paint requirement for ${site}${paint ? ` (brand noted: ${paint})` : ''}. Please share the paint type, shade and quantity required. Thank you.${suffix}`;

    default:

      return `Dear ${name}, greetings from Saravana Steel Company. We are following up regarding ${site}. Please let us know your current requirement. Thank you.${suffix}`;

  }

}

/* ================================
   GENERATE MESSAGE
   ================================ */

window.generateNormalMessage = (
  showOnly = false
) => {

  const selected =
    customers.filter(
      x => selectedIds.has(x.id)
    );

  if (!selected.length) {

    return alert(
      'Select one customer first, then open Message Generator.'
    );

  }

  if (selected.length > 1) {

    return alert(
      'For a personalized message, select one customer at a time.'
    );

  }

  lastMessageRecipient =
    selected[0];

  const type =
    document.querySelector(
      '#messageType'
    )?.value || 'followup';

  const extra =
    document.querySelector(
      '#messageExtra'
    )?.value || '';

  lastMessage =
    buildNormalMessage(
      lastMessageRecipient,
      type,
      extra
    );

  const result =
    document.querySelector(
      '#messageResult'
    );

  if (!result) return;

  result.innerHTML = `

    <div
      class="field"
      style="margin:0">

      <label>
        Message — you can edit it
      </label>

      <textarea
        id="generatedMessage"
        rows="7">${esc(lastMessage)}</textarea>

    </div>

    <div
      class="actions"
      style="margin-top:10px">

      <button
        class="btn"
        onclick="copyGeneratedMessage()">
        📋 Copy
      </button>

      <button
        class="btn green"
        onclick="sendGeneratedWhatsApp()">
        💬 WhatsApp
      </button>

      <button
        class="btn primary"
        onclick="sendGeneratedSMS()">
        ✉️ SMS
      </button>

    </div>

  `;

};

/* ================================
   EDITED MESSAGE
   ================================ */

function getEditedMessage() {

  const el =
    document.querySelector(
      '#generatedMessage'
    );

  const message =
    (
      el?.value ||
      lastMessage ||
      ''
    ).trim();

  if (el) {
    lastMessage = message;
  }

  if (!message) {

    alert(
      'Generate a message first.'
    );

    return '';

  }

  return message;

}

/* ================================
   COPY MESSAGE
   ================================ */

window.copyGeneratedMessage = async () => {

  const message =
    getEditedMessage();

  if (!message) return;

  try {

    await navigator.clipboard.writeText(
      message
    );

    toast(
      'Message copied'
    );

  } catch (e) {

    alert(
      'Copy is not available on this device. You can select and copy the message manually.'
    );

  }

};

/* ================================
   WHATSAPP MESSAGE
   ================================ */

window.sendGeneratedWhatsApp = () => {

  const message =
    getEditedMessage();

  if (
    !message ||
    !lastMessageRecipient
  ) return;

  const phone =
    String(
      lastMessageRecipient.phone || ''
    ).replace(/\D/g, '');

  if (!phone) {

    return alert(
      'This customer does not have a phone number.'
    );

  }

  const normalized =
    phone.startsWith('91')
      ? phone
      : `91${phone}`;

  window.open(
    `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
    '_blank'
  );

};

/* ================================
   SMS MESSAGE
   ================================ */

window.sendGeneratedSMS = () => {

  const message =
    getEditedMessage();

  if (
    !message ||
    !lastMessageRecipient
  ) return;

  const phone =
    String(
      lastMessageRecipient.phone || ''
    ).replace(/\D/g, '');

  if (!phone) {

    return alert(
      'This customer does not have a phone number.'
    );

  }

  window.location.href =
    `sms:${phone}?body=${encodeURIComponent(message)}`;

};

/* ================================
   BULK SMS
   ================================ */

window.openBulk = () => {

  const active =
    customers.filter(
      x =>
        String(x.status)
          .toLowerCase() === 'active'
    );

  app.insertAdjacentHTML(
    'beforeend',
    `

    <div
      class="modal"
      id="modal">

      <div class="sheet">

        <h2>
          Bulk normal SMS
        </h2>

        <p class="muted">

          Select customers. Android will open
          the SMS composer with the selected numbers.
          Carrier/device limits may apply.

        </p>

        <div class="field">

          <label>
            Message
          </label>

          <textarea id="bulkmsg">Dear Customer, please contact us if you have any requirements. Thank you.</textarea>

        </div>

        <div class="list">

          ${
            active.length
              ? active
                  .map(
                    x =>
                      `

                      <label
                        class="card"
                        style="display:block">

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

          <button
            class="btn"
            onclick="closeModal()">
            Cancel
          </button>

          <button
            class="btn primary"
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

    ...document.querySelectorAll(
      '.bulkpick:checked'
    )

  ].map(x =>
    x.value.replace(/\D/g, '')
  );

  const msg =
    document.querySelector(
      '#bulkmsg'
    ).value;

  if (!nums.length) return;

  location.href =
    `sms:${nums.join(',')}?body=${encodeURIComponent(msg)}`;

};

/* ================================
   SYNC INFO
   ================================ */

window.showInfo = () => {

  alert(
    CLOUD_ENABLED
      ? '☁️ Firebase Cloud Sync is connected. Customer data is stored in Firestore.'
      : 'Cloud sync is not configured.'
  );

};

/* ================================
   TOAST
   ================================ */

function toast(t) {

  const e =
    document.createElement('div');

  e.className =
    'toast';

  e.textContent =
    t;

  document.body.append(e);

  setTimeout(
    () => e.remove(),
    1800
  );

}

/* ================================
   SERVICE WORKER
   ================================ */

if (
  'serviceWorker' in navigator
) {

  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});

}

/* ================================
   START APP
   ================================ */

render();
