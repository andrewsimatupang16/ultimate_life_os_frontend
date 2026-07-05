# Menjalankan Frontend

Jalankan dari folder frontend:

```bash
cp .env.example .env
npm install
npm run dev
```

Jika ingin cek build produksi:

```bash
npm run build
npm run preview
```

Catatan:
- Gunakan `npm install` dulu agar `package-lock.json` diperbarui sesuai toolchain stabil.
- Jika install masih menarik dependency lama dari Vite 8, hapus `package-lock.json` dan `node_modules`, lalu jalankan `npm install` ulang.
- Toolchain frontend sudah diturunkan ke Vite 5, React plugin 4, dan TypeScript 5.6 agar tidak menarik dependency bermasalah dari Vite 8.
- Untuk local dev, gunakan `VITE_API_URL=http://localhost:8000` atau kosongkan nilainya. Frontend akan memanggil FastAPI langsung ke `http://localhost:8000`. Gunakan `VITE_USE_API_PROXY=true` hanya jika ingin memakai proxy Vite `/api -> http://localhost:8000`.
