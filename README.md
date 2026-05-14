# Ikariam Helper – Chrome Extension

Egy Google Chrome bővítmény, amely segít az [Ikariam](https://www.ikariam.com/) böngészőalapú stratégiai játékban.

---

## Funkciók

| Funkció | Leírás |
|---|---|
| **Erőforrás-nyomkövető** | Megjeleníti az aktuális arany, fa, márvány, kristály, kén és bor mennyiségeket, valamint az óránkénti termelési rátákat. |
| **Építési sor időzítő** | Mutatja az aktív épületfejlesztéseket visszaszámlálóval. Figyelmeztet, ha egy fejlesztés hamarosan (< 1 óra) vagy nagyon hamarosan (< 5 perc) kész. |
| **Kutatás visszaszámláló** | Nyomon követi az aktuálisan futó kutatást és a hátramaradó időt valós időben. |
| **Katonai áttekintő** | Megjeleníti a szárazföldi egységeket és a tengerészeti erőket. |
| **Lebegő panel** | Egy diszkrét lebegő gombon keresztül érhető el a játék oldalán – megnyomásra egy kompakt panel ugrik elő. |
| **Popup nézet** | A bővítmény ikonjára kattintva gyors összefoglalót kapsz az aktuális lapról. |
| **Automatikus frissítés** | A panel DOM-figyelőt és visszaszámláló időzítőt használ, hogy az adatok mindig naprakészek legyenek. |
| **Adattárolás** | Az utolsó ismert játékállapot a `chrome.storage`-ban tárolódik, így akkor is látható, ha épp nem az Ikariam lap az aktív. |

---

## Telepítés (fejlesztői mód)

1. Töltsd le vagy klónozd a tárat:
   ```bash
   git clone https://github.com/Ricsikkeh/ikariam_extension.git
   ```
2. Nyisd meg a Chrome-ot, és navigálj a `chrome://extensions/` oldalra.
3. Kapcsold be a **Fejlesztői módot** (jobb felső sarok).
4. Kattints a **Kicsomagolt bővítmény betöltése** gombra.
5. Válaszd ki a klónozott könyvtár gyökerét (ahol a `manifest.json` található).
6. Navigálj egy Ikariam szerverre (pl. `https://s1.ikariam.hu/`) – a segéd panel automatikusan megjelenik.

---

## Szerkezet

```
ikariam_extension/
├── manifest.json              # Chrome Manifest V3
├── background/
│   └── service_worker.js      # Háttér service worker (jelzés, adattárolás)
├── content/
│   ├── content.js             # Tartalom szkript – adatkinyerés + lebegő panel
│   └── content.css            # Lebegő panel stílusok
├── popup/
│   ├── popup.html             # Bővítmény popup felület
│   ├── popup.css              # Popup stílusok
│   └── popup.js               # Popup logika
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Fejlesztés

Nincs szükség build lépésre – a bővítmény tiszta JavaScript/HTML/CSS, összetevők nélkül.

A módosítások után frissítsd a bővítményt a `chrome://extensions/` oldalon (⟳ gomb).

---

## Licenc

MIT
