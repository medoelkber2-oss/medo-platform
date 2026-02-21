const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بقاعدة البيانات
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ Database Connected & Synced"));

// --- الموديلات (Models) ---
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String, courses: { type: String, default: '{}' }
}));

const Code = mongoose.model('Code', new mongoose.Schema({ code: String, used: { type: Boolean, default: false } }));

// الموديل الجديد لحفظ الكورسات في قاعدة البيانات [جديد]
const Course = mongoose.model('Course', new mongoose.Schema({
    title: String,
    vid: String,
    thumb: String
}));

app.use(session({ secret: 'medo-platform-2026', resave: false, saveUninitialized: false }));

// دالة مساعدة
function parseCourses(str) { try { return JSON.parse(str || '{}'); } catch { return {}; } }

// --- الرواتات (Routes) ---

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const dbCourses = await Course.find({}); // جلب الكورسات من القاعدة
    res.render('index', {
        courses: dbCourses,
        enrolledList: parseCourses(user.courses),
        username: user.username,
        sessionId: req.sessionID,
        error: '', success: ''
    });
});

// --- لوحة التحكم (Admin Dashboard) ---

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: await Course.find({}), // جلب الكورسات من القاعدة
        error: '', success: ''
    });
});

// إضافة كورس وحفظه في MongoDB [تعديل]
app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    await Course.create({
        title, 
        vid, 
        thumb: thumb || 'https://via.placeholder.com/300x160?text=No+Image'
    });
    res.redirect('/admin');
});

// مسح الكورس من MongoDB [تعديل]
app.get('/admin/delete-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Course.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

// راوت مشاهدة الفيديو (يجب التأكد من وجوده ليعمل مع الكورسات الديناميكية)
app.get('/video/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const course = await Course.findById(req.params.id);
    if (!course) return res.send("الكورس غير موجود");
    res.render('video', { course });
});

// (باقي رواتات الأكواد والطلاب تظل كما هي...)
app.listen(8080, () => console.log("🚀 Platform is Live & Database Secured"));
