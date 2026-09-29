window.toggleSelected = (id, checked) => {

  if (checked) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }

  render();
};


/* ================================
   SELECT VISIBLE CUSTOMERS
   ================================ */

window.selectVisible = () => {

  const today = getToday();

  customers
    .filter(x => {

      const status =
        String(x.status || '').toLowerCase();

      const called =
        wasCalledToday(x);

      const matchesFilter =
        filter === 'all' ||
        status === filter ||
        (filter === 'today' &&
          x.followup === today) ||
        (filter === 'overdue' &&
          x.followup &&
          x.followup < today) ||
        (filter === 'called' && called) ||
        (filter === 'notcalled' && !called);

      const q =
        query.toLowerCase();

      const matchesSearch =
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

      return matchesFilter && matchesSearch;

    })
    .forEach(x => {
      selectedIds.add(x.id);
    });

  render();
};


/* ================================
   CLEAR SELECTED
   ================================ */

window.clearSelected = () => {

  selectedIds.clear();

  render();

};


/* ================================
   EXPORT SELECTED
   ================================ */

window.exportSelected = type => {

  const list =
    selectedIds.size
      ? customers.filter(x =>
          selectedIds.has(x.id)
        )
      : customers;

  if (!list.length) {
    return alert('No customers to export.');
  }

  if (type === 'pdf') {

    const html = `
      <html>
      <head>
        <title>SiteTrack Customers</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }

          h1 {
            margin-bottom: 5px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }

          th,
          td {
            border: 1px solid #ccc;
            padding: 7px;
            text-align: left;
            font-size: 12px;
          }

          th {
            background: #eee;
          }
        </style>

      </head>

      <body>

        <h1>SiteTrack Customers</h1>

        <div>
          Saravana Steel Company
        </div>

        <table>

          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Site</th>
              <th>Status</th>
              <th>Address</th>
              <th>Stage</th>
              <th>Follow-up</th>
              <th>Steel</th>
              <th>Cement</th>
              <th>Paint</th>
            </tr>
          </thead>

          <tbody>

            ${list.map(x => `
              <tr>
                <td>${esc(x.name)}</td>
                <td>${esc(x.phone)}</td>
                <td>${esc(x.site)}</td>
                <td>${esc(x.status)}</td>
                <td>${esc(x.address)}</td>
                <td>${esc(x.stage)}</td>
                <td>${esc(x.followup)}</td>
                <td>${esc(x.steel)}</td>
                <td>${esc(x.cement)}</td>
                <td>${esc(x.paint)}</td>
              </tr>
            `).join('')}

          </tbody>

        </table>

      </body>
      </html>
    `;

    const win =
      window.open('', '_blank');

    if (!win) {
      return alert(
        'Please allow pop-ups for PDF export.'
      );
    }

    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.print();
    }, 500);

    return;
  }


  /* Excel-compatible CSV */

  const headers = [
    'Name',
    'Mobile',
    'Site',
    'Status',
    'Address',
    'Stage',
    'Follow-up',
    'Steel',
    'Cement',
    'Paint',
    'Requirement',
    'Notes'
  ];

  const csvEscape = value => {

    const v =
      String(value ?? '');

    return `"${v.replace(/"/g, '""')}"`;

  };

  const lines = [

    headers
      .map(csvEscape)
      .join(','),

    ...list.map(x =>
      [
        x.name,
        x.phone,
        x.site,
        x.status,
        x.address,
        x.stage,
        x.followup,
        x.steel,
        x.cement,
        x.paint,
        x.requirement,
        x.notes
      ]
        .map(csvEscape)
        .join(',')
    )

  ];

  const blob =
    new Blob(
      ['\ufeff' + lines.join('\n')],
      {
        type: 'text/csv;charset=utf-8;'
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;
  a.download =
    'SiteTrack-Customers.csv';

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

};


/* ================================
   BULK SMS
   ================================ */

window.openBulk = () => {

  const list =
    selectedIds.size
      ? customers.filter(x =>
          selectedIds.has(x.id)
        )
      : customers;

  if (!list.length) {
    return alert(
      'No customers available.'
    );
  }

  const phones =
    list
      .map(x =>
        String(x.phone || '')
          .replace(/\D/g, '')
      )
      .filter(Boolean);

  if (!phones.length) {
    return alert(
      'No customer phone numbers found.'
    );
  }

  const message =
    prompt(
      'Enter message to send:',
      'Dear Customer, please contact us if you have any requirements. Thank you.'
    );

  if (message === null) {
    return;
  }

  lastMessage = message;
  lastMessageRecipient = null;

  /*
     Android SMS app may handle multiple
     recipients differently depending on device.
  */

  const recipients =
    phones.join(',');

  location.href =
    `sms:${recipients}?body=${encodeURIComponent(message)}`;

};


/* ================================
   NORMAL MESSAGE GENERATOR
   ================================ */

window.openMessageGenerator = () => {

  const selected =
    customers.filter(x =>
      selectedIds.has(x.id)
    );

  const customer =
    selected.length === 1
      ? selected[0]
      : null;

  const name =
    customer?.name || 'Customer';

  const defaultMessage =
    `Dear ${name}, ` +
    `please let us know if you have any ` +
    `steel, cement or paint requirements. ` +
    `Thank you - Saravana Steel Company.`;

  const message =
    prompt(
      'Enter customer message:',
      defaultMessage
    );

  if (message === null) {
    return;
  }

  lastMessage = message;

  if (customer) {

    lastMessageRecipient =
      customer.phone || '';

    location.href =
      `sms:${customer.phone}?body=${encodeURIComponent(message)}`;

    return;
  }

  alert(
    'Message prepared.\n\n' +
    'Select one customer to send it directly.'
  );

};


/* ================================
   INFO / SYNC
   ================================ */

window.showInfo = () => {

  if (CLOUD_ENABLED) {

    alert(
      '☁ Cloud Sync Enabled\n\n' +
      'Your customer data is connected to Firebase Firestore.'
    );

  } else {

    alert(
      '📱 Local Storage Mode\n\n' +
      'Cloud sync is currently disabled.'
    );

  }

};


/* ================================
   TOAST
   ================================ */

window.toast = message => {

  const old =
    document.querySelector('#siteToast');

  if (old) {
    old.remove();
  }

  const el =
    document.createElement('div');

  el.id =
    'siteToast';

  el.textContent =
    message;

  el.style.cssText = `
    position:fixed;
    left:50%;
    bottom:90px;
    transform:translateX(-50%);
    z-index:99999;
    background:#111827;
    color:white;
    padding:12px 18px;
    border-radius:12px;
    font-size:14px;
    box-shadow:0 5px 20px rgba(0,0,0,.25);
  `;

  document.body.appendChild(el);

  setTimeout(() => {

    el.remove();

  }, 2500);

};


/* ================================
   INITIAL RENDER
   ================================ */

if (!CLOUD_ENABLED) {
  render();
}
