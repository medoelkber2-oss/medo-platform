const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بقاعدة البيانات
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// الموديلات
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    courses: { type: String, default: '{}' }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: String,
    used: { type: Boolean, default: false }
}));

// الجلسات
app.use(session({
    secret: 'medo-platform-2026',
    resave: false,
    saveUninitialized: false
}));

// مصفوفة الكورسات تبدأ فارغة بناءً على طلبك
let courses = []; 

// دالة لتحويل بيانات الكورسات الخاصة بالمستخدم
function parseCourses(str) {
    try { return JSON.parse(str || '{}'); }
    catch { return {}; }
}

// ==================== الرواتات (Routes) ====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id.toString();
        if (email === 'admin@medo.com') {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        res.redirect('/home');
    } else {
        res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');
    res.render('index', {
        courses: courses,
        enrolledList: parseCourses(user.courses),
        username: user.username,
        sessionId: req.sessionID,
        error: '', success: ''
    });
});

// ==================== لوحة التحكم (Admin Dashboard) ====================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: courses,
        error: '', success: ''
    });
});

// إضافة كورس جديد يدوياً
app.post('/admin/add-course', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    
    courses.push({
        id: "c" + Date.now(), // توليد رقم تعريفي فريد بناءً على الوقت
        title: title,
        vid: vid,
        thumb: thumb || 'https://via.placeholder.com/300x160?text=No+Image'
    });
    res.redirect('/admin');
});

// مسح الكورس
app.get('/admin/delete-course/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    courses = courses.filter(c => c.id !== req.params.id);
    res.redirect('/admin');
});

// إدارة الأكواد والطلاب
app.get('/admin/generate-keys', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    for (let i = 0; i < 20; i++) {
        await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
    }
    res.redirect('/admin');
});

app.get('/admin/delete-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://localhost:${PORT}`));
