const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json()); // إضافة لدعم بيانات الـ JSON
app.use(express.urlencoded({ extended: true }));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.error("❌ Database Error:", err));

// --- الموديلات (Models) ---
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  courses: { type: String, default: '{}' },
  isAdmin: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
  code: String,
  used: { type: Boolean, default: false },
  usedAt: Date,
  usedBy: String
}));

const Course = mongoose.model('Course', new mongoose.Schema({
  title: String,
  thumb: String,
  lectures: [{ title: String, vid: String }],
  createdAt: { type: Date, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
  type: String,
  message: String,
  data: Object,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

const ActivityLog = mongoose.model('ActivityLog', new mongoose.Schema({
  action: String,
  details: String,
  userId: String,
  userName: String,
  createdAt: { type: Date, default: Date.now }
}));

app.use(session({
  secret: 'medo-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // يوم كامل
}));

// --- وظائف مساعدة ---
const logActivity = async (action, details, userId = '', userName = '') => {
  try { await ActivityLog.create({ action, details, userId, userName }); } catch(e) {}
};

// --- المسارات (Routes) ---

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

// 1. تعديل مسار تسجيل الدخول (حل مشكلة الدخول)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.render('login', { error: 'برجاء ادخال البيانات', success: '' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // الأدمن الرئيسي
    if (cleanEmail === 'admin@medo.com' && cleanPass === 'admin123') {
      req.session.isAdmin = true;
      req.session.userId = 'admin-main';
      req.session.username = 'مدير عام';
      return res.redirect('/admin');
    }

    const user = await User.findOne({ email: cleanEmail, password: cleanPass });
    if (user) {
      user.isOnline = true;
      await user.save();

      req.session.userId = user._id.toString();
      req.session.isAdmin = user.isAdmin || false;
      req.session.username = user.username;

      logActivity('تسجيل دخول', 'دخول المستخدم', user._id.toString(), user.username);
      res.redirect(user.isAdmin ? '/admin' : '/home');
    } else {
      res.render('login', { error: 'الإيميل أو الباسورد غلط يا بطل', success: '' });
    }
  } catch (err) {
    res.render('login', { error: 'مشكلة في السيرفر، حاول تاني', success: '' });
  }
});

app.get('/logout', async (req, res) => {
  if (req.session.userId && req.session.userId !== 'admin-main') {
    await User.findByIdAndUpdate(req.session.userId, { isOnline: false });
  }
  req.session.destroy();
  res.redirect('/login');
});

// 2. لوحة التحكم
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');

  const students = await User.find({ isAdmin: false });
  const admins = await User.find({ isAdmin: true });
  const courses = await Course.find({});
  const codes = await Code.find({});
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(10);

  const stats = {
    totalStudents: students.length,
    activeStudents: await User.countDocuments({ isOnline: true, isAdmin: false }),
    totalCourses: courses.length,
    unusedCodes: codes.filter(c => !c.used).length,
  };

  res.render('admin', { students, codes, courses, admins, notifications, stats });
});

// --- عمليات الأدمن الجديدة ---

// إضافة/حذف أدمن (بالاسم والجيميل)
app.post('/admin/add-admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { username, email, password } = req.body;
  await User.create({ username, email: email.trim().toLowerCase(), password: password.trim(), isAdmin: true });
  res.redirect('/admin');
});

app.get('/admin/delete-admin/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

// تصفير طالب
app.get('/admin/reset-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
  res.redirect('/admin');
});

// تعديل كورس أو محاضرة
app.post('/admin/edit-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.findByIdAndUpdate(req.params.id, { title, thumb });
  res.redirect('/admin');
});

// حذف محاضرة معينة داخل كورس
app.get('/admin/delete-lecture/:courseId/:lectureIndex', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const course = await Course.findById(req.params.courseId);
  if (course) {
    course.lectures.splice(req.params.lectureIndex, 1);
    await course.save();
  }
  res.redirect('/admin');
});

// حذف طالب
app.get('/admin/delete-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
