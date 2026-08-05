// Toast notification system
function showToast(msg, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) { console.log(type + ':', msg); return; }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, duration);
}

// Back-to-top button
(function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// Initialisation des icônes Lucide
lucide.createIcons();

// 1. Gestion du Menu Mobile (Sidebar)
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileCloseBtn = document.getElementById('mobile-close-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-menu-overlay');
const mobileLinks = mobileMenu.querySelectorAll('a');

function openMobileMenu() {
    mobileOverlay.classList.remove('hidden');
    setTimeout(() => {
        mobileOverlay.classList.remove('opacity-0');
        mobileMenu.classList.remove('translate-x-full');
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    mobileOverlay.classList.add('opacity-0');
    mobileMenu.classList.add('translate-x-full');
    setTimeout(() => {
        mobileOverlay.classList.add('hidden');
    }, 300);
    document.body.style.overflow = '';
}

mobileMenuBtn.addEventListener('click', openMobileMenu);
mobileCloseBtn.addEventListener('click', closeMobileMenu);
mobileOverlay.addEventListener('click', closeMobileMenu);

mobileLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
});

// 2. Comportement de la Navbar au Scroll
const navbar = document.getElementById('navbar');
const logoText = document.getElementById('logo-text');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('bg-white', 'shadow-md');
        navbar.classList.remove('py-4');
        logoText.classList.add('text-vert-800');
        logoText.classList.remove('text-white');
        navLinks.forEach(link => {
            link.classList.add('text-vert-800');
            link.classList.remove('text-white');
        });
        document.getElementById('mobile-menu-btn').classList.add('text-vert-800');
        document.getElementById('mobile-menu-btn').classList.remove('text-white');
    } else {
        navbar.classList.remove('bg-white', 'shadow-md');
        logoText.classList.remove('text-vert-800');
        logoText.classList.add('text-white');
        navLinks.forEach(link => {
            link.classList.remove('text-vert-800');
            link.classList.add('text-white');
        });
        document.getElementById('mobile-menu-btn').classList.remove('text-vert-800');
        document.getElementById('mobile-menu-btn').classList.add('text-white');
    }
});

// 3. Animations au Scroll (Intersection Observer)
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
        }
    });
}, {
    root: null,
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
});

revealElements.forEach(el => revealObserver.observe(el));

// 4. Accordéon de la FAQ
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    item.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(otherItem => {
            otherItem.classList.remove('active');
        });
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// 5. Formulaire de Contact — envoi réel vers /api/contact
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').setAttribute('min', today);

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot check
    const honey = document.querySelector('input[name="_honey"]').value;
    if (honey) return;

    // ── Validation inline ──
    let valid = true;
    const showErr = (id, msg) => {
        const el = document.getElementById(id);
        if (!el) return;
        let err = el.parentNode.querySelector('.form-err');
        if (!err) { err = document.createElement('p'); err.className = 'form-err text-red-500 text-xs mt-1 font-medium'; el.parentNode.appendChild(err); }
        err.textContent = msg;
        el.classList.add('border-red-400');
        valid = false;
    };
    const clearErr = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const err = el.parentNode.querySelector('.form-err');
        if (err) err.textContent = '';
        el.classList.remove('border-red-400');
    };

    const nameVal = document.getElementById('name').value.trim();
    const emailVal = document.getElementById('email').value.trim();
    const phoneVal = document.getElementById('phone').value.trim();
    const checkinVal = document.getElementById('checkin').value;
    const checkoutVal = document.getElementById('checkout').value;
    const guestsVal = parseInt(document.getElementById('guests').value || '0');

    clearErr('name'); clearErr('email'); clearErr('phone'); clearErr('checkin'); clearErr('checkout'); clearErr('guests');

    if (!nameVal || nameVal.length < 2) showErr('name', 'Le nom est requis (2 caractères minimum).');
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) showErr('email', 'Adresse email invalide.');
    if (phoneVal && !/^[\d\s\+\-\(\)\.]{7,20}$/.test(phoneVal)) showErr('phone', 'Format téléphone invalide.');
    if (document.getElementById('guests').value && guestsVal < 1) showErr('guests', 'Au moins 1 personne.');

    if (!valid) return;

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Envoi en cours... <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    btn.disabled = true;

    try {
        const resp = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                phone: data.phone || '',
                dateStart: data.checkin || '',
                dateEnd: data.checkout || '',
                guests: data.guests || '2',
                typeLogement: data.type || '',
                message: data.message || '',
                marketingConsent: data.marketing === 'on',
                honeypot: data._honey || ''
            })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Erreur serveur');

        contactForm.reset();
        localStorage.removeItem('contactFormDraft');
        formSuccess.classList.remove('hidden');
        setTimeout(() => formSuccess.classList.add('hidden'), 5000);
    } catch (err) {
        showToast('Erreur lors de l\'envoi : ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// 5b. Formulaire Newsletter — envoi vers /api/newsletter
const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const honeyEl = newsletterForm.querySelector('input[name="_nl_honey"]');
        if (honeyEl && honeyEl.value) return;
        const emailEl = document.getElementById("newsletter-email");
        const msg = document.getElementById("newsletter-msg");
        const email = (emailEl.value || "").trim();
        msg.classList.remove("hidden");
        if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
            msg.textContent = "Adresse email invalide.";
            return;
        }
        const btn = newsletterForm.querySelector('button[type="submit"]');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "Inscription...";
        msg.textContent = "";
        msg.classList.add("hidden");
        try {
            const resp = await fetch("/api/newsletter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, consent: true, source: "site", honeypot: honeyEl ? honeyEl.value : "" })
            });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.error || "Erreur serveur");
            newsletterForm.reset();
            msg.textContent = result.alreadySubscribed
                ? "Vous êtes déjà inscrit(e) — merci !"
                : "Merci ! Votre code -10 % arrive dans votre boîte mail. 🌿";
            msg.classList.remove("hidden");
        } catch (err) {
            msg.textContent = "Erreur : " + err.message;
            msg.classList.remove("hidden");
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });
}

// --- 6. GESTION DES MODALS & COOKIES ---

const rgpdModal = document.getElementById('rgpd-modal');
const rgpdContent = document.getElementById('rgpd-modal-content');
const openRgpdBtn = document.getElementById('open-rgpd');
const closeRgpdBtns = [document.getElementById('close-rgpd'), document.getElementById('close-rgpd-btn')];

function openRgpdModal(e) {
    if (e) e.preventDefault();
    rgpdModal.classList.remove('hidden');
    setTimeout(() => {
        rgpdContent.classList.remove('scale-95', 'opacity-0');
        rgpdContent.classList.add('scale-100', 'opacity-100');
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeRgpdModal() {
    rgpdContent.classList.remove('scale-100', 'opacity-100');
    rgpdContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        rgpdModal.classList.add('hidden');
    }, 300);
    document.body.style.overflow = '';
}

if (openRgpdBtn) openRgpdBtn.addEventListener('click', openRgpdModal);
closeRgpdBtns.forEach(btn => btn?.addEventListener('click', closeRgpdModal));

rgpdModal.addEventListener('click', (e) => {
    if (e.target === rgpdModal) closeRgpdModal();
});

const cookieBanner = document.getElementById('cookie-banner');
const cookieAccept = document.getElementById('cookie-accept');
const cookieRefuse = document.getElementById('cookie-refuse');
const CONSENT_KEY = 'Archers_cookie_consent';

if (!localStorage.getItem(CONSENT_KEY)) {
    setTimeout(() => {
        cookieBanner.classList.remove('translate-y-full');
    }, 1500);
}

function handleCookie(consent) {
    localStorage.setItem(CONSENT_KEY, consent);
    cookieBanner.classList.add('translate-y-full');
    updateConsentStatusUI();
    if (consent === 'accepted') {
        const sid = sessionStorage.getItem('vsid') || Math.random().toString(36).slice(2) + Date.now();
        sessionStorage.setItem('vsid', sid);
        fetch('/api/visitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'cookie_accept', page: window.location.pathname, sessionId: sid })
        }).catch(() => {});
        // Fire the visit event now that consent is given
        fetch('/api/visitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'visit', page: window.location.pathname, sessionId: sid })
        }).catch(() => {});
    }
}

function updateConsentStatusUI() {
    const status = localStorage.getItem(CONSENT_KEY);
    const el = document.getElementById('current-consent-status');
    if (!el) return;
    if (status === 'accepted') {
        el.textContent = 'Suivi accepté';
        el.className = 'text-vert-700 font-bold';
    } else if (status === 'refused') {
        el.textContent = 'Suivi refusé';
        el.className = 'text-red-600 font-bold';
    } else {
        el.textContent = 'Non défini';
        el.className = 'text-terre-500 font-bold';
    }
}

// Lien "En savoir plus" dans le banner -> ouvre la modale RGPD
const cookieLearnMore = document.getElementById('cookie-learn-more');
if (cookieLearnMore) {
    cookieLearnMore.addEventListener('click', (e) => {
        e.preventDefault();
        cookieBanner.classList.add('translate-y-full');
        openRgpdModal();
        updateConsentStatusUI();
    });
}

// Boutons RGPD modal
const rgpdAcceptBtn = document.getElementById('rgpd-accept-btn');
const rgpdRefuseBtn = document.getElementById('rgpd-refuse-btn');
if (rgpdAcceptBtn) rgpdAcceptBtn.addEventListener('click', () => { handleCookie('accepted'); showToast('Suivi accepté. Merci !', 'success'); });
if (rgpdRefuseBtn) rgpdRefuseBtn.addEventListener('click', () => { handleCookie('refused'); showToast('Suivi refusé. Vos données ne seront pas collectées.', 'info'); });

if (cookieAccept) cookieAccept.addEventListener('click', () => handleCookie('accepted'));
if (cookieRefuse) cookieRefuse.addEventListener('click', () => handleCookie('refused'));


// --- 7. GESTION DE L'ADMINISTRATION (SPA Routing & Auth) ---

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleRouting() {
    const hash = window.location.hash;
    const publicSite = document.getElementById('public-site');
    const adminSite = document.getElementById('admin-site');

    const compteSite = document.getElementById('compte-site');
    if (hash.startsWith('#admin')) {
        publicSite.classList.add('hidden');
        adminSite.classList.remove('hidden');
        if (compteSite) compteSite.classList.add('hidden');
        document.body.classList.remove('scroll-smooth');
        checkAdminAuth();
    } else if (hash.startsWith('#compte')) {
        publicSite.classList.add('hidden');
        adminSite.classList.add('hidden');
        if (compteSite) compteSite.classList.remove('hidden');
        document.body.classList.remove('scroll-smooth');
        renderCompte();
        lucide.createIcons();
    } else {
        publicSite.classList.remove('hidden');
        adminSite.classList.add('hidden');
        if (compteSite) compteSite.classList.add('hidden');
        document.body.classList.add('scroll-smooth');
        lucide.createIcons();
    }
}

window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', handleRouting);

async function checkAdminAuth() {
    const token = sessionStorage.getItem('adminToken');
    const loginTs = parseInt(sessionStorage.getItem('adminLoginTs') || '0', 10);
    const loginScreen = document.getElementById('admin-login');
    const dashboard = document.getElementById('admin-dashboard');

    const clearSession = () => {
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminLoginTs');
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
        dashboard.classList.remove('flex');
    };

    const SESSION_MS = 24 * 60 * 60 * 1000;
    if (!token || (Date.now() - loginTs > SESSION_MS)) { clearSession(); return; }

    // Vérification du token côté serveur (détecte les tokens périmés/incorrects)
    try {
        const resp = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        if (!resp.ok) { clearSession(); return; }
    } catch { /* erreur réseau — on laisse passer */ }

    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    dashboard.classList.add('flex');
    initAdminPlugins();
}

// Formulaire de connexion Admin
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorMsg = document.getElementById('loginError');

    try {
        const hashHex = await hashPassword(password);
        const resp = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: hashHex })
        });
        const d = await resp.json();

        if (resp.ok && d.success) {
            sessionStorage.setItem('adminToken', hashHex);
            sessionStorage.setItem('adminLoginTs', Date.now().toString());
            errorMsg.classList.add('hidden');
            document.getElementById('adminPassword').value = '';
            checkAdminAuth();
        } else {
            throw new Error(d.message || 'Code incorrect');
        }
    } catch (err) {
        errorMsg.classList.remove('hidden');
        errorMsg.innerText = err.message || 'Code incorrect.';
    }
});

// Déconnexion
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('adminToken');
    checkAdminAuth();
});

// Navigation par onglets dans l'Admin
const adminNavBtns = document.querySelectorAll('.admin-nav-btn');
const adminTabs = document.querySelectorAll('.admin-tab-content');

// Menu hamburger admin (mobile) — tiroir latéral
const adminMenuEl = document.getElementById('admin-menu');
const adminMenuOverlay = document.getElementById('admin-menu-overlay');
function openAdminMenu() {
    if (!adminMenuEl) return;
    adminMenuOverlay.classList.remove('hidden');
    requestAnimationFrame(() => adminMenuOverlay.classList.remove('opacity-0'));
    adminMenuEl.classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
}
function closeAdminMenu() {
    if (!adminMenuEl) return;
    adminMenuOverlay.classList.add('opacity-0');
    setTimeout(() => adminMenuOverlay.classList.add('hidden'), 300);
    adminMenuEl.classList.add('translate-x-full');
    document.body.style.overflow = '';
}
(() => {
    const b = document.getElementById('admin-menu-btn');
    const c = document.getElementById('admin-menu-close');
    if (b) b.addEventListener('click', openAdminMenu);
    if (c) c.addEventListener('click', closeAdminMenu);
    if (adminMenuOverlay) adminMenuOverlay.addEventListener('click', closeAdminMenu);
    if (adminMenuEl) adminMenuEl.querySelectorAll('.admin-nav-btn').forEach(x => x.addEventListener('click', closeAdminMenu));
})();

adminNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        adminNavBtns.forEach(b => {
            b.classList.remove('bg-sable-200', 'font-bold');
            b.classList.add('font-medium');
        });
        btn.classList.remove('font-medium');
        btn.classList.add('bg-sable-200', 'font-bold');

        adminTabs.forEach(tab => {
            if (tab.id === targetTab) {
                tab.classList.remove('hidden');
                tab.classList.add('admin-tab-panel');
                requestAnimationFrame(() => tab.classList.remove('tab-hidden'));
                if (targetTab === 'tab-reservations') loadReservations();
                else if (targetTab === 'tab-dashboard') { loadReservations(); loadVisits(); }
                else if (targetTab === 'tab-campaigns') loadCampaigns();
                else if (targetTab === 'tab-calendar') loadCalendar();
            } else {
                tab.classList.add('tab-hidden');
                setTimeout(() => tab.classList.add('hidden'), 180);
            }
        });
    });
});

// Initialisation des plugins Admin
let adminPluginsInitialized = false;
function initAdminPlugins() {
    if (adminPluginsInitialized) return;
    const filterSelect = document.getElementById('filter-status');
    if (filterSelect) filterSelect.addEventListener('change', renderReservations);
    const searchInput = document.getElementById('search-res');
    if (searchInput) searchInput.addEventListener('input', renderReservations);
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', exportReservationsCSV);
    const exportEmailsBtn = document.getElementById('export-emails');
    if (exportEmailsBtn) exportEmailsBtn.addEventListener('click', exportClientEmails);
    const visitsRange = document.getElementById('visits-range');
    if (visitsRange) visitsRange.addEventListener('change', () => loadVisits(visitsRange.value));
    initCampaignsUI();
    document.querySelectorAll('.admin-nav-btn').forEach(b => {
        if (b.getAttribute('data-tab') === 'tab-dashboard') { b.classList.remove('font-medium'); b.classList.add('bg-sable-200', 'font-bold'); }
    });
    loadReservations();
    loadVisits();
    loadCampaigns();
    setInterval(() => { if (!document.getElementById('admin-dashboard').classList.contains('hidden')) loadReservations(); }, 30000);
    adminPluginsInitialized = true;
}
// Carousel Controller
class CarouselController {
    constructor(roomId, photoCount = 6) {
        this.roomId = roomId;
        this.photoCount = photoCount;
        this.currentIndex = 0;
        this.autoAdvanceTimer = null;
    }

    init() {
        const container = document.getElementById(`carousel-${this.roomId}`);
        if (!container) return;

        this.container = container;
        this.updateDisplay();

        container.querySelector('.carousel-next')?.addEventListener('click', () => this.next());
        container.querySelector('.carousel-prev')?.addEventListener('click', () => this.prev());

        const dots = container.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            dot.addEventListener('click', () => this.goTo(idx));
        });
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.photoCount;
        this.updateDisplay();
    }

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.photoCount) % this.photoCount;
        this.updateDisplay();
    }

    goTo(index) {
        this.currentIndex = index;
        this.updateDisplay();
    }

    updateDisplay() {
        const img = this.container.querySelector('.carousel-image');
        if (img && this.photoUrls && this.photoUrls[this.currentIndex]) {
            img.src = this.photoUrls[this.currentIndex];
        }

        const dots = this.container.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === this.currentIndex);
        });
    }

    startAutoAdvance() {
        this.autoAdvanceTimer = setInterval(() => {
            this.next();
        }, 6000);
    }

    resetAutoAdvance() {
        clearInterval(this.autoAdvanceTimer);
        this.startAutoAdvance();
    }
}

// Initialisation synchrone des carrousels avec les data-photos
window.carousels = {};
document.addEventListener('DOMContentLoaded', () => {
    for (let roomNum = 1; roomNum <= 7; roomNum++) {
        const carouselEl = document.getElementById(`carousel-room${roomNum}`);
        if (!carouselEl) continue;
        
        let photoUrls = [];
        try {
            const dataPhotos = carouselEl.getAttribute('data-photos');
            if (dataPhotos) photoUrls = JSON.parse(dataPhotos);
        } catch (e) {
            console.error("Erreur de parsing data-photos", e);
        }
        
        if (photoUrls.length === 0) {
            for (let i = 0; i < 6; i++) photoUrls.push('/photo/facade.webp');
        }

        const controller = new CarouselController(`room${roomNum}`, photoUrls.length);
        controller.photoUrls = photoUrls;
        controller.init();
        window.carousels[`room${roomNum}`] = controller;
    }
});


// ── Helpers communs ──
function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-token': sessionStorage.getItem('adminToken') || ''
    };
}

// ── Réservations réelles depuis KV ──
let _allReservations = [];

async function loadReservations() {
    const tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-terre-600 font-medium">Chargement...</td></tr>';
    try {
        const resp = await fetch('/api/reservations', { headers: adminHeaders() });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erreur');
        _allReservations = data.reservations || [];
        const kpi = document.getElementById('kpi-reservations');
        if (kpi) kpi.textContent = data.newCount || 0;
        renderReservations();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-500 font-medium">Erreur: ${err.message}</td></tr>`;
    }
}

function renderReservations() {
    const tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;
    renderResStats();
    const filter = document.getElementById('filter-status')?.value || '';
    const search = (document.getElementById('search-res')?.value || '').trim().toLowerCase();
    let list = filter ? _allReservations.filter(r => r.status === filter) : _allReservations.slice();
    if (search) {
        list = list.filter(r => [r.name, r.email, r.phone, r.typeLogement, r.message]
            .filter(Boolean).join(' ').toLowerCase().includes(search));
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center">
                    <div class="text-terre-300 mb-3 flex justify-center"><i data-lucide="inbox" class="w-10 h-10"></i></div>
                    <p class="font-bold text-terre-700 text-lg">Aucune demande</p>
                    <p class="text-terre-500 text-sm mt-1">${filter ? 'Aucune demande avec ce statut.' : 'Les demandes de r\u00e9servation appara\u00eetront ici.'}</p>
                </td></tr>`;
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        return;
    }

    const badgeClass = {
        new: 'bg-amber-100 text-amber-800 border-amber-300',
        confirmed: 'bg-green-100 text-green-800 border-green-300',
        refused: 'bg-red-100 text-red-700 border-red-300',
        read: 'bg-sable-200 text-terre-600 border-sable-300'
    };
    const lblIcon = { new: 'bell', confirmed: 'check', refused: 'x', read: 'eye' };
    const lblText = { new: 'Nouveau', confirmed: 'Confirmé', refused: 'Refusé', read: 'Lu' };

    tbody.innerHTML = list.map(r => {
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        const nights = r.dateStart && r.dateEnd
            ? Math.ceil((new Date(r.dateEnd) - new Date(r.dateStart)) / 86400000)
            : null;
        const dateRange = r.dateStart && r.dateEnd
            ? `${fmtDate(r.dateStart)} → ${fmtDate(r.dateEnd)}`
            : '<span class="text-terre-400 italic text-xs">Dates non précisées</span>';
        const createdAt = r.createdAt
            ? new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        const b = badgeClass[r.status] || badgeClass.read;
        const icon = lblIcon[r.status] || 'eye';
        const text = lblText[r.status] || r.status;
        const gcal = (r.dateStart && r.dateEnd) ? buildGcalUrl(r) : null;
        return `<tr class="hover:bg-sable-50 transition-colors border-t border-sable-200">
                    <td class="px-5 py-4">
                        <div class="flex items-start gap-3">
                            <div class="w-9 h-9 rounded-full bg-vert-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">${r.name?.charAt(0).toUpperCase() || '?'}</div>
                            <div>
                                <div class="font-bold text-vert-800 leading-tight">${r.name}</div>
                                <a href="mailto:${r.email}" class="text-terre-400 hover:text-terre-600 text-xs transition-colors">${r.email}</a>
                                ${r.phone ? `<div class="text-terre-500 text-xs mt-0.5 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${r.phone}</div>` : ''}
                                ${createdAt ? `<div class="text-terre-400 text-xs mt-1 font-medium">Reçu le ${createdAt}</div>` : ''}
                            </div>
                        </div>
                        ${r.message ? `<div class="mt-2 ml-12 text-terre-600 text-xs italic bg-sable-100 rounded-lg p-2 border border-sable-200 max-w-xs">&ldquo;${r.message.replace(/</g, '&lt;').substring(0, 200)}${r.message.length > 200 ? '&hellip;' : ''}&rdquo;</div>` : ''}
                    </td>
                    <td class="px-5 py-4">
                        <div class="text-sm text-terre-800 font-medium">${dateRange}</div>
                        <div class="flex gap-2 mt-1 flex-wrap">
                            ${nights ? `<span class="text-xs font-bold bg-vert-800 text-sable-100 px-2 py-0.5 rounded">${nights} nuit${nights > 1 ? 's' : ''}</span>` : ''}
                            ${r.guests ? `<span class="text-xs font-bold bg-sable-200 text-terre-700 px-2 py-0.5 rounded border border-sable-300">${r.guests} pers.</span>` : ''}
                        </div>
                    </td>
                    <td class="px-5 py-4">
                        <span class="text-sm font-bold text-terre-800">${r.typeLogement || '<span class="text-terre-400 italic font-normal">Non précisé</span>'}</span>
                    </td>
                    <td class="px-5 py-4">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-bold whitespace-nowrap ${b}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i>${text}</span>
                    </td>
                    <td class="px-5 py-4">
                        <div class="flex flex-col gap-1.5 min-w-[150px]">
                            ${r.status !== 'confirmed' ? `<button onclick="window._updateRes('${r.id}','confirmed')" class="w-full flex items-center justify-center gap-1.5 text-white bg-vert-800 hover:bg-vert-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"><i data-lucide="check" class="w-3.5 h-3.5"></i> Confirmer</button>` : ''}
                            ${r.status !== 'refused' ? `<button onclick="window._updateRes('${r.id}','refused')" class="w-full flex items-center justify-center gap-1.5 text-terre-700 bg-sable-200 hover:bg-sable-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="x" class="w-3.5 h-3.5"></i> Refuser</button>` : ''}
                            <button onclick="window._reply('${r.id}')" class="w-full flex items-center justify-center gap-1.5 text-terre-700 bg-sable-100 hover:bg-sable-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="mail" class="w-3.5 h-3.5"></i> Répondre au client</button>
                            ${gcal ? `<a href="${gcal}" target="_blank" rel="noopener" class="w-full flex items-center justify-center gap-1.5 text-vert-800 bg-sable-100 hover:bg-sable-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> Agenda Google</a>` : ''}
                            <button onclick="window._sendMail('${r.id}','review')" class="w-full flex items-center justify-center gap-1.5 text-vert-800 bg-sable-100 hover:bg-sable-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="${r.reviewSentAt ? 'check' : 'star'}" class="w-3.5 h-3.5"></i> ${r.reviewSentAt ? 'Avis envoyé' : "Mail demande d'avis"}</button>
                            <button onclick="window._sendMail('${r.id}','reengage')" class="w-full flex items-center justify-center gap-1.5 text-terre-700 bg-sable-100 hover:bg-sable-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="${r.lastReengagedAt ? 'check' : 'rotate-ccw'}" class="w-3.5 h-3.5"></i> ${r.lastReengagedAt ? 'Revenir envoyé' : 'Mail revenir'}</button>
                            <button onclick="window._sendMail('${r.id}','promo')" class="w-full flex items-center justify-center gap-1.5 text-terre-700 bg-sable-100 hover:bg-sable-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-sable-300 transition-colors"><i data-lucide="${r.lastPromoAt ? 'check' : 'tag'}" class="w-3.5 h-3.5"></i> ${r.lastPromoAt ? 'Promo envoyée' : 'Mail promo'}</button>
                            <button onclick="window._deleteRes('${r.id}')" class="w-full flex items-center justify-center gap-1.5 text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Supprimer</button>
                        </div>
                    </td>
                </tr>`;
    }).join('');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

// Génère un lien "Ajouter à Google Agenda" (événement journée, sans API)
function buildGcalUrl(r) {
    const toYMD = (d) => {
        const dt = new Date(d);
        return dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0');
    };
    const text = `Réservation ${r.typeLogement || ''} — ${r.name || ''}`.trim();
    const details = [
        r.email ? `Email : ${r.email}` : '',
        r.phone ? `Téléphone : ${r.phone}` : '',
        r.guests ? `Personnes : ${r.guests}` : '',
        r.message ? `Message : ${r.message}` : ''
    ].filter(Boolean).join('\n');
    const params = 'action=TEMPLATE'
        + '&text=' + encodeURIComponent(text)
        + '&dates=' + toYMD(r.dateStart) + '/' + toYMD(r.dateEnd)
        + '&details=' + encodeURIComponent(details)
        + '&location=' + encodeURIComponent('Les Archers, Voiron, 38500');
    return 'https://calendar.google.com/calendar/render?' + params;
}

// Statistiques calculées localement à partir de _allReservations
function renderResStats() {
    const el = document.getElementById('res-stats');
    if (!el) return;
    const all = _allReservations;
    const total = all.length;
    const nb = (s) => all.filter(r => r.status === s).length;
    const nNew = nb('new'), nConf = nb('confirmed'), nRef = nb('refused');
    const conv = total ? Math.round((nConf / total) * 100) : 0;
    const card = (label, value, color, icon) => `<div class="bg-white rounded-xl border border-sable-300 shadow-sm p-4 flex flex-col items-center text-center">
            <i data-lucide="${icon}" class="w-5 h-5 ${color} opacity-80 mb-1.5"></i>
            <div class="text-2xl font-bold ${color} leading-none">${value}</div>
            <div class="text-[11px] uppercase tracking-wide text-terre-500 font-bold mt-1.5">${label}</div>
        </div>`;
    el.innerHTML =
        card('Total', total, 'text-vert-800', 'inbox') +
        card('Nouvelles', nNew, 'text-amber-600', 'bell') +
        card('Confirmées', nConf, 'text-green-600', 'check-circle') +
        card('Refusées', nRef, 'text-red-500', 'x-circle') +
        card('Taux conv.', conv + '%', 'text-terre-700', 'trending-up');

    const bd = document.getElementById('res-breakdown');
    if (!bd) return;

    const bar = (label, val, max, color) => `<div class="mb-2">
            <div class="flex justify-between text-xs font-medium text-terre-700 mb-1"><span>${label}</span><span>${val}</span></div>
            <div class="h-2 bg-sable-200 rounded-full overflow-hidden"><div class="h-full ${color} rounded-full" style="width:${Math.round(val / max * 100)}%"></div></div>
        </div>`;

    // Répartition par logement
    const byLog = {};
    all.forEach(r => { const k = r.typeLogement || 'Non précisé'; byLog[k] = (byLog[k] || 0) + 1; });
    const logEntries = Object.entries(byLog).sort((a, b) => b[1] - a[1]);
    const maxLog = Math.max(1, ...logEntries.map(e => e[1]));
    const logHtml = logEntries.length
        ? logEntries.map(([k, v]) => bar(k, v, maxLog, 'bg-vert-800')).join('')
        : '<p class="text-xs text-terre-400">Aucune donnée</p>';

    // Répartition par mois (date de réception)
    const byMonth = {};
    all.forEach(r => {
        if (!r.createdAt) return;
        const d = new Date(r.createdAt);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        byMonth[key] = byMonth[key] || { label, val: 0 };
        byMonth[key].val++;
    });
    const monthEntries = Object.keys(byMonth).sort().map(k => [byMonth[k].label, byMonth[k].val]);
    const maxMonth = Math.max(1, ...monthEntries.map(e => e[1]));
    const monthHtml = monthEntries.length
        ? monthEntries.map(([k, v]) => bar(k, v, maxMonth, 'bg-terre-400')).join('')
        : '<p class="text-xs text-terre-400">Aucune donnée</p>';

    bd.innerHTML = `
        <div class="bg-white rounded-xl border border-sable-300 shadow-sm p-4">
            <h3 class="text-sm font-bold text-vert-800 mb-3 flex items-center gap-2"><i data-lucide="home" class="w-4 h-4"></i> Demandes par logement</h3>
            ${logHtml}
        </div>
        <div class="bg-white rounded-xl border border-sable-300 shadow-sm p-4">
            <h3 class="text-sm font-bold text-vert-800 mb-3 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> Demandes par mois</h3>
            ${monthHtml}
        </div>`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

// Export CSV des réservations (séparateur ; + BOM pour Excel FR)
function exportReservationsCSV() {
    const all = _allReservations;
    if (!all.length) { showToast('Aucune réservation à exporter', 'error'); return; }
    const headers = ['Nom', 'Email', 'Téléphone', 'Arrivée', 'Départ', 'Personnes', 'Logement', 'Statut', 'Reçu le', 'Message'];
    const esc = (v) => '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"';
    const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '';
    const rows = all.map(r => [
        r.name, r.email, r.phone, fmt(r.dateStart), fmt(r.dateEnd),
        r.guests, r.typeLogement, r.status, fmt(r.createdAt), r.message
    ].map(esc).join(';'));
    const csv = '﻿' + [headers.map(esc).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reservations-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Chargement paresseux de Chart.js (uniquement dans l'admin, pas sur le site public)
function ensureChartJs() {
    return new Promise((resolve, reject) => {
        if (window.Chart) return resolve();
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        sc.onload = () => resolve();
        sc.onerror = () => reject(new Error('Chart.js indisponible'));
        document.head.appendChild(sc);
    });
}

// Fréquentation du site — visites depuis /api/visitors (plage configurable)
async function loadVisits(range) {
    const kpisEl = document.getElementById('visits-kpis');
    const chartEl = document.getElementById('visits-chart');
    const topEl = document.getElementById('visits-toppages');
    if (!kpisEl || !chartEl) return;
    range = range || document.getElementById('visits-range')?.value || 30;
    chartEl.innerHTML = '<div class="text-xs text-terre-400 py-8 px-2">Chargement…</div>';
    try {
        const resp = await fetch('/api/visitors?range=' + range, { headers: adminHeaders() });
        const d = await resp.json();
        if (!resp.ok) throw new Error(d.error || 'Erreur');
        const labels = d.chartData?.labels || [];
        const totals = d.chartData?.total || [];
        const uniques = d.chartData?.unique || [];
        const periodTotal = totals.reduce((a, b) => a + (b || 0), 0);
        const periodUnique = uniques.reduce((a, b) => a + (b || 0), 0);

        const kpi = (label, value, color) => `<div class="bg-sable-100 rounded-xl border border-sable-200 p-3 text-center">
                <div class="text-2xl font-bold ${color}">${value}</div>
                <div class="text-[11px] uppercase tracking-wide text-terre-500 font-bold mt-0.5">${label}</div>
            </div>`;
        kpisEl.innerHTML =
            kpi('Visites (période)', periodTotal, 'text-vert-800') +
            kpi('Visiteurs uniques', periodUnique, 'text-terre-600') +
            kpi("Uniques aujourd'hui", d.todayUnique || 0, 'text-green-600') +
            kpi('Total (depuis début)', d.totalVisits || 0, 'text-terre-700');

        await ensureChartJs();
        if (!labels.length) {
            chartEl.innerHTML = '<div class="text-xs text-terre-400 py-8 px-2">Aucune donnée pour cette période.</div>';
        } else {
            chartEl.innerHTML = '<canvas id="visits-canvas"></canvas>';
            if (window._visitsChart) { try { window._visitsChart.destroy(); } catch (e) { } }
            window._visitsChart = new Chart(document.getElementById('visits-canvas'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Visites', data: totals, borderColor: '#556B2F', backgroundColor: 'rgba(85,107,47,0.12)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
                        { label: 'Visiteurs uniques', data: uniques, borderColor: '#A67B5B', backgroundColor: 'rgba(166,123,91,0.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    plugins: { legend: { display: true, labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#938E85' } },
                        y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: '#938E85' }, grid: { color: 'rgba(0,0,0,0.05)' } }
                    }
                }
            });
        }

        if (topEl) {
            const tp = d.topPages || [];
            topEl.innerHTML = tp.length
                ? `<h4 class="text-xs font-bold text-terre-700 uppercase tracking-wide mb-2">Pages les plus vues</h4>
                   <div class="space-y-1">${tp.map(p => `<div class="flex justify-between text-xs text-terre-600 border-b border-sable-100 py-1"><span class="truncate">${(p.page || '/').replace(/</g, '&lt;')}</span><span class="font-bold ml-2">${p.count}</span></div>`).join('')}</div>`
                : '';
        }
    } catch (err) {
        chartEl.innerHTML = `<div class="text-xs text-red-500 py-8 px-2">Visites indisponibles : ${err.message}</div>`;
        kpisEl.innerHTML = '';
    }
}

// Export de la liste dédoublonnée des emails clients (pour Resend / mailing)
function exportClientEmails() {
    const all = _allReservations;
    if (!all.length) { showToast('Aucun client à exporter', 'error'); return; }
    const seen = new Set();
    const rows = [];
    all.forEach(r => {
        const email = (r.email || '').trim().toLowerCase();
        if (!email || seen.has(email)) return;
        seen.add(email);
        rows.push([r.name || '', r.email || '', r.typeLogement || '', r.status || ''].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'));
    });
    const csv = '﻿' + ['"Nom";"Email";"Logement";"Statut"', ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emails-clients-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${rows.length} email(s) client(s) exporté(s)`, 'success');
}

// ===== Newsletter & Campagnes =====
let _audience = [];
let _audStats = { count: 0, newsletter: 0, clients: 0 };
let _lists = [];
let _allClients = [];

const CAMP_TEMPLATES = {
    promo: {
        subject: 'Une offre pour vous à Les Archers',
        message: 'Bonjour,\n\nLes beaux jours arrivent et notre terrasse n\'attend plus que vous : formules du jour, cocktails signature et tapas maison place du Général Leclerc.\n\nPour votre prochaine visite, profitez de 10 % de réduction avec le code ARCHERS10.\n\nÀ très bientôt,\nL\'équipe des Archers'
    },
    revenir: {
        subject: 'Cela faisait longtemps — revenez nous voir',
        message: 'Bonjour,\n\nLes saisons passent et notre terrasse est toujours aussi agréable. Si l\'envie d\'un café, d\'une formule ou d\'un cocktail vous tente, nous serions ravis de vous accueillir à nouveau à Les Archers.\n\nÀ très bientôt,\nL\'équipe des Archers'
    },
    news: {
        subject: 'Des nouvelles de Les Archers',
        message: 'Bonjour,\n\nVoici quelques nouvelles des Archers…\n\n(écrivez ici votre actualité)\n\nÀ très bientôt,\nL\'équipe des Archers'
    }
};

async function loadCampaigns() {
    try {
        const [aRes, lRes] = await Promise.all([
            fetch('/api/campaigns?audience=1', { headers: adminHeaders() }),
            fetch('/api/campaigns?lists=1', { headers: adminHeaders() })
        ]);
        const d = await aRes.json();
        if (!aRes.ok) throw new Error(d.error || 'Erreur');
        _audience = d.audience || [];
        _allClients = d.allClients || [];
        _audStats = { count: d.count || 0, newsletter: d.newsletter || 0, clients: d.clients || 0, allClients: d.allClientsCount || 0 };
        try { const l = await lRes.json(); _lists = (lRes.ok && l.lists) ? l.lists : []; } catch { _lists = []; }

        const kpi = document.getElementById('kpi-campaigns');
        if (kpi) kpi.textContent = d.count || 0;
        const cnt = document.getElementById('camp-audience-count');
        if (cnt) cnt.textContent = '· ' + (d.count || 0) + ' contact(s)';
        renderAudienceStats(d);
        renderLists();
        populateTargets();
        updateSendCount();
        renderAudienceTable();
    } catch (err) {
        const tb = document.getElementById('camp-audience-tbody');
        if (tb) tb.innerHTML = `<tr><td colspan="4" class="px-6 py-10 text-center text-red-500 font-medium">Erreur : ${err.message}</td></tr>`;
    }
}

function renderAudienceStats(d) {
    const card = (label, value, color, icon) => `<div class="bg-white rounded-xl border border-sable-300 shadow-sm p-4 flex flex-col items-center text-center">
        <i data-lucide="${icon}" class="w-5 h-5 ${color} opacity-80 mb-1.5"></i>
        <div class="text-2xl font-bold ${color} leading-none">${value}</div>
        <div class="text-[11px] uppercase tracking-wide text-terre-500 font-bold mt-1.5">${label}</div>
    </div>`;
    const html = card('Total liste', d.count || 0, 'text-vert-800', 'users')
        + card('Abonnés newsletter', d.newsletter || 0, 'text-green-600', 'mail')
        + card('Clients (consentement)', d.clients || 0, 'text-terre-700', 'calendar-check');
    const a = document.getElementById('camp-stats'); if (a) a.innerHTML = html;
    const b = document.getElementById('dash-audience'); if (b) b.innerHTML = html;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function renderLists() {
    const el = document.getElementById('camp-lists');
    if (!el) return;
    if (!_lists.length) {
        el.innerHTML = '<p class="text-sm text-terre-400">Aucune liste pour le moment. Créez-en une, puis ajoutez des contacts depuis le tableau ci-dessous.</p>';
        return;
    }
    el.innerHTML = _lists.map(l => `<span class="inline-flex items-center gap-2 bg-sable-100 border border-sable-300 rounded-full pl-3 pr-1.5 py-1.5 text-sm">
        <i data-lucide="users" class="w-3.5 h-3.5 text-terre-400"></i>
        <span class="font-medium text-terre-800">${(l.name || '').replace(/</g, '&lt;')}</span>
        <span class="text-xs text-terre-500">${l.count || 0}</span>
        <button data-del-list="${l.id}" title="Supprimer la liste" class="w-5 h-5 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 transition-colors">&times;</button>
    </span>`).join('');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function populateTargets() {
    const t = document.getElementById('camp-target');
    if (t) {
        const cur = t.value;
        let opts = `<option value="all">Toute la liste (${_audStats.count})</option>
            <option value="newsletter">Abonnés newsletter (${_audStats.newsletter})</option>
            <option value="clients">Clients / consentement (${_audStats.clients})</option>
            <option value="clients-all">Tous les anciens clients (${_audStats.allClients || 0})</option>`;
        if (_lists.length) {
            opts += '<optgroup label="Mes listes">' + _lists.map(l => `<option value="list:${l.id}">${(l.name || '').replace(/</g, '&lt;')} (${l.count || 0})</option>`).join('') + '</optgroup>';
        }
        t.innerHTML = opts;
        if (cur && t.querySelector(`option[value="${cur}"]`)) t.value = cur;
    }
    const sel = document.getElementById('camp-addlist-select');
    if (sel) {
        sel.innerHTML = _lists.length
            ? _lists.map(l => `<option value="${l.id}">${(l.name || '').replace(/</g, '&lt;')}</option>`).join('')
            : '<option value="">Créez d\'abord une liste</option>';
    }
}

function targetCount(target) {
    if (!target || target === 'all') return _audStats.count;
    if (target === 'newsletter') return _audStats.newsletter;
    if (target === 'clients') return _audStats.clients;
    if (target === 'clients-all') return _audStats.allClients || 0;
    if (target.indexOf('list:') === 0) {
        const l = _lists.find(x => x.id === target.slice(5));
        return l ? (l.count || 0) : 0;
    }
    return 0;
}

function updateSendCount() {
    const t = document.getElementById('camp-target');
    const sc = document.getElementById('camp-send-count');
    if (sc) sc.textContent = targetCount(t ? t.value : 'all');
}

function currentViewList() {
    const view = document.getElementById('camp-view')?.value || 'audience';
    if (view === 'clients-all') return _allClients;
    if (view === 'newsletter') return _audience.filter(a => (a.sources || []).includes('newsletter'));
    return _audience;
}

function renderAudienceTable() {
    const tb = document.getElementById('camp-audience-tbody');
    if (!tb) return;
    const q = (document.getElementById('camp-search')?.value || '').trim().toLowerCase();
    let list = currentViewList().slice();
    if (q) list = list.filter(a => (a.email + ' ' + (a.name || '')).toLowerCase().includes(q));
    if (!list.length) {
        tb.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-terre-500 font-medium">Aucun contact${q ? ' pour cette recherche' : ' pour le moment'}.</td></tr>`;
        updateSelBar();
        return;
    }
    const tag = { newsletter: 'bg-green-100 text-green-800 border-green-300', client: 'bg-amber-100 text-amber-800 border-amber-300' };
    const lab = { newsletter: 'Newsletter', client: 'Client' };
    tb.innerHTML = list.map(a => `<tr class="hover:bg-sable-50 transition-colors">
        <td class="px-4 py-3"><input type="checkbox" class="camp-row-check cursor-pointer align-middle" data-email="${a.email}"></td>
        <td class="px-6 py-3 font-medium text-vert-800">${a.email}</td>
        <td class="px-6 py-3 text-terre-700">${a.name || '<span class="text-terre-400 italic">—</span>'}</td>
        <td class="px-6 py-3">${(a.sources || []).map(s => `<span class="inline-block px-2 py-0.5 mr-1 rounded-full text-xs font-bold border ${tag[s] || 'bg-sable-200 text-terre-600 border-sable-300'}">${lab[s] || s}</span>`).join('')}</td>
    </tr>`).join('');
    const all = document.getElementById('camp-check-all');
    if (all) all.checked = false;
    updateSelBar();
}

function getCheckedEmails() {
    return Array.from(document.querySelectorAll('.camp-row-check:checked')).map(c => c.getAttribute('data-email'));
}

function updateSelBar() {
    const n = document.querySelectorAll('.camp-row-check:checked').length;
    const bar = document.getElementById('camp-selbar');
    const c = document.getElementById('camp-sel-count');
    if (c) c.textContent = n;
    if (bar) { bar.classList.toggle('hidden', n === 0); bar.classList.toggle('flex', n > 0); }
}

function exportAudienceCSV() {
    const data = currentViewList();
    if (!data.length) { showToast('Liste vide', 'error'); return; }
    const esc = (v) => '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"';
    const rows = data.map(a => [a.email, a.name || '', (a.sources || []).join(' + ')].map(esc).join(';'));
    const csv = '﻿' + ['"Email";"Nom";"Source"', ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'liste-diffusion-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    showToast(`${currentViewList().length} contact(s) exporté(s)`, 'success');
}

let _previewTimer = null;
function fitPreview() {
    const wrap = document.getElementById('camp-preview-wrap');
    const iframe = document.getElementById('camp-preview');
    if (!wrap || !iframe) return;
    const scale = Math.min(1, (wrap.clientWidth || 600) / 600);
    let h = 800;
    try { h = Math.max(iframe.contentDocument.body.scrollHeight || 0, iframe.contentDocument.documentElement.scrollHeight || 0) || 800; } catch (e) { }
    iframe.style.width = '600px';
    iframe.style.height = h + 'px';
    iframe.style.transformOrigin = 'top left';
    iframe.style.transform = 'scale(' + scale + ')';
    wrap.style.height = Math.ceil(h * scale) + 'px';
}
async function updateCampPreview() {
    const iframe = document.getElementById('camp-preview');
    if (!iframe) return;
    const message = document.getElementById('camp-message')?.value || '';
    const image = document.getElementById('camp-image')?.value || '';
    const ps = document.getElementById('camp-prev-subject');
    if (ps) ps.textContent = (document.getElementById('camp-subject')?.value || '') || '(sans objet)';
    try {
        const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'preview', message, image }) });
        const d = await resp.json();
        if (resp.ok && d.html) { iframe.onload = () => { fitPreview(); setTimeout(fitPreview, 350); setTimeout(fitPreview, 1100); }; iframe.srcdoc = d.html; }
    } catch { /* best-effort */ }
}

async function createCampList() {
    const input = document.getElementById('camp-newlist-name');
    const name = (input?.value || '').trim();
    if (!name) { showToast('Donnez un nom à la liste', 'error'); return; }
    try {
        const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'createList', name }) });
        const d = await resp.json();
        if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
        if (input) input.value = '';
        showToast('Liste créée ✓', 'success');
        await loadCampaigns();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

async function deleteCampList(id) {
    if (!confirm('Supprimer cette liste ? (les contacts ne sont pas supprimés, seule la liste disparaît)')) return;
    try {
        const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'deleteList', id }) });
        const d = await resp.json();
        if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
        showToast('Liste supprimée', 'info');
        await loadCampaigns();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

async function addSelectionToList() {
    const emails = getCheckedEmails();
    const id = document.getElementById('camp-addlist-select')?.value || '';
    if (!emails.length) { showToast('Cochez au moins un contact', 'error'); return; }
    if (!id) { showToast('Créez d\'abord une liste', 'error'); return; }
    try {
        const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'addToList', id, emails }) });
        const d = await resp.json();
        if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
        showToast(`${d.added} contact(s) ajouté(s) à la liste`, 'success');
        await loadCampaigns();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

function initCampaignsUI() {
    const tplSel = document.getElementById('camp-template');
    const subj = document.getElementById('camp-subject');
    const msg = document.getElementById('camp-message');
    const search = document.getElementById('camp-search');
    const exportBtn = document.getElementById('camp-export');
    const testBtn = document.getElementById('camp-test-btn');
    const sendBtn = document.getElementById('camp-send-btn');
    const target = document.getElementById('camp-target');
    const createBtn = document.getElementById('camp-create-list');
    const addBtn = document.getElementById('camp-addlist-btn');
    const checkAll = document.getElementById('camp-check-all');
    const tbody = document.getElementById('camp-audience-tbody');
    const listsBox = document.getElementById('camp-lists');

    if (tplSel) tplSel.addEventListener('change', () => {
        const t = CAMP_TEMPLATES[tplSel.value];
        if (t) { if (subj) subj.value = t.subject; if (msg) msg.value = t.message; }
        else { if (subj) subj.value = ''; if (msg) msg.value = ''; }
        updateCampPreview();
    });
    if (msg) msg.addEventListener('input', () => { clearTimeout(_previewTimer); _previewTimer = setTimeout(updateCampPreview, 400); });
    const imgSel = document.getElementById('camp-image');
    if (imgSel) imgSel.addEventListener('change', updateCampPreview);
    if (subj) subj.addEventListener('input', () => { const ps = document.getElementById('camp-prev-subject'); if (ps) ps.textContent = subj.value || '(sans objet)'; });
    window.addEventListener('resize', fitPreview);
    updateCampPreview();
    if (search) search.addEventListener('input', renderAudienceTable);
    const viewSel = document.getElementById('camp-view');
    if (viewSel) viewSel.addEventListener('change', renderAudienceTable);
    if (exportBtn) exportBtn.addEventListener('click', exportAudienceCSV);
    if (target) target.addEventListener('change', updateSendCount);
    if (createBtn) createBtn.addEventListener('click', createCampList);
    if (addBtn) addBtn.addEventListener('click', addSelectionToList);
    if (checkAll) checkAll.addEventListener('change', () => {
        document.querySelectorAll('.camp-row-check').forEach(c => { c.checked = checkAll.checked; });
        updateSelBar();
    });
    if (tbody) tbody.addEventListener('change', (e) => { if (e.target.classList.contains('camp-row-check')) updateSelBar(); });
    if (listsBox) listsBox.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-del-list]');
        if (btn) deleteCampList(btn.getAttribute('data-del-list'));
    });

    if (testBtn) testBtn.addEventListener('click', async () => {
        const testEmail = (document.getElementById('camp-test-email')?.value || '').trim();
        const subject = (subj?.value || '').trim();
        const message = (msg?.value || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) { showToast('Email de test invalide', 'error'); return; }
        if (!subject || !message.trim()) { showToast('Sujet et message requis', 'error'); return; }
        const o = testBtn.innerHTML; testBtn.disabled = true; testBtn.textContent = 'Envoi…';
        try {
            const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'broadcast', subject, message, testEmail, image: document.getElementById('camp-image')?.value || '' }) });
            const d = await resp.json();
            if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
            showToast('Email de test envoyé ✓', 'success');
        } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
        finally { testBtn.disabled = false; testBtn.innerHTML = o; }
    });

    if (sendBtn) sendBtn.addEventListener('click', async () => {
        const subject = (subj?.value || '').trim();
        const message = (msg?.value || '');
        const targetVal = target ? target.value : 'all';
        if (!subject || !message.trim()) { showToast('Sujet et message requis', 'error'); return; }
        const n = targetCount(targetVal);
        if (!n) { showToast('Aucun destinataire pour cette cible', 'error'); return; }
        const targetLabel = target && target.selectedOptions[0] ? target.selectedOptions[0].textContent : '';
        if (!confirm(`Envoyer cet email à ${n} contact(s) (${targetLabel}) ?\n\nLes emails partent réellement. Cette action est irréversible.`)) return;
        const o = sendBtn.innerHTML; sendBtn.disabled = true; sendBtn.textContent = 'Envoi en cours…';
        try {
            const resp = await fetch('/api/campaigns', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ type: 'broadcast', subject, message, target: targetVal, image: document.getElementById('camp-image')?.value || '' }) });
            const d = await resp.json();
            if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
            showToast(`Campagne envoyée : ${d.sent} envoi(s)${d.failed ? ', ' + d.failed + ' échec(s)' : ''}`, 'success');
        } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
        finally { sendBtn.disabled = false; sendBtn.innerHTML = o; }
    });
}

// Réponse libre à un client via une modale, envoyée par Resend (no-reply)
let _replyId = null;
window._reply = function (id) {
    _replyId = id;
    const r = _allReservations.find(x => x.id === id);
    const nameEl = document.getElementById('reply-to-name');
    if (nameEl) nameEl.textContent = r ? `À : ${r.name || ''} (${r.email || ''})` : '';
    const msgEl = document.getElementById('reply-message');
    if (msgEl) msgEl.value = '';
    const m = document.getElementById('reply-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
    setTimeout(() => msgEl && msgEl.focus(), 50);
};
window._closeReply = function () {
    const m = document.getElementById('reply-modal');
    m.classList.add('hidden');
    m.classList.remove('flex');
    _replyId = null;
};
window._sendReply = async function () {
    const message = (document.getElementById('reply-message')?.value || '');
    if (!message.trim()) { showToast('Message vide', 'error'); return; }
    const btn = document.getElementById('reply-send-btn');
    const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Envoi…';
    try {
        const resp = await fetch('/api/campaigns', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ type: 'reply', id: _replyId, message })
        });
        const d = await resp.json();
        if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
        showToast('Réponse envoyée ✓', 'success');
        window._closeReply();
        await loadReservations();
    } catch (err) {
        showToast('Erreur: ' + err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = txt;
    }
};

// Envoi manuel d'un email (avis ou relance) à un client depuis l'admin
window._sendMail = async function (id, type) {
    const labels = { review: "l'email de demande d'avis Google", reengage: "l'email « revenez nous voir »", promo: "l'email d'offre / promo" };
    if (!confirm(`Envoyer ${labels[type] || 'cet email'} à ce client maintenant ?`)) return;
    try {
        const resp = await fetch('/api/campaigns', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ type, id })
        });
        const d = await resp.json();
        if (!resp.ok || !d.success) throw new Error(d.error || 'Erreur');
        showToast('Email envoyé ✓', 'success');
        await loadReservations();
    } catch (err) {
        showToast('Erreur: ' + err.message, 'error');
    }
};

window._updateRes = async function (id, status) {
    try {
        const resp = await fetch(`/api/reservations?id=${id}`, {
            method: 'PATCH',
            headers: adminHeaders(),
            body: JSON.stringify({ status })
        });
        if (!resp.ok) throw new Error('Erreur');
        await loadReservations();
    } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
};

window._deleteRes = async function (id) {
    if (!confirm('Supprimer cette demande définitivement ?')) return;
    try {
        const resp = await fetch(`/api/reservations?id=${id}`, {
            method: 'DELETE',
            headers: adminHeaders()
        });
        if (!resp.ok) throw new Error('Erreur');
        await loadReservations();
    } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
};

// ===== Espace client — Supabase Auth =====
// Pas encore de projet Supabase pour Les Archers (à provisionner séparément) :
// on laisse volontairement ces clés vides pour ne pas dépendre d'un autre projet.
const SUPA_URL = '';
const SUPA_KEY = '';
let _supa = null;
let _compteWired = false;
let _recoveryMode = (typeof window !== "undefined") && /type=recovery/.test(window.location.hash);

function getSupa() {
    if (!SUPA_URL || !SUPA_KEY) return null;
    if (!_supa && window.supabase && window.supabase.createClient) {
        _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
}

function compteMsg(text, type) {
    const el = document.getElementById('compte-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm mt-4 text-center ' +
        (type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-700' : 'text-terre-600') +
        (text ? '' : ' hidden');
}

async function renderCompte() {
    const supa = getSupa();
    const authBox = document.getElementById('compte-auth');
    const dash = document.getElementById('compte-dashboard');
    if (!authBox || !dash) return;
    if (!supa) { compteMsg('Service indisponible, réessayez dans un instant.', 'error'); return; }
    wireCompteOnce();
    const rec = document.getElementById('compte-recovery');
    if (_recoveryMode) { authBox.classList.add('hidden'); dash.classList.add('hidden'); if (rec) rec.classList.remove('hidden'); return; }
    if (rec) rec.classList.add('hidden');
    const { data } = await supa.auth.getSession();
    const session = data && data.session;
    if (session && session.user) {
        authBox.classList.add('hidden');
        dash.classList.remove('hidden');
        const em = document.getElementById('compte-email');
        if (em) em.textContent = session.user.email || '';
        const ae = document.getElementById('acc-email');
        if (ae) ae.textContent = session.user.email || '';
        const gr = document.getElementById('compte-greeting');
        if (gr) { const md = session.user.user_metadata || {}; gr.textContent = (md.full_name || (session.user.email || '').split('@')[0] || '').split(' ')[0]; }
        loadMyReservations();
        loadBookingCatalog();
        initBookingOnce();
        if (location.hash.indexOf('paid=1') > -1) { try { localStorage.removeItem('cv_cart'); } catch (e) { } if (typeof _cart !== 'undefined') { _cart = []; } if (typeof updateCartBtn === 'function') updateCartBtn(); showToast('Paiement confirmé — votre réservation est enregistrée.', 'success'); if (history.replaceState) history.replaceState(null, '', location.pathname + '#compte'); }
    } else {
        authBox.classList.remove('hidden');
        dash.classList.add('hidden');
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

async function loadMyReservations() {
    const box = document.getElementById('compte-reservations');
    if (!box) return;
    box.innerHTML = '<p class="text-terre-500 text-sm">Chargement…</p>';
    const supa = getSupa();
    const { data } = await supa.auth.getSession();
    const token = data && data.session ? data.session.access_token : '';
    try {
        const resp = await fetch('/api/my-reservations', { headers: { Authorization: 'Bearer ' + token } });
        const d = await resp.json();
        if (!resp.ok) throw new Error(d.error || 'Erreur');
        const list = d.reservations || [];
        if (!list.length) {
            box.innerHTML = '<div class="bg-white rounded-2xl border border-sable-300 p-8 text-center text-terre-500">Aucune demande pour le moment.<br><a href="#contact" class="inline-block mt-3 text-terre-700 font-bold underline">Faire une demande de réservation</a></div>';
            return;
        }
        const badge = {
            new: 'bg-amber-100 text-amber-800 border-amber-300',
            confirmed: 'bg-green-100 text-green-800 border-green-300',
            refused: 'bg-red-100 text-red-700 border-red-300',
            read: 'bg-sable-200 text-terre-600 border-sable-300'
        };
        const lbl = { new: 'En attente', confirmed: 'Confirmée', refused: 'Refusée', read: 'Reçue' };
        const fmt = (x) => x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        box.innerHTML = list.map(r => `<div class="bg-white rounded-2xl border border-sable-300 shadow-sm overflow-hidden mb-3 flex flex-col sm:flex-row">
            <div class="sm:w-44 h-32 sm:h-auto flex-shrink-0 bg-sable-200"><img loading="lazy" src="${photoForLogement(r.typeLogement)}" alt="" class="w-full h-full object-cover"></div>
            <div class="p-5 flex-1">
                <div class="flex justify-between items-start gap-3 flex-wrap">
                    <div>
                        <div class="font-bold text-vert-800">${r.typeLogement || 'Séjour'}</div>
                        <div class="text-sm text-terre-700 mt-1">${fmt(r.dateStart)} &rarr; ${fmt(r.dateEnd)}${r.guests ? ' · ' + r.guests + ' pers.' : ''}</div>
                        ${r.message ? `<div class="text-xs text-terre-500 italic mt-2">&laquo; ${(r.message + '').replace(/</g, '&lt;').slice(0, 160)} &raquo;</div>` : ''}
                    </div>
                    <span class="px-3 py-1 border rounded-full text-xs font-bold whitespace-nowrap ${badge[r.status] || badge.read}">${lbl[r.status] || 'Reçue'}</span>
                </div>
                <div class="text-xs text-terre-400 mt-3">Demande envoyée le ${fmt(r.createdAt)}</div>
            </div>
        </div>`).join('');
    } catch (err) {
        box.innerHTML = `<p class="text-red-500 text-sm">Erreur : ${err.message}</p>`;
    }
}

function wireCompteOnce() {
    if (_compteWired) return;
    const supa = getSupa();
    if (!supa) return;
    _compteWired = true;

    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    const showTab = (login) => {
        loginForm.classList.toggle('hidden', !login);
        signupForm.classList.toggle('hidden', login);
        tabLogin.classList.toggle('bg-white', login);
        tabLogin.classList.toggle('shadow-sm', login);
        tabLogin.classList.toggle('text-terre-600', !login);
        tabSignup.classList.toggle('bg-white', !login);
        tabSignup.classList.toggle('shadow-sm', !login);
        tabSignup.classList.toggle('text-terre-600', login);
        compteMsg('');
    };
    if (tabLogin) tabLogin.addEventListener('click', () => showTab(true));
    if (tabSignup) tabSignup.addEventListener('click', () => showTab(false));

    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        compteMsg('Connexion…');
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) { compteMsg('Échec : ' + (error.message || 'identifiants invalides'), 'error'); return; }
        compteMsg('');
        renderCompte();
    });

    if (signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const full_name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        if (password.length < 6) { compteMsg('Mot de passe : 6 caractères minimum.', 'error'); return; }
        compteMsg('Création du compte…');
        const { data, error } = await supa.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: 'https://www.lesarchersvoiron.fr' } });
        if (error) { compteMsg('Échec : ' + error.message, 'error'); return; }
        if (data && data.session) { renderCompte(); }
        else {
            if (loginForm) loginForm.classList.add('hidden');
            if (signupForm) signupForm.classList.add('hidden');
            if (tabLogin && tabLogin.parentElement) tabLogin.parentElement.classList.add('hidden');
            const _g = document.getElementById('google-login'); if (_g) _g.classList.add('hidden');
            compteMsg('Compte créé ! Un email de confirmation a été envoyé à ' + email + '. Ouvrez votre boîte mail et cliquez sur le lien pour activer votre compte, puis revenez vous connecter.', 'success');
        }
    });

    const logoutBtn = document.getElementById('compte-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supa.auth.signOut(); renderCompte(); });

    const googleBtn = document.getElementById('google-login');
    if (googleBtn) googleBtn.addEventListener('click', async () => {
        compteMsg('Redirection vers Google…');
        const { error } = await supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://www.lesarchersvoiron.fr' } });
        if (error) compteMsg('Google indisponible : ' + error.message, 'error');
    });

    const forgotLink = document.getElementById('forgot-link');
    if (forgotLink) forgotLink.addEventListener('click', async () => {
        const email = (document.getElementById('login-email').value || '').trim();
        if (!email || email.indexOf('@') < 1 || email.indexOf('.') < 2) { compteMsg('Entrez d’abord votre email ci-dessus, puis recliquez sur « Mot de passe oublié ».', 'error'); return; }
        compteMsg('Envoi du lien…');
        const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: 'https://www.lesarchersvoiron.fr/#compte' });
        if (error) { compteMsg('Erreur : ' + error.message, 'error'); return; }
        compteMsg('Email de réinitialisation envoyé ! Consultez votre boîte mail.', 'success');
    });

    const recoveryForm = document.getElementById('recovery-form');
    if (recoveryForm) recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('recovery-password').value;
        const msg = document.getElementById('recovery-msg');
        const setMsg = (t, type) => { if (msg) { msg.textContent = t; msg.className = 'text-sm mt-4 text-center ' + (type === 'error' ? 'text-red-600' : 'text-green-700') + (t ? '' : ' hidden'); } };
        if (pwd.length < 6) { setMsg('6 caractères minimum.', 'error'); return; }
        setMsg('Enregistrement…');
        const { error } = await supa.auth.updateUser({ password: pwd });
        if (error) { setMsg('Erreur : ' + error.message, 'error'); return; }
        _recoveryMode = false;
        setMsg('Mot de passe mis à jour ✓', 'success');
        setTimeout(renderCompte, 900);
    });

    const navResa = document.getElementById('acc-nav-resa');
    const navParams = document.getElementById('acc-nav-params');
    const tabResa = document.getElementById('acc-tab-resa');
    const tabParams = document.getElementById('acc-tab-params');
    const accTab = (params) => {
        if (tabResa) tabResa.classList.toggle('hidden', params);
        if (tabParams) tabParams.classList.toggle('hidden', !params);
        if (navResa) { navResa.classList.toggle('border-vert-800', !params); navResa.classList.toggle('text-vert-800', !params); navResa.classList.toggle('border-transparent', params); navResa.classList.toggle('text-terre-500', params); }
        if (navParams) { navParams.classList.toggle('border-vert-800', params); navParams.classList.toggle('text-vert-800', params); navParams.classList.toggle('border-transparent', !params); navParams.classList.toggle('text-terre-500', !params); }
    };
    if (navResa) navResa.addEventListener('click', () => accTab(false));
    if (navParams) navParams.addEventListener('click', () => accTab(true));

    const pwdReset = document.getElementById('acc-pwd-reset');
    if (pwdReset) pwdReset.addEventListener('click', async () => {
        const msg = document.getElementById('acc-pwd-msg');
        const setMsg = (t, ty) => { if (msg) { msg.textContent = t; msg.className = 'text-sm mt-3 ' + (ty === 'error' ? 'text-red-600' : 'text-green-700') + (t ? '' : ' hidden'); } };
        const { data } = await supa.auth.getSession();
        const email = data && data.session ? data.session.user.email : '';
        if (!email) { setMsg('Erreur, reconnectez-vous.', 'error'); return; }
        setMsg('Envoi…');
        const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: 'https://www.lesarchersvoiron.fr/#compte' });
        if (error) { setMsg('Erreur : ' + error.message, 'error'); return; }
        setMsg('Lien envoyé ! Consultez votre boîte mail pour choisir un nouveau mot de passe.', 'success');
    });

    supa.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') { _recoveryMode = true; if (!location.hash.startsWith('#compte')) location.hash = '#compte'; }
        if (location.hash.startsWith('#compte')) renderCompte();
        prefillContactEmail();
    });
}

async function prefillContactEmail() {
    const supa = getSupa();
    if (!supa) return;
    try {
        const { data } = await supa.auth.getSession();
        const email = data && data.session && data.session.user ? data.session.user.email : '';
        const field = document.getElementById('email');
        if (email && field && !field.value) field.value = email;
    } catch (e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(prefillContactEmail, 700); });

// Retour d'une confirmation email ou d'une connexion Google (token dans l'URL)
if (typeof window !== 'undefined' && window.location.hash.indexOf('access_token') !== -1) {
    const _supaRedir = getSupa();
    if (_supaRedir) {
        let _redirDone = false;
        _supaRedir.auth.onAuthStateChange((event, session) => {
            if (session && !_redirDone) { _redirDone = true; location.replace(location.pathname + '#compte'); }
        });
    }
}

// ===== Logements (espace client) =====
const LOGEMENTS = [
    { nom: 'Plat du jour', prix: 13.90, key: 'plat-du-jour', photo: '/photo/plat.webp' },
    { nom: 'Entrée + plat ou plat + dessert', prix: 19.50, key: 'formule-simple', photo: '/photo/plat.webp' },
    { nom: 'Entrée + plat + dessert', prix: 22.50, key: 'formule-complete', photo: '/photo/plat.webp' },
    { nom: 'Cocktail signature', prix: 12, key: 'cocktail', photo: '/photo/cocktail.webp' }
];
const LOGEMENT_FALLBACK = '/photo/bar-interieur.webp';

function _norm(s) {
    return (s || '').toString().toLowerCase()
        .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o').replace(/[ûü]/g, 'u').replace(/ç/g, 'c');
}

function photoForLogement(type) {
    const t = _norm(type);
    if (!t) return LOGEMENT_FALLBACK;
    const found = LOGEMENTS.find(l => t.includes(l.key));
    return found ? found.photo : LOGEMENT_FALLBACK;
}

function renderLogements() {
    const box = document.getElementById('compte-logements');
    if (!box) return;
    box.innerHTML = LOGEMENTS.map(l => `<div class="bg-white rounded-2xl border border-sable-300 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
        <div class="aspect-[4/3] overflow-hidden bg-sable-200">
            <img loading="lazy" src="${l.photo}" alt="${l.nom}" class="w-full h-full object-cover">
        </div>
        <div class="p-4 flex flex-col flex-1">
            <h3 class="font-serif text-lg font-bold text-vert-800">${l.nom}</h3>
            <p class="text-sm text-terre-600 mt-1">À partir de <span class="font-bold text-terre-800">${l.prix}€</span> <span class="text-terre-400">/ nuit</span></p>
            <a href="https://reservation.lesarchersvoiron.fr" target="_blank" rel="noopener" class="mt-3 block text-center bg-vert-800 hover:bg-vert-600 text-white font-bold text-sm py-2 rounded-lg transition-colors">Réserver</a>
        </div>
    </div>`).join('');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

// ===== Tunnel de réservation (Stripe) =====
let _bk = null;
let _bookingWired = false;

async function loadBookingCatalog() {
    const box = document.getElementById('compte-logements');
    if (!box) return;
    box.innerHTML = '<p class="text-terre-500 text-sm">Chargement des hébergements…</p>';
    try {
        const r = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logements' }) });
        const d = await r.json();
        const cat = (r.ok && d.logements) ? d.logements : [];
        if (!cat.length) { box.innerHTML = '<p class="text-terre-500 text-sm">Hébergements indisponibles pour le moment.</p>'; return; }
        box.innerHTML = cat.map(l => `<div class="bg-white rounded-2xl border border-sable-300 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
            <div class="aspect-[4/3] overflow-hidden bg-sable-200"><img loading="lazy" src="${photoForLogement(l.nom)}" alt="${l.nom}" class="w-full h-full object-cover"></div>
            <div class="p-4 flex flex-col flex-1">
                <h3 class="font-serif text-lg font-bold text-vert-800">${l.nom}</h3>
                <p class="text-sm text-terre-600 mt-1">À partir de <span class="font-bold text-terre-800">${l.prix_nuit != null ? l.prix_nuit + '€' : '—'}</span> <span class="text-terre-400">/ nuit · ${l.capacite} pers. max</span></p>
                <a href="https://reservation.lesarchersvoiron.fr" target="_blank" rel="noopener" class="mt-3 block text-center bg-vert-800 hover:bg-vert-600 text-white font-bold text-sm py-2 rounded-lg transition-colors">Réserver</a>
            </div>
        </div>`).join('');
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    } catch (e) {
        box.innerHTML = '<p class="text-red-500 text-sm">Erreur de chargement des hébergements.</p>';
    }
}

window._closeBooking = function () {
    const m = document.getElementById('booking-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
};

function openBooking(b) {
    _bk = b;
    const _t = new Date().toISOString().slice(0, 10);
    const _ar = document.getElementById('booking-arrivee'); if (_ar) { _ar.min = _t; }
    const _dp = document.getElementById('booking-depart'); if (_dp) { _dp.min = _t; }
    const info = document.getElementById('booking-logement');
    if (info) info.textContent = `${b.nom} · ${b.prix}€/nuit · ${b.cap} pers. max · ${b.min} nuit(s) min.`;
    const pers = document.getElementById('booking-pers');
    if (pers) { pers.max = b.cap; if (parseInt(pers.value || '1', 10) > b.cap) pers.value = b.cap; }
    const result = document.getElementById('booking-result'); if (result) { result.classList.add('hidden'); result.innerHTML = ''; }
    const pay = document.getElementById('booking-pay'); if (pay) pay.classList.add('hidden');
    const m = document.getElementById('booking-modal');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function initBookingOnce() {
    if (_bookingWired) return;
    _bookingWired = true;
    const box = document.getElementById('compte-logements');
    if (box) box.addEventListener('click', (e) => {
        const btn = e.target.closest('.cv-book-btn');
        if (btn) openBooking({ id: btn.dataset.id, nom: btn.dataset.nom, cap: parseInt(btn.dataset.cap, 10), prix: btn.dataset.prix, min: btn.dataset.min });
    });

    const checkBtn = document.getElementById('booking-check');
    const payBtn = document.getElementById('booking-pay');
    const result = document.getElementById('booking-result');
    ['booking-arrivee', 'booking-depart', 'booking-pers'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { if (payBtn) payBtn.classList.add('hidden'); if (result) { result.classList.add('hidden'); result.innerHTML = ''; } }); });

    if (checkBtn) checkBtn.addEventListener('click', async () => {
        if (!_bk) return;
        const arrivee = document.getElementById('booking-arrivee').value;
        const depart = document.getElementById('booking-depart').value;
        const nb_pers = document.getElementById('booking-pers').value;
        result.classList.remove('hidden');
        payBtn.classList.add('hidden');
        if (!arrivee || !depart) { result.innerHTML = '<span class="text-red-600">Choisissez vos dates.</span>'; return; }
        result.innerHTML = 'Vérification…';
        try {
            const r = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'quote', logementId: _bk.id, arrivee, depart, nb_pers }) });
            const d = await r.json();
            if (d.error || !d.available) { result.innerHTML = `<span class="text-red-600">${d.error || 'Dates non disponibles'}</span>`; return; }
            result.innerHTML = `<div class="bg-sable-100 border border-sable-300 rounded-xl p-3"><div class="flex justify-between items-center"><span class="text-terre-700">${d.nights} nuit(s) · ${nb_pers} pers.</span><span class="font-bold text-vert-800 text-lg">${d.total.toFixed(2)} €</span></div><p class="text-xs text-terre-500 mt-1">Disponible · paiement total à la réservation</p></div>`;
            payBtn.textContent = 'Ajouter au panier · ' + d.total.toFixed(2) + ' €';
            payBtn.dataset.arrivee = arrivee; payBtn.dataset.depart = depart; payBtn.dataset.pers = nb_pers; payBtn.dataset.total = d.totalFinal;
            payBtn.classList.remove('hidden');
        } catch (e) { result.innerHTML = '<span class="text-red-600">Erreur, réessayez.</span>'; }
    });

    if (payBtn) payBtn.addEventListener('click', addCurrentToCart);
}

// ===== Reservation depuis le site public (test Stripe) =====
let _pubCatalog = [];
async function initPublicBooking() {
    try {
        const r = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logements' }) });
        const d = await r.json();
        _pubCatalog = (r.ok && d.logements) ? d.logements : [];
    } catch (e) { }
    if (typeof initBookingOnce === 'function') initBookingOnce();
    document.querySelectorAll('[data-book]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const room = _norm(btn.getAttribute('data-room') || '');
            const lg = _pubCatalog.find(l => _norm(l.nom).includes(room) || room.includes(_norm(l.nom)));
            if (!lg) { location.hash = '#compte'; return; }
            const supa = getSupa();
            const { data } = supa ? await supa.auth.getSession() : { data: null };
            if (!data || !data.session) { showToast('Connectez-vous ou créez un compte pour réserver.', 'info'); location.hash = '#compte'; return; }
            openBooking({ id: lg.id, nom: lg.nom, cap: lg.capacite, prix: lg.prix_nuit, min: lg.nb_nuits_min });
        });
    });
}
document.addEventListener('DOMContentLoaded', () => setTimeout(initPublicBooking, 500));

// ===== Calendrier admin =====
let _calData = { logements: [], reservations: [], blocages: [] };
let _calDate = new Date();
let _calWired = false;
const _CAL_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

async function loadCalendar() {
  try {
    const r = await fetch('/api/calendar', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ action: 'data' }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Erreur');
    _calData = { logements: d.logements || [], reservations: d.reservations || [], blocages: d.blocages || [] };
    const opts = '<option value="">Tous les logements</option>' + _calData.logements.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
    const f = document.getElementById('cal-filter'); if (f) f.innerHTML = opts;
    const bl = document.getElementById('cal-block-log'); if (bl) bl.innerHTML = _calData.logements.map(l => `<option value="${l.id}">${l.nom}</option>`).join('');
    wireCalendarOnce();
    renderCalendar();
    renderBlocages();
  } catch (e) {
    const g = document.getElementById('cal-grid'); if (g) g.innerHTML = `<p class="text-red-500 text-sm p-4">Erreur : ${e.message}</p>`;
  }
}

function _occ(dateStr, logId) {
  const res = _calData.reservations.filter(r => r.arrivee <= dateStr && r.depart > dateStr && (!logId || r.logement_id === logId));
  const blk = _calData.blocages.filter(b => b.from && b.from <= dateStr && b.to > dateStr && (!logId || b.logement_id === logId));
  return { res, blk, n: res.length + blk.length };
}

function renderCalendar() {
  const g = document.getElementById('cal-grid');
  if (!g) return;
  const PALETTE = ['#556B2F', '#C4704D', '#2E3D2F', '#A67B5B', '#6B8E23', '#B5651D', '#8B5E3C', '#4F6F52'];
  const colors = {};
  (_calData.logements || []).forEach((l, i) => colors[l.id] = PALETTE[i % PALETTE.length]);
  const y = _calDate.getFullYear(), m = _calDate.getMonth();
  const filt = (document.getElementById('cal-filter') || {}).value || '';
  const lab = document.getElementById('cal-label'); if (lab) lab.textContent = _CAL_MOIS[m] + ' ' + y;
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const jours = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let html = '<div class="grid grid-cols-7 gap-1 text-center">';
  jours.forEach(j => html += `<div class="text-xs font-bold text-terre-400 py-1">${j}</div>`);
  for (let i = 0; i < firstDow; i++) html += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const o = _occ(ds, filt || null);
    if (filt) {
      const conf = o.res.some(r => r.statut === 'confirmed');
      const pend = o.res.some(r => r.statut === 'pending');
      const blok = o.blk.length > 0;
      const col = colors[filt] || '#556B2F';
      const occ = conf || pend || blok;
      const sub = blok ? 'Bloqué' : conf ? 'Réservé' : pend ? 'En attente' : '';
      html += `<div class="rounded-lg py-2 min-h-[56px] border border-sable-200" style="${occ ? 'background:' + col + '22;border-color:' + col : ''}"><div class="font-bold text-sm text-terre-800">${d}</div><div class="text-[10px] text-terre-600">${sub}</div></div>`;
    } else {
      const ids = Array.from(new Set([...o.res.map(r => r.logement_id), ...o.blk.map(b => b.logement_id)]));
      const dots = ids.map(id => `<span title="" style="background:${colors[id] || '#999'}" class="inline-block w-2.5 h-2.5 rounded-full"></span>`).join('');
      html += `<div class="rounded-lg py-1.5 min-h-[56px] ${ids.length ? 'bg-sable-50' : 'bg-white'} border border-sable-200"><div class="font-bold text-sm text-terre-800">${d}</div><div class="flex flex-wrap gap-0.5 justify-center mt-1">${dots}</div></div>`;
    }
  }
  html += '</div>';
  html += '<div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-xs text-terre-700">' + (_calData.logements || []).map(l => `<span class="flex items-center gap-1.5"><span style="background:${colors[l.id]}" class="w-3 h-3 rounded-full inline-block"></span> ${l.nom}</span>`).join('') + '</div>';
  g.innerHTML = html;
}

function renderBlocages() {
  const el = document.getElementById('cal-blocages');
  if (!el) return;
  const nom = id => { const l = _calData.logements.find(x => x.id === id); return l ? l.nom : '?'; };
  if (!_calData.blocages.length) { el.innerHTML = '<p class="text-xs text-terre-400">Aucun blocage.</p>'; return; }
  el.innerHTML = _calData.blocages.map(b => `<div class="flex items-center justify-between text-sm border-b border-sable-100 py-1.5"><span>${nom(b.logement_id)} · ${b.from} → ${b.to}${b.motif ? ' · ' + b.motif : ''}</span><button type="button" data-unblock="${b.id}" class="text-red-500 hover:text-red-700 text-xs font-bold">Retirer</button></div>`).join('');
}

function wireCalendarOnce() {
  if (_calWired) return;
  _calWired = true;
  const prev = document.getElementById('cal-prev'), next = document.getElementById('cal-next'), filt = document.getElementById('cal-filter');
  if (prev) prev.addEventListener('click', () => { _calDate.setMonth(_calDate.getMonth() - 1); renderCalendar(); });
  if (next) next.addEventListener('click', () => { _calDate.setMonth(_calDate.getMonth() + 1); renderCalendar(); });
  if (filt) filt.addEventListener('change', renderCalendar);
  const bb = document.getElementById('cal-block-btn');
  if (bb) bb.addEventListener('click', async () => {
    const logement_id = (document.getElementById('cal-block-log') || {}).value;
    const from = (document.getElementById('cal-block-from') || {}).value;
    const to = (document.getElementById('cal-block-to') || {}).value;
    const motif = (document.getElementById('cal-block-motif') || {}).value;
    if (!logement_id || !from || !to) { showToast('Logement et dates requis', 'error'); return; }
    try {
      const r = await fetch('/api/calendar', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ action: 'block', logement_id, from, to, motif }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      showToast('Dates bloquées ✓', 'success');
      loadCalendar();
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
  });
  const list = document.getElementById('cal-blocages');
  if (list) list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-unblock]');
    if (!btn) return;
    try {
      await fetch('/api/calendar', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ action: 'unblock', id: btn.getAttribute('data-unblock') }) });
      showToast('Blocage retiré', 'info');
      loadCalendar();
    } catch (e2) { showToast('Erreur', 'error'); }
  });
}

// ===== Panier multi-logement =====
let _cart = [];
try { _cart = JSON.parse(localStorage.getItem('cv_cart') || '[]'); } catch (e) { _cart = []; }
function saveCart() { try { localStorage.setItem('cv_cart', JSON.stringify(_cart)); } catch (e) { } updateCartBtn(); }
function updateCartBtn() {
  const b = document.getElementById('cart-btn'), c = document.getElementById('cart-count');
  if (c) c.textContent = _cart.length;
  if (b) b.classList.toggle('hidden', _cart.length === 0);
  const nc = document.getElementById('cart-nav-count');
  if (nc) { nc.textContent = _cart.length; nc.classList.toggle('hidden', _cart.length === 0); }
}
window._closeCart = function () { const m = document.getElementById('cart-modal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } };
function openCart() { renderCart(); const m = document.getElementById('cart-modal'); if (m) { m.classList.remove('hidden'); m.classList.add('flex'); } }
function renderCart() {
  const box = document.getElementById('cart-items'); if (!box) return;
  if (!_cart.length) box.innerHTML = '<p class="text-terre-500 text-sm py-4 text-center">Votre panier est vide.</p>';
  else box.innerHTML = _cart.map((it, i) => `<div class="flex justify-between items-start gap-3 border-b border-sable-200 py-3">
        <div><div class="font-bold text-vert-800">${it.nom}</div><div class="text-xs text-terre-600 mt-0.5">${it.arrivee} &rarr; ${it.depart} · ${it.nb_pers} pers.</div></div>
        <div class="text-right"><div class="font-bold text-vert-800">${Number(it.total).toFixed(2)} €</div><button type="button" data-cart-rm="${i}" class="text-xs text-red-500 hover:text-red-700 mt-1">Retirer</button></div>
      </div>`).join('');
  const tot = _cart.reduce((s, it) => s + Number(it.total || 0), 0);
  const t = document.getElementById('cart-total'); if (t) t.textContent = tot.toFixed(2) + ' €';
}
function addCurrentToCart() {
  const payBtn = document.getElementById('booking-pay');
  if (!_bk || !payBtn || !payBtn.dataset.arrivee) return;
  _cart.push({ logementId: _bk.id, nom: _bk.nom, arrivee: payBtn.dataset.arrivee, depart: payBtn.dataset.depart, nb_pers: payBtn.dataset.pers, total: parseFloat(payBtn.dataset.total || '0') });
  saveCart();
  if (window._closeBooking) window._closeBooking();
  showToast('Logement ajouté au panier', 'success');
  openCart();
}
function initCartUI() {
  updateCartBtn();
  const btn = document.getElementById('cart-btn'); if (btn) btn.addEventListener('click', openCart);
  const navB = document.getElementById('cart-nav'); if (navB) navB.addEventListener('click', openCart);
  const items = document.getElementById('cart-items');
  if (items) items.addEventListener('click', (e) => { const rm = e.target.closest('[data-cart-rm]'); if (rm) { _cart.splice(parseInt(rm.getAttribute('data-cart-rm'), 10), 1); saveCart(); renderCart(); } });
  const pay = document.getElementById('cart-pay');
  if (pay) pay.addEventListener('click', async () => {
    if (!_cart.length) return;
    const supa = getSupa();
    const { data } = supa ? await supa.auth.getSession() : { data: null };
    if (!data || !data.session) { showToast('Connectez-vous pour payer', 'info'); window._closeCart(); location.hash = '#compte'; return; }
    pay.disabled = true; const o = pay.textContent; pay.textContent = 'Redirection…';
    try {
      const code = (document.getElementById('cart-code') || {}).value || '';
      const r = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ action: 'checkout-cart', items: _cart, code }) });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || 'Erreur');
      window.location.href = d.url;
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); pay.disabled = false; pay.textContent = o; }
  });
}
document.addEventListener('DOMContentLoaded', () => setTimeout(initCartUI, 400));
