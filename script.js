/* ===================== DevNotes App Logic ===================== */
(function () {
    "use strict";
    const GOOGLE_CLIENT_ID = '235045322384-qlvl1qcl9mi2mi69dj93psdrjld228s1.apps.googleusercontent.com';

    /* ---------- Utilities ---------- */
    function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function esc(str) {
        if (str === undefined || str === null) return '';
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const DOW_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function fmtDate(dateStr, opts) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        const months = state.language.appLanguage === 'en' ? MONTHS_SHORT_ID.map((_, i) => MONTHS_EN[i].slice(0, 3)) : MONTHS_SHORT_ID;
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }
    /* Format tanggal+jam yang konsisten dengan gaya tanggal aplikasi (bukan hasil
       toLocaleString() mentah yang formatnya berubah-ubah tergantung locale/OS browser
       tiap pengguna — bisa "24/08/2026, 09.26.06" di satu perangkat dan "8/24/2026,
       9:26:06 AM" di perangkat lain). Dipakai untuk "Last login" dsb. */
    function fmtDateTime(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        const months = state.language.appLanguage === 'en' ? MONTHS_SHORT_ID.map((_, i) => MONTHS_EN[i].slice(0, 3)) : MONTHS_SHORT_ID;
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hh + ':' + mm;
    }
    function relTime(ts) {
        const diff = Math.max(0, Date.now() - ts);
        const isEn = state.language.appLanguage === 'en';
        const min = Math.floor(diff / 60000);
        if (min < 1) return isEn ? 'just now' : 'baru saja';
        if (min < 60) return isEn ? (min + ' minutes ago') : (min + ' menit yang lalu');
        const hr = Math.floor(min / 60);
        if (hr < 24) return isEn ? (hr + ' hours ago') : (hr + ' jam yang lalu');
        const day = Math.floor(hr / 24);
        return isEn ? (day + ' days ago') : (day + ' hari yang lalu');
    }
    function toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toast._h);
        toast._h = setTimeout(() => t.classList.remove('show'), 2600);
    }
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /* ---------- Storage wrapper (browser localStorage) ---------- */
    /* Catatan: window.storage hanya tersedia di dalam sandbox Claude.ai artifact.
       Untuk file mandiri (dibuka langsung / di-hosting sendiri) kita pakai
       localStorage bawaan browser supaya data tetap tersimpan. */
    async function sGet(key, def) {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
            return def;
        } catch (e) { return def; }
    }
    async function sSet(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch (e) { console.error('storage set failed', key, e); }
    }

    /* ---------- State ---------- */
    let state = {
        profile: null,
        appearance: null,
        language: null,
        notifications: null,
        projects: [],
        milestones: [],
        files: [],
        events: [],
        activity: [],
        vault: [],
        notifItems: null,
        accounts: []
    };

    const ACCENTS = {
        blue: { c: '#2563eb', soft: '#eff6ff' },
        green: { c: '#16a34a', soft: '#f0fdf4' },
        purple: { c: '#7c3aed', soft: '#f5f3ff' },
        orange: { c: '#d97706', soft: '#fffbeb' },
        red: { c: '#dc2626', soft: '#fef2f2' }
    };

    function defaultProfile() {
        return {
            fullName: "Akun Demo", email: 'demo123@gmail.com', jobTitle: 'Project Manager',
            company: 'DevNotes', bio: 'Passionate about building great products and managing projects efficiently.',
            avatar: null, memberSince: '2025-01-01', lastLogin: new Date().toISOString(),
            accountType: 'Demo Account', password: 'demo123', lastPasswordChange: new Date().toISOString()
        };
    }
    function defaultAppearance() {
        return { theme: 'light', accent: 'blue', sidebarStyle: 'light', compactMode: false, fontSize: 'medium' };
    }
    function defaultLanguage() {
        return { appLanguage: 'id', dateFormat: 'DD MMM YYYY', timeFormat: '24 Hours (14:30)' };
    }
    function defaultNotifications() {
        return {
            email: true, browser: true,
            types: { project: true, task: true, milestone: true, calendar: true, file: false, comments: true },
            quiet: { start: '22:00', end: '07:00', enabled: true }
        };
    }
    function defaultAccounts() {
        const p = defaultProfile();
        return [{ id: uid('acc'), fullName: p.fullName, email: p.email.toLowerCase(), password: p.password, createdAt: p.memberSince }];
    }

    function seedProjects() {
        const t = todayStr();
        return [
            { id: uid('proj'), name: 'Website Redesign', category: 'UI/UX Design', desc: 'Redesign tampilan website perusahaan agar lebih modern dan responsif.', progress: 75, status: 'In Progress', priority: 'High', deadline: '2026-08-12', image: null, features: ['Login dengan Google', 'Dashboard analytics', 'Dark mode'] },
            { id: uid('proj'), name: 'Mobile App Development', category: 'Development', desc: 'Pengembangan aplikasi mobile untuk platform iOS dan Android.', progress: 60, status: 'In Progress', priority: 'Medium', deadline: '2026-08-15', image: null, features: ['Push notification', 'Offline mode'] },
            { id: uid('proj'), name: 'Dashboard UI Kit', category: 'UI Design', desc: 'Membuat UI kit komponen dashboard yang reusable.', progress: 90, status: 'Review', priority: 'Low', deadline: '2026-08-18', image: null, features: ['Component library', 'Design tokens', 'Storybook docs', 'Dark mode'] },
            { id: uid('proj'), name: 'Brand Identity Design', category: 'Branding', desc: 'Membangun identitas brand baru termasuk logo dan panduan visual.', progress: 40, status: 'Planning', priority: 'Medium', deadline: '2026-08-21', image: null, features: ['Logo variations', 'Brand guideline'] },
            { id: uid('proj'), name: 'Cloud Storage System', category: 'Development', desc: 'Sistem penyimpanan cloud internal untuk seluruh tim.', progress: 30, status: 'Planning', priority: 'High', deadline: '2026-08-30', image: null, features: ['File versioning', 'Access control', 'Encryption at rest', 'Search indexing'] },
            { id: uid('proj'), name: 'Marketing Website', category: 'Web Design', desc: 'Landing page marketing untuk peluncuran produk baru.', progress: 100, status: 'Completed', priority: 'Low', deadline: '2026-07-05', image: null, features: ['SEO optimization', 'Blog integration'] }
        ];
    }
    function seedMilestones(projects) {
        const wr = projects.find(p => p.name === 'Website Redesign');
        const mob = projects.find(p => p.name === 'Mobile App Development');
        const cloud = projects.find(p => p.name === 'Cloud Storage System');
        return [
            { id: uid('ms'), title: 'UI/UX Design', desc: 'Membuat wireframe, prototype, dan desain UI final.', projectId: wr.id, progress: 100, deadline: '2026-07-02', status: 'Completed' },
            { id: uid('ms'), title: 'Development Phase 1', desc: 'Implementasi fitur inti dan komponen front-end.', projectId: wr.id, progress: 75, deadline: '2026-07-30', status: 'In Progress' },
            { id: uid('ms'), title: 'Testing & Bug Fixing', desc: 'Menguji seluruh fitur dan memperbaiki bug yang dilaporkan.', projectId: wr.id, progress: 40, deadline: '2026-08-05', status: 'In Progress' },
            { id: uid('ms'), title: 'Deployment', desc: 'Deploy project ke environment production.', projectId: wr.id, progress: 0, deadline: '2026-08-12', status: 'Pending' },
            { id: uid('ms'), title: 'Project Launch', desc: 'Meluncurkan secara resmi website hasil redesign.', projectId: wr.id, progress: 0, deadline: '2026-07-20', status: 'Overdue' },
            { id: uid('ms'), title: 'API Integration', desc: 'Menghubungkan aplikasi mobile ke backend API.', projectId: mob.id, progress: 55, deadline: '2026-08-10', status: 'In Progress' },
            { id: uid('ms'), title: 'Beta Release', desc: 'Merilis versi beta ke tester internal.', projectId: mob.id, progress: 0, deadline: '2026-08-25', status: 'Pending' },
            { id: uid('ms'), title: 'Security Audit', desc: 'Audit keamanan sistem penyimpanan cloud.', projectId: cloud.id, progress: 20, deadline: '2026-08-15', status: 'In Progress' }
        ];
    }
    function seedFiles(projects) {
        const byName = n => (projects.find(p => p.name === n) || {}).name || n;
        return [
            { id: uid('file'), name: 'UI_Design_Homepage.png', project: byName('Website Redesign'), type: 'Image', size: 1300000, uploadedBy: "Hafidz Sya'bani", date: '2026-07-02T10:30:00', archived: false, dataURL: null },
            { id: uid('file'), name: 'PRD_Document.pdf', project: byName('Mobile App Development'), type: 'PDF', size: 2250000, uploadedBy: "Hafidz Sya'bani", date: '2026-07-01T16:15:00', archived: false, dataURL: null },
            { id: uid('file'), name: 'Meeting_Notes.docx', project: byName('Website Redesign'), type: 'DOCX', size: 524000, uploadedBy: "Hafidz Sya'bani", date: '2026-06-12T09:45:00', archived: false, dataURL: null },
            { id: uid('file'), name: 'Design_Assets.zip', project: byName('Dashboard UI Kit'), type: 'ZIP', size: 19500000, uploadedBy: "Hafidz Sya'bani", date: '2026-06-10T11:20:00', archived: false, dataURL: null },
            { id: uid('file'), name: 'Budget_Overview.xlsx', project: byName('Cloud Storage System'), type: 'XLSX', size: 327000, uploadedBy: "Hafidz Sya'bani", date: '2026-06-08T14:30:00', archived: true, dataURL: null },
            { id: uid('file'), name: 'Presentation_Proposal.pptx', project: byName('Mobile App Development'), type: 'PPTX', size: 3620000, uploadedBy: "Hafidz Sya'bani", date: '2026-06-05T13:10:00', archived: false, dataURL: null },
            { id: uid('file'), name: 'Readme.txt', project: 'Project Management', type: 'TXT', size: 2048, uploadedBy: "Hafidz Sya'bani", date: '2026-06-01T08:00:00', archived: true, dataURL: null }
        ];
    }
    function seedVault(projects) {
        const wr = projects.find(p => p.name === 'Website Redesign');
        const mob = projects.find(p => p.name === 'Mobile App Development');
        const kit = projects.find(p => p.name === 'Dashboard UI Kit');
        const mk = (section, title, desc, category, extra) => ({
            id: uid('vault'), section, title, desc, category,
            url: null, projectId: null, image: null, tags: [],
            date: new Date().toISOString(), ...extra
        });
        return [
            mk('assets', 'Icon Set - Outline 24px', 'Kumpulan icon outline untuk dashboard & mobile app.', 'Icon', { projectId: kit ? kit.id : null, tags: ['icon', 'outline'] }),
            mk('assets', 'Color Palette - Brand Primary', 'Palet warna utama untuk identitas brand.', 'Color Palette', { tags: ['color', 'brand'] }),
            mk('resources', 'Panduan Desain Material Design 3', 'Referensi resmi untuk komponen & spacing.', 'Dokumentasi', { url: 'https://m3.material.io', projectId: kit ? kit.id : null, tags: ['design'] }),
            mk('resources', 'Tutorial Membuat REST API dengan Node.js', 'Video tutorial step-by-step backend API.', 'Video', { url: 'https://www.youtube.com', projectId: mob ? mob.id : null, tags: ['backend', 'node'] }),
            mk('bookmarks', wr ? wr.name : 'Website Redesign', 'Project prioritas kuartal ini, sering dicek progressnya.', 'Project', { projectId: wr ? wr.id : null }),
            mk('bookmarks', 'Catatan Rapat Kickoff Client', 'Poin-poin penting dari rapat kickoff dengan client.', 'Catatan Penting', {}),
            mk('repository', 'devnotes-frontend', 'Repository utama untuk kode frontend aplikasi.', 'Git Repository', { url: 'https://github.com/', projectId: wr ? wr.id : null, tags: ['git', 'frontend'] }),
            mk('repository', 'api-documentation', 'Dokumentasi lengkap endpoint backend API.', 'Dokumentasi', { url: 'https://github.com/', projectId: mob ? mob.id : null, tags: ['docs', 'api'] })
        ];
    }
    function seedNotifItems() {
        const now = Date.now();
        return [
            { id: uid('notif'), type: 'milestone', title: 'Milestone "UI/UX Design" telah selesai', time: now - 1000 * 60 * 12, read: false },
            { id: uid('notif'), type: 'file', title: 'File baru "UI_Design_Homepage.png" berhasil diupload', time: now - 1000 * 60 * 45, read: false },
            { id: uid('notif'), type: 'calendar', title: 'Meeting UI/UX akan dimulai 1 jam lagi', time: now - 1000 * 60 * 60 * 2, read: false },
            { id: uid('notif'), type: 'project', title: 'Project "Mobile App Development" mendekati deadline', time: now - 1000 * 60 * 60 * 5, read: false },
            { id: uid('notif'), type: 'comments', title: 'Komentar baru pada project "Dashboard UI Kit"', time: now - 1000 * 60 * 60 * 20, read: true },
            { id: uid('notif'), type: 'task', title: 'Task "Testing & Bug Fixing" perlu ditinjau ulang', time: now - 1000 * 60 * 60 * 30, read: true }
        ];
    }
    function seedEvents() {
        const now = new Date();
        const y = now.getFullYear(), m = now.getMonth();
        const d = (day, h, mi) => { const dd = new Date(y, m, day, h || 0, mi || 0); return dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0'); };
        return [
            { id: uid('evt'), title: 'Meeting UI/UX', date: d(2), time: '10:00', color: '#2563eb' },
            { id: uid('evt'), title: 'Review Design', date: d(4), time: '14:00', color: '#7c3aed' },
            { id: uid('evt'), title: 'Milestone 2 Deadline', date: d(10), time: '', color: '#d97706' },
            { id: uid('evt'), title: 'Client Meeting', date: d(12), time: '11:00', color: '#2563eb' },
            { id: uid('evt'), title: 'Update Progress', date: d(16), time: '09:30', color: '#16a34a' },
            { id: uid('evt'), title: 'Milestone 3 Deadline', date: d(18), time: '', color: '#d97706' },
            { id: uid('evt'), title: 'Testing Review', date: d(24), time: '13:00', color: '#7c3aed' },
            { id: uid('evt'), title: 'Report Update', date: d(27), time: '16:00', color: '#16a34a' }
        ];
    }

    /* ---------- Load / Init ---------- */
    async function loadAccountRegistry() {
        state.accounts = await sGet('devnotes:accounts', null);
        if (!state.accounts) { state.accounts = defaultAccounts(); await sSet('devnotes:accounts', state.accounts); }
    }

    /* Migrasi sekali-jalan: jika ada data lama dari sebelum sistem multi-akun ada
       (tersimpan di key global lama seperti 'devnotes:projects'), pindahkan data itu
       ke "kotak data" akun demo saja, supaya progres testing sebelumnya tidak hilang,
       dan akun-akun lain tetap mulai dari kosong. */
    async function migrateLegacyDataToAccount(account) {
        const already = await sGet(acctKey('migrated', account.id), null);
        if (already) return;
        if (account.email === DEMO_ACCOUNT_EMAIL) {
            const legacyProjects = await sGet('devnotes:projects', null);
            if (legacyProjects !== null) {
                await sSet(acctKey('projects', account.id), legacyProjects);
                await sSet(acctKey('milestones', account.id), await sGet('devnotes:milestones', []));
                await sSet(acctKey('files', account.id), await sGet('devnotes:files', []));
                await sSet(acctKey('events', account.id), await sGet('devnotes:events', []));
                await sSet(acctKey('vault', account.id), await sGet('devnotes:vault', []));
                await sSet(acctKey('notifItems', account.id), await sGet('devnotes:notifItems', []));
                await sSet(acctKey('activity', account.id), await sGet('devnotes:activity', []));
                await sSet(acctKey('appearance', account.id), await sGet('devnotes:appearance', defaultAppearance()));
                await sSet(acctKey('language', account.id), await sGet('devnotes:language', defaultLanguage()));
                await sSet(acctKey('notifications', account.id), await sGet('devnotes:notifications', defaultNotifications()));
                const legacyProfile = await sGet('devnotes:profile', null);
                if (legacyProfile) await sSet(acctKey('profile', account.id), legacyProfile);
            }
        }
        await sSet(acctKey('migrated', account.id), true);
    }

    /* Muat "kotak data" milik SATU akun tertentu ke dalam state. Dipanggil setiap kali
       ada yang login/daftar/ganti akun, supaya proyek/milestone/file/dll. akun lama
       tidak ikut terbawa ke akun yang baru login. */
    async function loadAccountData(account) {
        await migrateLegacyDataToAccount(account);
        const id = account.id;
        const isDemo = account.email === DEMO_ACCOUNT_EMAIL;

        state.profile = await sGet(acctKey('profile', id), null);
        if (!state.profile) {
            state.profile = Object.assign(defaultProfile(), {
                fullName: account.fullName, email: account.email, password: account.password,
                memberSince: account.createdAt || todayStr()
            });
            if (isDemo) {
                state.profile.accountType = 'Demo Account';
            } else {
                state.profile.jobTitle = ''; state.profile.company = ''; state.profile.bio = '';
                state.profile.avatar = account.avatar || null;
                // Login via Google dianggap akun Premium; daftar manual (email/password) tetap Free.
                state.profile.accountType = account.provider === 'google' ? 'Premium Account' : 'Demo Account';
            }
            await sSet(acctKey('profile', id), state.profile);
        } else {
            // Migrasi ringan: kalau profil ini sudah pernah dibuat sebelum aturan
            // "demo = Free, Google = Premium" ada, samakan accountType-nya sekarang juga.
            const correctType = isDemo ? 'Demo Account' : (account.provider === 'google' ? 'Premium Account' : state.profile.accountType);
            if (correctType && state.profile.accountType !== correctType) {
                state.profile.accountType = correctType;
                await sSet(acctKey('profile', id), state.profile);
            }
        }

        state.appearance = await sGet(acctKey('appearance', id), null);
        if (!state.appearance) { state.appearance = defaultAppearance(); await sSet(acctKey('appearance', id), state.appearance); }

        state.language = await sGet(acctKey('language', id), null);
        if (!state.language) { state.language = defaultLanguage(); await sSet(acctKey('language', id), state.language); }

        state.notifications = await sGet(acctKey('notifications', id), null);
        if (!state.notifications) { state.notifications = defaultNotifications(); await sSet(acctKey('notifications', id), state.notifications); }

        state.projects = await sGet(acctKey('projects', id), null);
        if (state.projects === null) { state.projects = isDemo ? seedProjects() : []; await sSet(acctKey('projects', id), state.projects); }

        state.milestones = await sGet(acctKey('milestones', id), null);
        if (state.milestones === null) { state.milestones = isDemo ? seedMilestones(state.projects) : []; await sSet(acctKey('milestones', id), state.milestones); }

        state.files = await sGet(acctKey('files', id), null);
        if (state.files === null) { state.files = isDemo ? seedFiles(state.projects) : []; await sSet(acctKey('files', id), state.files); }

        state.events = await sGet(acctKey('events', id), null);
        if (state.events === null) { state.events = isDemo ? seedEvents() : []; await sSet(acctKey('events', id), state.events); }

        state.vault = await sGet(acctKey('vault', id), null);
        if (state.vault === null) { state.vault = isDemo ? seedVault(state.projects) : []; await sSet(acctKey('vault', id), state.vault); }

        state.notifItems = await sGet(acctKey('notifItems', id), null);
        if (state.notifItems === null) { state.notifItems = isDemo ? seedNotifItems() : []; await sSet(acctKey('notifItems', id), state.notifItems); }

        state.activity = await sGet(acctKey('activity', id), null);
        if (state.activity === null) {
            state.activity = isDemo ? [
                { id: uid('act'), icon: '&#128196;', title: 'Anda mengupload file "UI_Design_Homepage.png"', time: Date.now() - 1000 * 60 * 2 },
                { id: uid('act'), icon: '&#9989;', title: 'Milestone "UI/UX Design" selesai', time: Date.now() - 1000 * 60 * 60 },
                { id: uid('act'), icon: '&#128197;', title: 'Meeting dengan Client hari ini pukul 10:00', time: Date.now() - 1000 * 60 * 60 * 3 }
            ] : [];
            await sSet(acctKey('activity', id), state.activity);
        }

        loggedInEmail = account.email;
        loggedInAccountId = account.id;
    }

    function addActivity(icon, title) {
        state.activity.unshift({ id: uid('act'), icon, title, time: Date.now() });
        state.activity = state.activity.slice(0, 25);
        sSet(acctKey('activity'), state.activity);
    }

    /* ---------- Save helpers (persist + refresh) ---------- */
    function saveProjects() { sSet(acctKey('projects'), state.projects); }
    function saveMilestones() { sSet(acctKey('milestones'), state.milestones); }
    function saveFiles() { sSet(acctKey('files'), state.files); }
    function saveEvents() { sSet(acctKey('events'), state.events); }
    function saveActivity() { sSet(acctKey('activity'), state.activity); }
    function saveVault() { sSet(acctKey('vault'), state.vault); }
    function saveNotifItems() { sSet(acctKey('notifItems'), state.notifItems); }
    function saveAccounts() { sSet('devnotes:accounts', state.accounts); }

    /* ================= I18N ================= */
    const NAV_LABELS = {
        id: { dashboard: 'Dashboard', projects: 'Projects', calendar: 'Calendar', milestones: 'Milestones', files: 'Files', settings: 'Settings' },
        en: { dashboard: 'Dashboard', projects: 'Projects', calendar: 'Calendar', milestones: 'Milestones', files: 'Files', settings: 'Settings' }
    };
    const PAGE_TEXT = {
        id: {
            dashboard_sub: "Mari wujudkan hal-hal hebat hari ini!",
            projects_title: 'Projects', projects_sub: 'Kelola dan lacak semua project anda.',
            calendar_title: 'Calendar', calendar_sub: 'Kelola jadwal, deadline, dan acara anda.',
            milestones_title: 'Milestones', milestones_sub: 'Lacak milestone dan capai target project anda.',
            files_title: 'Files', files_sub: 'Kelola dan atur semua file project anda.',
            settings_title: 'Settings', settings_sub: 'Kelola akun, preferensi, dan pengaturan aplikasi.',
            search_ph: 'Search ...', greet: ['Selamat Pagi', 'Selamat Siang', 'Selamat Malam']
        },
        en: {
            dashboard_sub: "Let's make great things happen today!",
            projects_title: 'Projects', projects_sub: 'Manage and track all your projects.',
            calendar_title: 'Calendar', calendar_sub: 'Manage your schedule, deadlines, and events.',
            milestones_title: 'Milestones', milestones_sub: 'Track milestones and achieve your project goals.',
            files_title: 'Files', files_sub: 'Manage and organize all your project files.',
            settings_title: 'Settings', settings_sub: 'Manage your account, preferences, and application settings.',
            search_ph: 'Search ...', greet: ['Good Morning', 'Good Afternoon', 'Good Evening']
        }
    };
    function applyLanguageToUI() {
        const lang = state.language.appLanguage === 'en' ? 'en' : 'id';
        document.querySelectorAll('.nav-item[data-nav]').forEach(el => {
            const key = el.getAttribute('data-nav');
            if (NAV_LABELS[lang][key]) {
                // last text node holds label
                const walker = el.childNodes;
                for (let i = walker.length - 1; i >= 0; i--) {
                    if (walker[i].nodeType === 3 && walker[i].textContent.trim().length) {
                        walker[i].textContent = ' ' + NAV_LABELS[lang][key];
                        break;
                    }
                }
            }
        });
        document.getElementById('global-search').placeholder = PAGE_TEXT[lang].search_ph;
        document.querySelector('#view-projects .page-header p').textContent = PAGE_TEXT[lang].projects_sub;
        document.querySelector('#view-projects .page-header h1').textContent = PAGE_TEXT[lang].projects_title;
        document.querySelector('#view-calendar .page-header p').textContent = PAGE_TEXT[lang].calendar_sub;
        document.querySelector('#view-calendar .page-header h1').textContent = PAGE_TEXT[lang].calendar_title;
        document.querySelector('#view-milestones .page-header p').textContent = PAGE_TEXT[lang].milestones_sub;
        document.querySelector('#view-milestones .page-header h1').textContent = PAGE_TEXT[lang].milestones_title;
        document.querySelector('#view-files .page-header p').textContent = PAGE_TEXT[lang].files_sub;
        document.querySelector('#view-files .page-header h1').textContent = PAGE_TEXT[lang].files_title;
        document.querySelector('#view-settings .page-header p').textContent = PAGE_TEXT[lang].settings_sub;
        document.querySelector('#view-settings .page-header h1').textContent = PAGE_TEXT[lang].settings_title;
        document.querySelector('#view-dashboard .page-header p').textContent = PAGE_TEXT[lang].dashboard_sub;
        renderGreeting();
    }
    function renderGreeting() {
        const lang = state.language.appLanguage === 'en' ? 'en' : 'id';
        const h = new Date().getHours();

        const g = h < 11
            ? PAGE_TEXT[lang].greet[0]
            : h < 15
                ? PAGE_TEXT[lang].greet[1]
                : PAGE_TEXT[lang].greet[2];

        document.getElementById('dash-greeting').innerHTML =
            `${g},
        <span id="dash-name">${esc(state.profile.fullName)}</span>
        <span class="mdi mdi-hand-wave-outline wave-icon"></span>`;
    }

    /* ================= MOBILE SIDEBAR (hamburger) ================= */
    function openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
        document.getElementById('hamburger-btn').classList.add('active');
        document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'true');
        document.body.classList.add('sidebar-locked');
    }

    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
        document.getElementById('hamburger-btn').classList.remove('active');
        document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'false');
        document.body.classList.remove('sidebar-locked');
    }

    function toggleSidebar() {
        if (document.getElementById('sidebar').classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    /* ================= NAVIGATION ================= */
    function navigate(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + view);
        if (target) {
            void target.offsetWidth; // paksa reflow supaya animasi transisi section selalu terulang, termasuk saat klik berulang ke section yang sama
            target.classList.add('active');
        }
        document.querySelectorAll('.nav-item[data-nav]').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-nav') === view);
        });
        closeSidebar();
        if (view === 'dashboard') renderDashboard();
        if (view === 'projects') renderProjects();
        if (view === 'calendar') renderCalendar();
        if (view === 'milestones') renderMilestones();
        if (view === 'files') renderFiles();
        if (view === 'assets') renderAssets();
        if (view === 'resources') renderResources();
        if (view === 'bookmarks') renderBookmarks();
        if (view === 'repository') renderRepository();
        if (view === 'settings') renderSettingsAll();
        window.scrollTo(0, 0);
    }

    /* ================= GLOBAL SEARCH (dropdown lintas kategori) ================= */
    const GLOBAL_SEARCH_SECTIONS = [
        { key: 'projects', label: 'Projects', icon: 'mdi-folder-outline' },
        { key: 'milestones', label: 'Milestones', icon: 'mdi-bullseye-arrow' },
        { key: 'files', label: 'Files', icon: 'mdi-file-outline' },
        { key: 'assets', label: 'Assets', icon: 'mdi-package-variant-closed' },
        { key: 'resources', label: 'Resources', icon: 'mdi-book-open-page-variant-outline' },
        { key: 'bookmarks', label: 'Bookmarks', icon: 'mdi-bookmark-multiple-outline' },
        { key: 'repository', label: 'Repository', icon: 'mdi-database-outline' }
    ];
    function getGlobalSearchItems(key) {
        if (key === 'projects') return state.projects.map(p => ({ id: p.id, title: p.name, sub: p.category }));
        if (key === 'milestones') return state.milestones.map(m => ({ id: m.id, title: m.title, sub: m.status }));
        if (key === 'files') return state.files.map(f => ({ id: f.id, title: f.name, sub: f.type }));
        return state.vault.filter(v => v.section === key).map(v => ({ id: v.id, title: v.title, sub: v.category }));
    }
    function renderGlobalSearchResults(rawQ) {
        const box = document.getElementById('global-search-results');
        if (!box) return;
        const q = (rawQ || '').trim();
        if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        const ql = q.toLowerCase();
        let html = '';
        let totalMatches = 0;
        GLOBAL_SEARCH_SECTIONS.forEach(sec => {
            const items = getGlobalSearchItems(sec.key).filter(it =>
                (it.title || '').toLowerCase().includes(ql) || (it.sub || '').toLowerCase().includes(ql)
            ).slice(0, 4);
            if (!items.length) return;
            totalMatches += items.length;
            html += `<div class="gs-group">
        <div class="gs-group-label"><span class="mdi ${sec.icon}"></span>${sec.label}</div>
        ${items.map(it => `<div class="gs-item" data-gs-nav="${sec.key}" data-gs-title="${esc(it.title)}">
          <span class="gs-item-title">${esc(it.title)}</span>
          ${it.sub ? `<span class="gs-item-sub">${esc(it.sub)}</span>` : ''}
        </div>`).join('')}
      </div>`;
        });
        box.innerHTML = totalMatches ? html : `<div class="gs-empty">Tidak ada hasil untuk "${esc(q)}"</div>`;
        box.classList.remove('hidden');
        box.querySelectorAll('[data-gs-nav]').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.getAttribute('data-gs-nav');
                const title = el.getAttribute('data-gs-title');
                document.getElementById('global-search').value = title;
                navigate(key);
                box.classList.add('hidden');
            });
        });
    }

    /* ================= DASHBOARD ================= */
    function renderDashboard() {
        renderGreeting();
        const totalProjects = state.projects.length;
        const activeProjects = state.projects.filter(p => p.status !== 'Archived').length;
        const overallProgress = totalProjects ? Math.round(state.projects.reduce((s, p) => s + Number(p.progress || 0), 0) / totalProjects) : 0;
        const now = Date.now();
        const in7 = now + 7 * 24 * 60 * 60 * 1000;
        const upcomingDeadlines = state.projects.filter(p => {
            const t = new Date(p.deadline + 'T00:00:00').getTime();
            return t >= now - 86400000 && t <= in7;
        }).length;
        const completedMs = state.milestones.filter(m => m.status === 'Completed').length;

        document.getElementById('stat-total-projects').textContent = totalProjects;
        document.getElementById('stat-overall-progress').textContent = overallProgress + '%';
        document.getElementById('stat-upcoming').textContent = upcomingDeadlines;
        document.getElementById('stat-completed-ms').textContent = completedMs;
        document.getElementById('bs-projects').textContent = activeProjects;
        document.getElementById('bs-milestones').textContent = state.milestones.length;
        document.getElementById('bs-files').textContent = state.files.length;
        document.getElementById('bs-events').textContent = state.events.length;

        // project overview (top 4 by deadline)
        const ov = [...state.projects].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 4);
        document.getElementById('dash-project-overview').innerHTML = ov.map(p => `
    <div class="progress-item">
      <div class="progress-item-top"><span class="name">${esc(p.name)}</span><span class="pct">${p.progress}%</span></div>
      <div class="progress-row-line">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${p.progress}%;"></div></div>
      </div>
      <span class="status-chip">${esc(p.status)}</span>
    </div>`).join('') || emptyRow('Belum ada project');

        // donut
        drawDonut(overallProgress);

        // deadlines list (soonest 4 upcoming or all if none upcoming)
        let dl = [...state.projects].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 4);
        document.getElementById('dash-deadlines').innerHTML = dl.map(p => {
            const d = new Date(p.deadline + 'T00:00:00');
            const lang = state.language.appLanguage === 'en' ? MONTHS_EN : MONTHS_SHORT_ID;
            const monShort = state.language.appLanguage === 'en' ? MONTHS_EN[d.getMonth()].slice(0, 3) : MONTHS_SHORT_ID[d.getMonth()];
            return `<div class="deadline-item">
      <div class="deadline-date"><div class="d">${d.getDate()}</div><div class="m">${monShort}</div></div>
      <div class="deadline-info"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.category)}</div></div>
      <span class="badge badge-${p.priority.toLowerCase()}">${esc(p.priority)}</span>
    </div>`;
        }).join('') || emptyRow('Tidak ada deadline');

        // activity
        document.getElementById('dash-activity').innerHTML = state.activity.slice(0, 6).map(a => `
    <div class="activity-item">
      <div class="activity-icon">${a.icon}</div>
      <div class="activity-info"><div class="t">${a.title}</div><div class="s">${relTime(a.time)}</div></div>
    </div>`).join('') || emptyRow('Belum ada aktivitas');
    }
    function emptyRow(msg) { return `<div style="padding:20px 0;color:var(--text-muted);font-size:13px;text-align:center;">${esc(msg)}</div>`; }

    function drawDonut(pct) {
        const size = 150, r = 60, sw = 16, c = 2 * Math.PI * r;
        const off = c - (clamp(pct, 0, 100) / 100) * c;
        const svg = document.getElementById('donut-svg');
        svg.innerHTML = `
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--border)" stroke-width="${sw}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--black)" stroke-width="${sw}"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="${size / 2}" y="${size / 2 + 7}" text-anchor="middle" font-size="24" font-weight="800" fill="var(--text)">${pct}%</text>
  `;
        document.querySelector('.donut-wrap').querySelectorAll('.donut-label').forEach(e => e.remove());
        const lbl = document.createElement('div');
        lbl.className = 'donut-label';
        lbl.textContent = state.language.appLanguage === 'en' ? 'Overall Progress' : 'Progress Keseluruhan';
        document.querySelector('.donut-wrap').appendChild(lbl);
    }

    /* ================= PROJECTS ================= */
    let projFilter = 'All';
    let projPage = 1;
    const PAGE_SIZE = 5;
    let editingProjectId = null;
    let projFeatures = [];
    let projImageData = null;

    function renderProjects() {
        let list = state.projects.slice();
        if (projFilter !== 'All') list = list.filter(p => p.status === projFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        projPage = clamp(projPage, 1, totalPages);
        const pageItems = list.slice((projPage - 1) * PAGE_SIZE, projPage * PAGE_SIZE);

        document.getElementById('projects-list').innerHTML = pageItems.map(p => `
    <div class="proj-row">
      ${p.image ? `<img class="proj-thumb" src="${p.image}">` : `<div class="proj-thumb-fallback">${esc(p.name.slice(0, 1))}</div>`}
      <div class="proj-main">
        <div class="name">${esc(p.name)}</div>
        <div class="cat">${esc(p.category)}</div>
        ${p.features && p.features.length ? `<span class="feat-badge">${p.features.length} Features</span>` : ''}
      </div>
      <div class="proj-col progress-col">
        <div class="progress-row-line">
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${p.progress}%;"></div></div>
          <span style="font-weight:700;font-size:13px;">${p.progress}%</span>
        </div>
      </div>
      <div class="proj-col"><span class="badge badge-${statusClass(p.status)}">${esc(p.status)}</span></div>
      <div class="proj-col"><span class="badge badge-${p.priority.toLowerCase()}">${esc(p.priority)}</span></div>
      <div class="proj-col">${fmtDate(p.deadline)}</div>
      <div class="proj-actions">
        <button class="icon-btn" title="Edit" data-edit="${p.id}"><span class="mdi mdi-pencil"></span></button>
        <button class="icon-btn" title="Lihat Detail" data-view="${p.id}"><span class="mdi mdi-eye"></span></button>
        <button class="icon-btn danger" title="Hapus" data-del="${p.id}"><span class="mdi mdi-trash-can"></span></button>
      </div>
    </div>`).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-folder-outline"></span></div><h4>Tidak ada project</h4><p>Coba ubah filter atau tambah project baru.</p></div>`;

        document.getElementById('proj-pager').innerHTML = pagerHTML(projPage, totalPages, list.length, 'proj');
        wirePager('proj', totalPages, p => { projPage = p; renderProjects(); });

        document.querySelectorAll('#projects-list [data-edit]').forEach(b => b.onclick = () => openProjectModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#projects-list [data-view]').forEach(b => b.onclick = () => showDetailProject(b.getAttribute('data-view')));
        document.querySelectorAll('#projects-list [data-del]').forEach(b => b.onclick = () => confirmDelete('project', b.getAttribute('data-del')));
    }
    function statusClass(s) {
        return {
            'In Progress': 'inprogress', 'Completed': 'completed', 'Planning': 'planning', 'Review': 'review',
            'Archived': 'archived', 'Pending': 'pending', 'Overdue': 'overdue'
        }[s] || 'planning';
    }
    function pagerHTML(page, totalPages, totalItems, prefix) {
        let html = `<span class="pager-info">Showing ${totalItems ? ((page - 1) * PAGE_SIZE + 1) : 0} to ${Math.min(page * PAGE_SIZE, totalItems)} of ${totalItems}</span>`;
        html += `<button id="${prefix}-prevbtn" ${page <= 1 ? 'disabled' : ''}>&#8249;</button>`;
        for (let i = 1; i <= totalPages; i++) {
            if (totalPages > 7 && (i > 2 && i < totalPages - 1 && Math.abs(i - page) > 1)) { if (i === 3 || i === totalPages - 2) html += `<span style="padding:0 4px;">…</span>`; continue; }
            html += `<button data-page="${i}" class="${i === page ? 'active' : ''}">${i}</button>`;
        }
        html += `<button id="${prefix}-nextbtn" ${page >= totalPages ? 'disabled' : ''}>&#8250;</button>`;
        return html;
    }
    function wirePager(prefix, totalPages, cb) {
        const root = document.getElementById(prefix + '-pager');
        root.querySelectorAll('button[data-page]').forEach(b => b.onclick = () => cb(Number(b.getAttribute('data-page'))));
        const prev = document.getElementById(prefix + '-prevbtn'); if (prev) prev.onclick = () => cb(clamp((currentPageOf(prefix)) - 1, 1, totalPages));
        const next = document.getElementById(prefix + '-nextbtn'); if (next) next.onclick = () => cb(clamp((currentPageOf(prefix)) + 1, 1, totalPages));
    }
    function currentPageOf(prefix) {
        if (prefix === 'proj') return projPage;
        if (prefix === 'ms') return msPage;
        if (prefix === 'file') return filePage;
        if (prefix === 'assets') return assetPage;
        if (prefix === 'resources') return resourcePage;
        if (prefix === 'bookmarks') return bookmarkPage;
        if (prefix === 'repository') return repositoryPage;
        return 1;
    }

    function openProjectModal(id) {
        editingProjectId = id || null;
        const p = id ? state.projects.find(x => x.id === id) : null;
        document.getElementById('proj-modal-title').textContent = p ? 'Edit Project' : 'New Project';
        document.getElementById('proj-name').value = p ? p.name : '';
        document.getElementById('proj-category').value = p ? p.category : '';
        document.getElementById('proj-desc').value = p ? p.desc : '';
        document.getElementById('proj-status').value = p ? p.status : 'Planning';
        document.getElementById('proj-priority').value = p ? p.priority : 'Medium';
        document.getElementById('proj-progress').value = p ? p.progress : 0;
        document.getElementById('proj-deadline').value = p ? p.deadline : '';
        projFeatures = p && p.features ? p.features.slice() : [];
        projImageData = p ? p.image : null;
        renderFeatureChips();
        renderProjImagePreview();
        openModal('modal-project');
    }
    function renderProjImagePreview() {
        const wrap = document.getElementById('proj-img-preview-wrap');
        if (projImageData) {
            wrap.innerHTML = `<img src="${projImageData}"><div class="hint">Klik untuk ganti gambar</div>`;
        } else {
            wrap.innerHTML = `<div style="font-size:26px;"><span class="mdi mdi-camera"></span></div><div class="hint">Klik untuk upload gambar desain (JPG/PNG)</div>`;
        }
    }
    function renderFeatureChips() {
        document.getElementById('proj-feature-chips').innerHTML = projFeatures.map((f, i) => `
    <span class="chip">${esc(f)} <button data-idx="${i}">&times;</button></span>`).join('');
        document.querySelectorAll('#proj-feature-chips button').forEach(b => b.onclick = () => {
            projFeatures.splice(Number(b.getAttribute('data-idx')), 1);
            renderFeatureChips();
        });
    }

    function saveProjectFromModal() {
        const name = document.getElementById('proj-name').value.trim();
        if (!name) { toast('Nama project wajib diisi'); return; }
        const data = {
            name,
            category: document.getElementById('proj-category').value.trim() || 'General',
            desc: document.getElementById('proj-desc').value.trim(),
            status: document.getElementById('proj-status').value,
            priority: document.getElementById('proj-priority').value,
            progress: clamp(Number(document.getElementById('proj-progress').value) || 0, 0, 100),
            deadline: document.getElementById('proj-deadline').value || todayStr(),
            features: projFeatures.slice(),
            image: projImageData
        };
        if (editingProjectId) {
            const idx = state.projects.findIndex(p => p.id === editingProjectId);
            const prevStatus = state.projects[idx].status;
            state.projects[idx] = { ...state.projects[idx], ...data };
            addActivity('&#9998;', `Project "${esc(name)}" diperbarui`);
            toast('Project berhasil diperbarui');
            if (data.status !== prevStatus) {
                if (data.status === 'Completed') {
                    pushNotification('project', `Project "${name}" telah selesai`, { refView: 'projects', refId: editingProjectId });
                } else if (data.status === 'Review') {
                    pushNotification('project', `Project "${name}" siap untuk direview`, { refView: 'projects', refId: editingProjectId });
                }
            }
        } else {
            const newId = uid('proj');
            state.projects.push({ id: newId, ...data });
            addActivity('&#128193;', `Project baru "${esc(name)}" dibuat`);
            toast('Project berhasil ditambahkan');
            pushNotification('project', `Project baru "${name}" dibuat`, { refView: 'projects', refId: newId });
        }
        saveProjects();
        closeModal('modal-project');
        renderProjects();
        renderDashboard();
        updateStorageUsage();
    }

    /* ---------- Project Detail (read-only view) ---------- */
    function showDetailProject(id) {
        const project = state.projects.find(p => p.id === id);
        if (!project) { toast('Project tidak ditemukan'); return; }

        document.getElementById('detail-name').textContent = project.name;
        document.getElementById('detail-description').textContent = project.desc || '-';

        const imgEl = document.getElementById('detail-image');
        if (project.image) {
            imgEl.src = project.image;
            imgEl.style.display = '';
        } else {
            imgEl.removeAttribute('src');
            imgEl.style.display = 'none';
        }

        document.getElementById('detail-status').innerHTML = `<span class="badge badge-${statusClass(project.status)}">${esc(project.status)}</span>`;
        document.getElementById('detail-priority').innerHTML = `<span class="badge badge-${project.priority.toLowerCase()}">${esc(project.priority)}</span>`;
        document.getElementById('detail-progress').textContent = project.progress + '%';
        document.getElementById('detail-deadline').textContent = fmtDate(project.deadline);

        const list = document.getElementById('detail-features');
        list.innerHTML = '';
        if (project.features && project.features.length) {
            project.features.forEach(feature => {
                list.innerHTML += `<li>${esc(feature)}</li>`;
            });
        } else {
            list.innerHTML = `<li style="color:var(--text-muted);">Belum ada catatan fitur</li>`;
        }

        openModal('project-detail-modal');
    }
    function closeDetailProject() { closeModal('project-detail-modal'); }

    /* ================= CALENDAR ================= */
    let calCursor = new Date();
    let miniCursor = new Date();

    function renderCalendar() {
        renderCalGrid();
        renderMiniCal();
        renderUpcomingEvents();
    }
    function renderCalGrid() {
        const y = calCursor.getFullYear(), m = calCursor.getMonth();
        const isEn = state.language.appLanguage === 'en';
        document.getElementById('cal-title').textContent = (isEn ? MONTHS_EN : MONTHS_ID)[m] + ' ' + y;
        const first = new Date(y, m, 1);
        const startDow = first.getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const daysInPrevMonth = new Date(y, m, 0).getDate();
        const dowArr = isEn ? DOW_EN : DOW_ID;
        let html = dowArr.map(d => `<div class="cal-dow">${d}</div>`).join('');
        const todayS = todayStr();

        const cells = [];
        for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, muted: true, dateStr: null });
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            cells.push({ day: d, muted: false, dateStr: ds });
        }
        let nextDay = 1;
        while (cells.length % 7 !== 0) cells.push({ day: nextDay++, muted: true, dateStr: null });

        cells.forEach(cell => {
            const evts = cell.dateStr ? state.events.filter(e => e.date === cell.dateStr) : [];
            const isToday = cell.dateStr === todayS;
            html += `<div class="cal-cell ${cell.muted ? 'muted' : ''}">
      <div class="daynum ${isToday ? 'today' : ''}">${cell.day}</div>
      ${evts.slice(0, 3).map(e => `<div class="cal-evt" style="border-color:${e.color};" data-evtid="${e.id}" title="${esc(e.title)}">${esc(e.title)}</div>`).join('')}
      ${evts.length > 3 ? `<div style="font-size:10.5px;color:var(--text-muted);">+${evts.length - 3} lainnya</div>` : ''}
    </div>`;
        });
        document.getElementById('cal-grid').innerHTML = html;
        document.querySelectorAll('#cal-grid [data-evtid]').forEach(el => {
            el.onclick = (ev) => { ev.stopPropagation(); const e = state.events.find(x => x.id === el.getAttribute('data-evtid')); if (e) confirmDelete('event', e.id, `Hapus acara "${e.title}"?`); };
        });
    }
    function renderMiniCal() {
        const y = miniCursor.getFullYear(), m = miniCursor.getMonth();
        const isEn = state.language.appLanguage === 'en';
        document.getElementById('mini-cal-title').textContent = (isEn ? MONTHS_EN : MONTHS_ID)[m] + ' ' + y;
        const dowArr = isEn ? DOW_EN : DOW_ID;
        let html = dowArr.map(d => `<div class="dow">${d[0]}</div>`).join('');
        const first = new Date(y, m, 1);
        const startDow = first.getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const daysInPrevMonth = new Date(y, m, 0).getDate();
        const todayS = todayStr();
        const cells = [];
        for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, muted: true });
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            cells.push({ day: d, muted: false, dateStr: ds });
        }
        let nextDay = 1;
        while (cells.length % 7 !== 0) cells.push({ day: nextDay++, muted: true });
        cells.forEach(c => {
            const isToday = c.dateStr === todayS;
            html += `<div class="day ${c.muted ? 'muted' : ''} ${isToday ? 'today' : ''}" ${c.dateStr ? `data-jump="${c.dateStr}"` : ''}>${c.day}</div>`;
        });
        document.getElementById('mini-cal-grid').innerHTML = html;
        document.querySelectorAll('#mini-cal-grid [data-jump]').forEach(el => {
            el.onclick = () => { const ds = el.getAttribute('data-jump'); calCursor = new Date(ds + 'T00:00:00'); renderCalGrid(); };
        });
    }
    function renderUpcomingEvents() {
        const now = Date.now();
        const list = state.events.slice().filter(e => new Date(e.date + 'T00:00:00').getTime() >= now - 86400000)
            .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);
        document.getElementById('upcoming-events-list').innerHTML = list.map(e => {
            const d = new Date(e.date + 'T00:00:00');
            const isEn = state.language.appLanguage === 'en';
            return `<div class="upcoming-evt">
      <span class="evt-dot" style="background:${e.color};"></span>
      <div style="flex:1;min-width:0;">
        <div class="t">${esc(e.title)}</div>
        <div class="s">${e.time || (isEn ? 'All Day' : 'Sepanjang Hari')}</div>
      </div>
      <div class="when">${d.getDate()} ${(isEn ? MONTHS_EN : MONTHS_SHORT_ID)[d.getMonth()].slice(0, 3)}</div>
    </div>`;
        }).join('') || emptyRow('Tidak ada acara mendatang');
    }
    function openEventModal() {
        document.getElementById('evt-title').value = '';
        document.getElementById('evt-date').value = todayStr();
        document.getElementById('evt-time').value = '';
        document.getElementById('evt-type').value = '#2563eb';
        openModal('modal-event');
    }
    function saveEventFromModal() {
        const title = document.getElementById('evt-title').value.trim();
        const date = document.getElementById('evt-date').value;
        if (!title || !date) { toast('Judul dan tanggal wajib diisi'); return; }
        state.events.push({ id: uid('evt'), title, date, time: document.getElementById('evt-time').value, color: document.getElementById('evt-type').value });
        saveEvents();
        addActivity('&#128197;', `Acara baru "${esc(title)}" ditambahkan`);
        closeModal('modal-event');
        calCursor = new Date(date + 'T00:00:00');
        renderCalendar();
        renderDashboard();
        toast('Acara berhasil ditambahkan');
    }

    /* ================= MILESTONES ================= */
    let msFilter = 'All';
    let msPage = 1;
    let editingMsId = null;

    function renderMilestones() {
        const total = state.milestones.length;
        const completed = state.milestones.filter(m => m.status === 'Completed').length;
        const inprog = state.milestones.filter(m => m.status === 'In Progress').length;
        const overdue = state.milestones.filter(m => m.status === 'Overdue').length;
        document.getElementById('ms-stat-total').textContent = total;
        document.getElementById('ms-stat-completed').textContent = completed;
        document.getElementById('ms-stat-progress').textContent = inprog;
        document.getElementById('ms-stat-overdue').textContent = overdue;
        document.getElementById('ms-stat-completed-pct').textContent = (total ? Math.round(completed / total * 100) : 0) + '% completed';
        document.getElementById('ms-stat-progress-pct').textContent = (total ? Math.round(inprog / total * 100) : 0) + '% in progress';
        document.getElementById('ms-stat-overdue-pct').textContent = (total ? Math.round(overdue / total * 100) : 0) + '% overdue';

        let list = state.milestones.slice();
        if (msFilter !== 'All') list = list.filter(m => m.status === msFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(m => m.title.toLowerCase().includes(q));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        msPage = clamp(msPage, 1, totalPages);
        const pageItems = list.slice((msPage - 1) * PAGE_SIZE, msPage * PAGE_SIZE);
        const barColor = s => s === 'Completed' ? '#16a34a' : s === 'Overdue' ? '#dc2626' : s === 'In Progress' ? '#d97706' : '#9ca3af';

        document.getElementById('milestones-list').innerHTML = pageItems.map(m => {
            const proj = state.projects.find(p => p.id === m.projectId);
            return `<div class="ms-row" style="border-left-color:${barColor(m.status)};">
      <div class="ms-main"><div class="t">${esc(m.title)}</div><div class="d">${esc(m.desc || '')}</div></div>
      <div class="proj-col">${proj ? esc(proj.name) : '-'}</div>
      <div class="proj-col progress-col">
        <div class="progress-row-line">
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${m.progress}%;background:${barColor(m.status)};"></div></div>
          <span style="font-weight:700;font-size:13px;">${m.progress}%</span>
        </div>
      </div>
      <div class="proj-col">${fmtDate(m.deadline)}</div>
      <div class="proj-col"><span class="badge badge-${statusClass(m.status)}">${esc(m.status)}</span></div>
      <div class="proj-actions">
        <button class="icon-btn" title="Edit" data-edit="${m.id}"><span class="mdi mdi-pencil"></span></button>
        <button class="icon-btn" title="Lihat Detail" data-view="${m.id}"><span class="mdi mdi-eye"></span></button>
        <button class="icon-btn danger" title="Hapus" data-del="${m.id}"><span class="mdi mdi-trash-can"></span></button>
      </div>
    </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-bullseye-arrow"></span></div><h4>Tidak ada milestone</h4><p>Coba ubah filter atau tambah milestone baru.</p></div>`;

        document.getElementById('ms-pager').innerHTML = pagerHTML(msPage, totalPages, list.length, 'ms');
        wirePager('ms', totalPages, p => { msPage = p; renderMilestones(); });
        document.querySelectorAll('#milestones-list [data-edit]').forEach(b => b.onclick = () => openMilestoneModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#milestones-list [data-view]').forEach(b => b.onclick = () => showDetailMilestone(b.getAttribute('data-view')));
        document.querySelectorAll('#milestones-list [data-del]').forEach(b => b.onclick = () => confirmDelete('milestone', b.getAttribute('data-del')));
    }
    function openMilestoneModal(id) {
        editingMsId = id || null;
        const m = id ? state.milestones.find(x => x.id === id) : null;
        document.getElementById('ms-modal-title').textContent = m ? 'Edit Milestone' : 'New Milestone';
        document.getElementById('ms-title').value = m ? m.title : '';
        document.getElementById('ms-desc').value = m ? m.desc : '';
        const sel = document.getElementById('ms-project');
        sel.innerHTML = state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        sel.value = m ? m.projectId : (state.projects[0] ? state.projects[0].id : '');
        document.getElementById('ms-progress').value = m ? m.progress : 0;
        document.getElementById('ms-deadline').value = m ? m.deadline : '';
        document.getElementById('ms-status').value = m ? m.status : 'Pending';
        openModal('modal-milestone');
    }
    function saveMilestoneFromModal() {
        const title = document.getElementById('ms-title').value.trim();
        if (!title) { toast('Judul milestone wajib diisi'); return; }
        const data = {
            title,
            desc: document.getElementById('ms-desc').value.trim(),
            projectId: document.getElementById('ms-project').value,
            progress: clamp(Number(document.getElementById('ms-progress').value) || 0, 0, 100),
            deadline: document.getElementById('ms-deadline').value || todayStr(),
            status: document.getElementById('ms-status').value
        };
        if (editingMsId) {
            const idx = state.milestones.findIndex(m => m.id === editingMsId);
            const prevStatus = state.milestones[idx].status;
            state.milestones[idx] = { ...state.milestones[idx], ...data };
            addActivity('&#9998;', `Milestone "${esc(title)}" diperbarui`);
            toast('Milestone berhasil diperbarui');
            if (data.status === 'Completed' && prevStatus !== 'Completed') {
                pushNotification('milestone', `Milestone "${title}" telah selesai`, { refView: 'milestones', refId: editingMsId });
            }
        } else {
            const newId = uid('ms');
            state.milestones.push({ id: newId, ...data });
            addActivity('&#127919;', `Milestone baru "${esc(title)}" ditambahkan`);
            toast('Milestone berhasil ditambahkan');
        }
        saveMilestones();
        closeModal('modal-milestone');
        renderMilestones();
        renderDashboard();
    }

    /* ---------- Milestone Detail (read-only view) ---------- */
    function showDetailMilestone(id) {
        const m = state.milestones.find(x => x.id === id);
        if (!m) { toast('Milestone tidak ditemukan'); return; }
        const proj = state.projects.find(p => p.id === m.projectId);

        document.getElementById('msdetail-title').textContent = m.title;
        document.getElementById('msdetail-desc').textContent = m.desc || '-';
        document.getElementById('msdetail-project').textContent = proj ? proj.name : '-';
        document.getElementById('msdetail-status').innerHTML = `<span class="badge badge-${statusClass(m.status)}">${esc(m.status)}</span>`;
        document.getElementById('msdetail-progress').textContent = m.progress + '%';
        document.getElementById('msdetail-deadline').textContent = fmtDate(m.deadline);

        openModal('milestone-detail-modal');
    }

    /* ================= FILES ================= */
    let fileFilter = 'All';
    let filePage = 1;

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
    }

    /* ================= STORAGE USAGE ================= */
    const STORAGE_CAP_BYTES = 100 * 1024 * 1024 * 1024 * 1024; // batas maksimal: 100 TB

    /* Perkirakan ukuran byte dari sebuah data URL base64 (dipakai untuk foto profil,
       cover project, dan gambar di vault — karena semuanya disimpan sebagai base64). */
    function base64Bytes(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return 0;
        const idx = dataUrl.indexOf(',');
        const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
        const len = b64.length;
        if (len === 0) return 0;
        const padding = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
        return Math.max(0, Math.floor((len * 3) / 4) - padding);
    }

    /* Total pemakaian storage akun yang sedang login: file yang diupload,
       gambar project, gambar di vault (assets/resources/bookmarks/repository),
       dan foto profil. */
    function computeStorageUsedBytes() {
        let total = 0;
        total += state.files.reduce((s, f) => s + (f.size || 0), 0);
        total += state.projects.reduce((s, p) => s + base64Bytes(p.image), 0);
        total += state.vault.reduce((s, v) => s + base64Bytes(v.image), 0);
        total += base64Bytes(state.profile ? state.profile.avatar : null);
        return total;
    }

    function fmtStoragePct(pct) {
        if (pct <= 0) return '0%';
        if (pct < 0.01) return '<0.01%';
        return pct.toFixed(2) + '%';
    }

    function updateStorageUsage() {
        const fillEl = document.getElementById('storage-fill');
        const textEl = document.getElementById('storage-text');
        const pctEl = document.getElementById('storage-pct');
        if (!fillEl || !textEl || !pctEl) return;

        const used = computeStorageUsedBytes();
        const realPct = Math.min(100, (used / STORAGE_CAP_BYTES) * 100);
        // Beri lebar minimum kecil di bar supaya tetap terlihat walau pemakaian
        // sangat kecil dibanding kapasitas 100TB (persentase asli tetap ditampilkan di teks).
        const barWidth = used > 0 ? Math.max(realPct, 0.6) : 0;

        fillEl.style.width = barWidth + '%';
        textEl.textContent = fmtSize(used) + ' dari ' + fmtSize(STORAGE_CAP_BYTES);
        pctEl.textContent = fmtStoragePct(realPct);
    }
    function fileIconMeta(type) {
        const map = {
            Image: { ic: '<span class="mdi mdi-image"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            PDF: { ic: '<span class="mdi mdi-file-pdf-box"></span>', bg: 'var(--red-soft)', fg: 'var(--red)' },
            DOCX: { ic: '<span class="mdi mdi-file-document"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            ZIP: { ic: '<span class="mdi mdi-folder-zip"></span>', bg: 'var(--orange-soft)', fg: 'var(--orange)' },
            XLSX: { ic: '<span class="mdi mdi-file-excel"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            PPTX: { ic: '<span class="mdi mdi-file-powerpoint"></span>', bg: 'var(--purple-soft)', fg: 'var(--purple)' },
            TXT: { ic: '<span class="mdi mdi-text"></span>', bg: '#f3f4f6', fg: '#4b5563' }
        };
        return map[type] || { ic: '&#128196;', bg: '#f3f4f6', fg: '#4b5563' };
    }
    function renderFiles() {
        document.getElementById('file-stat-total').textContent = state.files.length;
        document.getElementById('file-stat-size').textContent = fmtSize(state.files.reduce((s, f) => s + f.size, 0));
        const thisMonth = new Date().getMonth();
        document.getElementById('file-stat-uploaded').textContent = state.files.filter(f => new Date(f.date).getMonth() === thisMonth).length;
        document.getElementById('file-stat-archived').textContent = state.files.filter(f => f.archived).length;
        updateStorageUsage();

        let list = state.files.slice();
        if (fileFilter === 'Project') list = list.filter(f => !f.archived);
        if (fileFilter === 'Archived') list = list.filter(f => f.archived);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
        list = list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        filePage = clamp(filePage, 1, totalPages);
        const pageItems = list.slice((filePage - 1) * PAGE_SIZE, filePage * PAGE_SIZE);

        document.getElementById('files-list').innerHTML = pageItems.map(f => {
            const meta = fileIconMeta(f.type);
            const d = new Date(f.date);
            return `<div class="file-row">
      <div class="file-icon" style="background:${meta.bg};color:${meta.fg};">${meta.ic}</div>
      <div class="file-main"><div class="n">${esc(f.name)}</div><div class="p">${esc(f.project)}</div></div>
      <div class="file-col"><span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(f.type)}</span></div>
      <div class="file-col">${fmtSize(f.size)}</div>
      <div class="file-col">${d.toLocaleDateString()} ${f.archived ? '<span class="badge badge-archived" style="margin-left:6px;">Archived</span>' : ''}</div>
      <div class="proj-actions">
        <button class="icon-btn" title="Preview" data-preview="${f.id}"><span class="mdi mdi-eye"></span></button>
        <button class="icon-btn" title="Download" data-download="${f.id}"><span class="mdi mdi-download"></span></button>
        <button class="icon-btn" title="${f.archived ? 'Unarchive' : 'Archive'}" data-archive="${f.id}"><span class="mdi mdi-archive-star"></span></button>
        <button class="icon-btn danger" title="Hapus" data-del="${f.id}"><span class="mdi mdi-trash-can"></span></button>
      </div>
    </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-file-outline"></span></div><h4>Tidak ada file</h4><p>Upload file pertama anda.</p></div>`;

        document.getElementById('file-pager').innerHTML = pagerHTML(filePage, totalPages, list.length, 'file');
        wirePager('file', totalPages, p => { filePage = p; renderFiles(); });

        document.querySelectorAll('#files-list [data-preview]').forEach(b => b.onclick = () => previewFile(b.getAttribute('data-preview')));
        document.querySelectorAll('#files-list [data-download]').forEach(b => b.onclick = () => downloadFile(b.getAttribute('data-download')));
        document.querySelectorAll('#files-list [data-archive]').forEach(b => b.onclick = () => toggleArchive(b.getAttribute('data-archive')));
        document.querySelectorAll('#files-list [data-del]').forEach(b => b.onclick = () => confirmDelete('file', b.getAttribute('data-del')));
    }
    function previewFile(id) {
        const f = state.files.find(x => x.id === id);
        if (!f) return;
        document.getElementById('fp-title').textContent = f.name;
        const body = document.getElementById('fp-body');
        if (f.dataURL && f.type === 'Image') {
            body.innerHTML = `<img src="${f.dataURL}" style="max-width:100%;border-radius:10px;">`;
        } else if (f.dataURL && f.type === 'TXT') {
            fetch(f.dataURL).then(r => r.text()).then(txt => {
                body.innerHTML = `<pre style="text-align:left;white-space:pre-wrap;background:var(--bg);padding:14px;border-radius:10px;max-height:300px;overflow:auto;">${esc(txt.slice(0, 3000))}</pre>`;
            });
        } else {
            const meta = fileIconMeta(f.type);
            body.innerHTML = `<div style="font-size:46px;margin-bottom:10px;">${meta.ic}</div>
      <div style="font-weight:700;">${esc(f.name)}</div>
      <div style="color:var(--text-muted);font-size:13px;margin-top:6px;">${fmtSize(f.size)} &middot; ${esc(f.type)}</div>
      <div style="color:var(--text-muted);font-size:12.5px;margin-top:14px;">${f.dataURL ? 'Pratinjau tidak tersedia untuk tipe file ini.' : 'File demo — tidak ada data biner tersimpan.'}</div>`;
        }
        document.getElementById('fp-download-btn').onclick = () => downloadFile(id);
        openModal('modal-filepreview');
    }
    function downloadFile(id) {
        const f = state.files.find(x => x.id === id);
        if (!f) return;
        if (!f.dataURL) { toast('File demo — tidak ada data untuk diunduh'); return; }
        const a = document.createElement('a');
        a.href = f.dataURL; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        toast('Mengunduh ' + f.name);
    }
    function toggleArchive(id) {
        const f = state.files.find(x => x.id === id);
        if (!f) return;
        f.archived = !f.archived;
        saveFiles();
        addActivity('&#128230;', `File "${esc(f.name)}" ${f.archived ? 'diarsipkan' : 'dipulihkan dari arsip'}`);
        renderFiles();
        toast(f.archived ? 'File diarsipkan' : 'File dipulihkan');
    }
    function extToType(name) {
        const ext = (name.split('.').pop() || '').toLowerCase();
        const map = { png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', webp: 'Image', pdf: 'PDF', doc: 'DOCX', docx: 'DOCX', zip: 'ZIP', rar: 'ZIP', xls: 'XLSX', xlsx: 'XLSX', csv: 'XLSX', ppt: 'PPTX', pptx: 'PPTX', txt: 'TXT', md: 'TXT' };
        return map[ext] || 'TXT';
    }
    function handleFileUpload(fileList) {
        const arr = Array.from(fileList);
        let count = 0;
        arr.forEach(file => {
            if (file.size > 3.5 * 1024 * 1024) { toast(`"${file.name}" terlalu besar untuk demo (maks 3.5MB)`); return; }
            const reader = new FileReader();
            reader.onload = () => {
                const newId = uid('file');
                state.files.unshift({
                    id: newId, name: file.name, project: 'Uploads', type: extToType(file.name),
                    size: file.size, uploadedBy: state.profile.fullName, date: new Date().toISOString(),
                    archived: false, dataURL: reader.result
                });
                saveFiles();
                addActivity('&#128196;', `Anda mengupload file "${esc(file.name)}"`);
                pushNotification('file', `File baru "${file.name}" berhasil diupload`, { refView: 'files', refId: newId });
                renderFiles();
                renderDashboard();
            };
            reader.readAsDataURL(file);
            count++;
        });
        if (count) toast(`Mengupload ${count} file...`);
    }

    /* ================= VAULT — SHARED HELPERS ================= */
    /* Assets, Resources, Bookmarks dan Repository masing-masing punya bagian kode
       sendiri di bawah (mirip Projects/Milestones/Calendar/Files). Mereka tetap
       berbagi SATU modal HTML (modal-vault) untuk tambah/edit, jadi kita perlu tahu
       section mana yang sedang dibuka lewat variabel ini. */
    let vaultCurrentSection = null;

    /* ================= ASSETS ================= */
    let assetFilter = 'All';
    let assetPage = 1;
    let editingAssetId = null;
    let assetImageData = null;
    const ASSET_CATEGORIES = ['Icon', 'Image', 'Illustration', 'Component', 'Font', 'Color Palette'];
    /* Tiap kategori punya ikon & warna sendiri (mirip pola fileIconMeta di bagian Files),
       dipakai untuk thumbnail fallback maupun badge kategori. */
    function assetCategoryMeta(category) {
        const map = {
            'Icon': { ic: '<span class="mdi mdi-shape-outline"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            'Image': { ic: '<span class="mdi mdi-image-outline"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            'Illustration': { ic: '<span class="mdi mdi-panorama-variant-outline"></span>', bg: 'var(--purple-soft)', fg: 'var(--purple)' },
            'Component': { ic: '<span class="mdi mdi-puzzle-outline"></span>', bg: 'var(--orange-soft)', fg: 'var(--orange)' },
            'Font': { ic: '<span class="mdi mdi-format-font"></span>', bg: 'var(--red-soft)', fg: 'var(--red)' },
            'Color Palette': { ic: '<span class="mdi mdi-palette-outline"></span>', bg: 'var(--pink-soft)', fg: 'var(--pink)' }
        };
        return map[category] || { ic: '<span class="mdi mdi-package-variant-closed"></span>', bg: '#f3f4f6', fg: '#4b5563' };
    }

    function renderAssets() {
        let list = state.vault.filter(v => v.section === 'assets');

        document.getElementById('assets-stat-total').textContent = list.length;
        const thisMonth = new Date().getMonth();
        document.getElementById('assets-stat-month').textContent = list.filter(v => new Date(v.date).getMonth() === thisMonth).length;
        document.getElementById('assets-stat-3').textContent = list.filter(v => v.projectId).length;

        if (assetFilter !== 'All') list = list.filter(v => v.category === assetFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(v => v.title.toLowerCase().includes(q) || (v.desc || '').toLowerCase().includes(q));
        list = list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        assetPage = clamp(assetPage, 1, totalPages);
        const pageItems = list.slice((assetPage - 1) * PAGE_SIZE, assetPage * PAGE_SIZE);

        document.getElementById('assets-list').innerHTML = pageItems.map(v => {
            const meta = assetCategoryMeta(v.category);
            const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
            const thumb = v.image
                ? `<img src="${v.image}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`
                : meta.ic;
            return `<div class="file-row">
        <div class="file-icon" style="background:${meta.bg};color:${meta.fg};">${thumb}</div>
        <div class="file-main">
          <div class="n">${esc(v.title)}</div>
          <div class="p">${esc((v.desc || '').slice(0, 80))}${(v.desc || '').length > 80 ? '&hellip;' : ''}</div>
        </div>
        <div class="file-col"><span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span></div>
        <div class="file-col">${proj ? esc(proj.name) : '<span style="color:var(--text-muted);">&#8212;</span>'}</div>
        <div class="file-col">${fmtDate(v.date.slice(0, 10))}</div>
        <div class="proj-actions">
          ${v.url ? `<button class="icon-btn" title="Buka Tautan" data-openurl="${v.id}"><span class="mdi mdi-link"></span></button>` : ''}
          <button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="mdi mdi-pencil"></span></button>
          <button class="icon-btn" title="Lihat Detail" data-view="${v.id}"><span class="mdi mdi-eye"></span></button>
          <button class="icon-btn danger" title="Hapus" data-del="${v.id}"><span class="mdi mdi-trash-can"></span></button>
        </div>
      </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-package-variant-closed"></span></div><h4>Belum ada asset</h4><p>Tambahkan ikon, gambar, atau komponen desain pertama anda.</p></div>`;

        document.getElementById('assets-pager').innerHTML = pagerHTML(assetPage, totalPages, list.length, 'assets');
        wirePager('assets', totalPages, p => { assetPage = p; renderAssets(); });

        document.querySelectorAll('#assets-list [data-edit]').forEach(b => b.onclick = () => openAssetModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#assets-list [data-del]').forEach(b => b.onclick = () => confirmDelete('vault', b.getAttribute('data-del')));
        document.querySelectorAll('#assets-list [data-view]').forEach(b => b.onclick = () => showAssetDetail(b.getAttribute('data-view')));
        document.querySelectorAll('#assets-list [data-openurl]').forEach(b => b.onclick = () => {
            const item = state.vault.find(x => x.id === b.getAttribute('data-openurl'));
            if (item && item.url) window.open(item.url, '_blank');
        });
    }

    function showAssetDetail(id) {
        const v = state.vault.find(x => x.id === id);
        if (!v) { toast('Item tidak ditemukan'); return; }

        document.getElementById('vaultdetail-title-head').textContent = 'Detail Asset';

        const imgEl = document.getElementById('vaultdetail-image');
        if (v.image) { imgEl.src = v.image; imgEl.style.display = ''; }
        else { imgEl.removeAttribute('src'); imgEl.style.display = 'none'; }

        document.getElementById('vaultdetail-title').textContent = v.title;
        document.getElementById('vaultdetail-desc').textContent = v.desc || '-';

        const meta = assetCategoryMeta(v.category);
        document.getElementById('vaultdetail-category').innerHTML = `<span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span>`;

        const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
        document.getElementById('vaultdetail-project').textContent = proj ? proj.name : '\u2014';

        document.getElementById('vaultdetail-tags').innerHTML = (v.tags && v.tags.length)
            ? v.tags.map(t => `<span class="type-chip" style="background:var(--bg);color:var(--text-muted);margin-right:4px;">${esc(t)}</span>`).join('')
            : '\u2014';

        document.getElementById('vaultdetail-date').textContent = fmtDate(v.date.slice(0, 10));

        const linkBtn = document.getElementById('vaultdetail-link-btn');
        if (v.url) { linkBtn.classList.remove('hidden'); linkBtn.onclick = () => window.open(v.url, '_blank'); }
        else { linkBtn.classList.add('hidden'); }

        openModal('modal-vault-detail');
    }

    function openAssetModal(id) {
        vaultCurrentSection = 'assets';
        editingAssetId = id || null;
        const v = id ? state.vault.find(x => x.id === id) : null;

        document.getElementById('vault-modal-title').textContent = (v ? 'Edit ' : 'Tambah ') + 'Asset';
        document.getElementById('vault-title-label').textContent = 'Nama Asset';
        document.getElementById('vault-title').value = v ? v.title : '';
        document.getElementById('vault-desc').value = v ? v.desc : '';
        document.getElementById('vault-url').value = v ? (v.url || '') : '';
        document.getElementById('vault-tags').value = v && v.tags ? v.tags.join(', ') : '';
        assetImageData = v ? v.image : null;

        const catSelect = document.getElementById('vault-category');
        catSelect.innerHTML = ASSET_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        catSelect.value = v ? v.category : ASSET_CATEGORIES[0];

        const projSelect = document.getElementById('vault-project');
        projSelect.innerHTML = '<option value="">- Tidak ada -</option>' + state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        projSelect.value = v && v.projectId ? v.projectId : '';

        document.getElementById('vault-url-group').style.display = 'none';
        document.getElementById('vault-project-group').style.display = '';
        document.getElementById('vault-image-group').style.display = '';
        renderAssetImagePreview();

        openModal('modal-vault');
    }
    function renderAssetImagePreview() {
        const wrap = document.getElementById('vault-img-preview-wrap');
        if (assetImageData) wrap.innerHTML = `<img src="${assetImageData}"><div class="hint">Klik untuk ganti gambar</div>`;
        else wrap.innerHTML = `<div style="font-size:26px;">&#128247;</div><div class="hint">Klik untuk upload gambar (opsional)</div>`;
    }
    function saveAssetFromModal() {
        const title = document.getElementById('vault-title').value.trim();
        if (!title) { toast('Nama Asset wajib diisi'); return; }
        const tags = document.getElementById('vault-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const data = {
            section: 'assets',
            title,
            desc: document.getElementById('vault-desc').value.trim(),
            category: document.getElementById('vault-category').value,
            url: null,
            projectId: document.getElementById('vault-project').value || null,
            image: assetImageData,
            tags
        };
        if (editingAssetId) {
            const idx = state.vault.findIndex(v => v.id === editingAssetId);
            state.vault[idx] = { ...state.vault[idx], ...data };
            addActivity('&#127912;', `Asset "${esc(title)}" diperbarui`);
            toast('Asset berhasil diperbarui');
        } else {
            state.vault.push({ id: uid('vault'), date: new Date().toISOString(), ...data });
            addActivity('&#127912;', `Asset baru "${esc(title)}" ditambahkan`);
            toast('Asset berhasil ditambahkan');
        }
        saveVault();
        closeModal('modal-vault');
        renderAssets();
        renderDashboard();
        updateStorageUsage();
    }

    /* ================= RESOURCES ================= */
    let resourceFilter = 'All';
    let resourcePage = 1;
    let editingResourceId = null;
    const RESOURCE_CATEGORIES = ['Tautan', 'Tutorial', 'Dokumentasi', 'Video', 'Artikel'];
    function resourceCategoryMeta(category) {
        const map = {
            'Tautan': { ic: '<span class="mdi mdi-link-variant"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            'Tutorial': { ic: '<span class="mdi mdi-school-outline"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            'Dokumentasi': { ic: '<span class="mdi mdi-file-document-outline"></span>', bg: 'var(--purple-soft)', fg: 'var(--purple)' },
            'Video': { ic: '<span class="mdi mdi-video-outline"></span>', bg: 'var(--orange-soft)', fg: 'var(--orange)' },
            'Artikel': { ic: '<span class="mdi mdi-newspaper-variant-outline"></span>', bg: 'var(--red-soft)', fg: 'var(--red)' }
        };
        return map[category] || { ic: '<span class="mdi mdi-book-open-page-variant-outline"></span>', bg: '#f3f4f6', fg: '#4b5563' };
    }

    function renderResources() {
        let list = state.vault.filter(v => v.section === 'resources');

        document.getElementById('resources-stat-total').textContent = list.length;
        const thisMonth = new Date().getMonth();
        document.getElementById('resources-stat-month').textContent = list.filter(v => new Date(v.date).getMonth() === thisMonth).length;
        document.getElementById('resources-stat-3').textContent = list.filter(v => v.projectId).length;

        if (resourceFilter !== 'All') list = list.filter(v => v.category === resourceFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(v => v.title.toLowerCase().includes(q) || (v.desc || '').toLowerCase().includes(q));
        list = list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        resourcePage = clamp(resourcePage, 1, totalPages);
        const pageItems = list.slice((resourcePage - 1) * PAGE_SIZE, resourcePage * PAGE_SIZE);

        document.getElementById('resources-list').innerHTML = pageItems.map(v => {
            const meta = resourceCategoryMeta(v.category);
            const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
            return `<div class="file-row">
        <div class="file-icon" style="background:${meta.bg};color:${meta.fg};">${meta.ic}</div>
        <div class="file-main">
          <div class="n">${esc(v.title)}</div>
          <div class="p">${esc((v.desc || '').slice(0, 80))}${(v.desc || '').length > 80 ? '&hellip;' : ''}</div>
        </div>
        <div class="file-col"><span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span></div>
        <div class="file-col">${proj ? esc(proj.name) : '<span style="color:var(--text-muted);">&#8212;</span>'}</div>
        <div class="file-col">${fmtDate(v.date.slice(0, 10))}</div>
        <div class="proj-actions">
          ${v.url ? `<button class="icon-btn" title="Buka Tautan" data-openurl="${v.id}"><span class="mdi mdi-link"></span></button>` : ''}
          <button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="mdi mdi-pencil"></span></button>
          <button class="icon-btn" title="Lihat Detail" data-view="${v.id}"><span class="mdi mdi-eye"></span></button>
          <button class="icon-btn danger" title="Hapus" data-del="${v.id}"><span class="mdi mdi-trash-can"></span></button>
        </div>
      </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-book-open-page-variant-outline"></span></div><h4>Belum ada resource</h4><p>Simpan referensi, tautan, atau tutorial berguna di sini.</p></div>`;

        document.getElementById('resources-pager').innerHTML = pagerHTML(resourcePage, totalPages, list.length, 'resources');
        wirePager('resources', totalPages, p => { resourcePage = p; renderResources(); });

        document.querySelectorAll('#resources-list [data-edit]').forEach(b => b.onclick = () => openResourceModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#resources-list [data-del]').forEach(b => b.onclick = () => confirmDelete('vault', b.getAttribute('data-del')));
        document.querySelectorAll('#resources-list [data-view]').forEach(b => b.onclick = () => showResourceDetail(b.getAttribute('data-view')));
        document.querySelectorAll('#resources-list [data-openurl]').forEach(b => b.onclick = () => {
            const item = state.vault.find(x => x.id === b.getAttribute('data-openurl'));
            if (item && item.url) window.open(item.url, '_blank');
        });
    }

    function showResourceDetail(id) {
        const v = state.vault.find(x => x.id === id);
        if (!v) { toast('Item tidak ditemukan'); return; }

        document.getElementById('vaultdetail-title-head').textContent = 'Detail Resource';

        const imgEl = document.getElementById('vaultdetail-image');
        imgEl.removeAttribute('src'); imgEl.style.display = 'none';

        document.getElementById('vaultdetail-title').textContent = v.title;
        document.getElementById('vaultdetail-desc').textContent = v.desc || '-';

        const meta = resourceCategoryMeta(v.category);
        document.getElementById('vaultdetail-category').innerHTML = `<span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span>`;

        const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
        document.getElementById('vaultdetail-project').textContent = proj ? proj.name : '\u2014';

        document.getElementById('vaultdetail-tags').innerHTML = (v.tags && v.tags.length)
            ? v.tags.map(t => `<span class="type-chip" style="background:var(--bg);color:var(--text-muted);margin-right:4px;">${esc(t)}</span>`).join('')
            : '\u2014';

        document.getElementById('vaultdetail-date').textContent = fmtDate(v.date.slice(0, 10));

        const linkBtn = document.getElementById('vaultdetail-link-btn');
        if (v.url) { linkBtn.classList.remove('hidden'); linkBtn.onclick = () => window.open(v.url, '_blank'); }
        else { linkBtn.classList.add('hidden'); }

        openModal('modal-vault-detail');
    }

    function openResourceModal(id) {
        vaultCurrentSection = 'resources';
        editingResourceId = id || null;
        const v = id ? state.vault.find(x => x.id === id) : null;

        document.getElementById('vault-modal-title').textContent = (v ? 'Edit ' : 'Tambah ') + 'Resource';
        document.getElementById('vault-title-label').textContent = 'Judul Resource';
        document.getElementById('vault-title').value = v ? v.title : '';
        document.getElementById('vault-desc').value = v ? v.desc : '';
        document.getElementById('vault-url').value = v ? (v.url || '') : '';
        document.getElementById('vault-tags').value = v && v.tags ? v.tags.join(', ') : '';

        const catSelect = document.getElementById('vault-category');
        catSelect.innerHTML = RESOURCE_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        catSelect.value = v ? v.category : RESOURCE_CATEGORIES[0];

        const projSelect = document.getElementById('vault-project');
        projSelect.innerHTML = '<option value="">- Tidak ada -</option>' + state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        projSelect.value = v && v.projectId ? v.projectId : '';

        document.getElementById('vault-url-group').style.display = '';
        document.getElementById('vault-project-group').style.display = '';
        document.getElementById('vault-image-group').style.display = 'none';

        openModal('modal-vault');
    }
    function saveResourceFromModal() {
        const title = document.getElementById('vault-title').value.trim();
        if (!title) { toast('Judul Resource wajib diisi'); return; }
        const tags = document.getElementById('vault-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const data = {
            section: 'resources',
            title,
            desc: document.getElementById('vault-desc').value.trim(),
            category: document.getElementById('vault-category').value,
            url: document.getElementById('vault-url').value.trim() || null,
            projectId: document.getElementById('vault-project').value || null,
            image: null,
            tags
        };
        if (editingResourceId) {
            const idx = state.vault.findIndex(v => v.id === editingResourceId);
            state.vault[idx] = { ...state.vault[idx], ...data };
            addActivity('&#128218;', `Resource "${esc(title)}" diperbarui`);
            toast('Resource berhasil diperbarui');
        } else {
            state.vault.push({ id: uid('vault'), date: new Date().toISOString(), ...data });
            addActivity('&#128218;', `Resource baru "${esc(title)}" ditambahkan`);
            toast('Resource berhasil ditambahkan');
        }
        saveVault();
        closeModal('modal-vault');
        renderResources();
        renderDashboard();
    }

    /* ================= BOOKMARKS ================= */
    let bookmarkFilter = 'All';
    let bookmarkPage = 1;
    let editingBookmarkId = null;
    const BOOKMARK_CATEGORIES = ['Project', 'Catatan Penting'];
    function bookmarkCategoryMeta(category) {
        const map = {
            'Project': { ic: '<span class="mdi mdi-folder-star-outline"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            'Catatan Penting': { ic: '<span class="mdi mdi-file-star-outline"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' }
        };
        return map[category] || { ic: '<span class="mdi mdi-bookmark-multiple-outline"></span>', bg: '#f3f4f6', fg: '#4b5563' };
    }

    function renderBookmarks() {
        let list = state.vault.filter(v => v.section === 'bookmarks');

        document.getElementById('bookmarks-stat-total').textContent = list.length;
        const thisMonth = new Date().getMonth();
        document.getElementById('bookmarks-stat-month').textContent = list.filter(v => new Date(v.date).getMonth() === thisMonth).length;
        document.getElementById('bookmarks-stat-3').textContent = list.filter(v => v.category === 'Project').length;

        if (bookmarkFilter !== 'All') list = list.filter(v => v.category === bookmarkFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(v => v.title.toLowerCase().includes(q) || (v.desc || '').toLowerCase().includes(q));
        list = list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        bookmarkPage = clamp(bookmarkPage, 1, totalPages);
        const pageItems = list.slice((bookmarkPage - 1) * PAGE_SIZE, bookmarkPage * PAGE_SIZE);

        document.getElementById('bookmarks-list').innerHTML = pageItems.map(v => {
            const meta = bookmarkCategoryMeta(v.category);
            const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
            return `<div class="file-row">
        <div class="file-icon" style="background:${meta.bg};color:${meta.fg};">${meta.ic}</div>
        <div class="file-main">
          <div class="n">${esc(v.title)}</div>
          <div class="p">${esc((v.desc || '').slice(0, 80))}${(v.desc || '').length > 80 ? '&hellip;' : ''}</div>
        </div>
        <div class="file-col"><span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span></div>
        <div class="file-col">${proj ? esc(proj.name) : '<span style="color:var(--text-muted);">&#8212;</span>'}</div>
        <div class="file-col">${fmtDate(v.date.slice(0, 10))}</div>
        <div class="proj-actions">
          ${v.url ? `<button class="icon-btn" title="Buka Tautan" data-openurl="${v.id}"><span class="mdi mdi-link"></span></button>` : ''}
          <button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="mdi mdi-pencil"></span></button>
          <button class="icon-btn" title="Lihat Detail" data-view="${v.id}"><span class="mdi mdi-eye"></span></button>
          <button class="icon-btn danger" title="Hapus" data-del="${v.id}"><span class="mdi mdi-trash-can"></span></button>
        </div>
      </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-bookmark-multiple-outline"></span></div><h4>Belum ada bookmark</h4><p>Simpan project atau catatan penting agar mudah ditemukan lagi.</p></div>`;

        document.getElementById('bookmarks-pager').innerHTML = pagerHTML(bookmarkPage, totalPages, list.length, 'bookmarks');
        wirePager('bookmarks', totalPages, p => { bookmarkPage = p; renderBookmarks(); });

        document.querySelectorAll('#bookmarks-list [data-edit]').forEach(b => b.onclick = () => openBookmarkModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#bookmarks-list [data-del]').forEach(b => b.onclick = () => confirmDelete('vault', b.getAttribute('data-del')));
        document.querySelectorAll('#bookmarks-list [data-view]').forEach(b => b.onclick = () => showBookmarkDetail(b.getAttribute('data-view')));
        document.querySelectorAll('#bookmarks-list [data-openurl]').forEach(b => b.onclick = () => {
            const item = state.vault.find(x => x.id === b.getAttribute('data-openurl'));
            if (item && item.url) window.open(item.url, '_blank');
        });
    }

    function showBookmarkDetail(id) {
        const v = state.vault.find(x => x.id === id);
        if (!v) { toast('Item tidak ditemukan'); return; }

        document.getElementById('vaultdetail-title-head').textContent = 'Detail Bookmark';

        const imgEl = document.getElementById('vaultdetail-image');
        imgEl.removeAttribute('src'); imgEl.style.display = 'none';

        document.getElementById('vaultdetail-title').textContent = v.title;
        document.getElementById('vaultdetail-desc').textContent = v.desc || '-';

        const meta = bookmarkCategoryMeta(v.category);
        document.getElementById('vaultdetail-category').innerHTML = `<span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span>`;

        const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
        document.getElementById('vaultdetail-project').textContent = proj ? proj.name : '\u2014';

        document.getElementById('vaultdetail-tags').innerHTML = (v.tags && v.tags.length)
            ? v.tags.map(t => `<span class="type-chip" style="background:var(--bg);color:var(--text-muted);margin-right:4px;">${esc(t)}</span>`).join('')
            : '\u2014';

        document.getElementById('vaultdetail-date').textContent = fmtDate(v.date.slice(0, 10));

        const linkBtn = document.getElementById('vaultdetail-link-btn');
        linkBtn.classList.add('hidden');

        openModal('modal-vault-detail');
    }

    function openBookmarkModal(id) {
        vaultCurrentSection = 'bookmarks';
        editingBookmarkId = id || null;
        const v = id ? state.vault.find(x => x.id === id) : null;

        document.getElementById('vault-modal-title').textContent = (v ? 'Edit ' : 'Tambah ') + 'Bookmark';
        document.getElementById('vault-title-label').textContent = 'Judul Bookmark';
        document.getElementById('vault-title').value = v ? v.title : '';
        document.getElementById('vault-desc').value = v ? v.desc : '';
        document.getElementById('vault-url').value = v ? (v.url || '') : '';
        document.getElementById('vault-tags').value = v && v.tags ? v.tags.join(', ') : '';

        const catSelect = document.getElementById('vault-category');
        catSelect.innerHTML = BOOKMARK_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        catSelect.value = v ? v.category : BOOKMARK_CATEGORIES[0];

        const projSelect = document.getElementById('vault-project');
        projSelect.innerHTML = '<option value="">- Tidak ada -</option>' + state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        projSelect.value = v && v.projectId ? v.projectId : '';

        document.getElementById('vault-url-group').style.display = 'none';
        document.getElementById('vault-project-group').style.display = '';
        document.getElementById('vault-image-group').style.display = 'none';

        openModal('modal-vault');
    }
    function saveBookmarkFromModal() {
        const title = document.getElementById('vault-title').value.trim();
        if (!title) { toast('Judul Bookmark wajib diisi'); return; }
        const tags = document.getElementById('vault-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const data = {
            section: 'bookmarks',
            title,
            desc: document.getElementById('vault-desc').value.trim(),
            category: document.getElementById('vault-category').value,
            url: null,
            projectId: document.getElementById('vault-project').value || null,
            image: null,
            tags
        };
        if (editingBookmarkId) {
            const idx = state.vault.findIndex(v => v.id === editingBookmarkId);
            state.vault[idx] = { ...state.vault[idx], ...data };
            addActivity('&#128278;', `Bookmark "${esc(title)}" diperbarui`);
            toast('Bookmark berhasil diperbarui');
        } else {
            state.vault.push({ id: uid('vault'), date: new Date().toISOString(), ...data });
            addActivity('&#128278;', `Bookmark baru "${esc(title)}" ditambahkan`);
            toast('Bookmark berhasil ditambahkan');
        }
        saveVault();
        closeModal('modal-vault');
        renderBookmarks();
        renderDashboard();
    }

    /* ================= REPOSITORY ================= */
    let repositoryFilter = 'All';
    let repositoryPage = 1;
    let editingRepositoryId = null;
    const REPOSITORY_CATEGORIES = ['Git Repository', 'Dokumentasi', 'Code Snippet', 'Package / Library'];
    function repositoryCategoryMeta(category) {
        const map = {
            'Git Repository': { ic: '<span class="mdi mdi-git"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            'Dokumentasi': { ic: '<span class="mdi mdi-file-document-outline"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            'Code Snippet': { ic: '<span class="mdi mdi-code-tags"></span>', bg: 'var(--purple-soft)', fg: 'var(--purple)' },
            'Package / Library': { ic: '<span class="mdi mdi-package-variant"></span>', bg: 'var(--orange-soft)', fg: 'var(--orange)' }
        };
        return map[category] || { ic: '<span class="mdi mdi-database-outline"></span>', bg: '#f3f4f6', fg: '#4b5563' };
    }

    function renderRepository() {
        let list = state.vault.filter(v => v.section === 'repository');

        document.getElementById('repository-stat-total').textContent = list.length;
        const thisMonth = new Date().getMonth();
        document.getElementById('repository-stat-month').textContent = list.filter(v => new Date(v.date).getMonth() === thisMonth).length;
        document.getElementById('repository-stat-3').textContent = list.filter(v => v.projectId).length;

        if (repositoryFilter !== 'All') list = list.filter(v => v.category === repositoryFilter);
        const q = document.getElementById('global-search').value.trim().toLowerCase();
        if (q) list = list.filter(v => v.title.toLowerCase().includes(q) || (v.desc || '').toLowerCase().includes(q));
        list = list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        repositoryPage = clamp(repositoryPage, 1, totalPages);
        const pageItems = list.slice((repositoryPage - 1) * PAGE_SIZE, repositoryPage * PAGE_SIZE);

        document.getElementById('repository-list').innerHTML = pageItems.map(v => {
            const meta = repositoryCategoryMeta(v.category);
            const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
            return `<div class="file-row">
        <div class="file-icon" style="background:${meta.bg};color:${meta.fg};">${meta.ic}</div>
        <div class="file-main">
          <div class="n">${esc(v.title)}</div>
          <div class="p">${esc((v.desc || '').slice(0, 80))}${(v.desc || '').length > 80 ? '&hellip;' : ''}</div>
        </div>
        <div class="file-col"><span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span></div>
        <div class="file-col">${proj ? esc(proj.name) : '<span style="color:var(--text-muted);">&#8212;</span>'}</div>
        <div class="file-col">${fmtDate(v.date.slice(0, 10))}</div>
        <div class="proj-actions">
          ${v.url ? `<button class="icon-btn" title="Buka Tautan" data-openurl="${v.id}"><span class="mdi mdi-link"></span></button>` : ''}
          <button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="mdi mdi-pencil"></span></button>
          <button class="icon-btn" title="Lihat Detail" data-view="${v.id}"><span class="mdi mdi-eye"></span></button>
          <button class="icon-btn danger" title="Hapus" data-del="${v.id}"><span class="mdi mdi-trash-can"></span></button>
        </div>
      </div>`;
        }).join('') || `<div class="empty-state"><div class="ic"><span class="mdi mdi-database-outline"></span></div><h4>Belum ada repository</h4><p>Tambahkan link repository kode atau dokumentasi project.</p></div>`;

        document.getElementById('repository-pager').innerHTML = pagerHTML(repositoryPage, totalPages, list.length, 'repository');
        wirePager('repository', totalPages, p => { repositoryPage = p; renderRepository(); });

        document.querySelectorAll('#repository-list [data-edit]').forEach(b => b.onclick = () => openRepositoryModal(b.getAttribute('data-edit')));
        document.querySelectorAll('#repository-list [data-del]').forEach(b => b.onclick = () => confirmDelete('vault', b.getAttribute('data-del')));
        document.querySelectorAll('#repository-list [data-view]').forEach(b => b.onclick = () => showRepositoryDetail(b.getAttribute('data-view')));
        document.querySelectorAll('#repository-list [data-openurl]').forEach(b => b.onclick = () => {
            const item = state.vault.find(x => x.id === b.getAttribute('data-openurl'));
            if (item && item.url) window.open(item.url, '_blank');
        });
    }

    function showRepositoryDetail(id) {
        const v = state.vault.find(x => x.id === id);
        if (!v) { toast('Item tidak ditemukan'); return; }

        document.getElementById('vaultdetail-title-head').textContent = 'Detail Repository';

        const imgEl = document.getElementById('vaultdetail-image');
        imgEl.removeAttribute('src'); imgEl.style.display = 'none';

        document.getElementById('vaultdetail-title').textContent = v.title;
        document.getElementById('vaultdetail-desc').textContent = v.desc || '-';

        const meta = repositoryCategoryMeta(v.category);
        document.getElementById('vaultdetail-category').innerHTML = `<span class="type-chip" style="background:${meta.bg};color:${meta.fg};">${esc(v.category)}</span>`;

        const proj = v.projectId ? state.projects.find(p => p.id === v.projectId) : null;
        document.getElementById('vaultdetail-project').textContent = proj ? proj.name : '\u2014';

        document.getElementById('vaultdetail-tags').innerHTML = (v.tags && v.tags.length)
            ? v.tags.map(t => `<span class="type-chip" style="background:var(--bg);color:var(--text-muted);margin-right:4px;">${esc(t)}</span>`).join('')
            : '\u2014';

        document.getElementById('vaultdetail-date').textContent = fmtDate(v.date.slice(0, 10));

        const linkBtn = document.getElementById('vaultdetail-link-btn');
        if (v.url) { linkBtn.classList.remove('hidden'); linkBtn.onclick = () => window.open(v.url, '_blank'); }
        else { linkBtn.classList.add('hidden'); }

        openModal('modal-vault-detail');
    }

    function openRepositoryModal(id) {
        vaultCurrentSection = 'repository';
        editingRepositoryId = id || null;
        const v = id ? state.vault.find(x => x.id === id) : null;

        document.getElementById('vault-modal-title').textContent = (v ? 'Edit ' : 'Tambah ') + 'Repository';
        document.getElementById('vault-title-label').textContent = 'Nama Repository';
        document.getElementById('vault-title').value = v ? v.title : '';
        document.getElementById('vault-desc').value = v ? v.desc : '';
        document.getElementById('vault-url').value = v ? (v.url || '') : '';
        document.getElementById('vault-tags').value = v && v.tags ? v.tags.join(', ') : '';

        const catSelect = document.getElementById('vault-category');
        catSelect.innerHTML = REPOSITORY_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        catSelect.value = v ? v.category : REPOSITORY_CATEGORIES[0];

        const projSelect = document.getElementById('vault-project');
        projSelect.innerHTML = '<option value="">- Tidak ada -</option>' + state.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
        projSelect.value = v && v.projectId ? v.projectId : '';

        document.getElementById('vault-url-group').style.display = '';
        document.getElementById('vault-project-group').style.display = '';
        document.getElementById('vault-image-group').style.display = 'none';

        openModal('modal-vault');
    }
    function saveRepositoryFromModal() {
        const title = document.getElementById('vault-title').value.trim();
        if (!title) { toast('Nama Repository wajib diisi'); return; }
        const tags = document.getElementById('vault-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const data = {
            section: 'repository',
            title,
            desc: document.getElementById('vault-desc').value.trim(),
            category: document.getElementById('vault-category').value,
            url: document.getElementById('vault-url').value.trim() || null,
            projectId: document.getElementById('vault-project').value || null,
            image: null,
            tags
        };
        if (editingRepositoryId) {
            const idx = state.vault.findIndex(v => v.id === editingRepositoryId);
            state.vault[idx] = { ...state.vault[idx], ...data };
            addActivity('&#127963;&#65039;', `Repository "${esc(title)}" diperbarui`);
            toast('Repository berhasil diperbarui');
        } else {
            state.vault.push({ id: uid('vault'), date: new Date().toISOString(), ...data });
            addActivity('&#127963;&#65039;', `Repository baru "${esc(title)}" ditambahkan`);
            toast('Repository berhasil ditambahkan');
        }
        saveVault();
        closeModal('modal-vault');
        renderRepository();
        renderDashboard();
    }

    /* ================= NOTIFICATIONS (bell popup) ================= */
    function notifIconMeta(type) {
        const map = {
            project: { ic: '<span class="mdi mdi-folder-zip-outline"></span>', bg: 'var(--green-soft)', fg: 'var(--green)' },
            task: { ic: '<span class="mdi mdi-file-chart-outline"></span>', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
            milestone: { ic: '<span class="mdi mdi-bullseye-arrow"></span>', bg: 'var(--orange-soft)', fg: 'var(--orange)' },
            calendar: { ic: '<span class="mdi mdi-calendar-month"></span>', bg: 'var(--purple-soft)', fg: 'var(--purple)' },
            file: { ic: '<span class="mdi mdi-file-outline"></span>', bg: 'var(--red-soft)', fg: 'var(--red)' },
            comments: { ic: '<span class="mdi mdi-comment-processing-outline"></span>', bg: 'var(--pink-soft)', fg: 'var(--pink)' },
            security: { ic: '<span class="mdi mdi-shield-lock-outline"></span>', bg: 'var(--red-soft)', fg: 'var(--red)' }
        };
        return map[type] || { ic: '&#128276;', bg: '#f3f4f6', fg: '#4b5563' };
    }
    function renderNotifPanel() {
        const unread = state.notifItems.filter(n => !n.read).length;
        const bell = document.getElementById('bell-count');
        bell.textContent = unread > 9 ? '9+' : String(unread);
        bell.classList.toggle('hidden', unread === 0);

        const sorted = [...state.notifItems].sort((a, b) => b.time - a.time);
        document.getElementById('notif-panel-list').innerHTML = sorted.map(n => {
            const m = notifIconMeta(n.type);
            return `<div class="notif-item ${n.read ? '' : 'unread'}" data-notif="${n.id}">
        <div class="notif-ic" style="background:${m.bg};color:${m.fg};">${m.ic}</div>
        <div class="notif-main"><div class="t">${esc(n.title)}</div><div class="ti">${relTime(n.time)}</div></div>
        ${!n.read ? '<span class="notif-dot"></span>' : ''}
      </div>`;
        }).join('') || `<div class="empty-state" style="padding:34px 20px;"><div class="ic"><span class="mdi mdi-bell-outline"></span></div><h4>Tidak ada notifikasi</h4></div>`;

        document.querySelectorAll('#notif-panel-list [data-notif]').forEach(el => el.onclick = () => {
            const n = state.notifItems.find(x => x.id === el.getAttribute('data-notif'));
            if (!n) return;
            if (!n.read) { n.read = true; saveNotifItems(); renderNotifPanel(); }
            const panel = document.getElementById('notif-panel');
            if (panel) panel.classList.add('hidden');
            // Klik notifikasi membawa pengguna langsung ke item terkait, bukan cuma menandai dibaca.
            if (n.refView) {
                navigate(n.refView);
                if (n.refView === 'calendar' && n.refDate) {
                    calCursor = new Date(n.refDate + 'T00:00:00');
                    renderCalGrid();
                } else if (n.refId) {
                    setTimeout(() => {
                        if (n.refView === 'projects') showDetailProject(n.refId);
                        else if (n.refView === 'milestones') showDetailMilestone(n.refId);
                        else if (n.refView === 'files') previewFile(n.refId);
                    }, 0);
                }
            }
        });
    }

    /* ================= NOTIFICATIONS — ENGINE (trigger nyata, bukan cuma data demo) =================
       Semua bagian aplikasi (project, milestone, file, calendar) memanggil pushNotification()
       ketika ada kejadian yang relevan. Fungsi ini menghormati pengaturan pengguna di
       Settings > Notifications: tipe notifikasi yang dimatikan tidak akan muncul, dan jika
       "Browser Notifications" aktif serta izin browser diberikan, notifikasi desktop asli
       juga akan ditembakkan (kecuali saat Quiet Hours, atau memang ditandai urgent). */
    function notifTypeAllowed(type) {
        if (!state.notifications) return true;
        if (!state.notifications.types || !(type in state.notifications.types)) return true;
        return !!state.notifications.types[type];
    }
    function isQuietHoursNow() {
        const q = state.notifications && state.notifications.quiet;
        if (!q || !q.enabled || !q.start || !q.end) return false;
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = q.start.split(':').map(Number);
        const [eh, em] = q.end.split(':').map(Number);
        const start = sh * 60 + sm, end = eh * 60 + em;
        if (start === end) return false;
        if (start < end) return cur >= start && cur < end;
        return cur >= start || cur < end; // rentang lintas tengah malam, mis. 22:00 - 07:00
    }
    function fireBrowserNotification(title, body) {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        try { new Notification(title, { body: body || '', icon: 'image/logo-icono.png' }); }
        catch (e) { /* beberapa browser mobile tidak mendukung constructor ini, abaikan dengan aman */ }
    }
    function requestBrowserNotifPermission() {
        if (!('Notification' in window)) return Promise.resolve('unsupported');
        if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            return Promise.resolve(Notification.permission);
        }
        return Notification.requestPermission();
    }
    /**
     * Tambahkan notifikasi baru (isi panel bel + badge + notifikasi browser bila diizinkan).
     * opts: { refView, refId, refDate, key, urgent, body }
     * - key: dipakai untuk mencegah duplikat pada notifikasi pengingat (deadline/acara) yang dicek berkala.
     * - urgent: lewati filter tipe & Quiet Hours (dipakai untuk hal penting seperti keamanan akun).
     */
    function pushNotification(type, title, opts) {
        opts = opts || {};
        if (!state.notifications || !state.notifItems) return;
        if (opts.key && state.notifItems.some(n => n.key === opts.key)) return; // sudah pernah dikirim
        if (!opts.urgent && !notifTypeAllowed(type)) return;

        const item = { id: uid('notif'), type, title, time: Date.now(), read: false };
        if (opts.refView) item.refView = opts.refView;
        if (opts.refId) item.refId = opts.refId;
        if (opts.refDate) item.refDate = opts.refDate;
        if (opts.key) item.key = opts.key;
        state.notifItems.unshift(item);
        if (state.notifItems.length > 60) state.notifItems = state.notifItems.slice(0, 60);
        saveNotifItems();
        renderNotifPanel();

        if (state.notifications.browser && (opts.urgent || !isQuietHoursNow())) {
            fireBrowserNotification(title, opts.body);
        }
    }
    function daysUntil(dateStr) {
        if (!dateStr) return NaN;
        const target = new Date(dateStr + 'T00:00:00').getTime();
        const today = new Date(todayStr() + 'T00:00:00').getTime();
        return Math.round((target - today) / 86400000);
    }
    /* Dipanggil saat login & tiap interval singkat: mengecek deadline project/milestone yang
       mendekat/lewat serta acara kalender yang akan segera dimulai, lalu memicu notifikasi
       (sekali saja per kejadian, berkat dedup "key" di atas). */
    function checkReminders() {
        if (!state.notifications || !state.notifItems) return;

        (state.projects || []).forEach(p => {
            if (p.status === 'Completed' || p.status === 'Archived') return;
            const d = daysUntil(p.deadline);
            if (d < 0) {
                pushNotification('project', `Project "${p.name}" telah melewati deadline`, {
                    refView: 'projects', refId: p.id, key: `proj-overdue:${p.id}:${p.deadline}`
                });
            } else if (d <= 2) {
                const label = d === 0 ? 'hari ini' : (d === 1 ? '1 hari lagi' : `${d} hari lagi`);
                pushNotification('project', `Project "${p.name}" mendekati deadline (${label})`, {
                    refView: 'projects', refId: p.id, key: `proj-deadline:${p.id}:${p.deadline}`
                });
            }
        });

        (state.milestones || []).forEach(m => {
            if (m.status === 'Completed') return;
            const d = daysUntil(m.deadline);
            if (d < 0) {
                pushNotification('milestone', `Milestone "${m.title}" telah melewati deadline`, {
                    refView: 'milestones', refId: m.id, key: `ms-overdue:${m.id}:${m.deadline}`
                });
            } else if (d <= 2) {
                const label = d === 0 ? 'hari ini' : (d === 1 ? '1 hari lagi' : `${d} hari lagi`);
                pushNotification('milestone', `Milestone "${m.title}" mendekati deadline (${label})`, {
                    refView: 'milestones', refId: m.id, key: `ms-deadline:${m.id}:${m.deadline}`
                });
            }
        });

        const now = Date.now();
        (state.events || []).forEach(e => {
            if (!e.time) return;
            const evtTime = new Date(e.date + 'T' + e.time + ':00').getTime();
            const diffMin = (evtTime - now) / 60000;
            if (diffMin > 0 && diffMin <= 60) {
                const mins = Math.max(1, Math.round(diffMin));
                pushNotification('calendar', `Acara "${e.title}" akan dimulai dalam ${mins} menit`, {
                    refView: 'calendar', refDate: e.date, key: `evt:${e.id}:${e.date}:${e.time}`
                });
            }
        });
    }

    /* ================= SETTINGS ================= */
    function renderSettingsAll() {
        renderSettingsProfile();
        renderSettingsPassword();
        renderSettingsNotifications();
    }
    function renderSettingsProfile() {
        const p = state.profile;
        document.getElementById('set-fullname').value = p.fullName;
        document.getElementById('set-email').value = p.email;
        document.getElementById('set-jobtitle').value = p.jobTitle;
        document.getElementById('set-company').value = p.company;
        document.getElementById('set-bio').value = p.bio;
        document.getElementById('acc-member-since').textContent = fmtDate(p.memberSince);
        document.getElementById('acc-last-login').textContent = fmtDateTime(p.lastLogin);
        document.getElementById('acc-type').textContent = p.accountType || 'Demo Account';
        updateAvatarDisplays();
        updateStorageUsage();
    }
    function updateAvatarDisplays() {
        const p = state.profile;
        const html = p.avatar ? `<img src="${p.avatar}">` : '&#128100;';
        document.getElementById('sb-avatar').innerHTML = html;
        document.getElementById('tb-avatar').innerHTML = html;
        document.getElementById('sb-username').textContent = p.fullName;
        document.getElementById('tb-username').textContent = p.fullName;
        document.getElementById('sb-userrole').textContent = p.jobTitle;
        const lg = document.getElementById('profile-avatar-lg');
        lg.innerHTML = (p.avatar ? `<img src="${p.avatar}">` : '&#128100;') + '<div class="avatar-edit-btn" id="avatar-edit-btn">&#128247;</div>';
        document.getElementById('avatar-edit-btn').onclick = () => document.getElementById('avatar-input').click();
    }
    function renderSettingsPassword() {
        document.getElementById('last-pw-change').textContent = new Date(state.profile.lastPasswordChange).toLocaleString();
        ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => document.getElementById(id).value = '');
        updatePwChecklist('');
    }
    function updatePwChecklist(val) {
        const checks = {
            len: val.length >= 8,
            num: /[0-9]/.test(val),
            upper: /[A-Z]/.test(val),
            special: /[^A-Za-z0-9]/.test(val)
        };
        document.getElementById('pw-check-len').classList.toggle('ok', checks.len);
        document.getElementById('pw-check-num').classList.toggle('ok', checks.num);
        document.getElementById('pw-check-upper').classList.toggle('ok', checks.upper);
        document.getElementById('pw-check-special').classList.toggle('ok', checks.special);
        const score = Object.values(checks).filter(Boolean).length;
        ['pw-bar-1', 'pw-bar-2', 'pw-bar-3', 'pw-bar-4'].forEach((id, i) => {
            const colors = ['#dc2626', '#d97706', '#eab308', '#16a34a'];
            document.getElementById(id).style.background = i < score ? colors[score - 1] : '';
        });
    }
    function renderSettingsNotifications() {
        const n = state.notifications;
        document.getElementById('notif-email').checked = n.email;
        document.getElementById('notif-browser').checked = n.browser;
        const browserSub = document.getElementById('notif-browser-sub');
        if (browserSub) {
            if (!('Notification' in window)) {
                browserSub.textContent = 'Browser ini tidak mendukung notifikasi desktop';
            } else if (Notification.permission === 'denied') {
                browserSub.textContent = 'Diblokir oleh browser — aktifkan lewat pengaturan izin situs';
            } else if (Notification.permission === 'granted') {
                browserSub.textContent = 'Izin browser aktif — notifikasi desktop akan muncul';
            } else {
                browserSub.textContent = 'Terima notifikasi di browser';
            }
        }
        document.getElementById('quiet-start').value = n.quiet.start;
        document.getElementById('quiet-end').value = n.quiet.end;
        document.getElementById('quiet-enabled').checked = n.quiet.enabled;
        const types = [
            { key: 'project', ic: '<span class="mdi mdi-folder-zip-outline"></span>', bg: 'var(--green-soft)', title: 'Project Updates', sub: 'Update tentang status, perubahan, dan progress project' },
            { key: 'task', ic: '<span class="mdi mdi-file-chart-outline"></span>', bg: 'var(--blue-soft)', title: 'Task Assignments', sub: 'Ketika anda ditugaskan pada sebuah task' },
            { key: 'milestone', ic: '<span class="mdi mdi-bullseye-arrow"></span>', bg: 'var(--orange-soft)', title: 'Milestone Reminders', sub: 'Pengingat dan update tentang milestone' },
            { key: 'calendar', ic: '<span class="mdi mdi-calendar-month"></span>', bg: 'var(--purple-soft)', title: 'Calendar Events', sub: 'Pengingat acara dan jadwal mendatang', },
            { key: 'file', ic: '<span class="mdi mdi-file-outline"></span>', bg: 'var(--red-soft)', title: 'File Activity', sub: 'Ketika file diupload, dibagikan, atau diperbarui' },
            { key: 'comments', ic: '<span class="mdi mdi-comment-processing-outline"></span>', bg: 'var(--pink-soft)', title: 'Comments & Mentions', sub: 'Ketika seseorang berkomentar atau menyebut anda' }
        ];
        document.getElementById('notif-types-list').innerHTML = types.map(t => `
    <div class="pref-row">
      <div class="pref-left"><div class="pref-ic" style="background:${t.bg};">${t.ic}</div><div><div class="pref-t">${t.title}</div><div class="pref-s">${t.sub}</div></div></div>
      <label class="toggle"><input type="checkbox" data-notiftype="${t.key}" ${n.types[t.key] ? 'checked' : ''}><span class="slider"></span></label>
    </div>`).join('');
    }

    function applyAppearanceToDOM() {
        const a = state.appearance;
        const body = document.body;
        const wantsDark = a.theme === 'dark' || (a.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        body.classList.toggle('theme-dark', wantsDark);
        body.classList.toggle('sidebar-dark', a.sidebarStyle === 'dark');
        body.classList.remove('font-small', 'font-large');
        if (a.fontSize === 'small') body.classList.add('font-small');
        if (a.fontSize === 'large') body.classList.add('font-large');
        const acc = ACCENTS[a.accent] || ACCENTS.blue;
        document.documentElement.style.setProperty('--accent', acc.c);
        document.documentElement.style.setProperty('--accent-soft', acc.soft);
        document.documentElement.style.setProperty('--blue', acc.c);
        document.documentElement.style.setProperty('--blue-soft', acc.soft);
    }

    /* Tombol cepat di topbar: toggle light/dark, langsung diterapkan & tersimpan. */
    function toggleThemeQuick() {
        const body = document.body;
        const isDarkNow = body.classList.contains('theme-dark');
        state.appearance.theme = isDarkNow ? 'light' : 'dark';
        body.classList.add('theme-transition');
        applyAppearanceToDOM();
        sSet(acctKey('appearance'), state.appearance);
        clearTimeout(toggleThemeQuick._t);
        toggleThemeQuick._t = setTimeout(() => body.classList.remove('theme-transition'), 400);
    }

    /* ================= MODALS (generic) ================= */
    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
    function wireModalCloseButtons() {
        document.querySelectorAll('.modal-overlay').forEach(ov => {
            ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); });
            ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ov.classList.add('hidden')));
        });
    }

    let pendingDelete = null;
    function confirmDelete(kind, id, customMsg) {
        pendingDelete = { kind, id };
        const labels = { project: 'project ini', milestone: 'milestone ini', file: 'file ini', event: 'acara ini', activity: 'semua log aktivitas', vault: 'item ini' };
        document.getElementById('confirm-title').textContent = 'Hapus item ini?';
        document.getElementById('confirm-msg').textContent = customMsg || `Anda yakin ingin menghapus ${labels[kind] || 'item ini'}? Tindakan ini tidak dapat dibatalkan.`;
        openModal('modal-confirm');
    }
    function doPendingDelete() {
        if (!pendingDelete) return;
        const { kind, id } = pendingDelete;
        if (kind === 'project') {
            const p = state.projects.find(x => x.id === id);
            state.projects = state.projects.filter(x => x.id !== id);
            saveProjects();
            if (p) addActivity('&#128465;', `Project "${esc(p.name)}" dihapus`);
            renderProjects(); renderDashboard();
        } else if (kind === 'milestone') {
            const m = state.milestones.find(x => x.id === id);
            state.milestones = state.milestones.filter(x => x.id !== id);
            saveMilestones();
            if (m) addActivity('&#128465;', `Milestone "${esc(m.title)}" dihapus`);
            renderMilestones(); renderDashboard();
        } else if (kind === 'file') {
            const f = state.files.find(x => x.id === id);
            state.files = state.files.filter(x => x.id !== id);
            saveFiles();
            if (f) addActivity('&#128465;', `File "${esc(f.name)}" dihapus`);
            renderFiles(); renderDashboard();
        } else if (kind === 'event') {
            state.events = state.events.filter(x => x.id !== id);
            saveEvents();
            renderCalendar(); renderDashboard();
        } else if (kind === 'activity') {
            state.activity = [];
            saveActivity();
            renderDashboard();
            toast('Riwayat aktivitas berhasil dihapus');
        } else if (kind === 'vault') {
            const v = state.vault.find(x => x.id === id);
            state.vault = state.vault.filter(x => x.id !== id);
            saveVault();
            if (v) {
                const labels = { assets: 'Asset', resources: 'Resource', bookmarks: 'Bookmark', repository: 'Repository' };
                addActivity('&#128465;', `${labels[v.section] || 'Item'} "${esc(v.title)}" dihapus`);
                if (v.section === 'assets') renderAssets();
                else if (v.section === 'resources') renderResources();
                else if (v.section === 'bookmarks') renderBookmarks();
                else if (v.section === 'repository') renderRepository();
            }
            renderDashboard();
        }
        pendingDelete = null;
        closeModal('modal-confirm');
        updateStorageUsage();
        toast('Berhasil dihapus');
    }

    /* ================= AUTH ================= */
    const AUTH_VIEWS = ['signin', 'signup', 'reset'];
    const DEMO_ACCOUNT_EMAIL = 'demo123@gmail.com';
    let loggedInEmail = null; // email of the account currently active in state.profile
    let loggedInAccountId = null; // stable id used to namespace this account's own data in storage

    /* Setiap akun punya "kotak data" sendiri di localStorage (projects, milestones,
       files, events, vault, notifikasi, profil, dst) berdasarkan id akun yang stabil,
       supaya akun Google/akun lain TIDAK ikut melihat data akun lain. */
    function acctKey(base, idOverride) {
        const id = idOverride || loggedInAccountId || 'guest';
        return 'devnotes:acct:' + id + ':' + base;
    }
    function saveProfile() { sSet(acctKey('profile'), state.profile); }

    function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim()); }

    function findAccount(email) {
        const e = (email || '').trim().toLowerCase();
        if (!e) return null;
        return state.accounts.find(a => a.email === e) || null;
    }

    function pwChecks(val) {
        val = val || '';
        return {
            len: val.length >= 8,
            upper: /[A-Z]/.test(val),
            num: /[0-9]/.test(val),
            special: /[^A-Za-z0-9]/.test(val)
        };
    }
    function pwIsStrong(val) {
        const c = pwChecks(val);
        return c.len && c.upper && c.num && c.special;
    }
    function updateAuthPwChecklist(prefix, val) {
        const c = pwChecks(val);
        const idLen = document.getElementById(prefix + '-pw-check-len');
        const idUpper = document.getElementById(prefix + '-pw-check-upper');
        const idNum = document.getElementById(prefix + '-pw-check-num');
        const idSpecial = document.getElementById(prefix + '-pw-check-special');
        if (idLen) idLen.classList.toggle('ok', c.len);
        if (idUpper) idUpper.classList.toggle('ok', c.upper);
        if (idNum) idNum.classList.toggle('ok', c.num);
        if (idSpecial) idSpecial.classList.toggle('ok', c.special);
    }

    function flashError(inputEl) {
        if (!inputEl) return;
        inputEl.classList.add('input-error');
        inputEl.focus();
        clearTimeout(flashError._h);
        flashError._h = setTimeout(() => inputEl.classList.remove('input-error'), 1600);
    }

    /* ---- session persistence: localStorage (remember me) or sessionStorage (this tab only) ---- */
    function persistSession(email, remember) {
        const payload = JSON.stringify({ email: email });
        try {
            if (remember) {
                localStorage.setItem('devnotes:session', payload);
                sessionStorage.removeItem('devnotes:session');
            } else {
                sessionStorage.setItem('devnotes:session', payload);
                localStorage.removeItem('devnotes:session');
            }
        } catch (e) { /* storage unavailable, ignore */ }
    }
    function readSession() {
        try {
            const raw = localStorage.getItem('devnotes:session') || sessionStorage.getItem('devnotes:session');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function clearSession() {
        try { localStorage.removeItem('devnotes:session'); sessionStorage.removeItem('devnotes:session'); } catch (e) { }
    }
    function updateSessionEmail(newEmail) {
        try {
            if (localStorage.getItem('devnotes:session')) localStorage.setItem('devnotes:session', JSON.stringify({ email: newEmail }));
            if (sessionStorage.getItem('devnotes:session')) sessionStorage.setItem('devnotes:session', JSON.stringify({ email: newEmail }));
        } catch (e) { /* ignore */ }
    }

    /* Ganti "kotak data" aktif ke akun yang baru login (dipanggil saat sign in,
       login Google akun lama, atau saat sesi dipulihkan otomatis). */
    async function loginToAccount(account) {
        await loadAccountData(account);
        state.profile.lastLogin = new Date().toISOString();
        account.lastLogin = state.profile.lastLogin;
        saveProfile();
        saveAccounts();
        applyAppearanceToDOM();
        applyLanguageToUI();
        updateAvatarDisplays();
        renderNotifPanel();
        checkReminders();
    }

    function showAuthView(name) {
        document.getElementById('view-app').classList.add('hidden');
        AUTH_VIEWS.forEach(v => {
            const el = document.getElementById('view-auth-' + v);
            if (el) el.classList.toggle('hidden', v !== name);
        });
        window.scrollTo(0, 0);
    }

    function enterApp() {
        const activeAuthEl = AUTH_VIEWS
            .map(v => document.getElementById('view-auth-' + v))
            .find(el => el && !el.classList.contains('hidden'));

        function reveal() {
            AUTH_VIEWS.forEach(v => {
                const el = document.getElementById('view-auth-' + v);
                if (el) { el.classList.add('hidden'); el.classList.remove('auth-exiting'); }
            });
            const appShell = document.getElementById('view-app');
            appShell.classList.remove('hidden');
            appShell.classList.add('app-entering');
            navigate('dashboard');
            setTimeout(() => appShell.classList.remove('app-entering'), 700);
        }

        // Kalau layar auth sedang tampil, mainkan animasi keluar dulu (fade+scale+blur)
        // sebelum aplikasi utama muncul dengan animasi masuknya sendiri.
        if (activeAuthEl) {
            activeAuthEl.classList.add('auth-exiting');
            setTimeout(reveal, 320);
        } else {
            reveal();
        }
    }

    function authIllustrationHTML() {
        return '' +
            '<div class="dot-grid dg-top">' + '<span></span>'.repeat(30) + '</div>' +
            '<div class="auth-blob"></div>' +
            '<div class="brand auth-logo">' +
            '  <div class="cube brand-logo">' +
            '    <span class="mdi mdi-folder-outline brand-logo-folder"></span>' +
            '    <span class="mdi mdi-code-tags brand-logo-code"></span>' +
            '  </div>' +
            '  <div>' +
            '    <div class="brand-title">DevNotes</div>' +
            '    <div class="brand-sub">Project Manager</div>' +
            '  </div>' +
            '</div>' +
            '<div class="auth-tagline">Kelola Proyek.<br>Lebih Terstruktur.</div>' +
            '<div class="auth-underline"></div>' +
            '<p class="auth-desc">DevNotes membantu Anda mengelola proyek, deadline, dan milestone dengan lebih efisien.</p>' +
            '<div class="auth-illustration">' +
            '  <div class="illus-window">' +
            '    <div class="illus-window-bar"><span></span><span></span><span></span></div>' +
            '    <div class="illus-window-body">' +
            '      <div class="illus-card illus-card-folder"><span class="mdi mdi-folder-outline"></span></div>' +
            '      <div class="illus-card">' +
            '        <span class="illus-skel w-60"></span>' +
            '        <span class="illus-skel w-40"></span>' +
            '        <div class="illus-bars"><span style="height:40%"></span><span style="height:65%"></span><span style="height:50%"></span><span style="height:90%"></span></div>' +
            '      </div>' +
            '      <div class="illus-card">' +
            '        <div class="illus-donutrow">' +
            '          <div class="illus-donut"></div>' +
            '          <div class="illus-lines"><span class="illus-skel w-60"></span><span class="illus-skel w-40"></span></div>' +
            '        </div>' +
            '      </div>' +
            '      <div class="illus-card">' +
            '        <div class="illus-list-row"><span class="dash"></span><span class="bar"></span></div>' +
            '        <div class="illus-list-row"><span class="dash"></span><span class="bar" style="width:70%"></span></div>' +
            '        <div class="illus-list-row"><span class="dash"></span><span class="bar" style="width:85%"></span></div>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <div class="illus-float illus-float-calendar"><span class="mdi mdi-calendar-blank"></span></div>' +
            '  <div class="illus-float illus-float-checklist"><span class="mdi mdi-format-list-checks"></span></div>' +
            '  <div class="illus-float illus-float-target"><span class="mdi mdi-bullseye-arrow"></span></div>' +
            '</div>' +
            '<div class="dot-grid dg-bottom">' + '<span></span>'.repeat(25) + '</div>';
    }
    function renderAuthBranding() {
        document.querySelectorAll('[data-auth-illustration]').forEach(el => { el.innerHTML = authIllustrationHTML(); });
    }

    /* ---- Google Sign-In (Google Identity Services) ---- */
    let googleTokenClient = null;

    function isGoogleConfigured() {
        return typeof GOOGLE_CLIENT_ID === 'string' &&
            GOOGLE_CLIENT_ID.trim() !== '' &&
            GOOGLE_CLIENT_ID.indexOf('GANTI_DENGAN') !== 0;
    }

    function initGoogleAuth() {
        if (!isGoogleConfigured()) return; // belum dikonfigurasi, tombol akan menampilkan panduan saat diklik
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            // library GIS belum selesai dimuat (async), coba lagi sebentar
            setTimeout(initGoogleAuth, 300);
            return;
        }
        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: handleGoogleTokenResponse
        });
    }

    async function handleGoogleTokenResponse(tokenResponse) {
        if (!tokenResponse || tokenResponse.error) {
            toast('Login Google dibatalkan atau gagal');
            return;
        }
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: 'Bearer ' + tokenResponse.access_token }
            });
            if (!res.ok) throw new Error('userinfo request failed');
            const g = await res.json(); // g.email, g.name, g.picture, g.sub

            let account = findAccount(g.email);
            const isNewAccount = !account;
            if (!account) {
                account = {
                    id: uid('acc'),
                    fullName: g.name || (g.email ? g.email.split('@')[0] : 'Google User'),
                    email: g.email.toLowerCase(),
                    password: uid('gpw') + uid('gpw'), // acak, bukan untuk login manual
                    provider: 'google',
                    createdAt: todayStr()
                };
                state.accounts.push(account);
                saveAccounts();
            }

            // Muat "kotak data" khusus akun ini (kosong kalau baru, isi lama kalau sudah pernah login)
            await loadAccountData(account);
            state.profile.lastLogin = new Date().toISOString();
            account.lastLogin = state.profile.lastLogin;
            if (g.picture && !state.profile.avatar) { state.profile.avatar = g.picture; }
            saveProfile();
            saveAccounts();
            applyAppearanceToDOM();
            applyLanguageToUI();
            updateAvatarDisplays();
            renderSettingsAll();
            renderNotifPanel();
            toast(isNewAccount
                ? ('Akun Google berhasil terhubung! Selamat datang, ' + account.fullName)
                : ('Selamat datang kembali, ' + account.fullName + '!'));

            persistSession(account.email, true);
            enterApp();
        } catch (err) {
            toast('Gagal mengambil data akun Google, coba lagi');
        }
    }

    function handleGoogleSignInClick() {
        if (!isGoogleConfigured()) {
            toast('Google Sign-In belum dikonfigurasi. Isi GOOGLE_CLIENT_ID di bagian atas script.js');
            return;
        }
        if (!googleTokenClient) {
            toast('Google Sign-In sedang disiapkan, coba lagi sebentar');
            initGoogleAuth();
            return;
        }
        googleTokenClient.requestAccessToken();
    }

    async function handleSignIn() {
        const emailEl = document.getElementById('si-email');
        const pwEl = document.getElementById('si-password');
        const email = emailEl.value.trim();
        const pw = pwEl.value;
        const remember = document.getElementById('si-remember').checked;

        if (!email || !pw) { toast('Email dan password wajib diisi'); flashError(!email ? emailEl : pwEl); return; }
        const account = findAccount(email);
        if (!account) { toast('Email belum terdaftar, silakan sign up'); flashError(emailEl); return; }
        if (account.password !== pw) { toast('Password salah'); flashError(pwEl); return; }

        await loginToAccount(account);
        persistSession(account.email, remember);
        pwEl.value = '';
        renderSettingsAll();
        toast('Selamat datang kembali, ' + account.fullName + '!');
        enterApp();
    }

    async function handleSignUp() {
        const nameEl = document.getElementById('su-fullname');
        const emailEl = document.getElementById('su-email');
        const pwEl = document.getElementById('su-password');
        const cfEl = document.getElementById('su-confirm');
        const tosEl = document.getElementById('su-tos');

        const fullName = nameEl.value.trim();
        const email = emailEl.value.trim();
        const pw = pwEl.value;
        const cf = cfEl.value;

        if (!fullName) { toast('Nama lengkap wajib diisi'); flashError(nameEl); return; }
        if (!isValidEmail(email)) { toast('Format email tidak valid'); flashError(emailEl); return; }
        if (findAccount(email)) { toast('Email sudah terdaftar, silakan sign in'); flashError(emailEl); return; }
        if (!pwIsStrong(pw)) { toast('Password belum memenuhi semua syarat di bawah'); flashError(pwEl); return; }
        if (pw !== cf) { toast('Konfirmasi password tidak cocok'); flashError(cfEl); return; }
        if (!tosEl.checked) { toast('Anda harus menyetujui Terms of Service & Privacy Policy'); return; }

        const account = { id: uid('acc'), fullName: fullName, email: email.toLowerCase(), password: pw, createdAt: todayStr() };
        state.accounts.push(account);
        saveAccounts();

        // Akun baru -> otomatis dapat "kotak data" sendiri yang masih kosong,
        // bukan ikut memakai proyek/milestone milik akun lain.
        await loadAccountData(account);
        persistSession(account.email, true);

        [nameEl, emailEl, pwEl, cfEl].forEach(el => el.value = '');
        tosEl.checked = false;
        updateAuthPwChecklist('su', '');

        applyAppearanceToDOM();
        applyLanguageToUI();
        updateAvatarDisplays();
        renderSettingsAll();
        renderNotifPanel();
        toast('Akun berhasil dibuat! Selamat datang, ' + fullName);
        enterApp();
    }

    async function handleResetPassword() {
        const emailEl = document.getElementById('rs-email');
        const pwEl = document.getElementById('rs-password');
        const cfEl = document.getElementById('rs-confirm');
        const email = emailEl.value.trim();
        const pw = pwEl.value;
        const cf = cfEl.value;

        if (!isValidEmail(email)) { toast('Format email tidak valid'); flashError(emailEl); return; }
        const account = findAccount(email);
        if (!account) { toast('Email tidak ditemukan di sistem kami'); flashError(emailEl); return; }
        if (!pwIsStrong(pw)) { toast('Password baru belum memenuhi semua syarat di bawah'); flashError(pwEl); return; }
        if (pw !== cf) { toast('Konfirmasi password tidak cocok'); flashError(cfEl); return; }

        const changedAt = new Date().toISOString();
        account.password = pw;
        account.lastPasswordChange = changedAt;
        saveAccounts();

        // Sinkronkan juga ke "kotak data" profil akun ini walaupun akun itu sedang tidak login
        const targetProfile = await sGet(acctKey('profile', account.id), null);
        if (targetProfile) {
            targetProfile.password = pw;
            targetProfile.lastPasswordChange = changedAt;
            await sSet(acctKey('profile', account.id), targetProfile);
        }
        if (state.profile && state.profile.email === account.email) {
            state.profile.password = pw;
            state.profile.lastPasswordChange = changedAt;
        }

        document.getElementById('si-email').value = account.email;
        [emailEl, pwEl, cfEl].forEach(el => el.value = '');
        updateAuthPwChecklist('rs', '');
        toast('Password berhasil direset, silakan sign in');
        showAuthView('signin');
    }

    function wireEyeToggle(inputId, btnId) {
        const inp = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!inp || !btn) return;
        btn.addEventListener('click', () => {
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            btn.innerHTML = show ? '<span class="mdi mdi-eye-off-outline"></span>' : '<span class="mdi mdi-eye-outline"></span>';
        });
    }

    function onEnterKey(ids, fn) {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
        });
    }

    function wireAuthEvents() {
        renderAuthBranding();

        document.querySelectorAll('[data-switch]').forEach(el => {
            el.addEventListener('click', () => showAuthView(el.getAttribute('data-switch')));
        });

        wireEyeToggle('si-password', 'si-password-eye');
        wireEyeToggle('su-password', 'su-password-eye');
        wireEyeToggle('su-confirm', 'su-confirm-eye');
        wireEyeToggle('rs-password', 'rs-password-eye');
        wireEyeToggle('rs-confirm', 'rs-confirm-eye');

        document.getElementById('su-password').addEventListener('input', e => updateAuthPwChecklist('su', e.target.value));
        document.getElementById('rs-password').addEventListener('input', e => updateAuthPwChecklist('rs', e.target.value));

        document.getElementById('si-submit-btn').addEventListener('click', handleSignIn);
        document.getElementById('su-submit-btn').addEventListener('click', handleSignUp);
        document.getElementById('rs-submit-btn').addEventListener('click', handleResetPassword);

        document.getElementById('si-google-btn').addEventListener('click', handleGoogleSignInClick);
        document.getElementById('su-google-btn').addEventListener('click', handleGoogleSignInClick);

        onEnterKey(['si-email', 'si-password'], handleSignIn);
        onEnterKey(['su-fullname', 'su-email', 'su-password', 'su-confirm'], handleSignUp);
        onEnterKey(['rs-email', 'rs-password', 'rs-confirm'], handleResetPassword);
    }

    /* ================= BOOT ================= */
    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }

    /* Placeholder kosong (tidak disimpan) supaya tampilan tidak error sebelum ada yang login. */
    function loadGuestDefaults() {
        state.profile = defaultProfile();
        state.appearance = defaultAppearance();
        state.language = defaultLanguage();
        state.notifications = defaultNotifications();
        state.projects = [];
        state.milestones = [];
        state.files = [];
        state.events = [];
        state.vault = [];
        state.notifItems = [];
        state.activity = [];
    }

    async function boot() {
        await loadAccountRegistry();

        // ---- Auth screens ----
        wireAuthEvents();
        initGoogleAuth();

        const session = readSession();
        const sessionAccount = session ? findAccount(session.email) : null;

        if (sessionAccount) {
            await loginToAccount(sessionAccount);
        } else {
            loadGuestDefaults();
        }

        applyAppearanceToDOM();
        applyLanguageToUI();
        updateAvatarDisplays();

        if (sessionAccount) {
            renderSettingsAll();
            enterApp();
        } else {
            showAuthView('signin');
        }

        // ---- Sidebar / topbar nav ----
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', () => navigate(el.getAttribute('data-nav')));
        });
        document.getElementById('hamburger-btn').addEventListener('click', () => toggleSidebar());
        document.getElementById('sidebar-overlay').addEventListener('click', () => closeSidebar());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSidebar();
        });
        document.getElementById('theme-toggle-btn').addEventListener('click', () => toggleThemeQuick());
        renderNotifPanel();
        function positionNotifPanelMobile() {
            const topbar = document.querySelector('.topbar');
            if (!topbar) return;
            const bottom = Math.round(topbar.getBoundingClientRect().bottom);
            document.documentElement.style.setProperty('--notif-panel-top', (bottom + 8) + 'px');
        }
        document.getElementById('bell-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = document.getElementById('notif-panel');
            const willShow = panel.classList.contains('hidden');
            if (willShow) positionNotifPanelMobile();
            panel.classList.toggle('hidden');
            if (willShow) renderNotifPanel();
        });
        window.addEventListener('resize', () => {
            const panel = document.getElementById('notif-panel');
            if (panel && !panel.classList.contains('hidden')) positionNotifPanelMobile();
        });
        document.getElementById('notif-markall').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.notifItems.some(n => !n.read)) { toast('Semua notifikasi sudah dibaca'); return; }
            state.notifItems.forEach(n => n.read = true);
            saveNotifItems();
            renderNotifPanel();
            toast('Semua notifikasi ditandai dibaca');
        });
        document.getElementById('notif-panel').addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('notif-wrap');
            if (wrap && !wrap.contains(e.target)) document.getElementById('notif-panel').classList.add('hidden');
        });
        // Cek deadline project/milestone & acara yang akan mulai setiap menit, supaya
        // notifikasi pengingat benar-benar muncul tanpa perlu refresh halaman.
        setInterval(checkReminders, 60000);
        document.getElementById('global-search').addEventListener('input', (e) => {
            projPage = 1; msPage = 1; filePage = 1;
            assetPage = 1; resourcePage = 1; bookmarkPage = 1; repositoryPage = 1;
            renderGlobalSearchResults(e.target.value);
            const active = document.querySelector('.view.active');
            if (!active) return;
            if (active.id === 'view-projects') renderProjects();
            if (active.id === 'view-milestones') renderMilestones();
            if (active.id === 'view-files') renderFiles();
            const activeKey = active.id.replace('view-', '');
            if (activeKey === 'assets') renderAssets();
            else if (activeKey === 'resources') renderResources();
            else if (activeKey === 'bookmarks') renderBookmarks();
            else if (activeKey === 'repository') renderRepository();
        });
        document.getElementById('global-search').addEventListener('focus', (e) => {
            if (e.target.value.trim()) renderGlobalSearchResults(e.target.value);
        });
        document.getElementById('global-search-results').addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', (e) => {
            const box = document.querySelector('.search-box');
            const results = document.getElementById('global-search-results');
            if (box && results && !box.contains(e.target)) results.classList.add('hidden');
        });

        // ---- Modals generic ----
        wireModalCloseButtons();
        document.getElementById('confirm-ok-btn').addEventListener('click', doPendingDelete);
        document.getElementById('dash-clear-activity').addEventListener('click', () => {
            if (!state.activity.length) { toast('Tidak ada aktivitas untuk dihapus'); return; }
            confirmDelete('activity', null, 'Anda yakin ingin menghapus semua log aktivitas ini? Tindakan ini tidak dapat dibatalkan.');
        });

        // ---- Projects ----
        document.getElementById('proj-add-btn').addEventListener('click', () => openProjectModal(null));
        document.getElementById('proj-save-btn').addEventListener('click', saveProjectFromModal);
        document.getElementById('proj-img-drop').addEventListener('click', () => document.getElementById('proj-img-input').click());
        document.getElementById('proj-img-input').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 3.5 * 1024 * 1024) { toast('Gambar terlalu besar (maks 3.5MB)'); return; }
            projImageData = await fileToDataURL(file);
            renderProjImagePreview();
        });
        document.getElementById('proj-feature-add-btn').addEventListener('click', () => {
            const inp = document.getElementById('proj-feature-input');
            if (inp.value.trim()) { projFeatures.push(inp.value.trim()); inp.value = ''; renderFeatureChips(); }
        });
        document.getElementById('proj-feature-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('proj-feature-add-btn').click(); }
        });
        document.querySelectorAll('#proj-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#proj-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); projFilter = b.getAttribute('data-filter'); projPage = 1; renderProjects();
        }));

        // ---- Calendar ----
        document.getElementById('cal-prev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); calCursor = new Date(calCursor); renderCalGrid(); });
        document.getElementById('cal-next').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); calCursor = new Date(calCursor); renderCalGrid(); });
        document.getElementById('cal-today').addEventListener('click', () => { calCursor = new Date(); renderCalGrid(); });
        document.getElementById('mini-cal-prev').addEventListener('click', () => { miniCursor.setMonth(miniCursor.getMonth() - 1); miniCursor = new Date(miniCursor); renderMiniCal(); });
        document.getElementById('mini-cal-next').addEventListener('click', () => { miniCursor.setMonth(miniCursor.getMonth() + 1); miniCursor = new Date(miniCursor); renderMiniCal(); });
        document.getElementById('cal-add-btn').addEventListener('click', openEventModal);
        document.getElementById('cal-add-btn-2').addEventListener('click', openEventModal);
        document.getElementById('evt-save-btn').addEventListener('click', saveEventFromModal);

        // ---- Milestones ----
        document.getElementById('ms-add-btn').addEventListener('click', () => openMilestoneModal(null));
        document.getElementById('ms-save-btn').addEventListener('click', saveMilestoneFromModal);
        document.querySelectorAll('#ms-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#ms-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); msFilter = b.getAttribute('data-filter'); msPage = 1; renderMilestones();
        }));

        // ---- Files ----
        document.getElementById('file-upload-btn').addEventListener('click', () => document.getElementById('file-input').click());
        document.getElementById('file-input').addEventListener('change', e => { handleFileUpload(e.target.files); e.target.value = ''; });
        document.querySelectorAll('#file-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#file-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); fileFilter = b.getAttribute('data-filter'); filePage = 1; renderFiles();
        }));

        // ---- Assets ----
        document.getElementById('assets-add-btn').addEventListener('click', () => openAssetModal(null));
        document.querySelectorAll('#assets-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#assets-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); assetFilter = b.getAttribute('data-filter'); assetPage = 1; renderAssets();
        }));

        // ---- Resources ----
        document.getElementById('resources-add-btn').addEventListener('click', () => openResourceModal(null));
        document.querySelectorAll('#resources-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#resources-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); resourceFilter = b.getAttribute('data-filter'); resourcePage = 1; renderResources();
        }));

        // ---- Bookmarks ----
        document.getElementById('bookmarks-add-btn').addEventListener('click', () => openBookmarkModal(null));
        document.querySelectorAll('#bookmarks-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#bookmarks-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); bookmarkFilter = b.getAttribute('data-filter'); bookmarkPage = 1; renderBookmarks();
        }));

        // ---- Repository ----
        document.getElementById('repository-add-btn').addEventListener('click', () => openRepositoryModal(null));
        document.querySelectorAll('#repository-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('#repository-tabs .tab-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); repositoryFilter = b.getAttribute('data-filter'); repositoryPage = 1; renderRepository();
        }));

        // ---- Vault shared modal (satu modal HTML dipakai Assets/Resources/Bookmarks/Repository) ----
        document.getElementById('vault-save-btn').addEventListener('click', () => {
            if (vaultCurrentSection === 'assets') saveAssetFromModal();
            else if (vaultCurrentSection === 'resources') saveResourceFromModal();
            else if (vaultCurrentSection === 'bookmarks') saveBookmarkFromModal();
            else if (vaultCurrentSection === 'repository') saveRepositoryFromModal();
        });
        document.getElementById('vault-img-drop').addEventListener('click', () => document.getElementById('vault-img-input').click());
        document.getElementById('vault-img-input').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2.5 * 1024 * 1024) { toast('Ukuran gambar maksimal 2.5MB'); return; }
            const dataUrl = await fileToDataURL(file);
            if (vaultCurrentSection === 'assets') { assetImageData = dataUrl; renderAssetImagePreview(); }
        });

        // ---- Settings: tabs ----
        document.querySelectorAll('.settings-tab').forEach(t => t.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.add('hidden'));
            document.getElementById('tab-' + t.getAttribute('data-tab')).classList.remove('hidden');
        }));

        // ---- Settings: profile ----
        document.getElementById('avatar-upload-btn').addEventListener('click', () => document.getElementById('avatar-input').click());
        document.getElementById('avatar-input').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { toast('Ukuran foto maksimal 2MB'); return; }
            state.profile.avatar = await fileToDataURL(file);
            saveProfile();
            updateAvatarDisplays();
            updateStorageUsage();
            toast('Foto profil diperbarui');
        });
        document.getElementById('save-profile-btn').addEventListener('click', () => {
            const newFullName = document.getElementById('set-fullname').value.trim() || state.profile.fullName;
            const newEmailRaw = document.getElementById('set-email').value.trim() || state.profile.email;
            const newEmail = newEmailRaw.toLowerCase();
            const emailChanged = newEmail !== state.profile.email.toLowerCase();

            if (!isValidEmail(newEmailRaw)) { toast('Format email tidak valid'); return; }
            const clash = findAccount(newEmail);
            if (clash && clash.email !== loggedInEmail) { toast('Email tersebut sudah digunakan akun lain'); return; }

            const account = findAccount(loggedInEmail);
            if (account) {
                account.fullName = newFullName;
                account.email = newEmail;
                saveAccounts();
            }
            updateSessionEmail(newEmail);
            loggedInEmail = newEmail;

            state.profile.fullName = newFullName;
            state.profile.email = newEmail;
            state.profile.jobTitle = document.getElementById('set-jobtitle').value.trim();
            state.profile.company = document.getElementById('set-company').value.trim();
            state.profile.bio = document.getElementById('set-bio').value.trim();
            saveProfile();
            updateAvatarDisplays();
            renderDashboard();
            toast('Profil berhasil disimpan');
            if (emailChanged) {
                pushNotification('security', 'Email akun Anda baru saja diubah', { urgent: true, refView: 'settings' });
            }
        });

        // ---- Settings: password ----
        document.getElementById('pw-new').addEventListener('input', e => updatePwChecklist(e.target.value));
        document.getElementById('update-pw-btn').addEventListener('click', () => {
            const cur = document.getElementById('pw-current').value;
            const nw = document.getElementById('pw-new').value;
            const cf = document.getElementById('pw-confirm').value;
            if (cur !== state.profile.password) { toast('Password saat ini salah'); return; }
            if (nw.length < 8) { toast('Password baru minimal 8 karakter'); return; }
            if (nw !== cf) { toast('Konfirmasi password tidak cocok'); return; }
            state.profile.password = nw;
            state.profile.lastPasswordChange = new Date().toISOString();
            saveProfile();
            const account = findAccount(loggedInEmail);
            if (account) { account.password = nw; saveAccounts(); }
            renderSettingsPassword();
            toast('Password berhasil diperbarui');
            // Notifikasi keamanan akun harus tetap tembus meski tipe "task"/dsb dimatikan
            // atau sedang Quiet Hours — makanya ditandai urgent, sesuai info di panel Quiet Hours.
            pushNotification('security', 'Password akun Anda baru saja diubah', { urgent: true, refView: 'settings' });
        });

        // ---- Settings: notifications ----
        // Saat toggle "Browser Notifications" dinyalakan, langsung minta izin browser
        // sungguhan alih-alih hanya menyimpan preferensi yang tidak pernah dipakai.
        document.getElementById('notif-browser').addEventListener('change', (e) => {
            if (!e.target.checked) return;
            requestBrowserNotifPermission().then(perm => {
                if (perm === 'unsupported') {
                    toast('Browser Anda tidak mendukung notifikasi desktop');
                    e.target.checked = false;
                } else if (perm === 'denied') {
                    toast('Izin notifikasi browser ditolak. Aktifkan lewat pengaturan situs di browser Anda.');
                    e.target.checked = false;
                } else if (perm === 'granted') {
                    toast('Izin notifikasi browser diaktifkan');
                }
                renderSettingsNotifications();
                document.getElementById('notif-browser').checked = e.target.checked;
            });
        });
        document.getElementById('save-notif-btn').addEventListener('click', async () => {
            const wantsBrowser = document.getElementById('notif-browser').checked;
            if (wantsBrowser) {
                const perm = await requestBrowserNotifPermission();
                if (perm === 'denied' || perm === 'unsupported') {
                    document.getElementById('notif-browser').checked = false;
                    toast(perm === 'unsupported' ? 'Browser Anda tidak mendukung notifikasi desktop' : 'Izin notifikasi browser ditolak, browser notification dinonaktifkan');
                }
            }
            state.notifications.email = document.getElementById('notif-email').checked;
            state.notifications.browser = document.getElementById('notif-browser').checked;
            document.querySelectorAll('[data-notiftype]').forEach(el => {
                state.notifications.types[el.getAttribute('data-notiftype')] = el.checked;
            });
            state.notifications.quiet.start = document.getElementById('quiet-start').value;
            state.notifications.quiet.end = document.getElementById('quiet-end').value;
            state.notifications.quiet.enabled = document.getElementById('quiet-enabled').checked;
            sSet(acctKey('notifications'), state.notifications);
            renderSettingsNotifications();
            toast('Pengaturan notifikasi disimpan');
        });

        // ---- Logout ----
        document.getElementById('logout-btn').addEventListener('click', () => {
            const appShell = document.getElementById('view-app');
            appShell.classList.add('app-exiting');
            setTimeout(() => {
                appShell.classList.remove('app-exiting');
                clearSession();
                loggedInEmail = null;
                loggedInAccountId = null;
                loadGuestDefaults();
                applyAppearanceToDOM();
                applyLanguageToUI();
                updateAvatarDisplays();
                renderNotifPanel();
                const siEmail = document.getElementById('si-email');
                const siPw = document.getElementById('si-password');
                if (siEmail) siEmail.value = '';
                if (siPw) siPw.value = '';
                showAuthView('signin');
                toast('Anda telah logout');
            }, 260);
        });
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
