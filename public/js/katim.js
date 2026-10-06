document.addEventListener('DOMContentLoaded', () => {
  loadSemuaPermintaanKatim();
});

let currentId = null;
let currentItems = [];
let currentType = 'atk'; // 'atk' atau 'lab'

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

async function loadSemuaPermintaanKatim() {
  await Promise.all([
    loadPermintaanKatim(),
    fetchPermintaanLabKatim()
  ]);
}

// =====================================================
// 1. PERMINTAAN ATK
// =====================================================
async function loadPermintaanKatim() {
  const tbody = document.getElementById('listPermintaan');
  const countBadge = document.getElementById('countMenunggu');

  try {
    const response = await fetch('/api/katim/peminjaman');
    const data = await response.json();
    
    tbody.innerHTML = '';
    if (countBadge) countBadge.textContent = Array.isArray(data) ? data.length : 0;

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center; padding: 24px; color: #64748b;">Tidak ada permintaan ATK yang menunggu review.</td></tr>';
      return;
    }

    data.forEach(p => {
      const tr = document.createElement('tr');
      const itemsList = Array.isArray(p.items) ? p.items : [];
      
      const itemsHtml = itemsList.length > 0 
        ? itemsList.map(i => `<div class="item-chip"><strong>${escapeHtml(i.nama)}</strong>: ${i.jumlah} ${escapeHtml(i.satuan || '')}</div>`).join(' ')
        : '<span style="color:#94a3b8;">- Tidak ada item -</span>';

      tr.innerHTML = `
        <td><strong class="mono" style="color: #1e40af;">${escapeHtml(p.nomor_pinjam)}</strong></td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${escapeHtml(p.nama_peminjam)}</div>
          <span class="badge-info">${escapeHtml(p.bidang)}</span>
          ${p.keperluan ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">"${escapeHtml(p.keperluan)}"</div>` : ''}
        </td>
        <td>${itemsHtml}</td>
        <td style="text-align: center;">
          <button onclick='bukaModalKatim(${p.id}, "${escapeHtml(p.nama_peminjam)}", ${JSON.stringify(itemsList).replace(/'/g, "&apos;")}, "atk")' class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;">
            Review
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Gagal memuat permintaan ATK Katim:', err);
    tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center; padding:24px; color:#ef4444;">Gagal memuat data ATK.</td></tr>';
  }
}

// =====================================================
// 2. PERMINTAAN LAB
// =====================================================
async function fetchPermintaanLabKatim() {
  const tbody = document.getElementById('listPermintaanLabKatim');
  const countBadge = document.getElementById('countMenungguLab');
  if (!tbody) return;

  try {
    const resp = await fetch('/api/katim/lab/peminjaman');
    const data = await resp.json();

    tbody.innerHTML = '';
    if (countBadge) countBadge.textContent = Array.isArray(data) ? data.length : 0;

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center; padding: 24px; color: #64748b;">Tidak ada permintaan Lab yang menunggu review.</td></tr>';
      return;
    }

    data.forEach(p => {
      const tr = document.createElement('tr');
      const itemsList = Array.isArray(p.items) ? p.items : [];
      
      const itemsHtml = itemsList.length > 0 
        ? itemsList.map(i => `<div class="item-chip"><strong>${escapeHtml(i.nama)}</strong>: ${i.jumlah} ${escapeHtml(i.satuan || '')}</div>`).join(' ')
        : '<span style="color:#94a3b8;">- Tidak ada item -</span>';

      tr.innerHTML = `
        <td><strong class="mono" style="color: #047857;">${escapeHtml(p.nomor_pinjam)}</strong></td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${escapeHtml(p.nama_peminjam)}</div>
          <span class="badge-info">${escapeHtml(p.bidang)}</span>
          ${p.keperluan ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">"${escapeHtml(p.keperluan)}"</div>` : ''}
        </td>
        <td>${itemsHtml}</td>
        <td style="text-align: center;">
          <button onclick='bukaModalKatim(${p.id}, "${escapeHtml(p.nama_peminjam)}", ${JSON.stringify(itemsList).replace(/'/g, "&apos;")}, "lab")' class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;">
            Review
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Gagal memuat permintaan Lab Katim:', err);
    tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center; padding:24px; color:#ef4444;">Gagal memuat data Lab.</td></tr>';
  }
}

// =====================================================
// 3. MODAL REVIEW & VALIDASI
// =====================================================
function bukaModalKatim(id, namaPemohon, items, type = 'atk') {
  currentId = id;
  currentType = type;
  currentItems = JSON.parse(JSON.stringify(items));
  const modal = document.getElementById('modalKatim');
  const infoPemohon = document.getElementById('infoPemohon');
  const detailDiv = document.getElementById('detailPermintaan');
  
  infoPemohon.innerHTML = `Pemohon: <strong>${escapeHtml(namaPemohon)}</strong> (${type.toUpperCase()})`;
  detailDiv.innerHTML = '';

  currentItems.forEach((item, index) => {
    detailDiv.innerHTML += `
      <div class="item-edit-row">
        <div>
          <div style="font-weight: 600; color: #1e293b;">${escapeHtml(item.nama)}</div>
          <small style="color: #64748b;">Satuan: ${escapeHtml(item.satuan || 'pcs')}</small>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 12px; color: #64748b;">Jumlah:</label>
          <input type="number" value="${item.jumlah}" min="0" 
                 oninput="updateJumlahItem(${index}, this.value)" 
                 class="form-control" style="width: 75px; padding: 4px 8px; text-align: center; font-weight: bold;">
        </div>
      </div>
    `;
  });
  
  modal.style.display = 'flex';
}

function tutupModalKatim() {
  document.getElementById('modalKatim').style.display = 'none';
  document.getElementById('catatanKatim').value = '';
}

function updateJumlahItem(index, val) {
  currentItems[index].jumlah = parseInt(val, 10) || 0;
}

// =====================================================
// 4. PROSES PERSETUJUAN (KATIM)
// =====================================================
async function prosesKatim(status) {
  const catatan = document.getElementById('catatanKatim').value;
  
  if (!confirm(`Apakah Anda yakin ingin memproses permintaan ini dengan status: ${status}?`)) {
    return;
  }

  const endpoint = currentType === 'lab' 
    ? '/api/katim/lab/peminjaman/proses'
    : '/api/katim/peminjaman/proses';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentId,
        status: status,
        catatan: catatan,
        items: currentItems
      })
    });

    const result = await response.json();
    if (result.success) {
      alert(`Permintaan berhasil diproses (${status})`);
      tutupModalKatim();
      loadSemuaPermintaanKatim();
    } else {
      alert(result.error || 'Gagal memproses data.');
    }
  } catch (err) {
    console.error(err);
    alert('Gagal terhubung ke server.');
  }
}