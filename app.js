const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// إعدادات المحرك (Views)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// المجلدات العامة والبيانات
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// الاتصال بقاعدة البيانات (MongoDB)
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// الموديلات (Models)
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    role: { type: String, default: 'student' }, 
    enrolled_courses: { type: [String], default: [] },
    device_info: { type: String, default: "" }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true }, 
    course_id: String, 
    is_used: { type: Boolean, default: false }
}));

// إعداد الجلسة (Session)
app.use(session({ 
    secret: 'medo-platform-2026-secret', 
    resave: false, 
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

// بيانات الكورسات
const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", lessons: [{title: "المقدمة", vid: "dQw4w9WgXcQ"}], thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق", lessons: [{title: "الأساسيات", vid: "9Wp3-6n-8f0"}], thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", lessons: [{title: "مفاجأة", vid: "ieaQmXn-uA4"}], thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

// --- المسارات (Routes) ---

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: req.query.error || null }));

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            req.session.userId = user._id;
            // التحقق إذا كان الحساب هو الأدمن
            if (email === "medo_elkber@gmail.com") {
                await User.findByIdAndUpdate(user._id, { role: 'admin' });
                return res.redirect('/admin/dashboard');
            }
            return res.redirect('/home');
        } else { 
            return res.redirect('/login?error=بيانات الدخول غير صحيحة'); 
        }
    } catch (e) { 
        return res.redirect('/login?error=حدث خطأ في السيرفر'); 
    }
});

app.get('/home', async (req, res) => {
    try {
        if (!req.session.userId) return res.redirect('/login');
        const user = await User.findById(req.session.userId);
        if(!user) return res.redirect('/logout');
        
        const currentDevice = req.headers['user-agent'];
        let deviceMatch = !user.device_info || user.device_info === currentDevice;

        // حفظ أول جهاز يدخل منه الطالب
        if (!user.device_info) {
            await User.findByIdAndUpdate(user._id, { device_info: currentDevice });
            deviceMatch = true;
        }

        res.render('index', { courses, user, deviceMatch });
    } catch (e) {
        res.status(500).send("خطأ في تحميل الصفحة الرئيسية");
    }
});

app.get('/admin/dashboard', async (req, res) => {
    try {
        if (!req.session.userId) return res.redirect('/login');
        const user = await User.findById(req.session.userId);
        if (!user || user.role !== 'admin') return res.redirect('/home?error=غير مسموح لك بالدخول');
        
        const students = await User.find({ role: 'student' });
        const codes = await Code.find();
        res.render('admin', { students, codes, user });
    } catch (e) {
        res.status(500).send("خطأ في الدخول للوحة التحكم");
    }
});

// تصفير جهاز الطالب (Reset Device)
app.get('/admin/reset/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { device_info: "" });
        res.redirect('/admin/dashboard?success=تم تصفير الجهاز بنجاح');
    } catch (e) {
        res.redirect('/admin/dashboard?error=فشل في تصفير الجهاز');
    }
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/login'); 
});

// منع إيرور الـ Favicon المشهور
app.get('/favicon.ico', (req, res) => res.status(204));

// تشغيل السيرفر لـ Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
