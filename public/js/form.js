let daftarBarang = [];
let searchTimer = null;

let halamanBarang = 1;
const barangPerHalaman = 10;
const barangTerpilih = new Map();


// =====================================================
// UTIL
// =====================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function tampilkanError(message) {
  let errorBox =
    document.getElementById('errorBox');

  if (!errorBox) {
    errorBox =
      document.createElement('div');

    errorBox.id = 'errorBox';
    errorBox.className = 'error-box';

    const form =
      document.getElementById(
        'formPermintaan'
      );

    form.prepend(errorBox);
  }

  errorBox.textContent = message;
  errorBox.style.display = 'block';

  errorBox.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}


function sembunyikanError() {
  const errorBox =
    document.getElementById(
      'errorBox'
    );

  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }
}


// =====================================================
// LOAD BARANG
// =====================================================

async function loadBarang(search = '') {
  const tbody =
    document.getElementById(
      'barangBody'
    );

  tbody.innerHTML = `
    <tr>
      <td
        colspan="6"
        class="empty-row"
      >
        Memuat data barang...
      </td>
    </tr>
  `;

  try {
    const response =
      await fetch(
        '/api/barang?search=' +
        encodeURIComponent(search)
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        'Gagal mengambil data barang.'
      );
    }

    daftarBarang =
      Array.isArray(data)
        ? data
        : [];

    daftarBarang.sort(
      (a, b) => {
        const angkaA =
          Number(
            String(a.kode)
              .match(/\d+/)?.[0] || 0
          );

        const angkaB =
          Number(
            String(b.kode)
              .match(/\d+/)?.[0] || 0
          );

        if (angkaA !== angkaB) {
          return angkaA - angkaB;
        }

        return String(a.kode)
          .localeCompare(
            String(b.kode),
            'id'
          );
      }
    );
    daftarBarang.forEach(
  item => {
    const id =
      Number(item.id);

    if (
      barangTerpilih.has(id)
    ) {
      const selected =
        barangTerpilih.get(id);

      selected.barang = {
        ...item
      };

      const stok =
        Number(item.stok) || 0;

      if (
        selected.jumlah > stok
      ) {
        selected.jumlah =
          stok;
      }

      if (
        selected.jumlah <= 0
      ) {
        barangTerpilih.delete(id);
      }
    }
  }
);

    halamanBarang = 1;

    renderBarang();

  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;

    tampilkanError(
      error.message
    );
  }
}


// =====================================================
// RENDER BARANG
// =====================================================

function renderBarang() {
  const tbody =
    document.getElementById(
      'barangBody'
    );

  if (
    daftarBarang.length === 0
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          Barang tidak ditemukan.
        </td>
      </tr>
    `;

    renderPaginationBarang();

    return;
  }

  const mulai =
    (halamanBarang - 1) *
    barangPerHalaman;

  const selesai =
    mulai + barangPerHalaman;

  const barangHalaman =
    daftarBarang.slice(
      mulai,
      selesai
    );


  tbody.innerHTML =
    barangHalaman
      .map(item => {
        const stok =
          Number(item.stok) || 0;

        const id =
  Number(item.id);

const selected =
  barangTerpilih.get(id);

const sudahDipilih =
  barangTerpilih.has(id);

const jumlahDipilih =
  selected
    ? selected.jumlah
    : 1;

        let stockClass = '';

        if (stok <= 0) {
          stockClass =
            'stock-empty';
        } else if (stok <= 5) {
          stockClass =
            'stock-low';
        } else {
          stockClass =
            'stock-available';
        }

        const disabled =
          stok <= 0
            ? 'disabled'
            : '';

        return `
          <tr>

            <td>
              <input
                type="checkbox"
                class="checkbox-atk"
                id="barang-${item.id}"
                data-id="${item.id}"
                ${sudahDipilih ? 'checked' : ''}
                onchange="
                  toggleBarang(
                    ${item.id}
                  )
                "
                ${disabled}
              >
            </td>

            <td>
              <span class="kode">
                ${escapeHtml(
                  item.kode
                )}
              </span>
            </td>

            <td>
              ${escapeHtml(
                item.nama
              )}
            </td>

            <td>
              ${escapeHtml(
                item.satuan
              )}
            </td>

            <td>
              <span
                class="${stockClass}"
              >
                ${stok}
              </span>
            </td>

            <td>
              <input
                type="number"
                id="jumlah-${item.id}"
                class="quantity-input"
                min="1"
                max="${stok}"
                value="${jumlahDipilih}"
                ${sudahDipilih ? '' : 'disabled'}
                oninput="
                  ubahJumlah(
                    ${item.id}
                  )
                "
                onchange="
                  ubahJumlah(
                    ${item.id}
                  )
                "
              >
            </td>

          </tr>
        `;
      })
      .join('');

  renderPaginationBarang();
  updateSummary();
}


// =====================================================
// PAGINATION
// =====================================================

function renderPaginationBarang() {
  const container =
    document.getElementById(
      'paginationBarang'
    );

  if (!container) {
    return;
  }

  const totalHalaman =
    Math.ceil(
      daftarBarang.length /
      barangPerHalaman
    );

  if (
    totalHalaman <= 1
  ) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  html += `
    <button
      type="button"
      class="pagination-btn"
      onclick="
        gantiHalamanBarang(
          ${halamanBarang - 1}
        )
      "
      ${
        halamanBarang === 1
          ? 'disabled'
          : ''
      }
    >
      ‹
    </button>
  `;


  for (
    let i = 1;
    i <= totalHalaman;
    i++
  ) {
    html += `
      <button
        type="button"
        class="pagination-btn ${
          i === halamanBarang
            ? 'active'
            : ''
        }"
        onclick="
          gantiHalamanBarang(
            ${i}
          )
        "
      >
        ${i}
      </button>
    `;
  }


  html += `
    <button
      type="button"
      class="pagination-btn"
      onclick="
        gantiHalamanBarang(
          ${halamanBarang + 1}
        )
      "
      ${
        halamanBarang ===
        totalHalaman
          ? 'disabled'
          : ''
      }
    >
      ›
    </button>
  `;


  container.innerHTML = html;
}


function gantiHalamanBarang(
  halaman
) {
  const totalHalaman =
    Math.ceil(
      daftarBarang.length /
      barangPerHalaman
    );

  if (
    halaman < 1 ||
    halaman > totalHalaman
  ) {
    return;
  }

  halamanBarang =
    halaman;

  renderBarang();

  document
    .getElementById(
      'barangBody'
    )
    ?.closest(
      '.table-wrapper'
    )
    ?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
}


// =====================================================
// PILIH BARANG
// =====================================================

function toggleBarang(id) {
  id = Number(id);

  const checkbox =
    document.getElementById(
      `barang-${id}`
    );

  const jumlahInput =
    document.getElementById(
      `jumlah-${id}`
    );

  const barang =
    daftarBarang.find(
      item =>
        Number(item.id) === id
    );

  if (
    !checkbox ||
    !jumlahInput ||
    !barang
  ) {
    return;
  }


  if (checkbox.checked) {
    let jumlah =
      Number.parseInt(
        jumlahInput.value,
        10
      );

    if (
      !Number.isInteger(jumlah) ||
      jumlah < 1
    ) {
      jumlah = 1;
    }

    const stok =
      Number(barang.stok) || 0;

    if (
      jumlah > stok
    ) {
      jumlah = stok;
    }

    barangTerpilih.set(
      id,
      {
        barang_id: id,
        jumlah,
        barang: {
          ...barang
        }
      }
    );

    jumlahInput.value =
      jumlah;

    jumlahInput.disabled =
      false;

    jumlahInput.focus();

  } else {

    barangTerpilih.delete(id);

    jumlahInput.value = 1;

    jumlahInput.disabled =
      true;
  }


  updateSummary();
}


function ubahJumlah(id) {
  id = Number(id);

  const input =
    document.getElementById(
      `jumlah-${id}`
    );

  const barang =
    daftarBarang.find(
      item =>
        Number(item.id) === id
    );

  if (
    !input ||
    !barang
  ) {
    return;
  }


  const stok =
    Number(barang.stok) || 0;


  let jumlah =
    Number.parseInt(
      input.value,
      10
    );


  if (
    !Number.isInteger(jumlah) ||
    jumlah < 1
  ) {
    jumlah = 1;
  }


  if (
    jumlah > stok
  ) {
    jumlah = stok;
  }


  input.value =
    jumlah;


  if (
    barangTerpilih.has(id)
  ) {
    barangTerpilih.set(
      id,
      {
        barang_id: id,
        jumlah,
        barang: {
          ...barang
        }
      }
    );
  }


  updateSummary();
}


// =====================================================
// AMBIL BARANG TERPILIH
// =====================================================

function getSelectedItems() {
  return Array.from(
    barangTerpilih.values()
  );
}


// =====================================================
// RINGKASAN
// =====================================================

function updateSummary() {
  const container =
    document.getElementById(
      'summaryContainer'
    );

  const jumlahJenis =
    document.getElementById(
      'jumlahJenis'
    );

  if (
    !container ||
    !jumlahJenis
  ) {
    return;
  }

  const selected =
    getSelectedItems();

  jumlahJenis.textContent =
    selected.length;


  if (
    selected.length === 0
  ) {
    container.innerHTML = `
      <div class="summary-empty">
        Belum ada barang yang dipilih.
      </div>
    `;

    return;
  }


  container.innerHTML =
    selected
      .map(item => `
        <div class="summary-item">

          <div>
            <strong>
              ${escapeHtml(
                item.barang.nama
              )}
            </strong>

            <div class="small">
              ${escapeHtml(
                item.barang.kode
              )}
            </div>
          </div>

          <div>
            ${item.jumlah}
            ${escapeHtml(
              item.barang.satuan
            )}
          </div>

        </div>
      `)
      .join('');
}


// =====================================================
// VALIDASI FORM
// =====================================================

function validasiForm() {
  sembunyikanError();

  const nama =
    document
      .getElementById(
        'nama'
      )
      .value
      .trim();

  const bidang =
    document
      .getElementById(
        'bidang'
      )
      .value
      .trim();

  const keperluan =
    document
      .getElementById(
        'keperluan'
      )
      .value
      .trim();

  const items =
    getSelectedItems();


  if (
    !nama ||
    !bidang
  ) {
    tampilkanError(
      'Nama dan bidang wajib diisi.'
    );

    return null;
  }


  if (
    items.length === 0
  ) {
    tampilkanError(
      'Pilih minimal satu barang ATK.'
    );

    return null;
  }


  for (
    const item of items
  ) {
    const stok =
      Number(
        item.barang.stok
      );

    if (
      item.jumlah > stok
    ) {
      tampilkanError(
        `Jumlah ${item.barang.nama} melebihi stok tersedia.`
      );

      return null;
    }
  }


  return {
    nama,
    bidang,
    keperluan,
    items:
      items.map(
        item => ({
          barang_id:
            item.barang_id,

          jumlah:
            item.jumlah
        })
      )
  };
}


// =====================================================
// KIRIM PERMINTAAN
// =====================================================

async function kirimPermintaan(
  event
) {
  event.preventDefault();

  const data =
    validasiForm();

  if (!data) {
    return;
  }

  const button =
    document.getElementById(
      'btnSubmit'
    );

  button.disabled = true;
  button.textContent =
    'Mengirim...';


  try {
    const response =
      await fetch(
        '/api/peminjaman',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(data)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal mengirim permintaan.'
      );
    }


    sembunyikanError();


    document
      .getElementById(
        'registrationNumber'
      )
      .textContent =
        result.nomor_pinjam || '-';


    document
      .getElementById(
        'successModal'
      )
      .classList
      .add('active');


  } catch (error) {
    tampilkanError(
      error.message
    );

  } finally {
    button.disabled = false;

    button.textContent =
      'Kirim Permintaan';
  }
}


// =====================================================
// SELESAI
// =====================================================

function selesaiPermintaan() {
  document
    .getElementById(
      'successModal'
    )
    .classList
    .remove('active');

  barangTerpilih.clear();


  document
    .getElementById(
      'formPermintaan'
    )
    .reset();





  halamanBarang = 1;

  updateSummary();

  loadBarang();
}


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const form =
      document.getElementById(
        'formPermintaan'
      );

    const searchBarang =
      document.getElementById(
        'searchBarang'
      );


    if (form) {
      form.addEventListener(
        'submit',
        kirimPermintaan
      );
    }


    if (searchBarang) {
      searchBarang.addEventListener(
        'input',
        () => {

          clearTimeout(
            searchTimer
          );


          searchTimer =
            setTimeout(
              () => {

                halamanBarang = 1;

                loadBarang(
                  searchBarang
                    .value
                    .trim()
                );

              },
              300
            );

        }
      );
    }


    loadBarang();
    updateSummary();

  }
);