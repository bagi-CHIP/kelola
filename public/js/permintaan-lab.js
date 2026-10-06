let daftarBarang = [];
let searchTimer = null;
let halamanBarang = 1;
const barangPerHalaman = 10;
const barangTerpilih = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function tampilkanError(message) {
  let errorBox = document.getElementById('errorBox');
  if (!errorBox) {
    errorBox = document.createElement('div');
    errorBox.id = 'errorBox';
    errorBox.className = 'error-box';
    const form = document.getElementById('formPermintaan');
    form.prepend(errorBox);
  }
  errorBox.textContent = message;
  errorBox.style.display = 'block';
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function sembunyikanError() {
  const errorBox = document.getElementById('errorBox');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }
}

// 1. Ambil Data Barang Lab
async function loadBarang(search = '') {
  const tbody = document.getElementById('barangBody');
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Memuat data barang lab...</td></tr>`;

  try {
    const response = await fetch('/api/lab/barang?search=' + encodeURIComponent(search));
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Gagal mengambil data barang lab.');
    }

    daftarBarang = Array.isArray(data) ? data : [];
    halamanBarang = 1;
    renderBarang();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row error">${escapeHtml(error.message)}</td></tr>`;
  }
}

// 2. Render Tabel Barang
function renderBarang() {
  const tbody = document.getElementById('barangBody');
  if (daftarBarang.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Tidak ada barang lab yang ditemukan.</td></tr>`;
    renderPaginationBarang();
    return;
  }

  const mulai = (halamanBarang - 1) * barangPerHalaman;
  const selesai = mulai + barangPerHalaman;
  const barangHalaman = daftarBarang.slice(mulai, selesai);

  tbody.innerHTML = barangHalaman.map(item => {
    const stok = Number(item.stok) || 0;
    const id = Number(item.id);
    const selected = barangTerpilih.get(id);
    const sudahDipilih = barangTerpilih.has(id);
    const jumlahDipilih = selected ? selected.jumlah : 1;
    const disabled = stok <= 0 ? 'disabled' : '';

    return `
      <tr>
        <td style="text-align: center;">
          <input
            type="checkbox"
            class="checkbox-atk"
            id="barang-${id}"
            data-id="${id}"
            ${sudahDipilih ? 'checked' : ''}
            onchange="toggleBarang(${id})"
            ${disabled}
          >
        </td>
        <td><code>${escapeHtml(item.kode)}</code></td>
        <td>${escapeHtml(item.nama)}</td>
        <td>${escapeHtml(item.satuan)}</td>
        <td><span class="badge ${stok <= 0 ? 'badge-danger' : 'badge-success'}">${stok}</span></td>
        <td>
          <input
            type="number"
            class="form-control"
            id="jumlah-${id}"
            min="1"
            max="${stok}"
            value="${jumlahDipilih}"
            ${sudahDipilih ? '' : 'disabled'}
            onchange="ubahJumlah(${id})"
            oninput="ubahJumlah(${id})"
            style="width: 70px;"
          >
        </td>
      </tr>
    `;
  }).join('');

  renderPaginationBarang();
}

// 3. Pagination
function renderPaginationBarang() {
  const container = document.getElementById('paginationBarang');
  const totalHalaman = Math.ceil(daftarBarang.length / barangPerHalaman);
  if (totalHalaman <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button type="button" class="btn-page" ${halamanBarang === 1 ? 'disabled' : ''} onclick="gantiHalamanBarang(${halamanBarang - 1})">&laquo; Prev</button>`;
  html += ` <span style="font-size: 13px; color: #64748b;">Hal ${halamanBarang} dari ${totalHalaman}</span> `;
  html += `<button type="button" class="btn-page" ${halamanBarang === totalHalaman ? 'disabled' : ''} onclick="gantiHalamanBarang(${halamanBarang + 1})">Next &raquo;</button>`;
  container.innerHTML = html;
}

function gantiHalamanBarang(halaman) {
  halamanBarang = halaman;
  renderBarang();
}

// 4. Pilih & Ubah Jumlah Barang (Sesuai form.js ATK)
function toggleBarang(id) {
  id = Number(id);
  const checkbox = document.getElementById(`barang-${id}`);
  const jumlahInput = document.getElementById(`jumlah-${id}`);
  const barang = daftarBarang.find(item => Number(item.id) === id);

  if (!checkbox || !jumlahInput || !barang) return;

  if (checkbox.checked) {
    let jumlah = Number.parseInt(jumlahInput.value, 10);
    const stok = Number(barang.stok) || 0;

    if (!Number.isInteger(jumlah) || jumlah < 1) jumlah = 1;
    if (jumlah > stok) jumlah = stok;

    barangTerpilih.set(id, {
      barang_id: id,
      jumlah,
      barang: { ...barang }
    });

    jumlahInput.value = jumlah;
    jumlahInput.disabled = false;
  } else {
    barangTerpilih.delete(id);
    jumlahInput.value = 1;
    jumlahInput.disabled = true;
  }

  updateSummary();
}

function ubahJumlah(id) {
  id = Number(id);
  const input = document.getElementById(`jumlah-${id}`);
  const barang = daftarBarang.find(item => Number(item.id) === id);

  if (!input || !barang) return;

  const stok = Number(barang.stok) || 0;
  let jumlah = Number.parseInt(input.value, 10);

  if (!Number.isInteger(jumlah) || jumlah < 1) jumlah = 1;
  if (jumlah > stok) jumlah = stok;

  input.value = jumlah;

  if (barangTerpilih.has(id)) {
    barangTerpilih.set(id, {
      barang_id: id,
      jumlah,
      barang: { ...barang }
    });
  }

  updateSummary();
}

// 5. Update Ringkasan Permintaan
function updateSummary() {
  const container = document.getElementById('summaryContainer');
  const jumlahJenis = document.getElementById('jumlahJenis');

  if (!container || !jumlahJenis) return;

  jumlahJenis.textContent = barangTerpilih.size;

  if (barangTerpilih.size === 0) {
    container.innerHTML = `<div class="summary-empty">Belum ada barang yang dipilih.</div>`;
    return;
  }

  container.innerHTML = Array.from(barangTerpilih.values()).map(item => `
    <div class="summary-item">
      <div>
        <div style="font-weight: 600;">${escapeHtml(item.barang.nama)}</div>
        <small style="color: #64748b;">${escapeHtml(item.barang.kode)}</small>
      </div>
      <div style="text-align: right;">
        <strong>${item.jumlah} ${escapeHtml(item.barang.satuan)}</strong>
      </div>
    </div>
  `).join('');
}

// 6. Submit Permintaan
async function kirimPermintaan(e) {
  e.preventDefault();
  sembunyikanError();

  const nama = document.getElementById('nama').value.trim();
  const bidang = document.getElementById('bidang').value.trim();
  const keperluan = document.getElementById('keperluan').value.trim();

  if (!nama || !bidang) {
    return tampilkanError('Nama dan Bidang wajib diisi.');
  }

  if (barangTerpilih.size === 0) {
    return tampilkanError('Silakan pilih minimal satu barang lab.');
  }

  const items = Array.from(barangTerpilih.values()).map(item => ({
    barang_id: item.barang_id,
    jumlah: item.jumlah
  }));

  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Mengirim...';

  try {
    const res = await fetch('/api/lab/peminjaman', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, bidang, keperluan, items })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim permintaan.');

    document.getElementById('registrationNumber').textContent = data.nomor_pinjam || '-';
    document.getElementById('successModal').classList.add('active');
  } catch (err) {
    tampilkanError(err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Kirim Permintaan';
  }
}

function selesaiPermintaan() {
  window.location.reload();
}

// Inisialisasi Event
document.addEventListener('DOMContentLoaded', () => {
  loadBarang();

  document.getElementById('formPermintaan').addEventListener('submit', kirimPermintaan);

  document.getElementById('searchBarang').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadBarang(e.target.value.trim());
    }, 400);
  });
});