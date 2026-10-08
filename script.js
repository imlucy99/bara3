// ===================== KONFIGURASI =====================
const CONFIG = {
    unit: 'MPH',      // 'MPH' atau 'KMH'
    maxSpeed: 180,    // Angka maksimal di dial
    majorStep: 20,    // Jarak angka besar
    midStep: 10,      // Jarak tick putih kecil
    minorStep: 2,     // Jarak tick oranye halus
    rpmMax: 8,        // Skala RPM (x1000 r/min)
    redline: 0.85     // Mulai zona merah RPM (0.0 - 1.0)
};

const MPS_TO_MPH = 2.236936;
const MPS_TO_KMH = 3.6;
const SPEED_FACTOR = CONFIG.unit === 'KMH' ? MPS_TO_KMH : MPS_TO_MPH;

// Geometri dial (koordinat viewBox SVG 400 x 340)
const CX = 200;
const CY = 200;
const R_OUTER = 184;
const START_ANGLE = 166;   // posisi angka 0 (derajat, searah jarum jam dari kanan)
const SWEEP = 208;         // total sudut dari 0 sampai maxSpeed
const SVG_NS = 'http://www.w3.org/2000/svg';

// Inisialisasi Element DOM
const elSpeed = document.getElementById('speed-display');
const elGear = document.getElementById('gear');
const elOdo = document.getElementById('odometer');
const elNeedle = document.getElementById('needle');
const hSegs = document.querySelectorAll('.h-seg');
const fSegs = document.querySelectorAll('.f-seg');
const elRpmNeedle = document.getElementById('rpm-needle');

if (new URLSearchParams(location.search).has('preview')) {
    document.documentElement.classList.add('preview');
}

// ===================== MEMBANGUN DIAL =====================
function polar(radius, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function valueToAngle(value) {
    const v = Math.max(0, Math.min(CONFIG.maxSpeed, value));
    return START_ANGLE + (v / CONFIG.maxSpeed) * SWEEP;
}

function arcPath(radius, fromDeg, toDeg) {
    const [x1, y1] = polar(radius, fromDeg);
    const [x2, y2] = polar(radius, toDeg);
    const large = (toDeg - fromDeg) > 180 ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function buildDial() {
    const ring = document.getElementById('ring');
    const ticks = document.getElementById('ticks');
    const labels = document.getElementById('labels');
    const rpmScale = document.getElementById('rpm-scale');

    // Garis lingkar luar oranye
    ring.appendChild(svgEl('path', {
        d: arcPath(R_OUTER + 4, START_ANGLE - 1.5, START_ANGLE + SWEEP + 1.5),
        class: 'ring-line',
        filter: 'url(#glow)'
    }));

    // Ticks
    const minorFrag = document.createDocumentFragment();
    for (let v = 0; v <= CONFIG.maxSpeed; v += CONFIG.minorStep) {
        const angle = valueToAngle(v);
        let cls = 'tick-minor';
        let len = 9;
        if (v % CONFIG.majorStep === 0) { cls = 'tick-major'; len = 20; }
        else if (v % CONFIG.midStep === 0) { cls = 'tick-mid'; len = 12; }

        const [x1, y1] = polar(R_OUTER, angle);
        const [x2, y2] = polar(R_OUTER - len, angle);
        const line = svgEl('line', {
            x1: x1.toFixed(2), y1: y1.toFixed(2),
            x2: x2.toFixed(2), y2: y2.toFixed(2),
            class: cls
        });
        (cls === 'tick-minor' ? minorFrag : ticks).appendChild(line);

        if (cls === 'tick-major') {
            const [lx, ly] = polar(R_OUTER - 40, angle);
            const text = svgEl('text', { x: lx.toFixed(2), y: ly.toFixed(2), class: 'tick-label' });
            text.textContent = v;
            labels.appendChild(text);
        }
    }
    ticks.insertBefore(minorFrag, ticks.firstChild);

    // Skala RPM (ticks + angka kecil di dalam dial)
    const R_RPM = R_OUTER - 66;
    for (let r = 0; r <= CONFIG.rpmMax; r += 0.5) {
        const angle = START_ANGLE + (r / CONFIG.rpmMax) * SWEEP;
        const major = Number.isInteger(r);
        const red = r / CONFIG.rpmMax >= CONFIG.redline;
        const [x1, y1] = polar(R_RPM, angle);
        const [x2, y2] = polar(R_RPM - (major ? 11 : 6), angle);
        rpmScale.appendChild(svgEl('line', {
            x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2),
            class: 'rpm-tick' + (major ? ' major' : '') + (red ? ' red' : '')
        }));
        if (major) {
            const [lx, ly] = polar(R_RPM - 23, angle);
            const t = svgEl('text', { x: lx.toFixed(2), y: ly.toFixed(2), class: 'rpm-num' + (red ? ' red' : '') });
            t.textContent = r;
            rpmScale.appendChild(t);
        }
    }

    document.getElementById('speed-mode').innerText = CONFIG.unit === 'KMH' ? 'KM/H' : 'MPH';
    document.getElementById('odo-unit').innerText = CONFIG.unit === 'KMH' ? 'km' : 'mi';
}

buildDial();

// ===================== ANIMASI JARUM =====================
let needleTarget = START_ANGLE;
let needleCurrent = START_ANGLE;
let rpmTarget = START_ANGLE;
let rpmCurrent = START_ANGLE;

function renderNeedle() {
    needleCurrent += (needleTarget - needleCurrent) * 0.2;
    if (Math.abs(needleTarget - needleCurrent) < 0.01) needleCurrent = needleTarget;
    elNeedle.setAttribute('transform', `translate(${CX} ${CY}) rotate(${needleCurrent.toFixed(2)})`);

    rpmCurrent += (rpmTarget - rpmCurrent) * 0.25;
    if (Math.abs(rpmTarget - rpmCurrent) < 0.01) rpmCurrent = rpmTarget;
    elRpmNeedle.setAttribute('transform', `translate(${CX} ${CY}) rotate(${rpmCurrent.toFixed(2)})`);
    requestAnimationFrame(renderNeedle);
}
requestAnimationFrame(renderNeedle);

// ===================== HELPER =====================
// Helper Parser: Mendeteksi nilai TRUE/LOCKED dari JGRP (menerima 1, "1", true, "true", atau 2)
function isLockedState(val) {
    return val === true || val === 1 || val === "1" || val === "true" || val === 2 || val === "2";
}

function isTrueValue(val) {
    return val === true || val === 1 || val === "1" || val === "true";
}

function fillSegments(segs, active) {
    segs.forEach((seg, i) => {
        if (i < active) seg.classList.add('active');
        else seg.classList.remove('active');
    });
}

// ===================== API UNTUK JGRP / CEF =====================

// 1. Kecepatan (input m/s, jarum analog + 3 digit)
window.setSpeed = function(speed) {
    const value = Math.round(Number(speed || 0) * SPEED_FACTOR);
    needleTarget = valueToAngle(value);

    if (!elSpeed) return;
    const padded = String(Math.min(value, 999)).padStart(3, '0');

    if (value < 10) {
        elSpeed.innerHTML = `<span class="dim">${padded.slice(0, 2)}</span><span class="bright">${padded.slice(2)}</span>`;
    } else if (value < 100) {
        elSpeed.innerHTML = `<span class="dim">${padded.slice(0, 1)}</span><span class="bright">${padded.slice(1)}</span>`;
    } else {
        elSpeed.innerHTML = `<span class="bright">${padded}</span>`;
    }
};

// 2. RPM Arc (0.0 - 1.0)
window.setRPM = function(rpm) {
    const val = Math.max(0, Math.min(1, Number(rpm || 0)));
    rpmTarget = START_ANGLE + val * SWEEP;
    elRpmNeedle.classList.toggle('red', val >= CONFIG.redline);
};

// 3. Bensin (Fuel)
window.setFuel = function(fuel) {
    const val = Number(fuel || 0);
    // Mendukung nilai 0.0-1.0 maupun 0-100%
    let percent = (val > 1) ? (val / 100) : val;
    percent = Math.max(0, Math.min(1, percent));
    fillSegments(fSegs, Math.round(percent * fSegs.length));

    const wrap = document.getElementById('fuel-segments');
    if (wrap) wrap.classList.toggle('low', percent <= 0.2);
};

// 4. Engine Health
window.setHealth = function(health) {
    const val = Number(health || 0);
    let percent = (val > 1) ? (val / 1000) : val;
    percent = Math.max(0, Math.min(1, percent));
    fillSegments(hSegs, Math.round(percent * hSegs.length));

    const engineIcon = document.getElementById('engine-icon');
    if (engineIcon) {
        engineIcon.className = 'bar-icon engine';
        if (percent <= 0.25) {
            engineIcon.classList.add('active-danger');
        } else if (percent <= 0.50) {
            engineIcon.classList.add('active-warn');
        }
    }
};

// 5. Gear
window.setGear = function(gear) {
    if (!elGear) return;
    elGear.innerText = (gear == 0 || gear === "0") ? 'R' : String(gear);
};

// 6. Lock / Unlock Vehicle (Mendukung semua alternatif panggilan JGRP)
window.updateLockStatus = function(state) {
    const el = document.getElementById('door-lock');
    if (!el) return;
    el.className = isLockedState(state) ? 'icon-item locked' : 'icon-item';
};

// Pemetaan fungsi lock/unlock ke berbagai nama alias CEF
window.setDoors = window.updateLockStatus;
window.setDoorLock = window.updateLockStatus;
window.setVehicleLocked = window.updateLockStatus;
window.setLocked = window.updateLockStatus;
window.setLock = window.updateLockStatus;
window.toggleLock = window.updateLockStatus;

// 7. Lampu (0 = mati, 1 = dekat, 2 = jauh)
window.setHeadlights = function(state) {
    const low = document.getElementById('headlight-low');
    const high = document.getElementById('headlight-high');
    const val = Number(state || 0);
    if (low) low.className = (val === 1) ? 'icon-item active' : 'icon-item';
    if (high) high.className = (val === 2) ? 'icon-item high-beam' : 'icon-item';
};

// 8. Lampu Sein (Turn Signals)
window.setLeftIndicator = function(state) {
    const el = document.getElementById('indicator-left');
    if (el) el.className = isTrueValue(state) ? 'signal active' : 'signal';
};

window.setRightIndicator = function(state) {
    const el = document.getElementById('indicator-right');
    if (el) el.className = isTrueValue(state) ? 'signal active' : 'signal';
};

// 9. Seatbelt
window.setSeatbelts = function(state) {
    const el = document.getElementById('seatbelts');
    if (el) el.className = isTrueValue(state) ? 'icon-item active' : 'icon-item warn';
};

// 10. Odometer
window.setOdometer = function(distance) {
    if (elOdo) elOdo.innerText = Number(distance || 0).toFixed(1);
};

// Handler untuk komunikasi via Event Message
window.addEventListener('message', function(event) {
    if (!event.data) return;
    const data = event.data;

    if (data.type === 'setDoors' || data.action === 'setDoors' || data.type === 'lock') {
        window.updateLockStatus(data.status !== undefined ? data.status : data.state);
    }
});