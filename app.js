const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.error("❌ Database Error:", err));

// --- تحديث الموديل لإضافة حالة الاتصال ---
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  courses: { type: String, default: '{}' },
  isAdmin: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false }, // جديد: للنشطين
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
  saveUninitialized: false
}));

const createNotification = async (type, message, data = {}) => {
  await Notification.create({ type, message, data });
};

const logActivity = async (action, details, userId = '', userName = '') => {
  await ActivityLog.create({ action, details, userId, userName });
};

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

// --- تحديث تسجيل الدخول ليجعل المستخدم متصل ---
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@medo.com' && password === 'admin123') {
    req.session.isAdmin = true;
    req.session.userId = 'admin-main';
    req.session.username = 'مدير عام';
    logActivity('تسجيل دخول', 'دخول الأدمن الرئيسي', 'admin-main', 'مدير عام');
    return res.redirect('/admin');
  }
  
  const user = await User.findOne({ email, password });
  if (user) {
    user.isOnline = true; // أصبح نشط
    await user.save();
    
    req.session.userId = user._id.toString();
    req.session.isAdmin = user.isAdmin || false;
    req.session.username = user.username;
    
    logActivity('تسجيل دخول', 'دخول المستخدم', user._id.toString(), user.username);
    res.redirect(user.isAdmin ? '/admin' : '/home');
  } else {
    res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
  }
});

// --- تحديث تسجيل الخروج ليجعل المستخدم غير متصل ---
app.get('/logout', async (req, res) => {
  if (req.session.userId && req.session.userId !== 'admin-main') {
    await User.findByIdAndUpdate(req.session.userId, { isOnline: false });
  }
  logActivity('تسجيل خروج', 'خروج من النظام', req.session.userId, req.session.username);
  req.session.destroy();
  res.redirect('/login');
});

// (باقي مسارات Signup, Profile, Reset Password تظل كما هي بدون تغيير)
// ... [يمكنك وضع الأكواد القديمة هنا] ...

// --- تحديث لوحة التحكم بالأدمن بالإحصائيات الجديدة ---
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  
  const students = await User.find({ isAdmin: false });
  const codes = await Code.find({});
  const courses = await Course.find({});
  const admins = await User.find({ isAdmin: true });
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(10);
  const activities = await ActivityLog.find({}).sort({ createdAt: -1 }).limit(20);
  
  const stats = {
    totalStudents: students.length,
    activeStudents: await User.countDocuments({ isOnline: true, isAdmin: false }), // النشطين فعلياً
    totalCourses: courses.length,
    totalLectures: courses.reduce((acc, c) => acc + (c.lectures ? c.lectures.length : 0), 0),
    usedCodes: codes.filter(c => c.used).length,
    unusedCodes: codes.filter(c => !c.used).length,
  };
  
  res.render('admin', { students, codes, courses, admins, notifications, activities, stats });
});

// --- إضافة مسارات التحكم الجديدة ---

// إضافة/حذف أدمن
app.post('/admin/add-admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { username, email, password } = req.body;
  await User.create({ username, email, password, isAdmin: true });
  res.redirect('/admin');
});

app.get('/admin/delete-admin/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

// تصفير طالب (مسح كورساته)
app.get('/admin/reset-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
  res.redirect('/admin');
});

// تعديل كورس
app.post('/admin/edit-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.findByIdAndUpdate(req.params.id, { title, thumb });
  res.redirect('/admin');
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Admin Dashboard Live on ${PORT}`));
