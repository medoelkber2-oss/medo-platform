const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch(err => console.error("❌ Database Error:", err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  courses: { type: String, default: '{}' },
  isAdmin: { type: Boolean, default: false },
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

// نموذج الإشعارات
const Notification = mongoose.model('Notification', new mongoose.Schema({
  type: String,
  message: String,
  data: Object,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

// نموذج سجل الأنشطة
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

// دالة إنشاء إشعار
const createNotification = async (type, message, data = {}) => {
  await Notification.create({ type, message, data });
};

// دالة تسجيل النشاط
const logActivity = async (action, details, userId = '', userName = '') => {
  await ActivityLog.create({ action, details, userId, userName });
};

// Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

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
    req.session.userId = user._id;
    req.session.isAdmin = user.isAdmin || false;
    req.session.username = user.username;
    
    logActivity('تسجيل دخول', 'دخول المستخدم', user._id.toString(), user.username);
    
    if (user.isAdmin) {
      res.redirect('/admin');
    } else {
      res.redirect('/home');
    }
  } else {
    res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
  }
});

app.get('/signup', (req, res) => res.render('signup', { error: '', success: '' }));

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.render('signup', { error: 'الإيميل مسجل مسبقاً', success: '' });
  }
  await User.create({ username, email, password });
  logActivity('تسجيل مستخدم جديد', `مستخدم جديد: ${email}`, '', username);
  createNotification('new_user', `تم تسجيل مستخدم جديد: ${email}`, { email, username });
  res.render('login', { error: '', success: 'تم إنشاء الحساب بنجاح' });
});

app.get('/home', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  const courses = await Course.find({});
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(5);
  res.render('index', {
    courses,
    enrolledList: JSON.parse(user.courses || '{}'),
    username: user.username,
    error: '',
    success: '',
    notifications
  });
});

app.post('/activate/:courseId', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { activationCode } = req.body;
  const courseId = req.params.courseId;
  
  const codeDoc = await Code.findOne({ code: activationCode.trim(), used: false });
  if (codeDoc) {
    const user = await User.findById(req.session.userId);
    let enrolled = JSON.parse(user.courses || '{}');
    enrolled[courseId] = { activated: true };
    await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
    codeDoc.used = true;
    codeDoc.usedAt = new Date();
    codeDoc.usedBy = user.email;
    await codeDoc.save();
    
    const course = await Course.findById(courseId);
    logActivity('تفعيل كود', `تفعيل كود للكورس: ${course.title}`, user._id.toString(), user.username);
    createNotification('code_used', `تم استخدام كود تفعيل للكورس: ${course.title}`, { user: user.username, course: course.title });
    
    res.redirect('/home');
  } else {
    res.redirect('/home?error=كود_غير_صالح');
  }
});

app.get('/video/:id', async (req, res) => {
  if (!req.session.userId && !req.session.isAdmin) return res.redirect('/login');
  const course = await Course.findById(req.params.id);
  const lecIndex = parseInt(req.query.lec) || 0;
  res.render('video', { course, lecIndex });
});

app.get('/logout', (req, res) => {
  logActivity('تسجيل خروج', 'خروج من النظام', req.session.userId, req.session.username);
  req.session.destroy();
  res.redirect('/login');
});

app.get('/profile', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  res.render('profile', { user, error: '', success: '' });
});

app.post('/profile/update', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { username, email } = req.body;
  await User.findByIdAndUpdate(req.session.userId, { username, email });
  const user = await User.findById(req.session.userId);
  logActivity('تحديث الملف', 'تحديث البيانات الشخصية', user._id.toString(), user.username);
  res.render('profile', { user, error: '', success: 'تم التحديث بنجاح' });
});

app.get('/forgot-password', (req, res) => res.render('forgot-password', { error: '', success: '', resetLink: '' }));

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.render('forgot-password', { error: 'الإيميل غير مسجل', success: '', resetLink: '' });
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetLink = `https://medo-platform.up.railway.app/reset-password/${resetToken}`;
  await User.findByIdAndUpdate(user._id, { resetToken, resetTokenExpiry: Date.now() + 3600000 });
  console.log('🔐 رابط الاستعادة:', resetLink);
  res.render('forgot-password', { error: '', success: 'راجع الـ Console', resetLink });
});

app.get('/reset-password/:token', async (req, res) => {
  const user = await User.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } });
  if (!user) {
    return res.render('reset-password', { error: 'رابط غير صالح', success: '', token: null });
  }
  res.render('reset-password', { error: '', success: '', token: req.params.token });
});

app.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;
  const user = await User.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } });
  if (!user) {
    return res.render('reset-password', { error: 'رابط غير صالح', success: '', token: req.params.token });
  }
  await User.findByIdAndUpdate(user._id, { password, resetToken: null, resetTokenExpiry: null });
  res.render('login', { error: '', success: 'تم تغيير كلمة المرور بنجاح' });
});

// Admin Routes
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  
  const students = await User.find({ isAdmin: false });
  const codes = await Code.find({});
  const courses = await Course.find({});
  const admins = await User.find({ isAdmin: true });
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(10);
  const activities = await ActivityLog.find({}).sort({ createdAt: -1 }).limit(20);
  
  // إحصائيات
  const stats = {
    totalStudents: students.length,
    activeStudents: students.filter(s => {
      try { return Object.keys(JSON.parse(s.courses || '{}')).length > 0; } catch { return false; }
    }).length,
    totalCourses: courses.length,
    totalLectures: courses.reduce((acc, c) => acc + (c.lectures ? c.lectures.length : 0), 0),
    usedCodes: codes.filter(c => c.used).length,
    unusedCodes: codes.filter(c => !c.used).length,
    
    // إحصائيات الطلاب الجدد (آخر 7 أيام)
    newStudentsThisWeek: students.filter(s => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 7);
      return new Date(s.createdAt) > dayAgo;
    }).length,
    
    // إحصائيات الأكواد المستخدمة يومياً
    codesUsedToday: codes.filter(c => {
      if (!c.usedAt) return false;
      const today = new Date();
      return c.usedAt.toDateString() === today.toDateString();
    }).length,
    
    // إحصائيات الطلاب حسب شهر التسجيل
    studentsByMonth: {},
    
    // إحصائيات الأكواد المستخدمة يومياً (آخر 7 أيام)
    codesUsedByDay: {}
  };
  
  // حساب الطلاب حسب الشهر
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  students.forEach(s => {
    const date = new Date(s.createdAt);
    const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
    stats.studentsByMonth[monthKey] = (stats.studentsByMonth[monthKey] || 0) + 1;
  });
  
  // حساب الأكواد المستخدمة يومياً
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toLocaleDateString('ar-EG');
    stats.codesUsedByDay[dateKey] = codes.filter(c => {
      if (!c.usedAt) return false;
      return c.usedAt.toDateString() === date.toDateString();
    }).length;
  }
  
  res.render('admin', { students, codes, courses, admins, notifications, activities, stats });
});

app.post('/admin/add-course', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.create({ title, thumb: thumb || 'https://via.placeholder.com/300x180', lectures: [] });
  logActivity('إنشاء كورس', `إنشاء كورس جديد: ${title}`, req.session.userId, req.session.username);
  createNotification('new_course', `تم إضافة كورس جديد: ${title}`, { course: title });
  res.redirect('/admin');
});

app.post('/admin/add-lecture', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { courseId, title, vid } = req.body;
  const course = await Course.findById(courseId);
  await Course.findByIdAndUpdate(courseId, { $push: { lectures: { title, vid } } });
  logActivity('إضافة محاضرة', `إضافة محاضرة: ${title} للكورس: ${course.title}`, req.session.userId, req.session.username);
  createNotification('new_lecture', `تم إضافة محاضرة جديدة: ${title}`, { course: course.title, lecture: title });
  res.redirect('/admin');
});

app.post('/admin/edit-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.findByIdAndUpdate(req.params.id, { title, thumb });
  logActivity('تعديل كورس', `تعديل كورس: ${title}`, req.session.userId, req.session.username);
  res.redirect('/admin');
});

app.post('/admin/edit-lecture/:courseId/:lecIndex', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, vid } = req.body;
  const { courseId, lecIndex } = req.params;
  const course = await Course.findById(courseId);
  if (course) {
    course.lectures[parseInt(lecIndex)] = { title, vid };
    await course.save();
    logActivity('تعديل محاضرة', `تعديل محاضرة: ${title}`, req.session.userId, req.session.username);
  }
  res.redirect('/admin');
});

app.get('/admin/delete-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const course = await Course.findById(req.params.id);
  await Course.findByIdAndDelete(req.params.id);
  logActivity('حذف كورس', `حذف كورس: ${course.title}`, req.session.userId, req.session.username);
  res.redirect('/admin');
});

app.get('/admin/delete-lecture/:courseId/:lecIndex', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { courseId, lecIndex } = req.params;
  const course = await Course.findById(courseId);
  if (course) {
    const lectureTitle = course.lectures[lecIndex]?.title || 'محاضرة';
    course.lectures.splice(parseInt(lecIndex), 1);
    await course.save();
    logActivity('حذف محاضرة', `حذف محاضرة: ${lectureTitle}`, req.session.userId, req.session.username);
  }
  res.redirect('/admin');
});

app.get('/admin/reset-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const student = await User.findById(req.params.id);
  await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
  logActivity('تصفير طالب', `تصفير حساب: ${student.email}`, req.session.userId, req.session.username);
  res.redirect('/admin#students-section');
});

app.get('/admin/delete-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const student = await User.findById(req.params.id);
  await User.findByIdAndDelete(req.params.id);
  logActivity('حذف طالب', `حذف طالب: ${student.email}`, req.session.userId, req.session.username);
  res.redirect('/admin#students-section');
});

app.get('/admin/generate-keys', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  for (let i = 0; i < 20; i++) {
    await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
  }
  logActivity('توليد أكواد', 'توليد 20 كود تفعيل', req.session.userId, req.session.username);
  res.redirect('/admin');
});

app.get('/admin/delete-code/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const code = await Code.findById(req.params.id);
  await Code.findByIdAndDelete(req.params.id);
  logActivity('حذف كود', `حذف كود: ${code.code}`, req.session.userId, req.session.username);
  res.redirect('/admin#codes-section');
});

app.get('/admin/delete-all-codes', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await Code.deleteMany({});
  logActivity('حذف كل الأكواد', 'حذف جميع أكواد التفعيل', req.session.userId, req.session.username);
  res.redirect
