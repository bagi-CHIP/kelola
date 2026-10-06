let daftarPermintaan = [];
let daftarBarangAdmin = [];
let daftarLabBarangAdmin = [];
let detailPermintaanAktif = null;
let searchLabBarangTimer = null;
let searchPermintaanTimer = null;
let searchBarangTimer = null;
let toastTimer = null;




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


function formatTanggal(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatTanggalInput(date) {
  const tahun =
    date.getFullYear();

  const bulan =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const tanggal =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${tahun}-${bulan}-${tanggal}`;
}

function initFilterLaporan() {
  const sekarang =
    new Date();

  const tanggalHariIni =
    formatTanggalInput(sekarang);

  const bulanSekarang =
    sekarang.getMonth() + 1;

  const tahunSekarang =
    sekarang.getFullYear();


  const tanggal =
    document.getElementById(
      'tanggalLaporan'
    );

  const bulan =
    document.getElementById(
      'bulanLaporan'
    );

  const tahunBulanan =
    document.getElementById(
      'tahunBulanan'
    );

  const tahunLaporan =
    document.getElementById(
      'tahunLaporan'
    );


  if (tanggal) {
    tanggal.value =
      tanggalHariIni;
  }

  if (bulan) {
    bulan.value =
      String(bulanSekarang);
  }

  if (tahunBulanan) {
    tahunBulanan.value =
      tahunSekarang;
  }

  if (tahunLaporan) {
    tahunLaporan.value =
      tahunSekarang;
  }
}


function tampilkanToast(
  message,
  type = 'success'
) {
  const toast =
    document.getElementById('toast');

  if (!toast) {
    return;
  }

  toast.textContent = message;

  toast.className =
    'toast active ' +
    (
      type === 'error'
        ? 'toast-error'
        : 'toast-success'
    );

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3200);
}


// =====================================================
// TAB
// =====================================================

function switchTab(tab) {
  const tabPermintaan = document.getElementById('tabPermintaan');
  const tabPermintaanLab = document.getElementById('tabPermintaanLab');
  const tabBarang = document.getElementById('tabBarang');
  const tabLabBarang = document.getElementById('tabLabBarang');
  const tabLaporan = document.getElementById('tabLaporan');

  const btnPermintaan = document.getElementById('tabPermintaanBtn');
  const btnPermintaanLab = document.getElementById('tabPermintaanLabBtn');
  const btnBarang = document.getElementById('tabBarangBtn');
  const btnLabBarang = document.getElementById('tabLabBarangBtn');
  const btnLaporan = document.getElementById('tabLaporanBtn');

  // Reset semua class active
  [tabPermintaan, tabPermintaanLab, tabBarang, tabLabBarang, tabLaporan].forEach(el => {
    if (el) el.classList.remove('active');
  });
  [btnPermintaan, btnPermintaanLab, btnBarang, btnLabBarang, btnLaporan].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  // Aktifkan tab yang dipilih
  if (tab === 'permintaanLab') {
    if (tabPermintaanLab) tabPermintaanLab.classList.add('active');
    if (btnPermintaanLab) btnPermintaanLab.classList.add('active');
    if (typeof fetchPermintaanLab === 'function') fetchPermintaanLab();

  } else if (tab === 'barang') {
    if (tabBarang) tabBarang.classList.add('active');
    if (btnBarang) btnBarang.classList.add('active');
    loadBarangAdmin();

  } else if (tab === 'labBarang') {
    if (tabLabBarang) tabLabBarang.classList.add('active');
    if (btnLabBarang) btnLabBarang.classList.add('active');
    loadLabBarangAdmin();

  } else if (tab === 'laporan') {
    if (tabLaporan) tabLaporan.classList.add('active');
    if (btnLaporan) btnLaporan.classList.add('active');

  } else {
    // Default: Permintaan ATK
    if (tabPermintaan) tabPermintaan.classList.add('active');
    if (btnPermintaan) btnPermintaan.classList.add('active');
    loadPermintaan();
  }
}

async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    alert('Sesi Anda telah habis. Silakan login kembali.');
    window.location.href = '/login';
    return;
  }
  
  return response;
}

// =====================================================
// STATISTIK
// =====================================================

async function loadStatistik() {
  try {
    const response =
      await fetch('/api/admin/statistik');

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal mengambil statistik.'
      );
    }

    const data =
      result.data || {};

    document.getElementById(
      'statTotalBarang'
    ).textContent =
      data.total_barang ?? 0;

    document.getElementById(
      'statTotalStok'
    ).textContent =
      data.total_stok ?? 0;

    document.getElementById(
      'statPending'
    ).textContent =
      data.pending ?? 0;

    document.getElementById(
      'statDisetujui'
    ).textContent =
      data.disetujui ?? 0;

    document.getElementById(
      'statDitolak'
    ).textContent =
      data.ditolak ?? 0;

  } catch (error) {
    console.error(
      'Gagal mengambil statistik:',
      error
    );
  }
}


// =====================================================
// LOAD PERMINTAAN
// =====================================================

async function loadPermintaan() {
  const tbody =
    document.getElementById(
      'permintaanBody'
    );

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty">
        Memuat data permintaan...
      </td>
    </tr>
  `;

  try {
    const response =
      await fetch(
        '/api/admin/peminjaman'
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        'Gagal mengambil data permintaan.'
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        'Format data permintaan tidak valid.'
      );
    }

    daftarPermintaan = data;

    renderPermintaan();

  } catch (error) {
    console.error(
      'Load permintaan gagal:',
      error
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


function renderBarangPermintaan(item) {
  if (!Array.isArray(item.items) || item.items.length === 0) {
    return escapeHtml(item.item_list || '-');
  }

  return item.items.map(barang => {
    const nama = escapeHtml(barang.nama);
    const satuan = escapeHtml(barang.satuan);
    const diminta = escapeHtml(barang.jumlah_diminta);
    const disetujui = escapeHtml(barang.jumlah_disetujui ?? 0);

    return `
      <div class="barang-permintaan">
        <strong>${nama}</strong>
        <div class="small">
          Diminta: ${diminta} ${satuan}
        </div>
        ${
          item.status === 'Disetujui'
            ? `
              <div class="small">
                Disetujui: <strong>${disetujui} ${satuan}</strong>
              </div>
            `
            : ''
        }
      </div>
    `;
  }).join('<br>');
}


// =====================================================
// RENDER PERMINTAAN
// =====================================================

function renderPermintaan() {
  const keyword =
    document
      .getElementById(
        'searchPermintaan'
      )
      .value
      .trim()
      .toLowerCase();

  const status =
    document
      .getElementById(
        'filterStatus'
      )
      .value;

  const filtered =
    daftarPermintaan.filter(
      item => {
        const searchable = [
          item.nomor_pinjam,
          item.nama_peminjam,
          item.email,
          item.bidang,
          item.keperluan,
          item.item_list
        ]
          .join(' ')
          .toLowerCase();

        const cocokKeyword =
          !keyword ||
          searchable.includes(keyword);

          const cocokStatus =
          !status ||
          item.status === status ||
          (status === 'Ditolak' && item.status === 'Ditolak Katim');

        return (
          cocokKeyword &&
          cocokStatus
        );
      }
    );

  const tbody =
    document.getElementById(
      'permintaanBody'
    );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">
          Tidak ada data permintaan.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    filtered
      .map(item => {
        let badgeClass = 'badge-pending';
if (item.status === 'Disetujui') badgeClass = 'badge-disetujui';
if (item.status === 'Ditolak' || item.status === 'Ditolak Katim') badgeClass = 'badge-ditolak';
if (item.status === 'Disetujui Katim') badgeClass = 'badge-katim'; 
  

        return `
          <tr>

            <td>
              <div class="mono">
                ${escapeHtml(
                  item.nomor_pinjam
                )}
              </div>
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  item.nama_peminjam
                )}
              </strong>

              <span class="small">
                ${escapeHtml(
                  item.email
                )}
              </span>
            </td>

            <td>
  ${renderBarangPermintaan(item)}
</td>

            <td>
              ${escapeHtml(
                item.keperluan
              )}
            </td>

            <td>
              <span class="small">
                ${escapeHtml(
                  formatTanggal(
                    item.tanggal
                  )
                )}
              </span>
            </td>

            <td>
              <span
                class="
                  badge
                  ${badgeClass}
                "
              >
                ${escapeHtml(
                  item.status
                )}
              </span>
            </td>

            <td>
              <div class="action-buttons">

                <button
                  class="btn btn-outline"
                  onclick="
                    lihatDetail(
                      ${item.id}
                    )
                  "
                >
                  Detail
                </button>

               ${
                  item.status === 'Disetujui Katim'
                    ? `
                      <button
                        class="btn btn-success"
                        onclick="lihatDetail(${item.id})"
                      >
                        Proses
                      </button>

                      <button
                        class="btn btn-danger"
                        onclick="ubahStatus(${item.id}, 'Ditolak')"
                      >
                        Tolak
                      </button>
                    `
                    : (item.status === 'Menunggu Katim'
                        ? `<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Menunggu Katim</span>`
                        : ''
                      )
                }

                ${
                  item.status === 'Disetujui'
                    ? `
                      <button
                        class="btn btn-secondary"
                        onclick="
                          ubahStatus(
                            ${item.id},
                            'Pending'
                          )
                        "
                      >
                        Kembalikan Pending
                      </button>
                    `
                    : ''
                }

                ${
                  item.status === 'Ditolak'
                    ? `
                      <button
                        class="btn btn-secondary"
                        onclick="
                          ubahStatus(
                            ${item.id},
                            'Pending'
                          )
                        "
                      >
                        Jadikan Pending
                      </button>
                    `
                    : ''
                }

              </div>
            </td>

          </tr>
        `;
      })
      .join('');
}


// =====================================================
// UPDATE STATUS
// =====================================================

async function ubahStatus(
  id,
  status
) {
  if (
  status === 'Disetujui'
) {
  lihatDetail(id);
  return;
}
  let pesan =
    `Ubah status menjadi ${status}?`;

  if (
    status === 'Disetujui'
  ) {
    pesan =
      'Setujui permintaan ini? Stok barang akan dikurangi otomatis.';
  }

  if (
    status === 'Pending'
  ) {
    pesan =
      'Kembalikan permintaan menjadi Pending? Jika sebelumnya disetujui, stok akan dikembalikan.';
  }

  if (!confirm(pesan)) {
    return;
  }

  try {
    const response =
      await fetch(
        '/api/admin/peminjaman/status',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              id,
              status
            })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal mengubah status.'
      );
    }

    tampilkanToast(
      result.message ||
      'Status berhasil diperbarui.'
    );

    await Promise.all([
      loadPermintaan(),
      loadStatistik()
    ]);

  } catch (error) {
    tampilkanToast(
      error.message,
      'error'
    );
  }
}


// =====================================================
// DETAIL PERMINTAAN
// =====================================================

async function lihatDetail(id) {
  const modal =
    document.getElementById(
      'detailModal'
    );

  const body =
    document.getElementById(
      'detailModalBody'
    );

  detailPermintaanAktif = id;

  body.innerHTML =
    'Memuat detail...';

    modal.style.display = 'flex';
  modal.classList.add('active');

  try {
    const response =
      await fetch(
        `/api/admin/peminjaman/${id}`
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal mengambil detail.'
      );
    }

    const peminjaman =
      result.peminjaman;

    const items =
      Array.isArray(result.items)
        ? result.items
        : [];
     let badgeClass = 'badge-pending';

    if (peminjaman.status === 'Menunggu Katim') {
      badgeClass = 'badge-warning';
    } else if (peminjaman.status === 'Disetujui Katim') {
      badgeClass = 'badge-katim';
    } else if (peminjaman.status === 'Disetujui') {
      badgeClass = 'badge-disetujui';
    } else if (peminjaman.status === 'Ditolak' || peminjaman.status === 'Ditolak Katim') {
      badgeClass = 'badge-ditolak';
    }


    const bisaPersetujuan = 
  peminjaman.status === 'Pending' || 
  peminjaman.status === 'Disetujui' || 
  peminjaman.status === 'Disetujui Katim';


    body.innerHTML = `

      <div class="detail-grid">

        <div class="detail-box">

          <div class="detail-label">
            Nomor Permintaan
          </div>

          <div class="detail-value mono">
            ${escapeHtml(
              peminjaman.nomor_pinjam
            )}
          </div>

        </div>


        <div class="detail-box">

          <div class="detail-label">
            Status
          </div>

          <div class="detail-value">

            <span
              class="
                badge
                ${badgeClass}
              "
            >
              ${escapeHtml(
                peminjaman.status
              )}
            </span>

          </div>

        </div>


        <div class="detail-box">

          <div class="detail-label">
            Nama Pemohon
          </div>

          <div class="detail-value">
            ${escapeHtml(
              peminjaman.nama_peminjam
            )}
          </div>

        </div>


        <div class="detail-box">

          <div class="detail-label">
            Bidang / Unit
          </div>

          <div class="detail-value">
            ${escapeHtml(
              peminjaman.bidang
            )}
          </div>

        </div>


        <div class="detail-box">

          <div class="detail-label">
            Tanggal
          </div>

          <div class="detail-value">
            ${escapeHtml(
              formatTanggal(
                peminjaman.tanggal
              )
            )}
          </div>

        </div>

      </div>


      <div
        class="detail-box"
        style="margin-bottom: 18px;"
      >

        <div class="detail-label">
          Keperluan
        </div>

        <div class="detail-value">
          ${
            peminjaman.keperluan
              ? escapeHtml(
                  peminjaman.keperluan
                )
              : '-'
          }

                ${
        peminjaman.catatan_katim
          ? `
            <div class="detail-box" style="margin-bottom: 18px; border-left: 4px solid #f59e0b; background: #fffbeb;">
              <div class="detail-label" style="color: #b45309; font-weight: bold;">
                Catatan dari Ketua Tim (Katim)
              </div>
              <div class="detail-value" style="color: #92400e;">
                ${escapeHtml(peminjaman.catatan_katim)}
              </div>
            </div>
          `
          : ''
      }
        </div>

      </div>


      <h4
        style="margin-bottom: 6px;"
      >
        Barang yang Diminta
      </h4>


      ${
        bisaPersetujuan
          ? `
            <div
              style="
                margin-bottom: 12px;
                font-size: 13px;
                color: #64748b;
              "
            >
              Isi jumlah yang disetujui.
              Nilai <strong>0</strong>
              berarti barang tersebut tidak disetujui /
              tidak dikeluarkan.
            </div>
          `
          : ''
      }


      <div class="table-wrapper">

        <table
          style="min-width: 650px;"
        >

          <thead>

            <tr>
              <th>Kode</th>
              <th>Barang</th>
              <th>Satuan</th>
              <th>Permintaan</th>
              <th>Disetujui</th>
              <th>Stok Saat Ini</th>
            </tr>

          </thead>


          <tbody>

            ${
              items.length > 0
                ? items
                    .map(item => {

                      const jumlahPermintaan =
                        Number(
                          item.jumlah
                        ) || 0;

                    const jumlahDisetujui =
                    (peminjaman.status === 'Pending' || peminjaman.status === 'Disetujui Katim')
                      ? jumlahPermintaan
                      : Number(
                          item.jumlah_disetujui
                        ) || 0;

                      return `
                        <tr>

                          <td class="mono">
                            ${escapeHtml(
                              item.kode
                            )}
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
                            ${jumlahPermintaan}
                          </td>

                          <td>

                            ${
                              bisaPersetujuan
                                ? `
                                  <input
                                    type="number"

                                    class="
                                      form-control
                                      approval-input
                                    "

                                    data-detail-id="${
                                      item.id
                                    }"

                                    data-nama="${
                                      escapeHtml(
                                        item.nama
                                      )
                                    }"

                                    min="0"

                                    max="${
                                      jumlahPermintaan
                                    }"

                                    value="${
                                      jumlahDisetujui
                                    }"

                                    style="
                                      width: 90px;
                                    "
                                  >
                                `
                                : `
                                  ${
                                    Number(
                                      item.jumlah_disetujui
                                    ) || 0
                                  }
                                `
                            }

                          </td>

                          <td>
                            ${escapeHtml(
                              item.stok
                            )}
                          </td>

                        </tr>
                      `;
                    })
                    .join('')
                : `
                  <tr>

                    <td
                      colspan="6"
                      class="empty"
                    >
                      Tidak ada barang.
                    </td>

                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      ${
        bisaPersetujuan
          ? `
            <div
              style="
                margin-top: 18px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
              "
            >

              <button
                type="button"
                class="btn btn-success"
                onclick="
                  simpanPersetujuan(
                    ${peminjaman.id}
                  )
                "
              >
                Simpan Persetujuan
              </button>


              ${
                peminjaman.status ===
                'Pending'
                  ? `
                    <button
                      type="button"
                      class="btn btn-danger"
                      onclick="
                        ubahStatus(
                          ${peminjaman.id},
                          'Ditolak'
                        )
                      "
                    >
                      Tolak Semua
                    </button>
                  `
                  : ''
              }

            </div>
          `
          : ''
      }
    `;

  } catch (error) {

    body.innerHTML = `
      <div
        style="
          color: #b91c1c;
        "
      >
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}


function tutupModal() {
  const modal = document.getElementById('detailModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}


// =====================================================
// LOAD BARANG ADMIN
// =====================================================

async function loadBarangAdmin() {
  const keyword =
    document
      .getElementById(
        'searchBarangAdmin'
      )
      .value
      .trim();

  const tbody =
    document.getElementById(
      'barangAdminBody'
    );

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="empty">
        Memuat data barang...
      </td>
    </tr>
  `;

  try {
    const response =
      await fetch(
        '/api/barang?search=' +
        encodeURIComponent(keyword)
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        'Gagal mengambil data barang.'
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        'Format data barang tidak valid.'
      );
    }

    daftarBarangAdmin = data;

    renderBarangAdmin();

  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}

async function loadLabBarangAdmin() {
  const tbody = document.getElementById('labBarangAdminBody');
  if (!tbody) return;
  const searchInput = document.getElementById('searchLabBarangAdmin');
  const search = searchInput ? encodeURIComponent(searchInput.value.trim()) : '';
  try {
    const response = await fetch(`/api/lab/barang?search=${search}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Gagal mengambil data barang lab.');
    }
    daftarLabBarangAdmin = Array.isArray(data) ? data : [];
    renderLabBarangAdmin();
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">${escapeHtml(error.message)}</td>
      </tr>
    `;
  }
}


// =====================================================
// RENDER BARANG ADMIN
// =====================================================

function renderBarangAdmin() {
  const tbody =
    document.getElementById(
      'barangAdminBody'
    );

  if (
    daftarBarangAdmin.length === 0
  ) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          Barang tidak ditemukan.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    daftarBarangAdmin
      .map(item => `
        <tr>

          <td class="mono">
            ${escapeHtml(
              item.kode
            )}
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
            <input
              type="number"
              id="stok-${item.id}"
              class="form-control"
              style="width: 100px;"
              min="0"
              value="${
                Number(item.stok) || 0
              }"
            >
          </td>

          <td>

            <div class="action-buttons">

              <button
                class="btn btn-primary"
                onclick="
                  simpanStok(
                    ${item.id}
                  )
                "
              >
                Simpan Stok
              </button>


              <button
                class="btn btn-danger"
                data-id="${item.id}"
                data-nama="${
                  escapeHtml(
                    item.nama
                  )
                }"
                onclick="
                  hapusBarang(
                    this.dataset.id,
                    this.dataset.nama
                  )
                "
              >
                Hapus
              </button>

            </div>

          </td>

        </tr>
      `)
      .join('');
}

function renderLabBarangAdmin() {
  const tbody = document.getElementById('labBarangAdminBody');
  if (!tbody) return;
  if (daftarLabBarangAdmin.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">Barang lab tidak ditemukan.</td>
      </tr>
    `;
    return;
  }
  tbody.innerHTML = daftarLabBarangAdmin.map(item => `
    <tr>
      <td class="mono">${escapeHtml(item.kode)}</td>
      <td>${escapeHtml(item.nama)}</td>
      <td>${escapeHtml(item.satuan)}</td>
      <td>
        <input
          type="number"
          id="stok-lab-${item.id}"
          class="form-control"
          style="width: 100px;"
          min="0"
          value="${Number(item.stok) || 0}"
        />
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-primary" onclick="simpanStokLab(${item.id})">
            Simpan Stok
          </button>
          <button class="btn btn-danger" onclick="hapusBarangLab(${item.id}, '${escapeHtml(item.nama)}')">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}
// SEARCH FILTER DENGAN DEBOUNCE
function handleSearchLabBarang() {
  clearTimeout(searchLabBarangTimer);
  searchLabBarangTimer = setTimeout(() => {
    loadLabBarangAdmin();
  }, 300);
}
// TAMBAH BARANG LAB
async function tambahBarangLab(event) {
  event.preventDefault();
  const kode = document.getElementById('kodeLabBarang').value.trim();
  const nama = document.getElementById('namaLabBarang').value.trim();
  const satuan = document.getElementById('satuanLabBarang').value.trim();
  const stok = Number.parseInt(document.getElementById('stokLabBarang').value, 10);
  if (!kode || !nama || !satuan) {
    tampilkanToast('Kode, nama, dan satuan wajib diisi.', 'error');
    return;
  }
  const btn = document.getElementById('btnTambahLabBarang');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    const response = await fetch('/api/admin/lab/barang/tambah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kode, nama, satuan, stok })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Gagal menambahkan barang lab.');
    }
    tampilkanToast('Barang lab berhasil ditambahkan.', 'success');
    document.getElementById('formTambahLabBarang').reset();
    document.getElementById('stokLabBarang').value = 0;
    loadLabBarangAdmin();
  } catch (err) {
    tampilkanToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tambah Barang Lab';
  }
}


// =====================================================
// UPDATE STOK
// =====================================================

async function simpanStok(id) {
  const input =
    document.getElementById(
      `stok-${id}`
    );

  const stok =
    Number.parseInt(
      input.value,
      10
    );

  if (
    !Number.isInteger(stok) ||
    stok < 0
  ) {
    tampilkanToast(
      'Stok harus berupa angka 0 atau lebih.',
      'error'
    );

    return;
  }

  try {
    const response =
      await fetch(
        '/api/admin/barang/update-stok',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              id: Number(id),
              stok
            })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal memperbarui stok.'
      );
    }

    tampilkanToast(
      result.message ||
      'Stok berhasil diperbarui.'
    );

    await Promise.all([
      loadBarangAdmin(),
      loadStatistik()
    ]);

  } catch (error) {
    tampilkanToast(
      error.message,
      'error'
    );
  }
}



async function updateStokLab(id, stokBaru) {
  try {
    const resp = await fetch('/api/admin/lab/barang/update-stok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stok: stokBaru })
    });
    const json = await resp.json();
    if (json.success) {
      fetchLabBarang();
      refreshStatistik();
    } else {
      alert(json.error);
    }
  } catch (e) {
    console.error(e);
  }
}

async function simpanStokLab(id) {
  const input = document.getElementById(`stok-lab-${id}`);
  const stok = Number.parseInt(input.value, 10);
  if (!Number.isInteger(stok) || stok < 0) {
    tampilkanToast('Stok harus berupa angka 0 atau lebih.', 'error');
    return;
  }
  try {
    const response = await fetch('/api/admin/lab/barang/update-stok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), stok })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Gagal memperbarui stok.');
    }
    tampilkanToast('Stok barang lab berhasil diperbarui.', 'success');
    loadLabBarangAdmin();
  } catch (err) {
    tampilkanToast(err.message, 'error');
  }
}

// =====================================================
// TAMBAH BARANG
// =====================================================

async function tambahBarang(event) {
  event.preventDefault();

  const kode =
    document
      .getElementById(
        'kodeBarang'
      )
      .value
      .trim();

  const nama =
    document
      .getElementById(
        'namaBarang'
      )
      .value
      .trim();

  const satuan =
    document
      .getElementById(
        'satuanBarang'
      )
      .value
      .trim();

  const stok =
    Number.parseInt(
      document
        .getElementById(
          'stokBarang'
        )
        .value,
      10
    );

  if (
    !kode ||
    !nama ||
    !satuan
  ) {
    tampilkanToast(
      'Kode, nama, dan satuan wajib diisi.',
      'error'
    );

    return;
  }

  if (
    !Number.isInteger(stok) ||
    stok < 0
  ) {
    tampilkanToast(
      'Stok tidak valid.',
      'error'
    );

    return;
  }

  const button =
    document.getElementById(
      'btnTambahBarang'
    );

  button.disabled = true;
  button.textContent =
    'Menyimpan...';

  try {
    const response =
      await fetch(
        '/api/admin/barang/tambah',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              kode,
              nama,
              satuan,
              stok
            })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal menambahkan barang.'
      );
    }

    tampilkanToast(
      result.message ||
      'Barang berhasil ditambahkan.'
    );

    document
      .getElementById(
        'formTambahBarang'
      )
      .reset();

    document
      .getElementById(
        'stokBarang'
      )
      .value = 0;

    await Promise.all([
      loadBarangAdmin(),
      loadStatistik()
    ]);

  } catch (error) {
    tampilkanToast(
      error.message,
      'error'
    );

  } finally {
    button.disabled = false;

    button.textContent =
      'Tambah Barang';
  }
}


async function tambahBarangLab(event) {
  event.preventDefault();
  const kode = document.getElementById('kodeLabBarang').value.trim();
  const nama = document.getElementById('namaLabBarang').value.trim();
  const satuan = document.getElementById('satuanLabBarang').value.trim();
  const stok = Number.parseInt(document.getElementById('stokLabBarang').value, 10);
  if (!kode || !nama || !satuan) {
    tampilkanToast('Kode, nama, dan satuan wajib diisi.', 'error');
    return;
  }
  const btn = document.getElementById('btnTambahLabBarang');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    const response = await fetch('/api/admin/lab/barang/tambah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kode, nama, satuan, stok })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Gagal menambahkan barang lab.');
    }
    tampilkanToast('Barang lab berhasil ditambahkan.', 'success');
    document.getElementById('formTambahLabBarang').reset();
    document.getElementById('stokLabBarang').value = 0;
    loadLabBarangAdmin();
  } catch (err) {
    tampilkanToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tambah Barang Lab';
  }
}


// =====================================================
// HAPUS BARANG
// =====================================================

async function hapusBarang(
  id,
  nama
) {
  if (
    !confirm(
      `Hapus barang "${nama}"?`
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/admin/barang/${id}`,
        {
          method: 'DELETE'
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal menghapus barang.'
      );
    }

    tampilkanToast(
      result.message ||
      'Barang berhasil dihapus.'
    );

    await Promise.all([
      loadBarangAdmin(),
      loadStatistik()
    ]);

  } catch (error) {
    tampilkanToast(
      error.message,
      'error'
    );
  }
}

async function hapusBarangLab(id, nama) {
  const yakin = confirm(`Yakin ingin menghapus barang lab "${nama}"?`);
  if (!yakin) return;
  try {
    const response = await fetch(`/api/admin/lab/barang/${id}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Gagal menghapus barang lab.');
    }
    tampilkanToast('Barang lab berhasil dihapus.', 'success');
    loadLabBarangAdmin();
  } catch (err) {
    tampilkanToast(err.message, 'error');
  }
}


// =====================================================
// IMPORT CSV
// =====================================================

async function importBarang(event) {
  event.preventDefault();

  const input =
    document.getElementById(
      'importFile'
    );

  const button =
    document.getElementById(
      'btnImportBarang'
    );

  const resultBox =
    document.getElementById(
      'importResult'
    );


  // ---------------------------------------------
  // CEK FILE
  // ---------------------------------------------

  if (
    !input.files ||
    input.files.length === 0
  ) {
    tampilkanToast(
      'Silakan pilih file CSV terlebih dahulu.',
      'error'
    );

    return;
  }


  const file =
    input.files[0];


  if (
    !file.name
      .toLowerCase()
      .endsWith('.csv')
  ) {
    tampilkanToast(
      'File harus berformat CSV.',
      'error'
    );

    return;
  }


  const confirmImport =
    confirm(
      'Import data CSV sekarang?\n\n' +
      'Jika kode barang sudah ada, stok lama akan diganti dengan stok dari CSV.'
    );


  if (!confirmImport) {
    return;
  }


  const formData =
    new FormData();

  formData.append(
    'file',
    file
  );


  button.disabled = true;

  button.textContent =
    'Mengimpor...';


  resultBox.style.display =
    'block';

  resultBox.innerHTML = `
    <div
      style="
        padding: 12px;
        border-radius: 8px;
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
      "
    >
      Sedang mengimpor data...
    </div>
  `;


  try {

    const response =
      await fetch(
        '/api/admin/barang/import',
        {
          method: 'POST',
          body: formData
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      const detail =
        Array.isArray(
          result.errors
        )
          ? result.errors
          : [];


      let detailHtml = '';


      if (
        detail.length > 0
      ) {
        detailHtml = `
          <div
            style="
              margin-top: 10px;
              max-height: 220px;
              overflow-y: auto;
            "
          >

            <strong>
              Detail kesalahan:
            </strong>

            <ul
              style="
                margin-top: 8px;
                padding-left: 20px;
              "
            >

              ${
                detail
                  .slice(0, 20)
                  .map(item => `
                    <li>
                      Baris ${
                        escapeHtml(
                          item.baris ?? '-'
                        )
                      }:
                      ${
                        escapeHtml(
                          item.error
                        )
                      }
                    </li>
                  `)
                  .join('')
              }

            </ul>

          </div>
        `;
      }


      if (
        Array.isArray(
          result.duplicates
        ) &&
        result.duplicates.length > 0
      ) {
        detailHtml += `
          <div style="margin-top: 10px;">
            <strong>
              Kode duplikat:
            </strong>

            ${
              escapeHtml(
                result.duplicates.join(', ')
              )
            }
          </div>
        `;
      }


      resultBox.innerHTML = `
        <div
          style="
            padding: 12px;
            border-radius: 8px;
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
          "
        >

          <strong>
            Import gagal
          </strong>

          <div style="margin-top: 5px;">
            ${
              escapeHtml(
                result.error ||
                'Gagal mengimpor CSV.'
              )
            }
          </div>

          ${detailHtml}

        </div>
      `;


      throw new Error(
        result.error ||
        'Gagal mengimpor CSV.'
      );
    }


    // ---------------------------------------------
    // HASIL SUKSES
    // ---------------------------------------------

    const summary =
      result.summary || {};


    const gagal =
      Number(
        summary.gagal || 0
      );


    let errorList = '';


    if (
      Array.isArray(
        result.errors
      ) &&
      result.errors.length > 0
    ) {

      errorList = `
        <div
          style="
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #bbf7d0;
          "
        >

          <strong>
            Baris yang dilewati:
          </strong>

          <ul
            style="
              margin-top: 7px;
              padding-left: 20px;
            "
          >

            ${
              result.errors
                .slice(0, 20)
                .map(item => `
                  <li>
                    Baris ${
                      escapeHtml(
                        item.baris ?? '-'
                      )
                    }:
                    ${
                      escapeHtml(
                        item.error
                      )
                    }
                  </li>
                `)
                .join('')
            }

          </ul>

        </div>
      `;
    }


    resultBox.innerHTML = `
      <div
        style="
          padding: 14px;
          border-radius: 8px;
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        "
      >

        <strong>
          Import berhasil
        </strong>

        <div
          style="
            margin-top: 10px;
            line-height: 1.8;
          "
        >

          Total baris:
          <strong>
            ${
              Number(
                summary.total_baris || 0
              )
            }
          </strong>

          <br>

          Data valid:
          <strong>
            ${
              Number(
                summary.valid || 0
              )
            }
          </strong>

          <br>

          Barang baru:
          <strong>
            ${
              Number(
                summary.ditambahkan || 0
              )
            }
          </strong>

          <br>

          Barang diperbarui:
          <strong>
            ${
              Number(
                summary.diperbarui || 0
              )
            }
          </strong>

          <br>

          Gagal / dilewati:
          <strong>
            ${gagal}
          </strong>

        </div>

        ${errorList}

      </div>
    `;


    tampilkanToast(
      'Import CSV berhasil.'
    );


    // Kosongkan input setelah sukses
    input.value = '';


    // Refresh tabel barang dan statistik
    await Promise.all([
      loadBarangAdmin(),
      loadStatistik()
    ]);


  } catch (error) {

    console.error(
      'Import CSV gagal:',
      error
    );


    tampilkanToast(
      error.message,
      'error'
    );


  } finally {

    button.disabled = false;

    button.textContent =
      'Import CSV';
  }
}


// =====================================================
// REFRESH
// =====================================================

async function refreshSemua() {
  await Promise.all([
    loadStatistik(),
    loadPermintaan(),
    loadBarangAdmin()
  ]);

  tampilkanToast(
    'Data berhasil diperbarui.'
  );
}


// =====================================================
// EVENT LISTENER
// =====================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    const formTambahBarang =
      document.getElementById(
        'formTambahBarang'
      );

    const formImportBarang =
      document.getElementById(
        'formImportBarang'
      );

    const searchPermintaan =
      document.getElementById(
        'searchPermintaan'
      );

    const filterStatus =
      document.getElementById(
        'filterStatus'
      );

    const searchBarangAdmin =
      document.getElementById(
        'searchBarangAdmin'
      );

    const detailModal =
      document.getElementById(
        'detailModal'
      );


    if (formTambahBarang) {
      formTambahBarang.addEventListener(
        'submit',
        tambahBarang
      );
    }


    if (formImportBarang) {
      formImportBarang.addEventListener(
        'submit',
        importBarang
      );
    }


    if (searchPermintaan) {
      searchPermintaan.addEventListener(
        'input',
        () => {

          clearTimeout(
            searchPermintaanTimer
          );

          searchPermintaanTimer =
            setTimeout(
              renderPermintaan,
              250
            );
        }
      );
    }


    if (filterStatus) {
      filterStatus.addEventListener(
        'change',
        renderPermintaan
      );
    }


    if (searchBarangAdmin) {
      searchBarangAdmin.addEventListener(
        'input',
        () => {

          clearTimeout(
            searchBarangTimer
          );

          searchBarangTimer =
            setTimeout(
              loadBarangAdmin,
              300
            );
        }
      );
    }


    if (detailModal) {
      detailModal.addEventListener(
        'click',
        function(event) {

          if (
            event.target === this
          ) {
            tutupModal();
          }

        }
      );
    }

    initFilterLaporan();
    ubahJenisPeriode();

    await Promise.all([
      loadStatistik(),
      loadPermintaan()
    ]);

  }
);

async function simpanPersetujuan(id) {
  const inputs =
    document.querySelectorAll(
      '.approval-input'
    );

  if (
    inputs.length === 0
  ) {
    tampilkanToast(
      'Data barang tidak ditemukan.',
      'error'
    );

    return;
  }


  const items = [];

  let totalDisetujui = 0;


  for (
    const input of inputs
  ) {
    const detailId =
      Number.parseInt(
        input.dataset.detailId,
        10
      );

    const nama =
      input.dataset.nama ||
      'Barang';

    const max =
      Number.parseInt(
        input.max,
        10
      );

    const jumlahDisetujui =
      Number.parseInt(
        input.value,
        10
      );


    if (
      !Number.isInteger(
        jumlahDisetujui
      ) ||
      jumlahDisetujui < 0
    ) {
      tampilkanToast(
        `Jumlah disetujui untuk ${nama} tidak valid.`,
        'error'
      );

      input.focus();

      return;
    }


    if (
      jumlahDisetujui > max
    ) {
      tampilkanToast(
        `Jumlah disetujui untuk ${nama} tidak boleh melebihi ${max}.`,
        'error'
      );

      input.focus();

      return;
    }


    items.push({
      detail_id:
        detailId,

      jumlah_disetujui:
        jumlahDisetujui
    });


    totalDisetujui +=
      jumlahDisetujui;
  }


  if (
    totalDisetujui <= 0
  ) {
    tampilkanToast(
      'Minimal satu barang harus disetujui. Jika semua ditolak, gunakan tombol Tolak Semua.',
      'error'
    );

    return;
  }


  const yakin =
    confirm(
      'Simpan jumlah barang yang disetujui?\n\nStok akan diperbarui berdasarkan jumlah tersebut.'
    );


  if (!yakin) {
    return;
  }


  try {
    const response =
      await fetch(
        '/api/admin/peminjaman/status',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              id,
              status:
                'Disetujui',
              items
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal menyimpan persetujuan.'
      );
    }


    tampilkanToast(
      result.message ||
      'Persetujuan berhasil disimpan.'
    );


    tutupModal();


    await Promise.all([
      loadPermintaan(),
      loadStatistik(),
      loadBarangAdmin()
    ]);


  } catch (error) {

    tampilkanToast(
      error.message,
      'error'
    );

  }
}

function ubahJenisPeriode() {
  const jenis =
    document
      .getElementById(
        'jenisPeriode'
      )
      .value;


  const harian =
    document.getElementById(
      'periodeHarian'
    );

  const bulanan =
    document.getElementById(
      'periodeBulanan'
    );

  const tahunan =
    document.getElementById(
      'periodeTahunan'
    );


  harian.style.display =
    'none';

  bulanan.style.display =
    'none';

  tahunan.style.display =
    'none';


  if (jenis === 'bulanan') {
    bulanan.style.display =
      'grid';

  } else if (
    jenis === 'tahunan'
  ) {
    tahunan.style.display =
      'grid';

  } else {
    harian.style.display =
      'grid';
  }
}

function ambilFilterLaporan() {
  const jenisSurat =
    document
      .getElementById(
        'jenisSurat'
      )
      .value;

  const bidang =
    document
      .getElementById(
        'filterBidangLaporan'
      )
      .value;

  const jenisPeriode =
    document
      .getElementById(
        'jenisPeriode'
      )
      .value;


  let tanggalMulai = '';
  let tanggalSelesai = '';


  // ==========================================
  // HARIAN
  // ==========================================

  if (
    jenisPeriode === 'harian'
  ) {
    const tanggal =
      document
        .getElementById(
          'tanggalLaporan'
        )
        .value;


    if (!tanggal) {
      tampilkanToast(
        'Pilih tanggal laporan.',
        'error'
      );

      return null;
    }


    tanggalMulai =
      tanggal;

    tanggalSelesai =
      tanggal;
  }


  // ==========================================
  // BULANAN
  // ==========================================

  if (
    jenisPeriode === 'bulanan'
  ) {
    const bulan =
      Number(
        document
          .getElementById(
            'bulanLaporan'
          )
          .value
      );

    const tahun =
      Number(
        document
          .getElementById(
            'tahunBulanan'
          )
          .value
      );


    if (
      !tahun ||
      tahun < 2020 ||
      tahun > 2100
    ) {
      tampilkanToast(
        'Tahun laporan tidak valid.',
        'error'
      );

      return null;
    }


    const tanggalAwal =
      new Date(
        tahun,
        bulan - 1,
        1
      );

    const tanggalAkhir =
      new Date(
        tahun,
        bulan,
        0
      );


    tanggalMulai =
      formatTanggalInput(
        tanggalAwal
      );

    tanggalSelesai =
      formatTanggalInput(
        tanggalAkhir
      );
  }


  // ==========================================
  // TAHUNAN
  // ==========================================

  if (
    jenisPeriode === 'tahunan'
  ) {
    const tahun =
      Number(
        document
          .getElementById(
            'tahunLaporan'
          )
          .value
      );


    if (
      !tahun ||
      tahun < 2020 ||
      tahun > 2100
    ) {
      tampilkanToast(
        'Tahun laporan tidak valid.',
        'error'
      );

      return null;
    }


    tanggalMulai =
      `${tahun}-01-01`;

    tanggalSelesai =
      `${tahun}-12-31`;
  }


  return {
    jenisSurat,
    bidang,
    jenisPeriode,
    tanggalMulai,
    tanggalSelesai
  };
}

async function tampilkanLaporan() {
  const filter =
    ambilFilterLaporan();

  if (!filter) {
    return;
  }


  const container =
    document.getElementById(
      'laporanResult'
    );


  container.innerHTML = `
    <div class="empty">
      Memuat data laporan...
    </div>
  `;


  try {
    const params =
      new URLSearchParams({
        jenis:
          filter.jenisSurat,

        bidang:
          filter.bidang,

        tanggal_mulai:
          filter.tanggalMulai,

        tanggal_selesai:
          filter.tanggalSelesai
      });


    const response =
      await fetch(
        `/api/admin/laporan?${params.toString()}`
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        'Gagal mengambil laporan.'
      );
    }


    const data =
      Array.isArray(result.data)
        ? result.data
        : [];


    if (
      data.length === 0
    ) {
      container.innerHTML = `
        <div class="empty">
          Tidak ada data untuk filter tersebut.
        </div>
      `;

      return;
    }


    let nomor = 1;

    const rows = [];


    for (
      const permintaan of data
    ) {
      for (
        const item of permintaan.items
      ) {
        rows.push(`
          <tr>

            <td>
              ${nomor++}
            </td>

            <td class="mono">
              ${escapeHtml(
                item.kode
              )}
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
              ${
                Number(
                  item.jumlah
                ) || 0
              }
            </td>

            <td>
              ${
                Number(
                  item.jumlah_disetujui
                ) || 0
              }
            </td>

            <td>
              ${escapeHtml(
                permintaan.nama_peminjam
              )}
            </td>

            <td>
              ${escapeHtml(
                permintaan.bidang
              )}
            </td>

            <td>
              ${escapeHtml(
                formatTanggal(
                  permintaan.tanggal
                )
              )}
            </td>

            <td>
              ${escapeHtml(
                permintaan.status
              )}
            </td>

          </tr>
        `);
      }
    }


    container.innerHTML = `

      <div
        style="
          margin-bottom: 16px;
          padding: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        "
      >

        <strong>
          ${
            filter.jenisSurat ===
            'sbbk'
              ? 'Surat Bukti Barang Keluar'
              : 'Surat Permintaan Barang ATK'
          }
        </strong>

        <div
          style="
            margin-top: 6px;
            font-size: 13px;
            color: #64748b;
          "
        >
          Bidang:
          <strong>
            ${
              filter.bidang ||
              'Semua Bidang'
            }
          </strong>

          &nbsp; | &nbsp;

          Periode:
          <strong>
            ${
              escapeHtml(
                filter.tanggalMulai
              )
            }
            s.d.
            ${
              escapeHtml(
                filter.tanggalSelesai
              )
            }
          </strong>

          &nbsp; | &nbsp;

          Total Permintaan:
          <strong>
            ${
              Number(
                result.total_permintaan
              ) || 0
            }
          </strong>
        </div>

      </div>


      <div class="table-wrapper">

        <table>

          <thead>

            <tr>
              <th>No</th>
              <th>Kode</th>
              <th>Nama Barang</th>
              <th>Satuan</th>
              <th>Diminta</th>
              <th>Disetujui</th>
              <th>Pemohon</th>
              <th>Bidang</th>
              <th>Tanggal</th>
              <th>Status</th>
            </tr>

          </thead>


          <tbody>
            ${rows.join('')}
          </tbody>

        </table>

      </div>
    `;


  } catch (error) {

    container.innerHTML = `
      <div
        style="
          padding: 12px;
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        "
      >
        ${escapeHtml(
          error.message
        )}
      </div>
    `;


    tampilkanToast(
      error.message,
      'error'
    );
  }
}

async function fetchLabBarang() {
  try {
    const resp = await fetch('/api/lab/barang?search=' + encodeURIComponent(searchLab.value));
    const data = await resp.json();
    renderLabBarang(data);
  } catch (e) {
    console.error('Error fetch lab barang:', e);
  }
}

function cetakSurat() {
  const filter =
    ambilFilterLaporan();

  if (!filter) {
    return;
  }


  const params =
    new URLSearchParams({
      jenis:
        filter.jenisSurat,

      bidang:
        filter.bidang,

      tanggal_mulai:
        filter.tanggalMulai,

      tanggal_selesai:
        filter.tanggalSelesai
    });


  window.open(
    `/surat.html?${params.toString()}`,
    '_blank'
  );
}

function renderLabBarang(barang) {
  const tbody = document.getElementById('listLabBarang');
  tbody.innerHTML = '';
  if (barang.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty" style="text-align:center;padding:24px;">Tidak ada barang Lab.</td></tr>`;
    return;
  }
  barang.forEach(b => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${b.kode}</td>
        <td>${b.nama}</td>
        <td>${b.satuan}</td>
        <td>${b.stok}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="bukaModalEditLab(${b.id},'${b.kode}','${b.nama}','${b.satuan}',${b.stok})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="hapusBarangLab(${b.id})">Hapus</button>
        </td>
      </tr>
    `);
  });
}

function bukaModalTambahLab() {
  document.getElementById('modalTambahLab').style.display = 'flex';
  // reset fields
  document.getElementById('labKode').value = '';
  document.getElementById('labNama').value = '';
  document.getElementById('labSatuan').value = '';
  document.getElementById('labStok').value = 0;
}
function tutupModalTambahLab() {
  document.getElementById('modalTambahLab').style.display = 'none';
}
function bukaModalEditLab(id, kode, nama, satuan, stok) {
  // reuse modalTambahLab, set hidden id
  document.getElementById('modalTambahLab').style.display = 'flex';
  document.getElementById('labKode').value = kode;
  document.getElementById('labNama').value = nama;
  document.getElementById('labSatuan').value = satuan;
  document.getElementById('labStok').value = stok;
  // ganti aksi tombol simpan menjadi update
  const btn = document.querySelector('#modalTambahLab .btn-primary');
  btn.onclick = () => {
    // update barang lab
    updateStokLab(id, Number.parseInt(document.getElementById('labStok').value, 10));
    tutupModalTambahLab();
  };
}

function refreshSemua() {
  fetchBarang();          // ATK
  fetchLabBarang();       // LAB
  fetchPermintaan();      // ATK
  fetchPermintaanLab();   
  }// LAB

// ======================================================
// FETCH & RENDER PERMINTAAN LAB
// ======================================================
async function fetchPermintaanLab() {
  const tbody = document.getElementById('listPermintaanLab');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="empty" style="text-align:center;padding:24px;">
        Memuat data permintaan lab...
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/admin/lab/peminjaman');
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal memuat data permintaan lab.');

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty" style="text-align:center;padding:24px;">
            Tidak ada permintaan barang lab.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map(p => {
      let badgeClass = 'badge-warning';
      if (p.status === 'Disetujui') badgeClass = 'badge-success';
      if (p.status === 'Ditolak' || p.status === 'Ditolak Katim') badgeClass = 'badge-danger';
      if (p.status === 'Disetujui Katim') badgeClass = 'badge-info';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(p.nomor_pinjam)}</strong><br>
            <small style="color: #64748b;">${p.tanggal ? new Date(p.tanggal).toLocaleDateString('id-ID') : '-'}</small>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(p.nama_peminjam)}</div>
            <small style="color: #64748b;">${escapeHtml(p.bidang)}</small>
            ${p.keperluan ? `<div style="font-size:12px;color:#475569;margin-top:2px;">"${escapeHtml(p.keperluan)}"</div>` : ''}
          </td>
          <td>${renderBarangPermintaan(p)}</td>
          <td style="text-align:center;">
            <span class="badge ${badgeClass}">${escapeHtml(p.status)}</span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('fetchPermintaanLab error:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty" style="text-align:center;color:#ef4444;padding:24px;">
          ${escapeHtml(err.message)}
        </td>
      </tr>
    `;
  }
}