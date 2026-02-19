const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// إعدادات المسارات (تأكد إن فولدر views موجود في GitHub)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// الاتصال بقاعدة البيانات (من بياناتك في الصور)
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ DB Connected")).catch(err => console.error("❌ DB Error:", err));

// تعريف الجداول
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

// حل مشكلة MemoryStore Warning اللي ظاهرة في الـ Logs عندك
app.use(session({ 
    secret: 'medo_secret_2026', 
    resave: false, 
    saveUninitialized: false 
}));

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", lessons: [{title: "المقدمة", vid: "dQw4w9WgXcQ"}], thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق", lessons: [{title: "الأساسيات", vid: "9Wp3-6n-8f0"}], thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", lessons: [{title: "مفاجأة", vid: "ieaQmXn-uA4"}], thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

// --- 🛠️ المسارات (Routes) ---

// المسار الرئيسي يحول للوجن فوراً بدل Cannot GET /
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: req.query.error || null }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        // تفعيل الأدمن لإيميلك الظاهر في الصورة
        if (email === "medo_elkber@gmail.com") {
            await User.findByIdAndUpdate(user._id, { role: 'admin' });
            return res.redirect('/admin/dashboard');
        }
        res.redirect('/home');
    } else {
        res.redirect('/login?error=بيانات الدخول غلط يا ميدو');
    }
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') return res.redirect('/home?error=غير مسموح لك');
    
    const students = await User.find({ role: 'student' });
    const codes = await Code.find();
    res.render('admin', { students, codes });
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const currentDevice = req.headers['user-agent'];
    let deviceMatch = !user.device_info || user.device_info === currentDevice;
    res.render('index', { courses, user, deviceMatch });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Medo Academy on ${PORT}`));

module.exports = app;
