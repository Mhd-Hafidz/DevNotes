# 🗂️ DevNotes

<p align="center">
  <b>DevNotes adalah website **manajemen proyek pribadi** yang dirancang untuk membantu developer dalam mengelola proyek, mencatat informasi penting, memantau progres, mengatur milestone, serta menyimpan berbagai catatan yang berkaitan dengan proses pengembangan.</b>
</p>

<p align="center"> <b>Website ini memiliki tampilan yang **minimalis, modern, responsif, dan nyaman digunakan**, dengan fokus pada pengalaman pengguna yang sederhana dan terorganisir.</b> </p>

<p align="center">
  Organize projects · Track progress · Manage milestones · Stay productive
</p>

---

## 🌐 Live Demo

DevNotes telah berhasil di-deploy dan dapat diakses melalui:

**🚀 ****[Kunjungi DevNotes](MASUKKAN-LINK-WEBSITE-KAMU-DI-SINI)**

> https://devnotes-ashen.vercel.app/ 

---

## 📖 Tentang DevNotes

**DevNotes** adalah website manajemen proyek yang dirancang untuk membantu developer mengatur dan memantau berbagai proyek dalam satu workspace.

Aplikasi ini memungkinkan pengguna untuk mengelola proyek, memantau progres, mengatur milestone, mencatat aktivitas, mengelola kalender, menyimpan file, serta menyesuaikan pengaturan aplikasi.

DevNotes dibuat dengan konsep antarmuka yang **modern, clean, minimalis, responsif, dan mudah digunakan**.

---

## ✨ Fitur Utama

### 🔐 Authentication

DevNotes menyediakan sistem autentikasi yang terdiri dari:

* Sign In
* Sign Up
* Forgot Password
* Reset Password
* Password visibility toggle
* Password validation
* Remember Me
* Continue with Google

---

### 📊 Dashboard

Dashboard menampilkan ringkasan informasi proyek, seperti:

* Total Projects
* Overall Progress
* Upcoming Deadlines
* Completed Milestones
* Daftar proyek
* Aktivitas terbaru
* Informasi progres proyek

---

### 📁 Project Management

Pengguna dapat mengelola berbagai proyek dalam satu aplikasi.

Fitur yang tersedia:

* Menambahkan proyek baru
* Mengedit proyek
* Menghapus proyek
* Melihat detail proyek
* Menentukan kategori proyek
* Menentukan prioritas
* Mengatur deadline
* Memantau progress
* Menambahkan feature notes
* Menambahkan gambar atau desain proyek

Status proyek dapat berupa:

* Planning
* In Progress
* Review
* Completed
* Archived

---

### 🎯 Milestones

Fitur Milestones membantu pengguna membagi proyek menjadi beberapa target atau tahapan.

Setiap milestone dapat memiliki:

* Judul milestone
* Deskripsi
* Proyek terkait
* Progress
* Deadline
* Status

---

### 📅 Calendar

Calendar digunakan untuk membantu pengguna mengatur aktivitas dan jadwal proyek.

Fitur ini dapat digunakan untuk:

* Mengatur agenda
* Menentukan deadline
* Memantau jadwal
* Melihat event
* Mengatur aktivitas proyek

---

### 📂 File Management

DevNotes menyediakan fitur pengelolaan file untuk membantu mengorganisir file yang berkaitan dengan proyek.

Jenis file yang dapat dikelola antara lain:

* Image
* PDF
* DOCX
* XLSX
* PPTX
* ZIP
* TXT

---

### 🔔 Notifications

Sistem notifikasi digunakan untuk memberikan informasi terkait aktivitas aplikasi.

Pengaturan notifikasi meliputi:

* Email notifications
* Browser notifications
* Project notifications
* Milestone notifications
* Calendar notifications
* File notifications
* Comments notifications
* Quiet hours

---

### 👤 Account Settings

Pengguna dapat mengatur informasi akun, seperti:

* Full Name
* Email
* Job Title
* Company
* Bio
* Profile picture
* Password

---

### 🎨 Appearance Settings

DevNotes mendukung beberapa pengaturan tampilan, seperti:

* Light mode
* Dark mode
* Accent color
* Sidebar style
* Compact mode
* Font size

Pilihan accent color:

* 🔵 Blue
* 🟢 Green
* 🟣 Purple
* 🟠 Orange
* 🔴 Red

---

### 🌐 Language Settings

Aplikasi mendukung pengaturan bahasa dan format tampilan, termasuk:

* Bahasa Indonesia
* Date format
* Time format

---

## 🛠️ Teknologi yang Digunakan

| Teknologi                | Kegunaan                           |
| ------------------------ | ---------------------------------- |
| HTML5                    | Struktur website                   |
| CSS3                     | Styling dan responsive layout      |
| JavaScript               | Logika dan interaktivitas aplikasi |
| Local Storage            | Penyimpanan data di browser        |
| Google Identity Services | Fitur Continue with Google         |
| Material Design Icons    | Icon interface                     |

---

## 📂 Struktur Project

```text
DevNotes/
│
├── index.html       # Struktur utama aplikasi
├── style.css        # Styling dan responsive design
├── script.js        # Logika dan interaktivitas aplikasi
└── README.md        # Dokumentasi project
```

---

## 💾 Data Storage

DevNotes menggunakan **Browser Local Storage** untuk menyimpan data aplikasi.

Beberapa data yang disimpan meliputi:

* Profile pengguna
* Account
* Projects
* Milestones
* Files
* Calendar events
* Activity
* Notifications
* Appearance settings
* Language settings

> Data tersimpan secara lokal di browser pengguna. Menghapus browser storage dapat menyebabkan data aplikasi terhapus.

---

## 🔑 Google Sign-In

Project ini menggunakan **Google Identity Services** untuk fitur:

```text
Continue with Google
```

Konfigurasi Google Client ID terdapat pada file:

```text
script.js
```

Contoh:

```javascript
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
```

Pastikan konfigurasi pada Google Cloud telah disesuaikan dengan domain website yang sudah di-deploy.

---

## 📱 Responsive Design

DevNotes dirancang agar dapat digunakan pada berbagai perangkat:

* 🖥️ Desktop
* 💻 Laptop
* 📱 Tablet
* 📱 Mobile

Tampilan antarmuka akan menyesuaikan ukuran layar agar tetap nyaman digunakan.

---

## 🔮 Pengembangan Selanjutnya

Beberapa fitur yang dapat dikembangkan pada DevNotes di masa mendatang:

* [ ] Backend integration
* [ ] Database integration
* [ ] Cloud synchronization
* [ ] Multi-user collaboration
* [ ] Real-time notifications
* [ ] Project sharing
* [ ] Advanced search
* [ ] Export project data
* [ ] Backup and restore
* [ ] File cloud storage
* [ ] Progressive Web App
* [ ] Mobile application

---

## ⚠️ Catatan

Versi saat ini menggunakan **Local Storage**, sehingga data bersifat lokal pada browser dan perangkat yang digunakan.

Untuk pengembangan skala produksi, aplikasi dapat dikembangkan menggunakan backend dan database, misalnya:

* PHP
* Node.js
* Laravel
* MySQL
* Firebase
* Supabase

---

## 👨‍💻 Developer

**Hafidz**

Frontend Developer & Junior Programmer

> *"Belajar pelan tidak masalah, yang penting terus naik level."*

---

## 📄 License

Project ini dibuat untuk keperluan pembelajaran, eksplorasi, dan pengembangan pribadi.

Silakan gunakan dan kembangkan project ini sesuai kebutuhan.

---

<p align="center">

Made with ❤️ by <b>Hafidz</b>

**© 2026 DevNotes. All Rights Reserved.**

</p>
