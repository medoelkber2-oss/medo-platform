const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// إعدادات المحرك
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الربط بالداتا بيز
const mongoURI = (process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority").trim();

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected Successfully"))
    .catch(err => console.error("❌ DB Error:", err));

// جداول البيانات
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    enrolled_courses: { type: [String], default: [] }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true },
    course_id: String,
    is_used: { type: Boolean, default: false }
}));

app.use(session({
    secret: 'medo-platform-secret-2026',
    resave: false,
    saveUninitialized: true
}));

// قائمة الكورسات بصور احترافية
const courses = [
    { id: "c1", title: "مراجعة الفيزياء - 1 ثانوي", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1636466484362-d26e79aa59d6?w=500" },
    { id: "c2", title: "كيمياء اللغات - 2 ثانوي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1532187875605-2fe358711e24?w=500" }
];

// المسارات
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));

app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); }
    catch (e) { res.render('signup', { error: "الإيميل مسجل مسبقاً" }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) { req.session.userId = user._id; res.redirect('/home'); }
    else { res.render('login', { error: "بيانات الدخول خاطئة" }); }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    res.render('index', { 
        courses, 
        enrolledList: user.enrolled_courses || [], 
        username: user.username,
        deviceMatch: true 
    });
});

app.post('/activate/:courseId', async (req, res) => {
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        codeDoc.is_used = true;
        await codeDoc.save();
        res.send("<script>alert('✅ مبروك! الكورس اتفعل عندك'); window.location.href='/home';</script>");
    } else {
        res.send("<script>alert('❌ الكود غلط أو مستخدم'); window.location.href='/home';</script>");
    }
});

// توليد أكواد الأدمن
app.get('/admin/generate-keys-secret', async (req, res) => {
    const ids = ["c1", "c2"];
    for (let id of ids) {
        for (let i = 0; i < 10; i++) {
            let codeVal = `MEDO-${Math.random().toString(36).substring(5).toUpperCase()}`;
            await Code.create({ code: codeVal, course_id: id });
        }
    }
    res.send("✅ تم توليد 20 كود جديد بنجاح!");
});

// تشغيل السيرفر على بورت 8080 (حسب طلب Railway)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 السيرفر شغال الآن على بورت ${PORT}`));
