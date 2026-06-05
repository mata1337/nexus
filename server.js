const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const path = require('path');
const Datastore = require('nedb-promises');

const app = express();
const PORT = 3000;

// DBs
const db = {
  users: Datastore.create({ filename: './data/users.db', autoload: true }),
  invites: Datastore.create({ filename: './data/invites.db', autoload: true }),
  threads: Datastore.create({ filename: './data/threads.db', autoload: true }),
  posts: Datastore.create({ filename: './data/posts.db', autoload: true }),
  categories: Datastore.create({ filename: './data/categories.db', autoload: true }),
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'nexus-forum-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Seed default categories and admin
async function seed() {
  const cats = await db.categories.find({});
  if (cats.length === 0) {
    await db.categories.insert([
      { _id: 'cat1', name: 'News & Releases', desc: 'Ankündigungen und Changelogs', icon: 'ti-speakerphone', order: 1 },
      { _id: 'cat2', name: 'Unsere Produkte', desc: 'Feature-Übersichten und Showcases', icon: 'ti-package', order: 2 },
      { _id: 'cat3', name: 'Support & Bugs', desc: 'Hilfe und Fehlermeldungen', icon: 'ti-help-circle', order: 3 },
      { _id: 'cat4', name: 'Media', desc: 'Clips, Screenshots, Highlights', icon: 'ti-video', order: 4 },
      { _id: 'cat5', name: 'Offtopic', desc: 'Alles andere', icon: 'ti-messages', order: 5 },
    ]);
  }
  const admin = await db.users.findOne({ role: 'admin' });
  if (!admin) {
    const hash = await bcrypt.hash('Mata76!', 10);
    const uid = 'UID-' + uuidv4().split('-')[0].toUpperCase();
    await db.users.insert({
      uid, username: 'Admin', email: 'admin@nexus.local',
      password: hash, role: 'admin',
      createdAt: Date.now(), posts: 0, invitesLeft: 99
    });
    // seed a starter invite
    await db.invites.insert({ code: 'NEXUS-BETA', createdBy: uid, used: false, createdAt: Date.now() });
    console.log('Admin created. Username: Admin, Password: Mata76!');
    console.log('Starter invite code: NEXUS-BETA');
  }
}
seed();

// Auth middleware
function auth(req, res, next) {
  if (!req.session.uid) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function adminAuth(req, res, next) {
  if (!req.session.uid || req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// === AUTH ROUTES ===
app.post('/api/register', async (req, res) => {
  const { username, email, password, inviteCode } = req.body;
  if (!username || !email || !password || !inviteCode)
    return res.json({ error: 'Alle Felder ausfüllen' });
  if (username.length < 3 || username.length > 20)
    return res.json({ error: 'Username: 3–20 Zeichen' });
  if (password.length < 6)
    return res.json({ error: 'Passwort min. 6 Zeichen' });

  const invite = await db.invites.findOne({ code: inviteCode.toUpperCase(), used: false });
  if (!invite) return res.json({ error: 'Ungültiger oder bereits verwendeter Invite-Code' });

  const exists = await db.users.findOne({ $or: [{ username: { $regex: new RegExp('^' + username + '$', 'i') } }, { email }] });
  if (exists) return res.json({ error: 'Username oder Email bereits vergeben' });

  const hash = await bcrypt.hash(password, 10);
  const uid = 'UID-' + uuidv4().split('-')[0].toUpperCase();
  await db.users.insert({
    uid, username, email, password: hash,
    role: 'member', createdAt: Date.now(), posts: 0, invitesLeft: 2
  });
  await db.invites.update({ code: inviteCode.toUpperCase() }, { $set: { used: true, usedBy: uid, usedAt: Date.now() } });
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.users.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
  if (!user) return res.json({ error: 'Ungültige Zugangsdaten' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ error: 'Ungültige Zugangsdaten' });
  req.session.uid = user.uid;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ ok: true, uid: user.uid, username: user.username, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.uid) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, uid: req.session.uid, username: req.session.username, role: req.session.role });
});

// === INVITE ROUTES ===
app.post('/api/invites/create', auth, async (req, res) => {
  const user = await db.users.findOne({ uid: req.session.uid });
  if (user.invitesLeft <= 0 && user.role !== 'admin')
    return res.json({ error: 'Keine Invites mehr übrig' });
  const code = 'NX-' + uuidv4().split('-')[0].toUpperCase() + '-' + uuidv4().split('-')[1].toUpperCase();
  await db.invites.insert({ code, createdBy: req.session.uid, used: false, createdAt: Date.now() });
  if (user.role !== 'admin') await db.users.update({ uid: req.session.uid }, { $inc: { invitesLeft: -1 } });
  res.json({ ok: true, code });
});

app.get('/api/invites/mine', auth, async (req, res) => {
  const invites = await db.invites.find({ createdBy: req.session.uid }).sort({ createdAt: -1 });
  const user = await db.users.findOne({ uid: req.session.uid });
  res.json({ invites, invitesLeft: user.invitesLeft, role: user.role });
});

// === CATEGORIES ===
app.get('/api/categories', async (req, res) => {
  const cats = await db.categories.find({}).sort({ order: 1 });
  const result = await Promise.all(cats.map(async c => {
    const threadCount = await db.threads.count({ categoryId: c._id });
    const threads = await db.threads.find({ categoryId: c._id }).sort({ lastPostAt: -1 }).limit(1);
    return { ...c, threadCount, lastThread: threads[0] || null };
  }));
  res.json(result);
});

// === THREADS ===
app.get('/api/threads/:catId', async (req, res) => {
  const threads = await db.threads.find({ categoryId: req.params.catId }).sort({ pinned: -1, lastPostAt: -1 });
  res.json(threads);
});

app.post('/api/threads', auth, async (req, res) => {
  const { categoryId, title, content } = req.body;
  if (!title || !content || title.length < 3)
    return res.json({ error: 'Titel und Inhalt erforderlich' });
  const cat = await db.categories.findOne({ _id: categoryId });
  if (!cat) return res.json({ error: 'Kategorie nicht gefunden' });
  const id = uuidv4();
  const now = Date.now();
  await db.threads.insert({
    _id: id, categoryId, title, content,
    authorUid: req.session.uid, authorName: req.session.username,
    createdAt: now, lastPostAt: now, replyCount: 0, views: 0, pinned: false
  });
  await db.users.update({ uid: req.session.uid }, { $inc: { posts: 1 } });
  res.json({ ok: true, id });
});

app.get('/api/thread/:id', async (req, res) => {
  const thread = await db.threads.findOne({ _id: req.params.id });
  if (!thread) return res.status(404).json({ error: 'Nicht gefunden' });
  await db.threads.update({ _id: req.params.id }, { $inc: { views: 1 } });
  const posts = await db.posts.find({ threadId: req.params.id }).sort({ createdAt: 1 });
  res.json({ thread, posts });
});

app.post('/api/thread/:id/reply', auth, async (req, res) => {
  const { content } = req.body;
  if (!content || content.length < 2) return res.json({ error: 'Zu kurz' });
  const thread = await db.threads.findOne({ _id: req.params.id });
  if (!thread) return res.json({ error: 'Thread nicht gefunden' });
  const now = Date.now();
  await db.posts.insert({
    threadId: req.params.id, content,
    authorUid: req.session.uid, authorName: req.session.username,
    createdAt: now
  });
  await db.threads.update({ _id: req.params.id }, { $inc: { replyCount: 1 }, $set: { lastPostAt: now, lastPostBy: req.session.username } });
  await db.users.update({ uid: req.session.uid }, { $inc: { posts: 1 } });
  res.json({ ok: true });
});

// === ADMIN ===
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await db.users.find({}).sort({ createdAt: -1 });
  res.json(users.map(u => ({ ...u, password: undefined })));
});

app.post('/api/admin/invite', adminAuth, async (req, res) => {
  const code = 'ADMIN-' + uuidv4().split('-')[0].toUpperCase();
  await db.invites.insert({ code, createdBy: req.session.uid, used: false, createdAt: Date.now() });
  res.json({ ok: true, code });
});

app.post('/api/admin/pin/:threadId', adminAuth, async (req, res) => {
  const t = await db.threads.findOne({ _id: req.params.threadId });
  await db.threads.update({ _id: req.params.threadId }, { $set: { pinned: !t.pinned } });
  res.json({ ok: true });
});

app.delete('/api/admin/thread/:id', adminAuth, async (req, res) => {
  await db.threads.remove({ _id: req.params.id });
  await db.posts.remove({ threadId: req.params.id }, { multi: true });
  res.json({ ok: true });
});

// === STATS ===
app.get('/api/stats', async (req, res) => {
  const [users, threads, posts] = await Promise.all([
    db.users.count({}), db.threads.count({}), db.posts.count({})
  ]);
  const latest = await db.users.find({}).sort({ createdAt: -1 }).limit(1);
  res.json({ users, threads, posts, latestMember: latest[0]?.username });
});

app.get('/api/profile/:uid', async (req, res) => {
  const user = await db.users.findOne({ uid: req.params.uid });
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ uid: user.uid, username: user.username, role: user.role, createdAt: user.createdAt, posts: user.posts });
});

app.listen(PORT, () => console.log(`NEXUS Forum running on http://localhost:${PORT}`));
