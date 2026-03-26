document.body.className = 'bg-alap';

let hp = 30;
let kronikasHp = 80;
let szornyek = [];
let csapattagok = {};
let sajatId = "vandor_" + Date.now();
let enVagyokAKronikas = false;
let utolsoBossSebzes = 0;
let vegsoHarcAktiv = false; 

// VÉRZÉS CSAPDA VÁLTOZÓ
let globalVerzesAtok = 0; 

let globalisNehezseg = "konnyu";
let vandorokSzama = "2";
let onlineVandorokSzama = 0;
let kronikasOnline = false;

let fazisSzamlalo = 0;
let pancelHasznalva = false;
let kronikasKeszsegek = { aoe: false, heal: false, sebzes: false, pajzs: false };

const vandorHpMatrix = { "konnyu": 30, "kozepes": 35, "nehez": 45 };
const szornyHpMatrix = { "konnyu": { 1: 13, 2: 15, 3: 17 }, "kozepes": { 1: 17, 2: 20, 3: 25 }, "nehez": { 1: 20, 2: 25, 3: 30 } };
const bossHpMatrix = {
    "konnyu": { "1": 50, "2": 80, "3": 110, "4": 140 },
    "kozepes": { "1": 60, "2": 90, "3": 125, "4": 160 },
    "nehez": { "1": 75, "2": 100, "3": 155, "4": 200 }
};
const bossExtraDmMatrix = { "konnyu": 0, "kozepes": 3, "nehez": 5 };

let kivalasztottAlap = 0, veglegesSebzes = 0, kepessegHasznalva = false;
let duhAktiv = false, pajzsErtek = 0, korvenyAktiv = false, bossExtraSebzes = 0;
let db = null;

// --- ÚJ: KAZAMATA SORSVONAL VÁLTOZÓK ---
let aktualisLepes = 1;
const maxLepes = 8;
let terkepData = [];

// --- KAZAMATA SORSVONAL LOGIKA ---
function generalKazamata(nehezseg) {
    let ideiglenesTerkep = [];
    let eselyHarc, eselyCsapda;

    if (nehezseg === "nehez") {
        eselyHarc = 0.46;
        eselyCsapda = 0.39;
    } else {
        eselyHarc = 0.45;
        eselyCsapda = 0.36;
    }

    for (let i = 1; i <= maxLepes; i++) {
        let r = Math.random();
        let tipus = r < eselyHarc ? "Harc" : (r < eselyHarc + eselyCsapda ? "Csapda" : "Lore");
        ideiglenesTerkep.push({ id: i, tipus: tipus, tabor: false });
    }

    if (nehezseg === "konnyu") {
        for(let i=1; i <= maxLepes; i++) if(i % 2 === 0) ideiglenesTerkep[i-1].tabor = true;
    } else if (nehezseg === "kozepes") {
        ideiglenesTerkep[1].tabor = true; 
        ideiglenesTerkep[4].tabor = true; 
        ideiglenesTerkep[6].tabor = true; 
    } else if (nehezseg === "nehez") {
        ideiglenesTerkep[3].tabor = true; 
        ideiglenesTerkep[6].tabor = true; 
    }

    if (db) {
        db.ref("gameState/kazamataTerkep").set(ideiglenesTerkep);
        db.ref("gameState/aktualisLepes").set(1);
    }
}

function renderSorsvonal() {
    const container = document.getElementById("sorsvonal-belso");
    let kazamataContainer = document.getElementById("kazamata-container");
    
    if (!container || !kazamataContainer) return;

    // Ha végső harc van, VAGY a menüben vagyunk, rejtsük el a sorsvonalat!
    let menuLatszik = !document.getElementById("kezdokepernyo").classList.contains("rejtett");
    if (vegsoHarcAktiv || menuLatszik || terkepData.length === 0) {
        kazamataContainer.classList.add("rejtett");
        return;
    } else {
        kazamataContainer.classList.remove("rejtett");
    }

    container.innerHTML = "";

    terkepData.forEach(pont => {
        let div = document.createElement("div");
        div.className = "allomas";
        if (pont.id === aktualisLepes) div.className += " active";
        if (pont.id < aktualisLepes) div.className += " past";

        let ikon = "";

        // Csak ikont és számot generálunk, hogy beférjen a vékony sávba!
        if (enVagyokAKronikas) {
            ikon = pont.tabor ? "⛺" : (pont.tipus === "Harc" ? "⚔️" : (pont.tipus === "Csapda" ? "🪤" : "📜"));
        } else {
            ikon = pont.tabor ? "⛺" : "❓";
        }

        div.innerHTML = `<span>${pont.id}. ${ikon}</span>`;
        container.appendChild(div);
    });

    let kronikasVezerlo = document.getElementById("kronikas-vezerlo");
    if (kronikasVezerlo) {
        if (enVagyokAKronikas) kronikasVezerlo.classList.remove("rejtett");
        else kronikasVezerlo.classList.add("rejtett");
    }
}

function kovetkezoAllomas() {
    if (aktualisLepes < maxLepes) {
        if (db) db.ref("gameState/aktualisLepes").set(aktualisLepes + 1);
    } else {
        alert("Elértétek a folyosó végét! Indítsd el a Végső Harcot a lenti gombbal!");
    }
}

// --- CSAPDA MECHANIKÁK ---

function elsutCsapda() {
    if (!enVagyokAKronikas) return;
    let biztos = confirm("Biztosan elsütöd a 10 HP-s Csapdát? Minden hős kap azonnal 10 sebzést!");
    if (!biztos) return;

    let frissitesek = {};
    for (let id in csapattagok) {
        let jatekos = csapattagok[id];
        let h_hp = jatekos.hp;
        if (h_hp > 0) {
            let h_pajzs = typeof jatekos.pajzs === "number" ? jatekos.pajzs : (jatekos.pajzs ? 4 : 0);
            
            let levon = 10;
            if (h_pajzs > 0) {
                if (levon >= h_pajzs) { levon -= h_pajzs; h_pajzs = 0; } 
                else { h_pajzs -= levon; levon = 0; }
            }
            h_hp = Math.max(0, h_hp - levon);

            frissitesek["gameState/vandorok/" + id + "/hp"] = h_hp;
            frissitesek["gameState/vandorok/" + id + "/pajzs"] = h_pajzs;
        }
    }
    
    if (db) db.ref().update(frissitesek);
    alert("🪤 1. Csapda elsütve! Mindenki sebződött 10-et.");
}

function elsutVerzesCsapda() {
    if (!enVagyokAKronikas) return;
    let biztos = confirm("Biztosan elsütöd a Vérzés Csapdát? A következő 2 harc elején minden hős veszít 2 HP-t!");
    if (!biztos) return;
    
    if (db) db.ref("gameState/verzesAtok").set(2); 
    alert("🩸 Vérzés Csapda aktiválva! Majd az új szörnyek megidézésekor fog hatni.");
}

function automatikusVerzesLevonas() {
    if (!enVagyokAKronikas || globalVerzesAtok <= 0) return;
    
    let frissitesek = {};
    for (let id in csapattagok) {
        let h_hp = csapattagok[id].hp;
        if (h_hp > 0) {
            h_hp = Math.max(0, h_hp - 2); 
            frissitesek["gameState/vandorok/" + id + "/hp"] = h_hp;
        }
    }
    frissitesek["gameState/verzesAtok"] = globalVerzesAtok - 1; 
    
    if (db) db.ref().update(frissitesek);
    alert("🩸 Új harc kezdődött! A Vérzés Csapda miatt minden hős elvesztett 2 HP-t!");
}


// --- FÁZIS ÉS KÉPESSÉG LOGIKÁK ---
let kronikasKivalasztottTipus = "ido"; 

function getAktualisFazis() {
    let hosIdk = Object.keys(csapattagok).sort(); 
    let n = hosIdk.length;
    if (n === 0) return { tipus: 'WAIT', szoveg: "Várakozás a Vándorokra..." };

    let p = fazisSzamlalo || 0;

    if (n === 1) {
        return p % 2 === 0 ? { tipus: 'H', ids: [hosIdk[0]] } : { tipus: 'K', count: 1 };
    } else if (n === 2) {
        let step = p % 4;
        if (step === 0) return { tipus: 'H', ids: [hosIdk[0]] }; 
        if (step === 1) return { tipus: 'K', count: 1 };
        if (step === 2) return { tipus: 'H', ids: [hosIdk[1]] }; 
        if (step === 3) return { tipus: 'K', count: 1 };
    } else if (n >= 3 && !vegsoHarcAktiv) {
        return p % 2 === 0 ? { tipus: 'H_ALL', ids: hosIdk } : { tipus: 'K_ALL', count: 1 };
    } else if (n === 3 && vegsoHarcAktiv) {
        let step = p % 6;
        if (step === 0) return { tipus: 'H', ids: [hosIdk[2]] }; 
        if (step === 1) return { tipus: 'K', count: 1 };
        if (step === 2) return { tipus: 'H', ids: [hosIdk[0]] }; 
        if (step === 3) return { tipus: 'K', count: 1 };
        if (step === 4) return { tipus: 'H', ids: [hosIdk[1], hosIdk[2]] }; 
        if (step === 5) return { tipus: 'K', count: 2 }; 
    } else if (n >= 4 && vegsoHarcAktiv) {
        let step = p % 4;
        if (step === 0) return { tipus: 'H', ids: [hosIdk[0], hosIdk[1]] }; 
        if (step === 1) return { tipus: 'K', count: 2 };
        if (step === 2) return { tipus: 'H', ids: [hosIdk[2], hosIdk[3]] }; 
        if (step === 3) return { tipus: 'K', count: 2 };
    }
    return { tipus: 'WAIT', szoveg: "Ismeretlen fázis" };
}

function getHeroImg(kasztNev) {
    if(kasztNev === "Barbár") return "barbar.jpg";
    if(kasztNev === "Orgyilkos") return "orgyilkos.jpg";
    if(kasztNev === "Lovag") return "lovag.jpg";
    if(kasztNev === "Varázsló") return "varazslo.jpg";
    return "barbar.jpg";
}

function frissitFazisKijelzot() {
    let f = getAktualisFazis();
    let html = "";
    let isMyTurn = false;

    if (f.tipus === 'WAIT') {
        html = `<span>${f.szoveg}</span>`;
    } else if (f.tipus === 'K' || f.tipus === 'K_ALL') {
        let utesSzoveg = f.count > 1 ? ` <span style="color:#e74c3c">(${f.count} ütés!)</span>` : "";
        html = `<div style="display:flex; align-items:center; gap:10px; justify-content:center;">
                    <img src="${kronikasKivalasztottTipus}.jpg" style="width:40px; height:40px; border-radius:50%; border:2px solid #8e44ad; box-shadow: 0 0 10px #8e44ad;">
                    <span>👁️ Sötétség Ura támad${utesSzoveg}</span>
                </div>`;
        if (enVagyokAKronikas) isMyTurn = true;
    } else {
        let kepekHtml = "";
        let nevek = [];
        f.ids.forEach(id => {
            let j = csapattagok[id];
            if(j) {
                nevek.push(j.nev);
                kepekHtml += `<img src="${getHeroImg(j.kaszt)}" title="${j.nev}" style="width:40px; height:40px; border-radius:50%; border:2px solid #3498db; box-shadow: 0 0 10px #3498db;">`;
            }
        });
        let cimszoveg = f.tipus === 'H_ALL' ? "⚔️ Vándorok Hordája" : `⚔️ ${nevek.join(" és ")}`;
        
        html = `<div style="display:flex; align-items:center; gap:10px; justify-content:center;">
                    ${kepekHtml}
                    <span>${cimszoveg}</span>
                </div>`;
                
        if (!enVagyokAKronikas && (f.ids.includes(sajatId) || f.tipus === 'H_ALL')) isMyTurn = true;
    }

    let szovegMezo = document.getElementById("fazis-szoveg");
    if(szovegMezo) szovegMezo.innerHTML = html;

    let sáv = document.getElementById("fazis-jelzo");
    let gomb = document.getElementById("kor-vege-gomb"); 
    
    if(sáv) {
        if (isMyTurn) { 
            sáv.classList.add("sajat-kor"); sáv.classList.remove("mas-kore"); 
            if(gomb) gomb.style.display = "inline-block"; 
        } else { 
            sáv.classList.add("mas-kore"); sáv.classList.remove("sajat-kor"); 
            if(gomb) gomb.style.display = "none"; 
        }
    }
}

function kovetkezoFazis() {
    if (db) {
        db.ref("gameState/fazisSzamlalo").set((fazisSzamlalo || 0) + 1);
        db.ref("gameState/pancelHasznalva").set(false);
    }
}

function harcKezdete(kiKezd) {
    let ujFazis = 0;
    let n = Object.keys(csapattagok).length;
    
    if (kiKezd === 'kronikas') {
        ujFazis = 1; 
        alert("👁️ A Sötétség Ura csap le először!");
    } else {
        if (n === 2) {
            ujFazis = Math.random() < 0.5 ? 0 : 2;
        } else {
            ujFazis = 0; 
        }
        alert("⚔️ A Vándoroké az első csapás joga!");
    }
    
    if (db) {
        db.ref("gameState/fazisSzamlalo").set(ujFazis);
        db.ref("gameState/pancelHasznalva").set(false);
    }
}

let ebersegZar = null;
async function kepernyoEbrenTartasa() {
    if ('wakeLock' in navigator) {
        try {
            ebersegZar = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn("A böngésző nem engedi az ébrentartást:", err);
        }
    }
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ebersegZar !== null) {
        kepernyoEbrenTartasa();
    }
});

let fireInterval = null;
function startFireEffect() {
    if (fireInterval) return; 
    let container = document.getElementById("fire-container");
    if(container) container.classList.remove("rejtett");
    
    fireInterval = setInterval(() => {
        let p = document.createElement("div");
        p.className = "fire-particle";
        p.style.left = Math.random() * 100 + "vw";
        p.style.animationDuration = (Math.random() * 2 + 1.5) + "s"; 
        let meret = Math.random() * 15 + 5; 
        p.style.width = meret + "px";
        p.style.height = meret + "px";
        if(container) container.appendChild(p);
        
        setTimeout(() => { if(p.parentNode) p.parentNode.removeChild(p); }, 3500);
    }, 50); 
}

function stopFireEffect() {
    if (fireInterval) {
        clearInterval(fireInterval);
        fireInterval = null;
    }
    let container = document.getElementById("fire-container");
    if(container) {
        container.classList.add("rejtett");
        container.innerHTML = "";
    }
}

let defeatInterval = null;
function startDefeatEffect() {
    if (defeatInterval) return;
    let container = document.getElementById("defeat-container");
    if(container) container.classList.remove("rejtett");
    
    document.body.style.filter = "grayscale(80%) brightness(0.6)";
    
    defeatInterval = setInterval(() => {
        let p = document.createElement("div");
        p.className = "defeat-particle";
        p.style.left = Math.random() * 100 + "vw";
        p.style.animationDuration = (Math.random() * 3 + 2) + "s"; 
        let meret = Math.random() * 8 + 3; 
        p.style.width = meret + "px";
        p.style.height = meret + "px";
        if(container) container.appendChild(p);
        
        setTimeout(() => { if(p.parentNode) p.parentNode.removeChild(p); }, 5000);
    }, 80);
}

function jatekReseteles() {
    let biztos = confirm("Biztosan törölni akarod a teljes online mentést?");
    if (biztos && db) {
        db.ref("gameState").set(null).then(() => {
            alert("Sikeresen töröltél minden online adatot! A játék most újraindul.");
            location.reload();
        }).catch((hiba) => { alert("Hiba történt a törléskor: " + hiba); });
    }
}

function megnyitSetup(szerep) {
    document.getElementById("fazis-jelzo").classList.add("rejtett");
    if (szerep === 'vandor') {
        if (onlineVandorokSzama >= 4) { alert("A csapat megtelt (4/4)! Nem tudsz csatlakozni."); return; }
        document.body.className = 'bg-vandor';
        document.getElementById("kezdokepernyo").classList.add("rejtett");
        document.getElementById("setup-vandor").classList.remove("rejtett");
    } else {
        if (kronikasOnline) { alert("Már van egy Krónikás a játékban (1/1)!"); return; }
        document.body.className = 'bg-kronikas';
        document.getElementById("kezdokepernyo").classList.add("rejtett");
        document.getElementById("setup-kronikas").classList.remove("rejtett");
    }
}

function visszaAMenube() {
    document.body.className = 'bg-alap';
    document.querySelectorAll(".szoba").forEach(s => s.classList.add("rejtett"));
    document.getElementById("kezdokepernyo").classList.remove("rejtett");
    document.getElementById("fazis-jelzo").classList.add("rejtett");
}

function csatlakozasVandorkent() {
    kepernyoEbrenTartasa();
    let nev = document.getElementById("nickname-input").value || "Névtelen Kalandor";
    let hos = document.getElementById("hero-select").value;
    let kasztNev = document.getElementById("hero-select").options[document.getElementById("hero-select").selectedIndex].text;

    for (let id in csapattagok) {
        if (csapattagok[id].kaszt === kasztNev) {
            alert("Ezt a hőst (" + kasztNev + ") már kiválasztotta valaki!");
            return;
        }
    }

    enVagyokAKronikas = false;
    hp = vandorHpMatrix[globalisNehezseg];
    pajzsErtek = 0;
    
    document.getElementById("display-nickname").innerText = nev;
    document.getElementById("hero-image").src = hos + ".jpg";
    document.getElementById("hero-name").innerText = kasztNev;
    document.getElementById("hp-display").innerText = hp;

    document.getElementById("setup-vandor").classList.add("rejtett");
    document.getElementById("kozos-csapat-panel").classList.remove("rejtett");
    document.getElementById("vandor-felulet").classList.remove("rejtett");
    document.getElementById("fazis-jelzo").classList.remove("rejtett");
    kepessegUjratolt();

    if (db) {
        let sajatRef = db.ref("gameState/vandorok/" + sajatId);
        sajatRef.set({ nev: nev, hp: hp, kaszt: kasztNev, pajzs: 0 });
        sajatRef.onDisconnect().remove();
    }
    
    renderSorsvonal(); // <-- ITT FONTOS A SORSVONAL KIRAJZOLÁSA
}

function inditVegsoHarcot() {
    let biztos = confirm("Biztosan elindítod a Végső Harcot? Ekkortól a Vándorok sebezhetik a Krónikást!");
    if (biztos && db) {
        if (globalVerzesAtok > 0) {
            automatikusVerzesLevonas();
        }
        db.ref("gameState").update({ vegsoHarc: true, fazisSzamlalo: 0, pancelHasznalva: false });
        alert("⚔️ A Végső Harc elkezdődött! Indul a Taktikai Fázis!");
    }
}

function csatlakozasKronikaskent() {
    kepernyoEbrenTartasa();
    let boss = document.getElementById("kronikas-select").value;
    document.getElementById("kronikas-image").src = boss + ".jpg";
    document.getElementById("kronikas-name").innerText = document.getElementById("kronikas-select").options[document.getElementById("kronikas-select").selectedIndex].text;

    enVagyokAKronikas = true;
    vandorokSzama = document.getElementById("vandorok-szama").value;
    let valasztottNehezseg = document.getElementById("jatek-nehezseg").value;

    kronikasHp = bossHpMatrix[valasztottNehezseg][vandorokSzama];
    document.getElementById("kronikas-hp-display").innerText = kronikasHp;

    document.getElementById("setup-kronikas").classList.add("rejtett");
    document.getElementById("kozos-csapat-panel").classList.remove("rejtett");
    document.getElementById("kronikas-felulet").classList.remove("rejtett");
    document.getElementById("fazis-jelzo").classList.remove("rejtett");

    if (db) {
        let kRef = db.ref("gameState/kronikasJelenlet");
        kRef.set(true);
        kRef.onDisconnect().remove();
        db.ref("gameState").update({ kronikasHp: kronikasHp, nehezseg: valasztottNehezseg, kivalasztottVandorokSzama: vandorokSzama, kronikasTipus: boss, fazisSzamlalo: 0 });
        db.ref("gameState/kronikasKeszsegek").set({ aoe: false, heal: false, sebzes: false, pajzs: false });
        
        // --- ITT FONTOS: GENERÁLÁS INDÍTÁSA ---
        generalKazamata(valasztottNehezseg);
    }
    megjelenitCsapatot();
    renderSorsvonal(); // <-- ITT FONTOS A SORSVONAL KIRAJZOLÁSA
}

// --- BOSS ÉS VÁNDOR PÁNCÉL LOGIKÁJA ---
function getVandorPasszivPancel() {
    if (!vegsoHarcAktiv) return 0; 
    if (Number(vandorokSzama) < 3) return 0; 
    
    if (globalisNehezseg === "kozepes") return 2;
    if (globalisNehezseg === "nehez") return 3;
    return 0;
}

function frissitBossPancelKijelzot() {
    let bossArmor = 0;
    if (Number(vandorokSzama) > 2) {
        if (globalisNehezseg === "kozepes") bossArmor = 3;
        if (globalisNehezseg === "nehez") bossArmor = 5;
    }
    let pancelSzoveg = bossArmor > 0 ? `🛡️ Páncél: ${bossArmor}` : "";
    let vP = document.getElementById("vandor-lato-boss-pancel");
    if(vP) vP.innerText = pancelSzoveg;
    let kP = document.getElementById("kronikas-sajat-pancel");
    if(kP) kP.innerText = pancelSzoveg;

    let heroArmor = getVandorPasszivPancel();
    let heroPancelSzoveg = heroArmor > 0 ? `🛡️ Páncél: ${heroArmor}` : "";
    let heroP = document.getElementById("vandor-passziv-pancel");
    if(heroP) heroP.innerText = heroPancelSzoveg;
}

function megjelenitCsapatot() {
    let html = "";
    let passzivPancel = getVandorPasszivPancel();

    for (let id in csapattagok) {
        let jatekos = csapattagok[id];
        let kronikasGombHtml = enVagyokAKronikas ? `<button onclick="kronikasUtHoston('${id}')" style="background: darkred; width: 100%; padding: 5px; margin-top: 5px; font-size: 14px; border: 1px solid #ff4d4d;">⚔️ Sebzés</button>` : "";
        
        let pE = typeof jatekos.pajzs === "number" ? jatekos.pajzs : (jatekos.pajzs ? 4 : 0);
        let pajzsIkon = pE > 0 ? ` 🛡️(${pE})` : "";
        let passzivIkon = passzivPancel > 0 ? ` ⚙️[+${passzivPancel}]` : ""; 

        html += `<div class="player-card"><h4>${jatekos.nev}${pajzsIkon}${passzivIkon}</h4><p>❤️ HP: <strong>${jatekos.hp}</strong></p><p style="font-size: 10px; color: #aaa;">(${jatekos.kaszt})</p>${kronikasGombHtml}</div>`;
    }
    document.getElementById("csapat-terulet").innerHTML = html;
    frissitFazisKijelzot();
}

function kronikasUtHoston(hosId) {
    let jatekos = csapattagok[hosId];
    if (utolsoBossSebzes === 0) { alert("Előbb válaszd ki a sebzést!"); return; }

    let jatekosPajzs = typeof jatekos.pajzs === "number" ? jatekos.pajzs : (jatekos.pajzs ? 4 : 0);
    let passzivPancel = getVandorPasszivPancel(); 
    
    let tenylegesSebzes = utolsoBossSebzes - passzivPancel;
    if (tenylegesSebzes < 0) tenylegesSebzes = 0;

    if (jatekosPajzs > 0) {
        if (tenylegesSebzes >= jatekosPajzs) {
            tenylegesSebzes -= jatekosPajzs; 
            jatekosPajzs = 0; 
        } else {
            jatekosPajzs -= tenylegesSebzes; 
            tenylegesSebzes = 0; 
        }
    }

    let ujHp = Math.max(0, jatekos.hp - tenylegesSebzes);

    if (db) {
        db.ref("gameState/vandorok/" + hosId + "/hp").set(ujHp);
        db.ref("gameState/vandorok/" + hosId + "/pajzs").set(jatekosPajzs);
    }
    ellenorizJatekVege();
}

function sebzodes() {
    let levon = Number(document.getElementById("hp-input").value);
    
    let passzivPancel = getVandorPasszivPancel();
    if (passzivPancel > 0 && levon > 0) {
        levon -= passzivPancel;
        if (levon < 0) levon = 0;
        alert(`🛡️ A passzív páncélod felfogott ${passzivPancel} sebzést a támadásból!`);
    }

    if (pajzsErtek > 0) {
        if (levon >= pajzsErtek) {
            levon -= pajzsErtek;
            pajzsErtek = 0;
        } else {
            pajzsErtek -= levon;
            levon = 0;
        }
        if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/pajzs").set(pajzsErtek);
    }
    
    let ujHp = Math.max(0, hp - levon);
    document.getElementById("hp-input").value = 0;
    if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/hp").set(ujHp);
    ellenorizJatekVege();
}

function gyogyulas() {
    let ujHp = hp + Number(document.getElementById("hp-input").value);
    document.getElementById("hp-input").value = 0;
    if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/hp").set(ujHp);
}

function aktiválBuff(tipus) {
    let gomb = document.getElementById("buff-" + tipus);
    if (tipus === 'düh') { duhAktiv = !duhAktiv; if(gomb) gomb.classList.toggle("buff-aktiv"); }
    else if (tipus === 'körvény') { korvenyAktiv = !korvenyAktiv; if(gomb) gomb.classList.toggle("buff-aktiv"); }
    else if (tipus === 'pajzs') {
        if (pajzsErtek > 0) {
            pajzsErtek = 0; 
            if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/pajzs").set(0);
        } else {
            pajzsErtek = 4; 
            if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/pajzs").set(4);
            alert("🛡️ Oroszlánpajzs felvéve! (Felfog 4 sebzést)");
        }
    } else if (tipus === 'angyal') {
        hp = vandorHpMatrix[globalisNehezseg];
        document.getElementById("hp-display").innerText = hp;
        if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/hp").set(hp);
        alert("👼 Feltámadtál!");
    }
}

function kivalasztTamadas(dm) { kivalasztottAlap = dm; document.getElementById("kiszamolt-sebzes").innerText = "Dobás?"; }

function kivalasztTalalat(szorzo) {
    if (kivalasztottAlap === 0) return;
    let bonusz = Number(document.getElementById("erosite-input").value || 0);
    let alap = Math.floor((kivalasztottAlap + bonusz) * szorzo);
    if (duhAktiv) { alap += 8; duhAktiv = false; document.getElementById("buff-düh").classList.remove("buff-aktiv"); }
    
    if (globalVerzesAtok > 0) {
        alap -= 2;
        if (alap < 0) alap = 0; 
    }
    
    veglegesSebzes = alap;
    document.getElementById("kiszamolt-sebzes").innerText = veglegesSebzes;
}

function szornyIdezes(szint) {
    let maxSzorny = Number(vandorokSzama) + 1;
    if (szornyek.length >= maxSzorny) { alert("Maximum " + maxSzorny + " szörny lehet a pályán!"); return; }
    
    if (szornyek.length === 0 && globalVerzesAtok > 0) {
        automatikusVerzesLevonas();
    }

    szornyek.push({ id: Date.now(), szint: szint, hp: szornyHpMatrix[globalisNehezseg][szint] });
    
    if (db) db.ref("gameState/szornyek").set(szornyek);
    megjelenitSzornyeket();
}

function megjelenitSzornyeket() {
    let html = "";
    let biztonsagosSzornyLista = [];
    if (Array.isArray(szornyek)) {
        biztonsagosSzornyLista = szornyek.filter(sz => sz !== null);
    } else if (typeof szornyek === "object" && szornyek !== null) {
        biztonsagosSzornyLista = Object.values(szornyek);
    }
    szornyek = biztonsagosSzornyLista;

    szornyek.forEach((sz) => {
        let utombGomb = !enVagyokAKronikas ? `<button onclick="szornySebzodes(${sz.id})" class="dmg-btn" style="width:100%;">⚔️ Ütés</button>` : ``;
        html += `<div class="monster-card"><h4>Lvl ${sz.szint}</h4><p>❤️ HP: ${sz.hp}</p>${utombGomb}</div>`;
    });
    
    let vTer = document.getElementById("vandor-szorny-terulet");
    let kTer = document.getElementById("kronikas-szorny-terulet");
    if (vTer) vTer.innerHTML = html;
    if (kTer) kTer.innerHTML = html;
}

function szornySebzodes(id) {
    if (enVagyokAKronikas) return; 
    if (veglegesSebzes === 0) { alert("Előbb válassz támadást és dobj kockával!"); return; }

    if (korvenyAktiv && kronikasOnline && vegsoHarcAktiv) {
        let ujBossHp = Math.max(0, kronikasHp - veglegesSebzes);
        if (db) db.ref("gameState").update({ kronikasHp: ujBossHp });
    }

    szornyek = szornyek.map(sz => { if (sz.id === id || korvenyAktiv) sz.hp -= veglegesSebzes; return sz; }).filter(sz => sz.hp > 0);
    
    if (db) {
        if (szornyek.length > 0) db.ref("gameState/szornyek").set(szornyek);
        else db.ref("gameState/szornyek").remove();
    }
    
    megjelenitSzornyeket();
    
    veglegesSebzes = 0; korvenyAktiv = false;
    document.getElementById("kiszamolt-sebzes").innerText = "0";
    document.querySelectorAll(".buff-btn").forEach(b => {
        if(b.id !== "buff-pajzs") b.classList.remove("buff-aktiv");
    });
}

function szornyTorles() { 
    szornyek = []; 
    megjelenitSzornyeket(); 
    if (db) db.ref("gameState/szornyek").remove(); 
}

function kronikasSebzodes() {
    kronikasHp -= Number(document.getElementById("kronikas-hp-input").value);
    document.getElementById("kronikas-hp-display").innerText = kronikasHp;
    document.getElementById("kronikas-hp-input").value = 0;
    if (db) db.ref("gameState").update({ kronikasHp: kronikasHp });
    ellenorizJatekVege();
}

function kronikasGyogyulas() { kronikasHp += Number(document.getElementById("kronikas-hp-input").value); document.getElementById("kronikas-hp-display").innerText = kronikasHp; document.getElementById("kronikas-hp-input").value = 0; if (db) db.ref("gameState").update({ kronikasHp: kronikasHp }); }

function vandorUtiABosst() {
    if (enVagyokAKronikas) return;
    if (veglegesSebzes === 0) { alert("Előbb válassz támadást és dobj kockával!"); return; }
    if (!kronikasOnline) { alert("A Krónikás még nem csatlakozott a játékhoz!"); return; }
    if (!vegsoHarcAktiv) { alert("🛡️ A Krónikás még a sötétségben rejtőzik! Csak a Végső Harc fázisban támadhatjátok meg."); return; }

    let vanHarmasSzorny = szornyek.some(sz => Number(sz.szint) === 3);
    if (vanHarmasSzorny && !korvenyAktiv) { alert("🛡️ Egy 3-as szintű szörny védi a Krónikást! Előbb őt kell legyőznöd, vagy használj Területi sebzést (Árnyékörvény)!"); return; }

    let armor = 0;
    if (Number(vandorokSzama) > 1) {
        if (globalisNehezseg === "kozepes") armor = 3;
        if (globalisNehezseg === "nehez") armor = 5;
    }

    let tenylegesSebzes = veglegesSebzes - armor;
    if (tenylegesSebzes < 0) tenylegesSebzes = 0;

    let ujBossHp = Math.max(0, kronikasHp - tenylegesSebzes);

    if (db) {
        db.ref("gameState").update({ kronikasHp: ujBossHp });
        
        if (armor > 0 && veglegesSebzes > 0) {
            let uzi = tenylegesSebzes > 0 ? `A Krónikás passzív páncélja felfogott ${armor} sebzést! (Ténylegesen bevitt: ${tenylegesSebzes})` : `A Krónikás masszív páncélja felfogta a teljes támadást!`;
            alert(`🛡️ ${uzi}`);
        }

        if (korvenyAktiv && szornyek.length > 0) {
            let ujSzornyek = szornyek.map(sz => { sz.hp -= veglegesSebzes; return sz; }).filter(sz => sz.hp > 0);
            if (ujSzornyek.length > 0) db.ref("gameState/szornyek").set(ujSzornyek);
            else db.ref("gameState/szornyek").remove();
            szornyek = ujSzornyek;
            megjelenitSzornyeket();
        }
    }

    veglegesSebzes = 0; korvenyAktiv = false;
    document.getElementById("kiszamolt-sebzes").innerText = "0";
    document.querySelectorAll(".buff-btn").forEach(b => {
        if(b.id !== "buff-pajzs") b.classList.remove("buff-aktiv");
    });
}

function hasznalKepesseg() {
    if (kepessegHasznalva) { alert("Ezt a képességet már elhasználtad ebben a harcban!"); return; }
    let hos = document.getElementById("hero-select").value;

    if (hos === "barbar") { duhAktiv = true; alert("🔥 Barbár Képesség: Vérszomj!"); }
    else if (hos === "orgyilkos") { korvenyAktiv = true; alert("🌪️ Orgyilkos Képesség: Haláltánc!"); }
    else if (hos === "lovag") {
        pajzsErtek = 4; alert("🛡️ Lovag Képesség: Áthatolhatatlan Vért!");
        if (db && csapattagok[sajatId]) db.ref("gameState/vandorok/" + sajatId + "/pajzs").set(4);
    } else if (hos === "varazslo") {
        if (kivalasztottAlap === 0) { alert("✨ Előbb válassz egy támadási szintet!"); return; }
        kivalasztTalalat(1); alert("✨ Varázsló Képesség: Fókuszált Mágia!");
    }
    kepessegHasznalva = true;
    let gomb = document.getElementById("hero-ability-btn");
    if (gomb) { gomb.style.opacity = "0.5"; gomb.innerText = "Képesség Elhasználva"; }
}

function kepessegUjratolt() {
    kepessegHasznalva = false;
    let gomb = document.getElementById("hero-ability-btn");
    if (gomb) { gomb.style.opacity = "1"; gomb.innerText = "Hős Képessége (1x)"; }
}

function vizualisValasztas(selectId, ertek) {
    document.getElementById(selectId).value = ertek;
    let container = document.getElementById(selectId + "-visual");
    let gombok = container.querySelectorAll(".select-btn");
    gombok.forEach(g => g.classList.remove("active"));
    let kivalasztottGomb = container.querySelector(`[data-value="${ertek}"]`);
    if (kivalasztottGomb) kivalasztottGomb.classList.add("active");
}

function bossBuff(tipus) {
    if (tipus === 'gyogyulas') {
        if (kronikasKeszsegek.heal) { alert("Ezt már elhasználtad!"); return; }
        kronikasHp += 10; document.getElementById("kronikas-hp-display").innerText = kronikasHp;
        if (db) { db.ref("gameState").update({ kronikasHp: kronikasHp }); db.ref("gameState/kronikasKeszsegek/heal").set(true); }
        alert("🩸 Sötét Rituálé: +10 HP!");
    } else if (tipus === 'sebzes') {
        if (kronikasKeszsegek.sebzes) { alert("Ezt már elhasználtad!"); return; }
        bossExtraSebzes = 5; 
        if (db) db.ref("gameState/kronikasKeszsegek/sebzes").set(true);
        alert("🔥 Pokoli Erő: Következő támadás +5 sebzés!");
    } else if (tipus === 'elopajzs') {
        if (kronikasKeszsegek.pajzs) { alert("Már megidézted az Élő Pajzsot!"); return; }
        szornyIdezes(3);
        if (db) db.ref("gameState/kronikasKeszsegek/pajzs").set(true);
        alert("🛡️ Élő Pajzs (Lvl 3 Szörny) megidézve!");
    }
}

function szamolBossSebzes(alapExtra, szorzo = 1) {
    let d12 = Number(document.getElementById("boss-d12-input").value);
    if (d12 <= 0) { alert("Kérlek adj meg egy érvényes sebzést (1 vagy nagyobb)!"); return; }
    let nehezsegBonusz = bossExtraDmMatrix[globalisNehezseg] || 0;
    let extraMatek = (alapExtra === "AOE") ? 0 : alapExtra;

    let teljesSebzes = d12 + extraMatek + nehezsegBonusz + bossExtraSebzes;
    utolsoBossSebzes = Math.floor(teljesSebzes * szorzo);

    let kijelzo = document.getElementById("boss-kiszamolt-sebzes");
    kijelzo.innerText = (alapExtra === "AOE") ? utolsoBossSebzes + " (Mindenkinek!)" : utolsoBossSebzes;

    bossExtraSebzes = 0; document.getElementById("boss-d12-input").value = 0;
}

function bossSimaTamadas() { szamolBossSebzes(0, 1); }
function bossGyengeTamadas() { szamolBossSebzes(0, 0.5); }
function bossBrutalisUtes() { szamolBossSebzes(7, 1); }
function bossTeruletiSebzes() { 
    if (kronikasKeszsegek.aoe) { alert("A Területi Sebzést már elhasználtad a játékban!"); return; }
    szamolBossSebzes("AOE", 1); 
    if (db) db.ref("gameState/kronikasKeszsegek/aoe").set(true);
}

let tutAlapSebzes = 0, tutVeglegesSebzes = 0, tutSzornyHp = 25;
function megnyitGyakorloter() {
    document.getElementById("kezdokepernyo").classList.add("rejtett");
    document.getElementById("gyakorloter-panel").classList.remove("rejtett");
    tutAlapSebzes = 0; tutVeglegesSebzes = 0; tutSzornyHp = 25;
    document.getElementById("tut-szorny-hp").innerText = tutSzornyHp;
    document.getElementById("tut-kiszamolt-sebzes").innerText = "0";
    document.getElementById("tutorial-uzenet").innerText = "1. Lépés: Válaszd ki a fizikai kártyád szintjét!";
}
function tutKivalasztTamadas(dm) { tutAlapSebzes = dm; document.getElementById("tut-kiszamolt-sebzes").innerText = "Dobás?"; document.getElementById("tutorial-uzenet").innerText = "2. Lépés: Most 'dobj a kockával' és válaszd ki a találatot!"; }
function tutKivalasztTalalat(szorzo) {
    if (tutAlapSebzes === 0) { alert("Előbb válaszd ki a támadás szintjét!"); return; }
    tutVeglegesSebzes = Math.floor(tutAlapSebzes * szorzo);
    document.getElementById("tut-kiszamolt-sebzes").innerText = tutVeglegesSebzes;
    document.getElementById("tutorial-uzenet").innerText = `3. Lépés: A gép kiszámolta a sebzést (${tutVeglegesSebzes} DM). Kattints az Ütés gombra!`;
}
function tutSzornySebzodes() {
    if (tutVeglegesSebzes === 0) { alert("Előbb válassz támadási szintet!"); return; }
    tutSzornyHp -= tutVeglegesSebzes;
    if (tutSzornyHp <= 0) {
        tutSzornyHp = 0;
        document.getElementById("tutorial-uzenet").innerHTML = "Gratulálok, elpusztítottad a bábut! 🎉";
    } else { document.getElementById("tutorial-uzenet").innerText = `Szép ütés! Kezdheted elölről az 1. lépéssel!`; }
    document.getElementById("tut-szorny-hp").innerText = tutSzornyHp;
    tutVeglegesSebzes = 0; tutAlapSebzes = 0; document.getElementById("tut-kiszamolt-sebzes").innerText = "0";
}

let tutBossVeglegesSebzes = 0, tutDummyHosHp = 35;
function megnyitKronikasGyakorloter() {
    document.getElementById("kezdokepernyo").classList.add("rejtett");
    document.getElementById("gyakorloter-kronikas-panel").classList.remove("rejtett");
    tutBossVeglegesSebzes = 0; tutDummyHosHp = 35;
    document.getElementById("tut-dummy-hos-hp").innerText = tutDummyHosHp;
    document.getElementById("tut-boss-kiszamolt").innerText = "0";
    document.getElementById("tut-boss-d12").value = 0;
    document.getElementById("tut-kronikas-uzenet").innerText = "1. Lépés: Idézz meg egy szörnyet a pályára!";
}
function tutSikeresIdezes(szint) { document.getElementById("tut-kronikas-uzenet").innerHTML = `Megidéztél egy Lvl ${szint} szörnyet! <br>2. Lépés: Írj be egy D12 dobást (1-12) és válassz Boss támadást!`; }
function tutSzamolBoss(extra, szorzo = 1) {
    let d12 = Number(document.getElementById("tut-boss-d12").value);
    if (d12 <= 0) { alert("Kérlek, adj meg egy érvényes sebzést (1 vagy nagyobb)!"); return; }
    let extraMatek = (extra === "AOE") ? 0 : extra;
    let teljesSebzes = d12 + extraMatek + 3;
    tutBossVeglegesSebzes = Math.floor(teljesSebzes * szorzo);
    let kijelzo = document.getElementById("tut-boss-kiszamolt");
    kijelzo.innerText = (extra === "AOE") ? tutBossVeglegesSebzes + " (Mindenkinek!)" : tutBossVeglegesSebzes;
    document.getElementById("tut-kronikas-uzenet").innerText = `3. Lépés: A gép kiszámolta a sebzést (${tutBossVeglegesSebzes} DM). Kattints a Sebzés kiosztása gombra!`;
    document.getElementById("tut-boss-d12").value = 0;
}
function tutKronikasUt() {
    if (tutBossVeglegesSebzes === 0) { alert("Előbb dobj a D12-vel!"); return; }
    tutDummyHosHp -= tutBossVeglegesSebzes;
    if (tutDummyHosHp <= 0) {
        tutDummyHosHp = 0;
        document.getElementById("tut-dummy-hos-hp").innerText = tutDummyHosHp + " ☠️";
        document.getElementById("tut-kronikas-uzenet").innerHTML = "Sikeresen elpusztítottad a Vándort! 💀";
    } else {
        document.getElementById("tut-dummy-hos-hp").innerText = tutDummyHosHp;
        document.getElementById("tut-kronikas-uzenet").innerText = `A Vándor HP-ja csökkent. Dobj újra!`;
    }
    tutBossVeglegesSebzes = 0; document.getElementById("tut-boss-kiszamolt").innerText = "0";
}

try {
    const firebaseConfig = {
        apiKey: "AIzaSyA0S6afhfkR5WbydQGS1MRcxnIqRw_hMCQ",
        authDomain: "kalandoroktaborhelye.firebaseapp.com",
        databaseURL: "https://kalandoroktaborhelye-default-rtdb.firebaseio.com",
        projectId: "kalandoroktaborhelye",
        storageBucket: "kalandoroktaborhelye.firebasestorage.app",
        messagingSenderId: "380794066725",
        appId: "1:380794066725:web:83878b0b930dda7459accc"
    };
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    db.ref(".info/connected").on("value", (snap) => {
        if (snap.val() === true) {
            let vandorLatszik = !document.getElementById("vandor-felulet").classList.contains("rejtett");
            if (!enVagyokAKronikas && vandorLatszik) {
                let sajatRef = db.ref("gameState/vandorok/" + sajatId);
                let nev = document.getElementById("display-nickname").innerText;
                let kasztNev = document.getElementById("hero-name").innerText;
                sajatRef.set({ nev: nev, hp: hp, kaszt: kasztNev, pajzs: pajzsErtek });
                sajatRef.onDisconnect().remove();
            }
            let kronikasLatszik = !document.getElementById("kronikas-felulet").classList.contains("rejtett");
            if (enVagyokAKronikas && kronikasLatszik) {
                let kRef = db.ref("gameState/kronikasJelenlet");
                kRef.set(true);
                kRef.onDisconnect().remove();
            }
        }
    });

    db.ref("gameState/fazisSzamlalo").on("value", (snap) => { fazisSzamlalo = snap.val() || 0; frissitFazisKijelzot(); });
    db.ref("gameState/pancelHasznalva").on("value", (snap) => { pancelHasznalva = snap.val() || false; });

    db.ref("gameState/kronikasKeszsegek").on("value", (snap) => {
        kronikasKeszsegek = snap.val() || { aoe: false, heal: false, sebzes: false, pajzs: false };
        let frissitGomb = (id, feltetel, szoveg) => {
            let g = document.getElementById(id);
            if (g) { if (feltetel) { g.style.opacity = "0.5"; g.innerText = szoveg; } else { g.style.opacity = "1"; } }
        };
        frissitGomb("boss-aoe-btn", kronikasKeszsegek.aoe, "🔮 Terület (Elhasználva)");
        frissitGomb("buff-heal", kronikasKeszsegek.heal, "🩸 Rituálé (Elhasználva)");
        frissitGomb("buff-sebzes", kronikasKeszsegek.sebzes, "🔥 Pokoli Erő (Elhasználva)");
        frissitGomb("buff-elopajzs", kronikasKeszsegek.pajzs, "🛡️ Élő Pajzs (Elhasználva)");
    });

    db.ref("gameState/szornyek").on("value", (snap) => { szornyek = snap.val() || []; megjelenitSzornyeket(); });
    
    // --- KAZAMATA FIGYELŐK (Ide is bekerültek) ---
    db.ref("gameState/kazamataTerkep").on("value", (snap) => {
        terkepData = snap.val() || [];
        renderSorsvonal();
    });

    db.ref("gameState/aktualisLepes").on("value", (snap) => {
        aktualisLepes = snap.val() || 1;
        renderSorsvonal();
    });

    db.ref("gameState/kivalasztottVandorokSzama").on("value", (snap) => { 
        if (snap.val()) vandorokSzama = snap.val(); 
        setTimeout(frissitBossPancelKijelzot, 500); 
    });
    db.ref("gameState/kronikasJelenlet").on("value", (snap) => { kronikasOnline = snap.val() ? true : false; let k = document.getElementById("kronikas-szamlalo"); if (k) k.innerText = kronikasOnline ? "1" : "0"; });
    
    db.ref("gameState").on("value", (snap) => {
        let state = snap.val();
        if (state !== null) {
            let vCount = state.vandorok ? Object.keys(state.vandorok).length : 0;
            let kOnline = state.kronikasJelenlet ? true : false;
            
            if (vCount === 0 && !kOnline) {
                let menuLatszik = !document.getElementById("kezdokepernyo").classList.contains("rejtett");
                if (menuLatszik) {
                    db.ref("gameState").remove();
                    console.log("🧹 Automatikus takarítás: Az üres szoba beragadt adatai törölve!");
                }
            }
        }
    });

    db.ref("gameState/vegsoHarc").on("value", (snap) => {
        vegsoHarcAktiv = snap.val() || false;
        
        if (vegsoHarcAktiv) {
            startFireEffect(); 
        } else {
            stopFireEffect();
        }
        
        frissitFazisKijelzot();
        frissitBossPancelKijelzot();
        renderSorsvonal(); // Frissíti a sorsvonalat is, hogy eltűnjön

        let gomb = document.getElementById("vegso-harc-gomb");
        if (gomb) {
            if (vegsoHarcAktiv) {
                gomb.innerText = "⚔️ Végső Harc Aktív!";
                gomb.style.background = "#c0392b"; 
                gomb.onclick = null; 
            } else {
                gomb.innerText = "➡️ Végső Harc Indítása";
                gomb.style.background = "#e67e22";
                gomb.onclick = inditVegsoHarcot;
            }
        }

        let vandorTamadasGomb = document.getElementById("boss-tamadas-gomb");
        if (vandorTamadasGomb) {
            if (vegsoHarcAktiv) {
                vandorTamadasGomb.style.background = "linear-gradient(to bottom, #8e44ad, #732d91)";
                vandorTamadasGomb.innerText = "⚔️ Támadás a Krónikásra";
                vandorTamadasGomb.style.cursor = "pointer";
            } else {
                vandorTamadasGomb.style.background = "#555";
                vandorTamadasGomb.innerText = "🔒 Krónikás védve";
                vandorTamadasGomb.style.cursor = "not-allowed";
            }
        }
    });

    db.ref("gameState/nehezseg").on("value", (snap) => {
        let regiNehezseg = globalisNehezseg;
        globalisNehezseg = snap.val() || "konnyu";
        let n = document.getElementById("aktualis-nehezseg-kiir");
        if (n) n.innerText = globalisNehezseg === "konnyu" ? "Könnyű" : (globalisNehezseg === "kozepes" ? "Közepes" : "Nehéz");

        if (!enVagyokAKronikas && csapattagok[sajatId]) {
            if (hp === vandorHpMatrix[regiNehezseg] || hp === 0) {
                hp = vandorHpMatrix[globalisNehezseg];
                document.getElementById("hp-display").innerText = hp;
                db.ref("gameState/vandorok/" + sajatId + "/hp").set(hp);
            }
        }
        setTimeout(frissitBossPancelKijelzot, 500);
    });

    db.ref("gameState/kronikasHp").on("value", (snap) => {
        kronikasHp = snap.val() !== null ? snap.val() : 80;
        let b = document.getElementById("kronikas-hp-display");
        if (b) b.innerText = kronikasHp;
        
        let vHp = document.getElementById("vandor-lato-boss-hp");
        if (vHp) vHp.innerText = kronikasHp;
        
        ellenorizJatekVege();
    });

   db.ref("gameState/kronikasTipus").on("value", (snap) => {
        let tipus = snap.val();
        kronikasKivalasztottTipus = tipus || "ido"; 
        let bossTerulet = document.getElementById("vandor-boss-terulet");
        
        if (tipus && bossTerulet) {
            bossTerulet.classList.remove("rejtett");
            document.getElementById("vandor-lato-boss-kep").src = tipus + ".jpg";
            
            let nev = "Ismeretlen";
            if (tipus === "ido") nev = "Idő mágus";
            if (tipus === "lelek") nev = "Lélek gyűjtő";
            if (tipus === "mester") nev = "Holtak mestere";
            if (tipus === "ver") nev = "Vér harcos";
            
            document.getElementById("vandor-lato-boss-nev").innerText = nev;
        } else if (!tipus && bossTerulet) {
            bossTerulet.classList.add("rejtett");
        }
    });

    db.ref("gameState/vandorok").on("value", (snap) => {
        csapattagok = snap.val() || {};
        onlineVandorokSzama = Object.keys(csapattagok).length;
        let sz = document.getElementById("vandor-szamlalo");
        if (sz) sz.innerText = onlineVandorokSzama;
        megjelenitCsapatot();

        if (!enVagyokAKronikas && csapattagok[sajatId]) {
            let bejovoHp = csapattagok[sajatId].hp;
            let hpKijelzo = document.getElementById("hp-display");

            if (hp > 0 && bejovoHp === 0) {
                hp = 0; if (hpKijelzo) hpKijelzo.innerText = "0 ☠️";
                setTimeout(() => {
                    let hasAngyal = confirm("☠️ A hősöd HP-ja 0-ra csökkent!\n\nVan fizikai 'Angyalok akarata' kártyád az asztalon?");
                    if (hasAngyal) aktiválBuff('angyal'); else alert("Hősöd elesett a harcban...");
                }, 100);
            } else if (bejovoHp > 0 || (hp === 0 && bejovoHp === 0)) {
                hp = bejovoHp; if (hpKijelzo) hpKijelzo.innerText = hp === 0 ? "0 ☠️" : hp;
            }

            let kapottPajzs = csapattagok[sajatId].pajzs;
            pajzsErtek = typeof kapottPajzs === "number" ? kapottPajzs : (kapottPajzs ? 4 : 0);
            
            let gomb = document.getElementById("buff-pajzs");
            if (gomb) {
                if (pajzsErtek > 0) {
                    gomb.classList.add("buff-aktiv");
                    gomb.innerText = `🛡️ Oroszlánpajzs (${pajzsErtek} maradt)`;
                } else {
                    gomb.classList.remove("buff-aktiv");
                    gomb.innerText = "🛡️ Oroszlánpajzs (-4 HP)";
                }
            }
            ellenorizJatekVege();
        }
    });

    db.ref("gameState/verzesAtok").on("value", (snap) => {
        globalVerzesAtok = snap.val() || 0;
        
        let v_kijelzo = document.getElementById("csapda-kijelzo");
        if (v_kijelzo) {
            if (globalVerzesAtok > 0 && !enVagyokAKronikas) {
                v_kijelzo.classList.remove("rejtett");
                v_kijelzo.innerText = `🩸 Vérzés aktív: ${globalVerzesAtok} harc maradt (-2 HP és -2 DM a harcokban)`;
            } else {
                v_kijelzo.classList.add("rejtett");
            }
        }
    });

} catch (hiba) { console.warn("Nincs internet vagy hiba a Firebase-ben:", hiba); }

let kihivasAktiv = false;
let megtalaltUtak = [];
const maxUt = 15;
const ervenyesKodok = ["#1", "#2", "#3", "#4", "#5", "#6", "#7", "#8", "#9", "#10", "#11", "#12", "#13", "#14", "#15"];

const tortenetek = {
    gyozelemUzenet: "A Főellenség elbukott!",
    veresegUzenet: "A sötétség diadala",
    gyozelemTortenet: "A szörnyeteg egy utolsó hörgéssel a földre rogyott. A levegő kitisztult, és a kazamata kijárata szabaddá vált. A Krónikás leteszi a tollát... Választhattok: Biztonságban hazatértek a zsákmánnyal, vagy tovább kutattok a sötétben?",
    veresegTortenet: `A harcosok elbuktak. Mikor ez Kriktusz király fülébe jut, összehívja a népet, hogy beszámoljon nekik a halálhírről. Kriktusz király kiáll a nép elé: 
– Mind meghalt, elnyelte őket a kazamata, a Krónikás megölte mindet! 
A nép tapsviharba kezd, és ujjonganak, hogy a száműzöttek megkapták méltó büntetésüket. 
Bundás örökre a kazamatába ragadt.`,
    biztonsagTortenet: `Amikor a hősök visszatérnek Kriktusz király birodalmába, a nép meglepett arccal látja, hogy élnek a száműzöttek. Először halk, szégyenteli, lassú taps, majd hangosan az egész nép lassú tapsba kezd. 
Kriktusz király azonnal eléjük szalad, és mikor meglátja a sok kincset, elmosolyodik, és ennyit mond: 
– CSÖNDET! Látom visszatértetek. Ha a kincset a királyságnak adjátok, felmentelek benneteket végleg a haláltól. 
A kincset átadják a királynak, és a nép a király örömére ujjongani kezd. 
Mikor a kincset átadják, továbbállnak a hősök, és tudják, hogy a Krónikás nem halt meg, nem is lehet megölni. 
Bundás velük maradt, és örökre hű maradt gazdáihoz.`,
    kihivasSiker: `Felfedeztétek a sötétség minden titkát! Megszereztétek a legendás kincseket és élve jutottatok ki a kazamata legmélyéről is. Amikor Kriktusz király meglátta a mérhetetlen gazdagságotokat, azonnal eltörölte az ítéleteteket. De ti tudjátok az igazságot a Krónikásról és a sötétségről... A ti legendátok örökké élni fog!`
};

function ellenorizJatekVege() {
    if (kihivasAktiv) return; 

    let menuRejtve = document.getElementById("kezdokepernyo").classList.contains("rejtett");
    let setupVandorRejtve = document.getElementById("setup-vandor").classList.contains("rejtett");
    let setupKronikasRejtve = document.getElementById("setup-kronikas").classList.contains("rejtett");
    
    if (!menuRejtve || !setupVandorRejtve || !setupKronikasRejtve) return;

    let mindenkiHalott = true;
    let vanJatekos = false;
    for (let id in csapattagok) {
        vanJatekos = true;
        if (csapattagok[id].hp > 0) mindenkiHalott = false;
    }
    
    if (vanJatekos && mindenkiHalott) { 
        jatekBefejezese('vereseg'); 
        return; 
    }
    
    if (kronikasHp <= 0 && kronikasOnline) { 
        jatekBefejezese('gyozelem'); 
    }
}

function jatekBefejezese(eredmeny) {
    document.getElementById("eredmenyAblak").classList.remove("rejtett");
    stopFireEffect(); 

    if (eredmeny === 'gyozelem') {
        document.getElementById("eredmenyCim").innerText = tortenetek.gyozelemUzenet;
        document.getElementById("eredmenySzoveg").innerText = tortenetek.gyozelemTortenet;
        
        if (typeof confetti === "function") {
            let duration = 3000; 
            let end = Date.now() + duration;
            (function frame() {
                confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#d4af37', '#f1c40f', '#e67e22'] });
                confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#d4af37', '#f1c40f', '#e67e22'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }

        if (globalisNehezseg === "konnyu") {
            setTimeout(() => { kazamataElhagyasa(); }, 2000); 
            document.getElementById("gombPanel").innerHTML = `<p style="color: #27ae60;">A kaland véget ért, a hősök hazatérnek...</p>`;
        } else if (enVagyokAKronikas) {
            document.getElementById("gombPanel").innerHTML = `
                <button onclick="kazamataElhagyasa()" style="background: #27ae60; width: 100%;">Hazatérés (Biztonság)</button>
                <button onclick="kihivasInditasa()" style="background: #c0392b; width: 100%;">Tovább a sötétségbe! (Kihívás)</button>
            `;
        } else {
            document.getElementById("gombPanel").innerHTML = `<p style="color: #aaa;">Várakozás a Krónikás döntésére...</p>`;
        }
    } else if (eredmeny === 'vereseg') {
        document.getElementById("eredmenyCim").innerText = tortenetek.veresegUzenet;
        document.getElementById("eredmenyCim").style.color = "#c0392b";
        document.getElementById("eredmenySzoveg").innerText = tortenetek.veresegTortenet;
        document.getElementById("gombPanel").innerHTML = `<button onclick="location.reload()" style="background: #34495e;">Új Kaland Indítása</button>`;
        
        startDefeatEffect();
    }
}

function kazamataElhagyasa() { if (db) db.ref("gameState/jatekVege").set("biztonsag"); }

function kihivasInditasa() {
    let kimentABundas = confirm("Krónikás válaszolj:\nElőkerült már a Bundás lap az alapjáték során?\n\n(Nyomj OK-t, ha IGEN. Nyomj Mégse-t, ha NEM.)");
    let sorsoltKihivas = "uresUt"; 
    if (!kimentABundas && Math.random() < 0.5) sorsoltKihivas = "bundas";
    if (db) db.ref("gameState/kihivasAdatok").set({ aktiv: true, tipus: sorsoltKihivas });
}

function kodHozzaadasa() {
    let beirtKod = document.getElementById("kartyKod").value.trim(); 
    if (!ervenyesKodok.includes(beirtKod)) { alert("Érvénytelen kód! Kérlek ellenőrizd a kártyát (pl.: #5)."); return; }
    if (megtalaltUtak.includes(beirtKod)) { alert("Ezt az utat már felfedeztétek!"); document.getElementById("kartyKod").value = ""; return; }
    megtalaltUtak.push(beirtKod); 
    document.getElementById("utSzamlalo").innerText = megtalaltUtak.length + " / " + maxUt;
    document.getElementById("kartyKod").value = ""; 
    if (megtalaltUtak.length === maxUt) kihivasTeljesitve();
}

function kihivasTeljesitve() { if (db) db.ref("gameState/jatekVege").set("kihivasSiker"); }

if (typeof firebase !== 'undefined') {
    setTimeout(() => {
        db.ref("gameState/jatekVege").on("value", (snap) => {
            let allapot = snap.val();
            if (allapot === "biztonsag") {
                document.getElementById("eredmenyCim").innerText = "Sikeres Hazatérés";
                document.getElementById("eredmenySzoveg").innerText = tortenetek.biztonsagTortenet;
                document.getElementById("gombPanel").innerHTML = `<button onclick="location.reload()" style="background: #34495e;">Vége</button>`;
            } else if (allapot === "kihivasSiker") {
                document.getElementById("eredmenyAblak").classList.remove("rejtett");
                document.getElementById("eredmenyCim").innerText = "TÖKÉLETES GYŐZELEM!";
                document.getElementById("eredmenyCim").style.color = "#2ecc71";
                document.getElementById("eredmenySzoveg").innerText = tortenetek.kihivasSiker;
                document.getElementById("gombPanel").innerHTML = `<button onclick="location.reload()" style="background: #34495e;">Újra</button>`;
            }
        });

        db.ref("gameState/kihivasAdatok").on("value", (snap) => {
            let adat = snap.val();
            if (adat && adat.aktiv) {
                kihivasAktiv = true;
                document.getElementById("eredmenyAblak").classList.add("rejtett"); 
                globalisNehezseg = "nehez";
                if (!enVagyokAKronikas) {
                    hp = vandorHpMatrix["nehez"];
                    document.getElementById("hp-display").innerText = hp;
                    db.ref("gameState/vandorok/" + sajatId + "/hp").set(hp);
                } else {
                    document.getElementById("kihivas-panel").classList.remove("rejtett");
                    if (adat.tipus === "uresUt") {
                        document.getElementById("kihivas-leiras").innerText = "Feladat: Szerezzétek meg az összes Üres Utat!";
                        document.getElementById("ures-ut-tarolo").classList.remove("rejtett");
                    } else {
                        document.getElementById("kihivas-leiras").innerText = "Feladat: Keressétek meg a Bundás lapot!";
                        document.getElementById("bundas-gomb").classList.remove("rejtett");
                    }
                }
                alert("⚠️ A VÉGSŐ KIHÍVÁS ELINDULT! A szörnyek ereje megnőtt (Nehéz szint), a Vándorok életereje feltöltődött!");
            }
        });
    }, 1500); 
}