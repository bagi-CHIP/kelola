// public/js/permintaan-lab.js
document.getElementById('formPermintaanLab').addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    kode_barang: document.getElementById('kodeLabBarang').value.trim(),
    nama_barang: document.getElementById('namaLabBarang').value.trim(),
    jumlah: Number(document.getElementById('jumlahLab').value),
    keterangan: document.getElementById('keteranganLab').value.trim(),
    // pastikan ada field yang menandakan jenis=lab (bisa otomatis dari server)
  };

  try {
    const resp = await fetch('/api/permintaan-lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (resp.ok) {
      alert('Permintaan berhasil dikirim!');
      e.target.reset();
    } else {
      alert('Gagal: ' + (data.error || resp.statusText));
    }
  } catch (err) {
    console.error(err);
    alert('Terjadi error jaringan');
  }
});