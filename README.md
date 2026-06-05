# NEXUS Forum

Ein invite-only CS2 Software Forum mit User-Accounts, UIDs und persistenter Datenbank.

## Features
- ✅ Invite-only Registrierung
- ✅ Eindeutige UIDs für jeden User (z.B. UID-A3F7C2B1)
- ✅ Rollen: Admin & Member
- ✅ Kategorien, Threads, Antworten
- ✅ Invite-Codes erstellen & weitergeben
- ✅ Admin Panel (Users, Invites, Stats)
- ✅ Persistente Datenbank (nedb, kein Setup nötig)
- ✅ Session-basierter Login

## Setup

### Voraussetzungen
- Node.js 18+ installiert

### Installation
```bash
# 1. In den Ordner wechseln
cd nexus-forum

# 2. Dependencies installieren
npm install

# 3. Server starten
node server.js
```

### Erster Start
Beim ersten Start werden automatisch erstellt:
- **Admin Account**: Username `Admin`, Passwort `admin123`
- **Starter Invite**: `NEXUS-BETA`

**Wichtig**: Passwort nach dem ersten Login ändern!

### Zugriff
- Lokal: http://localhost:3000
- Im Netzwerk: http://DEINE-IP:3000

## Online deployen (kostenlos)

### Option A: Railway.app (empfohlen)
1. Account auf railway.app erstellen
2. "New Project" → "Deploy from GitHub"
3. Repo hochladen und deployen
4. Fertig — öffentliche URL bekommst du automatisch

### Option B: Render.com
1. Account auf render.com
2. "New Web Service" → GitHub Repo verbinden
3. Build Command: `npm install`
4. Start Command: `node server.js`

### Option C: VPS/Server
```bash
# Mit PM2 dauerhaft laufen lassen
npm install -g pm2
pm2 start server.js --name nexus-forum
pm2 startup
pm2 save
```

## Invite System
- **Admin**: Unlimited Invites generieren
- **Neue Member**: Bekommen 2 Invites beim Registrieren
- Jeder Code kann nur 1x verwendet werden
- Codes sehen: Forum → "Invites" in der Navbar

## Daten
Alle Daten werden in `/data/*.db` gespeichert (JSON-basiert).
Backup: Einfach den `/data` Ordner kopieren.

## Port ändern
In `server.js` Zeile 6: `const PORT = 3000;` anpassen.
