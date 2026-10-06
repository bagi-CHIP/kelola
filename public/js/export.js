// =====================================================
// EXPORT / BACKUP DATA BARANG KE CSV
// =====================================================

function escapeCSV(value) {
  const text = String(value ?? '');

  // Jika mengandung koma, tanda kutip,
  // atau baris baru, bungkus dengan quote.
  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}


// =====================================================
// FORMAT TANGGAL FILE
// =====================================================

function formatTanggalFile() {
  const now = new Date();

  const tahun =
    now.getFullYear();

  const bulan =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const tanggal =
    String(
      now.getDate()
    ).padStart(2, '0');

  const jam =
    String(
      now.getHours()
    ).padStart(2, '0');

  const menit =
    String(
      now.getMinutes()
    ).padStart(2, '0');

  return (
    `${tahun}-${bulan}-${tanggal}_` +
    `${jam}-${menit}`
  );
}


// =====================================================
// DOWNLOAD CSV
// =====================================================

function downloadCSV(
  csvContent,
  filename
) {
  // BOM UTF-8 supaya karakter Indonesia
  // terbaca dengan baik di Excel.
  const BOM = '\uFEFF';

  const blob =
    new Blob(
      [
        BOM,
        csvContent
      ],
      {
        type:
          'text/csv;charset=utf-8;'
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(url);
}


// =====================================================
// EXPORT STOK BARANG
// =====================================================

async function exportBarangCSV() {
  try {
    if (
      typeof tampilkanToast ===
      'function'
    ) {
      tampilkanToast(
        'Menyiapkan backup stok...'
      );
    }

    // Ambil SEMUA barang.
    // Tidak mengikuti pencarian pada tabel admin.
    const response =
      await fetch('/api/barang');

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

    if (data.length === 0) {
      throw new Error(
        'Belum ada data barang untuk diekspor.'
      );
    }


    // Header dibuat sama dengan format import.
    const rows = [
      [
        'kode',
        'nama',
        'satuan',
        'stok'
      ]
    ];


    data.forEach(
      item => {
        rows.push([
          item.kode,
          item.nama,
          item.satuan,
          Number(
            item.stok
          ) || 0
        ]);
      }
    );


    const csv =
      rows
        .map(
          row =>
            row
              .map(
                escapeCSV
              )
              .join(',')
        )
        .join('\r\n');


    const filename =
      'Backup_Stok_ATK_' +
      formatTanggalFile() +
      '.csv';


    downloadCSV(
      csv,
      filename
    );


    if (
      typeof tampilkanToast ===
      'function'
    ) {
      tampilkanToast(
        `${data.length} barang berhasil diekspor.`
      );
    }

  } catch (error) {
    console.error(
      'Export CSV gagal:',
      error
    );

    if (
      typeof tampilkanToast ===
      'function'
    ) {
      tampilkanToast(
        error.message,
        'error'
      );
    } else {
      alert(
        error.message
      );
    }
  }
}