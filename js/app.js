/* =========================================================
   Kolom Tanya Ustadz — Muslim Solo
   Pure JavaScript (tanpa framework)
   ========================================================= */

(function () {
  'use strict';

  /* ===============================================================
     1. KONFIGURASI — ubah bagian ini sesuai kebutuhan
     =============================================================== */

  // URL Web App Google Apps Script (akhiran /exec).
  // Ganti dengan URL hasil deploy Apps Script Anda.
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyxnsodMuegBW-aDGE1VOFkApBvSLq0vpge0OW5LQBjcvH67A8Tqy056t2Hjhb8US-UBg/exec';

  // Informasi kajian — cukup ubah nilai di sini.
  const INFO_KAJIAN = {
    tema: 'Meniti Jalan Keselamatan',
    pemateri: 'Ustadz Abu Farhan Furaihan',
    waktu: 'Sabtu, 6 Juni 2026 · 9.30 s.d. Selesai',
  };

  // Pengaturan lain
  const MAX_CHAR = 500;          // maksimal karakter pertanyaan
  const RATE_LIMIT_MS = 30000;   // jeda antar kirim (30 detik)
  const RATE_LIMIT_KEY = 'ktu_last_submit'; // key localStorage

  /* ===============================================================
     2. REFERENSI ELEMEN
     =============================================================== */
  const form          = document.getElementById('form-tanya');
  const textarea      = document.getElementById('pertanyaan');
  const charCount     = document.getElementById('char-count');
  const errorEl       = document.getElementById('error-pertanyaan');
  const honeypot      = document.getElementById('website');
  const btnSubmit     = document.getElementById('btn-submit');
  const btnText       = document.getElementById('btn-text');
  const btnSpinner    = document.getElementById('btn-spinner');
  const toastWrap     = document.getElementById('toast-container');

  /* ===============================================================
     3. INISIALISASI
     =============================================================== */
  function init() {
    // Isi informasi kajian
    setText('info-tema', INFO_KAJIAN.tema);
    setText('info-pemateri', INFO_KAJIAN.pemateri);
    setText('info-waktu', INFO_KAJIAN.waktu);

    // Tahun footer
    setText('year', new Date().getFullYear());

    // Counter karakter
    updateCounter();
    textarea.addEventListener('input', function () {
      updateCounter();
      clearError();
    });

    // Submit
    form.addEventListener('submit', handleSubmit);
  }

  /* ===============================================================
     4. COUNTER KARAKTER
     =============================================================== */
  function updateCounter() {
    const len = textarea.value.length;
    charCount.textContent = len;

    // Beri warna peringatan saat mendekati / mencapai batas
    charCount.parentElement.classList.remove('text-red-500', 'text-amber-500', 'text-brand-400');
    if (len >= MAX_CHAR) {
      charCount.parentElement.classList.add('text-red-500');
    } else if (len >= MAX_CHAR * 0.9) {
      charCount.parentElement.classList.add('text-amber-500');
    } else {
      charCount.parentElement.classList.add('text-brand-400');
    }
  }

  /* ===============================================================
     5. VALIDASI
     =============================================================== */
  function validate() {
    const val = textarea.value.trim();

    if (val.length === 0) {
      showError('Pertanyaan tidak boleh kosong.');
      return false;
    }
    if (val.length < 5) {
      showError('Pertanyaan terlalu pendek, mohon lebih jelas.');
      return false;
    }
    if (val.length > MAX_CHAR) {
      showError('Pertanyaan melebihi ' + MAX_CHAR + ' karakter.');
      return false;
    }
    clearError();
    return true;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    textarea.classList.add('border-red-400', 'focus:ring-red-500/15', 'animate-shake');
    textarea.classList.remove('border-brand-200');
    // hapus kelas shake setelah animasi selesai agar bisa diputar ulang
    setTimeout(function () {
      textarea.classList.remove('animate-shake');
    }, 450);
  }

  function clearError() {
    errorEl.textContent = '';
    textarea.classList.remove('border-red-400', 'focus:ring-red-500/15');
    textarea.classList.add('border-brand-200');
  }

  /* ===============================================================
     6. RATE LIMIT (localStorage)
     =============================================================== */
  function getRemainingCooldown() {
    const last = parseInt(localStorage.getItem(RATE_LIMIT_KEY) || '0', 10);
    if (!last) return 0;
    const elapsed = Date.now() - last;
    const remaining = RATE_LIMIT_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  function markSubmitted() {
    localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
  }

  /* ===============================================================
     7. HANDLE SUBMIT
     =============================================================== */
  async function handleSubmit(e) {
    e.preventDefault();

    // Honeypot: jika terisi, kemungkinan besar bot. Pura-pura sukses.
    if (honeypot && honeypot.value.trim() !== '') {
      showToast('success', 'Terima kasih', 'Pertanyaan Anda telah diterima.');
      form.reset();
      updateCounter();
      return;
    }

    // Validasi
    if (!validate()) return;

    // Rate limit
    const remaining = getRemainingCooldown();
    if (remaining > 0) {
      const detik = Math.ceil(remaining / 1000);
      showToast('error', 'Mohon tunggu', 'Anda baru saja mengirim. Coba lagi dalam ' + detik + ' detik.');
      return;
    }

    // Mulai proses kirim
    setLoading(true);

    const payload = {
      timestamp: new Date().toISOString(),
      pertanyaan: textarea.value.trim(),
    };

    try {
      await kirimData(payload);

      markSubmitted();
      form.reset();
      updateCounter();
      clearError();
      showToast('success', 'Berhasil terkirim', 'Pertanyaan Anda telah disampaikan. Jazakallahu khairan.');
    } catch (err) {
      console.error('Gagal mengirim:', err);
      showToast('error', 'Gagal mengirim', 'Terjadi kendala koneksi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  /* ===============================================================
     8. KIRIM DATA KE GOOGLE APPS SCRIPT
     =============================================================== */
  async function kirimData(payload) {
    // Body dikirim sebagai text/plain = "simple request" sehingga tidak
    // memicu preflight CORS. Tanpa 'no-cors', kita BISA membaca respons,
    // jadi sukses hanya ditampilkan bila server benar-benar membalas ok.
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    // Apps Script mengembalikan JSON, mis. { status: 'ok' }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Respons server tidak valid: ' + text.slice(0, 120));
    }

    if (data.status !== 'ok') {
      throw new Error(data.message || 'Server menolak data.');
    }
    return data;
  }

  /* ===============================================================
     9. LOADING STATE
     =============================================================== */
  function setLoading(isLoading) {
    btnSubmit.disabled = isLoading;
    textarea.disabled = isLoading;

    if (isLoading) {
      btnText.textContent = 'Mengirim...';
      btnSpinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Kirim Pertanyaan';
      btnSpinner.classList.add('hidden');
    }
  }

  /* ===============================================================
     10. TOAST
     =============================================================== */
  function showToast(type, title, message) {
    const isSuccess = type === 'success';

    const toast = document.createElement('div');
    toast.className =
      'toast animate-pop flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-xl ring-1 ' +
      (isSuccess
        ? 'bg-brand-700 text-white ring-brand-900/20'
        : 'bg-red-600 text-white ring-red-900/20');

    const iconPath = isSuccess
      ? '<path d="M20 6 9 17l-5-5"/>'
      : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';

    toast.innerHTML =
      '<svg class="mt-0.5 h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg>' +
      '<div class="min-w-0 flex-1">' +
        '<p class="text-sm font-bold">' + escapeHtml(title) + '</p>' +
        '<p class="mt-0.5 text-xs leading-snug opacity-90">' + escapeHtml(message) + '</p>' +
      '</div>';

    toastWrap.appendChild(toast);

    // Trigger transisi masuk
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('toast-show');
      });
    });

    // Auto dismiss
    setTimeout(function () {
      toast.classList.remove('toast-show');
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 4000);
  }

  /* ===============================================================
     11. UTILITAS
     =============================================================== */
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ===============================================================
     JALANKAN
     =============================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
