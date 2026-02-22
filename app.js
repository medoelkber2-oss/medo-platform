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
  isAdmin: { type: Boolean, default: false }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
  code: String,
  used: { type: Boolean, default: false }
}));

const Course = mongoose.model('Course', new mongoose.Schema({
  title: String,
  thumb: String,
  lectures: [{ title: String, vid: String }]
}));

app.use(session({
  secret: 'medo-secret-key-2024',
  resave: false,
  saveUninitialized: false
}));

// Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Admin login (main admin)
  if (email === 'admin@medo.com' && password === 'admin123') {
    req.session.isAdmin = true;
    req.session.userId = 'admin-main';
    return res.redirect('/admin');
  }
  
  // Regular user login
  const user = await User.findOne({ email, password });
  if (user) {
    req.session.userId = user._id;
    req.session.isAdmin = user.isAdmin || false;
    req.session.username = user.username;
    
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
  res.render('login', { error: '', success: 'تم إنشاء الحساب بنجاح' });
});

app.get('/home', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  const courses = await Course.find({});
  res.render('index', {
    courses,
    enrolledList: JSON.parse(user.courses || '{}'),
    username: user.username,
    error: '',
    success: ''
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
    await codeDoc.save();
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
  
  // جلب الطلاب (غير الأدمنز)
  const students = await User.find({ isAdmin: false });
  
  // جلب الأكواد
  const codes = await Code.find({});
  
  // جلب الكورسات
  const courses = await Course.find({});
  
  // جلب الأدمنز
  const admins = await User.find({ isAdmin: true });
  
  res.render('admin', { students, codes, courses, admins });
});

app.post('/admin/add-course', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.create({ title, thumb: thumb || 'https://via.placeholder.com/300x180', lectures: [] });
  res.redirect('/admin');
});

app.post('/admin/add-lecture', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { courseId, title, vid } = req.body;
  await Course.findByIdAndUpdate(courseId, { $push: { lectures: { title, vid } } });
  res.redirect('/admin');
});

app.post('/admin/edit-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { title, thumb } = req.body;
  await Course.findByIdAndUpdate(req.params.id, { title, thumb });
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
  }
  res.redirect('/admin');
});

app.get('/admin/delete-course/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await Course.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

app.get('/admin/delete-lecture/:courseId/:lecIndex', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { courseId, lecIndex } = req.params;
  const course = await Course.findById(courseId);
  if (course) {
    course.lectures.splice(parseInt(lecIndex), 1);
    await course.save();
  }
  res.redirect('/admin');
});

app.get('/admin/reset-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
  res.redirect('/admin#students-section');
});

app.get('/admin/delete-student/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/admin#students-section');
});

app.get('/admin/generate-keys', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  for (let i = 0; i < 20; i++) {
    await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
  }
  res.redirect('/admin');
});

app.get('/admin/delete-code/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await Code.findByIdAndDelete(req.params.id);
  res.redirect('/admin#codes-section');
});

app.get('/admin/delete-all-codes', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  await Code.deleteMany({});
  res.redirect('/admin');
});

// إضافة أدمن (بالاسم والإيميل فقط)
app.post('/admin/add-admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  const { username, email } = req.body;
  const defaultPassword = "admin123";
  
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // تحويل المستخدم الحالي لأدمن
      await User.findByIdAndUpdate(existingUser._id, { isAdmin: true, username: username });
      console.log('✅ تم تحويل المستخدم لأدمن:', email);
    } else {
      // إنشاء أدمن جديد
      await User.create({ 
        username, 
        email, 
        password: defaultPassword, 
        isAdmin: true,
        courses: '{}'
      });
      console.log('✅ تم إضافة أدمن جديد:', email);
    }
    res.redirect('/admin#admins-section');
  } catch (err) {
    console.error('❌ خطأ في إضافة الأدمن:', err);
    res.redirect('/admin#admins-section');
  }
});

app.get('/admin/delete-admin/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login');
  if (req.params.id === 'admin-main') {
    return res.redirect('/admin#admins-section');
  }
  await User.findByIdAndUpdate(req.params.id, { isAdmin: false });
  res.redirect('/admin#admins-section');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
