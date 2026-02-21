const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بـ MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ Database Connected & Integrated"));

// --- الموديلات (Models) ---
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    courses: { type: String, default: '{}' }
}));
const Code = mongoose.model('Code', new mongoose.Schema({ code: String, used: { type: Boolean, default: false } }));
const Course = mongoose.model('Course', new mongoose.Schema({ title: String, vid: String, thumb: String }));

app.use(session({ secret: 'medo-platform-2026', resave: false, saveUninitialized: false }));

// ================= المسارات الأساسية =================

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@medo.com' && password === 'admin123') {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        res.redirect('/home');
    } else {
        res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const dbCourses = await Course.find({});
    res.render('index', { 
        courses: dbCourses, 
        enrolledList: JSON.parse(user.courses || '{}'), 
        username: user.username, error: '', success: '' 
    });
});

// [حل مشكلة التفعيل] مسار تفعيل الكورس بالكود
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
        const user = await User.findById(req.session.userId);
        const dbCourses = await Course.find({});
        res.render('index', { 
            courses: dbCourses, enrolledList: JSON.parse(user.courses || '{}'), 
            username: user.username, error: '❌ الكود غير صحيح أو مستخدم مسبقاً', success: '' 
        });
    }
});

// [حل مشكلة الفيديو] مسار صفحة الفيديو
app.get('/video/:id', async (req, res) => {
    if (!req.session.userId && !req.session.isAdmin) return res.redirect('/login');
    const course = await Course.findById(req.params.id);
    if (!course) return res.send("الكورس غير موجود");
    res.render('video', { course });
});

// ================= لوحة التحكم (Admin) =================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const studentsRaw = await User.find({});
    const codes = await Code.find({});
    const dbCourses = await Course.find({});

    const students = studentsRaw.map(s => {
        const enrolled = JSON.parse(s.courses || '{}');
        return { ...s._doc, activeCount: Object.keys(enrolled).length };
    });
    res.render('admin', { students, codes, courses: dbCourses });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    await Course.create({ title, vid, thumb: thumb || 'https://via.placeholder.com/300x180' });
    res.redirect('/admin');
});

app.get('/admin/delete-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Course.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/admin/reset-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
    res.redirect('/admin');
});

app.get('/admin/generate-keys', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    for (let i = 0; i < 20; i++) {
        await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
    }
    res.redirect('/admin');
});

app.get('/admin/delete-all-codes', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Code.deleteMany({});
    res.redirect('/admin');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
