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
   HELPERS
   ================================ */

const esc = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char])
  );

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function wasCalledToday(customer) {
  return !!customer.calledAt &&
    String(customer.calledAt).slice(0, 10) === getToday();
}

function saveLocal() {
  localStorage.setItem(KEY, JSON.stringify(customers));
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);

  setTimeout(() => element.remove(), 1800);
}


/* ================================
   FIREBASE / LOCAL DATA
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

      alert(
        'Cloud database connection error. Please check Firebase settings.'
      );

    }
  );

} else {

  try {

    customers = JSON.parse(
      localStorage.getItem(KEY) || '[]'
    );

  } catch {

    customers = [];

  }

  customers = customers.map(x => ({
    ...x,
    calledAt: x.calledAt || ''
  }));

}


/* ================================
   VISIBLE CUSTOMERS
   ================================ */

function getVisibleCustomers() {

  const today = getToday();
  const q = query.toLowerCase().trim();

  return customers
    .filter(customer => {

      const status =
        String(customer.status || '').toLowerCase();

      const called =
        wasCalledToday(customer);

      const matchesFilter =
        filter === 'all' ||
        status === filter ||
        (filter === 'today' && customer.followup === today) ||
        (
          filter === 'overdue' &&
          customer.followup &&
          customer.followup < today
        ) ||
        (filter === 'called' && called) ||
        (filter === 'notcalled' && !called);

      if (!matchesFilter) return false;

      if (!q) return true;

      return [
        customer.name,
        customer.phone,
        customer.address,
        customer.site,
        customer.steel,
        customer.cement,
        customer.paint,
        customer.stage,
        customer.requirement
      ].some(value =>
        String(value || '').toLowerCase().includes(q)
      );

    })
    .sort((a, b) =>
      String(a.name || '').localeCompare(
        String(b.name || '')
      )
    );
}


/* ================================
   RENDER
   ================================ */

function render() {

  const today = getToday();

  const due = customers.filter(
    customer => customer.followup === today
  ).length;

  const rows = getVisibleCustomers();

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

        <div
          style="
            margin-left:auto;
            display:flex;
            align-items:center;
            gap:8px;
          "
        >

          <!-- THREE DOT MENU -->

          <div style="position:relative">

            <button
              class="btn"
              style="
                font-size:22px;
                padding:3px 11px;
                line-height:1;
                min-width:44px;
                min-height:42px;
              "
              onclick="toggleToolsMenu()"
              aria-label="Customer tools"
            >
              ⋮
            </button>

            <div
              id="toolsMenu"
              style="
                display:none;
                position:absolute;
                right:0;
                top:48px;
                z-index:1000;
                min-width:210px;
                background:#fff;
                border:1px solid #ddd;
                border-radius:12px;
                padding:7px;
                box-shadow:0 8px 25px rgba(0,0,0,.16);
              "
            >

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="
                  openMessageGenerator();
                  closeToolsMenu();
                "
              >
                ✨ Message Generator
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="
                  selectVisible();
                  closeToolsMenu();
                "
              >
                ☑️ Select All
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="
                  clearSelected();
                  closeToolsMenu();
                "
              >
                🧹 Clear
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left;margin-bottom:5px"
                onclick="
                  exportSelected('xlsx');
                  closeToolsMenu();
                "
              >
                📊 Export Excel
              </button>

              <button
                class="btn"
                style="width:100%;text-align:left"
                onclick="
                  exportSelected('pdf');
                  closeToolsMenu();
                "
              >
                📄 Export PDF
              </button>

            </div>

          </div>

        </div>

      </div>

      <div class="search">

        <input
          id="q"
          value="${esc(query)}"
          placeholder="Search customer, phone, site, area, brand…"
        >

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
        ].map(([key, label]) => `
          <button
            class="chip ${filter === key ? 'active' : ''}"
            onclick="setFilter('${key}')"
          >
            ${label}
          </button>
        `).join('')}

      </div>


      <!-- ONLY TWO STATS -->

      <div class="stats">

        <div class="stat">

          <b>${customers.length}</b>

          <span>
            Total customers
          </span>

        </div>

        <div class="stat">

          <b>${due}</b>

          <span>
            Today's follow-up
          </span>

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

                <button
                  class="btn primary"
                  onclick="openForm()"
                >
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
        onclick="setFilter('all')"
      >
        <strong>⌂</strong>
        Home
      </button>

      <button
        class="nav"
        onclick="openForm()"
      >
        <strong>＋</strong>
        Add
      </button>

      <button
        class="nav"
        onclick="openBulk()"
      >
        <strong>✉</strong>
        SMS
      </button>

      <button
        class="nav"
        onclick="showInfo()"
      >
        <strong>☁</strong>
        Sync
      </button>

    </nav>

  `;
}


/* ================================
   CUSTOMER CARD
   ================================ */

function card(customer) {

  const status =
    String(customer.status || 'active').toLowerCase();

  const called =
    wasCalledToday(customer);

  const phone =
    String(customer.phone || '').replace(/\D/g, '');

  const whatsappNumber =
    phone.replace(/^91/, '');

  return `

    <article class="card">

      <div class="row">

        <div class="name-wrap">

          <input
            class="customer-pick"
            type="checkbox"
            ${selectedIds.has(customer.id) ? 'checked' : ''}
            onchange="
              toggleSelected(
                '${esc(customer.id)}',
                this.checked
              )
            "
          >

          <div>

            <div class="name">
              ${esc(customer.name)}
            </div>

            <div class="muted">

              ${esc(customer.phone)}

              ${
                customer.site
                  ? ' • ' + esc(customer.site)
                  : ''
              }

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
              opacity:${called ? '.9' : '.65'};
            "
          >
            ${called ? '✓ Called today' : '○ Not called'}
          </div>

        </div>

      </div>


      <div
        class="muted"
        style="margin-top:8px"
      >

        ${esc(customer.address || 'No address')}

        ${
          customer.stage
            ? ' • Stage: ' + esc(customer.stage)
            : ''
        }

      </div>


      <div
        class="muted"
        style="margin-top:5px"
      >

        Steel: ${esc(customer.steel || '—')}
        · Cement: ${esc(customer.cement || '—')}
        · Paint: ${esc(customer.paint || '—')}

      </div>


      ${
        customer.followup
          ? `
            <div
              class="muted"
              style="margin-top:6px"
            >
              Follow-up:
              <b>${esc(customer.followup)}</b>
            </div>
          `
          : ''
      }


      <div class="actions">

        <button
          class="btn"
          onclick="callCustomer('${esc(customer.id)}')"
        >
          📞 Call
        </button>

        <a
          class="btn green"
          target="_blank"
          href="https://wa.me/91${whatsappNumber}"
        >
          WhatsApp
        </a>

        <button
          class="btn"
          onclick="smsOne('${esc(customer.phone)}')"
        >
          SMS
        </button>

        <button
          class="btn"
          onclick="openForm('${esc(customer.id)}')"
        >
          Edit
        </button>

      </div>

    </article>

  `;
}


/* ================================
   CALL CUSTOMER
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
    return alert(
      'This customer does not have a phone number.'
    );
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

      customers = customers.map(x =>
        x.id === id
          ? { ...x, calledAt, updatedAt: calledAt }
          : x
      );

      saveLocal();
      render();

    }

  } catch (error) {

    console.error('Call tracking error:', error);

  }

  window.location.href = `tel:${phone}`;
};


/* ================================
   SEARCH / FILTER
   ================================ */

window.doSearch = () => {

  query =
    document.querySelector('#q')?.value || '';

  render();

};

window.setFilter = key => {

  filter = key;
  render();

};


/* ================================
   SMS
   ================================ */

window.smsOne = phone => {

  location.href =
    `sms:${phone}?body=${encodeURIComponent(
      'Dear Customer, please contact us if you have any requirements. Thank you.'
    )}`;

};


/* ================================
   THREE DOT MENU
   ================================ */

window.toggleToolsMenu = () => {

  const menu =
    document.querySelector('#toolsMenu');

  if (!menu) return;

  menu.style.display =
    menu.style.display === 'block'
      ? 'none'
      : 'block';

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

  editing =
    id
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

            <input
              id="f_name"
              value="${esc(x.name)}"
            >

          </div>


          <div class="field">

            <label>Mobile *</label>

            <input
              id="f_phone"
              inputmode="tel"
              value="${esc(x.phone)}"
            >

          </div>


          <div class="field">

            <label>Site name</label>

            <input
              id="f_site"
              value="${esc(x.site)}"
            >

          </div>


          <div class="field">

            <label>Status</label>

            <select id="f_status">

              <option
                value="active"
                ${String(x.status).toLowerCase() !== 'inactive' ? 'selected' : ''}
              >
                Active
              </option>

              <option
                value="inactive"
                ${String(x.status).toLowerCase() === 'inactive' ? 'selected' : ''}
              >
                Inactive
              </option>

            </select>

          </div>


          <div class="field full">

            <label>Address / Site location</label>

            <input
              id="f_address"
              value="${esc(x.address)}"
            >

          </div>


          <div class="field">

            <label>
              Construction stage / level
            </label>

            <input
              id="f_stage"
              value="${esc(x.stage)}"
              placeholder="Foundation / 1st floor / slab…"
            >

          </div>


          <div class="field">

            <label>Follow-up date</label>

            <input
              id="f_followup"
              type="date"
              value="${esc(x.followup)}"
            >

          </div>


          <div class="field">

            <label>Steel brand</label>

            <input
              id="f_steel"
              value="${esc(x.steel)}"
            >

          </div>


          <div class="field">

            <label>Cement brand</label>

            <input
              id="f_cement"
              value="${esc(x.cement)}"
            >

          </div>


          <div class="field">

            <label>Paint brand</label>

            <input
              id="f_paint"
              value="${esc(x.paint)}"
            >

          </div>


          <div class="field">

            <label>Requirement</label>

            <input
              id="f_requirement"
              value="${esc(x.requirement)}"
            >

          </div>


          <div class="field full">

            <label>Notes</label>

            <textarea id="f_notes">${esc(x.notes)}</textarea>

          </div>

        </div>


        <div class="sheet-actions">

          <button
            class="btn"
            onclick="closeModal()"
          >
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
                  onclick="deleteCustomer('${esc(editing.id)}')"
                >
                  🗑️ Delete Customer
                </button>
              `
              : ''
          }


          <button
            class="btn primary"
            onclick="saveCustomer()"
          >
            Save Customer
          </button>

        </div>

      </div>

    </div>

    `
  );

};

window.closeModal = () => {

  document
    .querySelector('#modal')
    ?.remove();

};


/* ================================
   SAVE CUSTOMER
   ================================ */

window.saveCustomer = async () => {

  const get = id =>
    document.querySelector(id)?.value.trim() || '';

  const name = get('#f_name');
  const phone = get('#f_phone');

  if (!name || !phone) {
    return alert(
      'Name and mobile are required.'
    );
  }

  const data = {

    name,
    phone,
    whatsapp: phone,
    site: get('#f_site'),
    status: get('#f_status'),
    address: get('#f_address'),
    stage: get('#f_stage'),
    siteLevel: get('#f_stage'),
    followup: get('#f_followup'),
    followUpDate: get('#f_followup'),
    steel: get('#f_steel'),
    cement: get('#f_cement'),
    paint: get('#f_paint'),
    requirement: get('#f_requirement'),
    notes: get('#f_notes'),
    calledAt: editing?.calledAt || '',
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
          x.id === editing.id
            ? data
            : x
        );

      } else {

        data.id = crypto.randomUUID();
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
      'Could not save customer. Please check your Firebase / Firestore settings.'
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
    return alert('Customer not found.');
  }

  if (!confirm(
    `Delete "${customer.name}" permanently?\n\n` +
    `All customer data will be deleted.\n\n` +
    `This action cannot be undone.`
  )) {
    return;
  }

  try {

    if (CLOUD_ENABLED && db) {

      await deleteDoc(
        doc(db, 'customers', id)
      );

    } else {

      customers =
        customers.filter(x => x.id !== id);

      saveLocal();

      render();

    }

    selectedIds.delete(id);
    editing = null;
    closeModal();

    toast('Customer deleted');

  } catch (error) {

    console.error('Delete error:', error);

    alert(
      'Could not delete customer. Please check your Firestore rules.'
    );

  }

};


/* ================================
   SELECT CUSTOMERS
   ================================ */

window.toggleSelected = (id, checked) => {

  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }

  render();

};

window.selectVisible = () => {

  getVisibleCustomers().forEach(
    customer => selectedIds.add(customer.id)
  );

  render();

};

window.clearSelected = () => {

  selectedIds.clear();
  render();

};


/* ================================
   EXPORT DATA
   ================================ */

function exportRows() {

  return customers
    .filter(customer => selectedIds.has(customer.id))
    .map(customer => ({

      'Customer Name': customer.name || '',
      'Mobile': customer.phone || '',
      'Site Name': customer.site || '',
      'Status': customer.status || '',
      'Address / Location': customer.address || '',
      'Construction Stage': customer.stage || '',
      'Follow-up Date': customer.followup || '',
      'Steel Brand': customer.steel || '',
      'Cement Brand': customer.cement || '',
      'Paint Brand': customer.paint || '',
      'Requirement': customer.requirement || '',
      'Called Today': wasCalledToday(customer) ? 'Yes' : 'No',
      'Notes': customer.notes || ''

    }));

}


/* ================================
   EXCEL / PDF EXPORT
   ================================ */

window.exportSelected = format => {

  const rows = exportRows();

  if (!rows.length) {
    return alert(
      'Please select at least one customer to export.'
    );
  }

  const stamp =
    new Date().toISOString().slice(0, 10);


  /* EXCEL */

  if (format === 'xlsx') {

    if (!window.XLSX) {
      return alert(
        'Excel export library is not loaded.'
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


  /* PDF */

  if (format !== 'pdf') return;

  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {
    return alert(
      'PDF library is not loaded.'
    );
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
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

  const body = rows.map((row, index) => [

    index + 1,
    row['Customer Name'],
    row['Mobile'],
    row['Site Name'],
    row['Status'],
    row['Construction Stage'],
    row['Follow-up Date'],
    row['Steel Brand'],
    row['Cement Brand'],
    row['Paint Brand'],
    row['Called Today']

  ]);

  pdf.setFontSize(18);
  pdf.text('SiteTrack', 14, 14);

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

  if (typeof pdf.autoTable !== 'function') {
    return alert(
      'PDF table plugin is not loaded. Please refresh the app.'
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

      0: { cellWidth: 8 },
      1: { cellWidth: 32 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28 },
      4: { cellWidth: 17 },
      5: { cellWidth: 25 },
      6: { cellWidth: 23 },
      7: { cellWidth: 25 },
      8: { cellWidth: 25 },
      9: { cellWidth: 25 },
      10: { cellWidth: 15 }

    },

    margin: {
      left: 8,
      right: 8
    },

    didDrawPage: data => {

      pdf.setFontSize(7);

      pdf.text(
        'SiteTrack - Customer List',
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

};


/* ================================
   MESSAGE GENERATOR
   ================================ */

window.openMessageGenerator = () => {

  app.insertAdjacentHTML(
    'beforeend',
    `

    <div class="modal" id="modal">

      <div class="sheet">

        <h2>
          ✉️ Customer Message Generator
        </h2>

        <p class="muted">
          Create a ready-to-send message from the customer's saved details.
          Works without any AI service or paid add-on.
        </p>


        <div class="field">

          <label>Message type</label>

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
          </label>

          <input
            id="messageExtra"
            placeholder="Example: Ask about tomorrow's delivery requirement"
          >

        </div>


        <div class="field">

          <label>
            Selected customer
          </label>

          <div
            id="messageCustomer"
            class="card muted"
          >
            Select one customer first.
          </div>

        </div>


        <div
          id="messageResult"
          class="message-result muted"
        >
          Your message will appear here.
        </div>


        <div class="sheet-actions">

          <button
            class="btn"
            onclick="closeModal()"
          >
            Close
          </button>

          <button
            class="btn primary"
            onclick="generateNormalMessage()"
          >
            Generate Message
          </button>

        </div>

      </div>

    </div>

    `
  );


  const selected =
    customers.filter(
      customer => selectedIds.has(customer.id)
    );

  const box =
    document.querySelector('#messageCustomer');


  if (selected.length === 1) {

    lastMessageRecipient =
      selected[0];

    box.innerHTML = `
      <b>
        ${esc(selected[0].name || 'Customer')}
      </b>
      <br>
      ${esc(selected[0].phone || '')}
      ${
        selected[0].site
          ? ' • ' + esc(selected[0].site)
          : ''
      }
    `;

  } else if (selected.length > 1) {

    box.textContent =
      'Please keep one customer selected for a personalized message.';

  }

};


/* ================================
   MESSAGE CREATION
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

  const requirement =
    customer.requirement || '';

  const followup =
    customer.followup || '';

  const steel =
    customer.steel || '';

  const cement =
    customer.cement || '';

  const paint =
    customer.paint || '';

  const suffix =
    extra.trim()
      ? ` ${extra.trim()}`
      : '';


  switch (type) {

    case 'followup':

      return `Dear ${name}, greetings from Saravana Steel Company. This is a friendly follow-up regarding ${site}${followup ? `, scheduled for ${followup}` : ''}. Please let us know your current requirement. Thank you.${suffix}`;


    case 'requirement':

      return `Dear ${name}, greetings from Saravana Steel Company. We are checking on your material requirement for ${site}. ${requirement ? `Our notes mention: ${requirement}. ` : ''}Please share any updated requirement for steel, cement or paint. Thank you.${suffix}`;


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

window.generateNormalMessage = () => {

  const selected =
    customers.filter(
      customer => selectedIds.has(customer.id)
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
    document.querySelector('#messageType')?.value ||
    'followup';

  const extra =
    document.querySelector('#messageExtra')?.value ||
    '';

  lastMessage =
    buildNormalMessage(
      lastMessageRecipient,
      type,
      extra
    );

  const result =
    document.querySelector('#messageResult');

  if (!result) return;

  result.innerHTML = `

    <div
      class="field"
      style="margin:0"
    >

      <label>
        Message — you can edit it
      </label>

      <textarea
        id="generatedMessage"
        rows="7"
      >${esc(lastMessage)}</textarea>

    </div>


    <div
      class="actions"
      style="margin-top:10px"
    >

      <button
        class="btn"
        onclick="copyGeneratedMessage()"
      >
        📋 Copy
      </button>

      <button
        class="btn green"
        onclick="sendGeneratedWhatsApp()"
      >
        💬 WhatsApp
      </button>

      <button
        class="btn primary"
        onclick="sendGeneratedSMS()"
      >
        ✉️ SMS
      </button>

    </div>

  `;

};


/* ================================
   MESSAGE ACTIONS
   ================================ */

function getEditedMessage() {

  const element =
    document.querySelector('#generatedMessage');

  const message =
    (
      element?.value ||
      lastMessage ||
      ''
    ).trim();

  if (element) {
    lastMessage = message;
  }

  if (!message) {
    alert('Generate a message first.');
    return '';
  }

  return message;

}


window.copyGeneratedMessage = async () => {

  const message =
    getEditedMessage();

  if (!message) return;

  try {

    await navigator.clipboard.writeText(message);

    toast('Message copied');

  } catch {

    alert(
      'Copy is not available on this device. You can select and copy the message manually.'
    );

  }

};


window.sendGeneratedWhatsApp = () => {

  const message =
    getEditedMessage();

  if (!message || !lastMessageRecipient) return;

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


window.sendGeneratedSMS = () => {

  const message =
    getEditedMessage();

  if (!message || !lastMessageRecipient) return;

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
      customer =>
        String(customer.status).toLowerCase() === 'active'
    );

  app.insertAdjacentHTML(
    'beforeend',
    `

    <div class="modal" id="modal">

      <div class="sheet">

        <h2>
          Bulk normal SMS
        </h2>

        <p class="muted">
          Select customers. Android will open the SMS composer
          with the selected numbers.
        </p>

        <div class="field">

          <label>Message</label>

          <textarea id="bulkmsg">Dear Customer, please contact us if you have any requirements. Thank you.</textarea>

        </div>

        <div class="list">

          ${
            active.length
              ? active.map(customer => `
                  <label
                    class="card"
                    style="display:block"
                  >

                    <input
                      type="checkbox"
                      class="bulkpick"
                      value="${esc(customer.phone)}"
                      checked
                    >

                    ${esc(customer.name)}
                    —
                    ${esc(customer.phone)}

                  </label>
                `).join('')
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
            onclick="closeModal()"
          >
            Cancel
          </button>

          <button
            class="btn primary"
            onclick="sendBulk()"
          >
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
  ].map(
    element =>
      element.value.replace(/\D/g, '')
  );

  const message =
    document.querySelector('#bulkmsg')?.value || '';

  if (!nums.length) return;

  location.href =
    `sms:${nums.join(',')}?body=${encodeURIComponent(message)}`;

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
   SERVICE WORKER
   ================================ */

if ('serviceWorker' in navigator) {

  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});

}


/* ================================
   START
   ================================ */

render();
