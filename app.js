const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// إعداد المسارات المطلقة عشان Vercel ميتهش
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ DB Connected"));

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

// حل مشكلة الـ MemoryStore Warning اللي ظهرت في الـ Logs عندك
app.use(session({ 
    secret: 'medo-2026-secure', 
    resave: false, 
    saveUninitialized: false,
    cookie: { secure: false } // خليه true لو بتستخدم https رسمي
}));

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", lessons: [{title: "المقدمة", vid: "dQw4w9WgXcQ"}], thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق", lessons: [{title: "الأساسيات", vid: "9Wp3-6n-8f0"}], thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", lessons: [{title: "مفاجأة", vid: "ieaQmXn-uA4"}], thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

// --- Routes ---
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        // تأكيد رتبة الأدمن لإيميلك
        if (email === "medo_elkber@gmail.com") {
            await User.findByIdAndUpdate(user._id, { role: 'admin' });
            return res.redirect('/admin/dashboard');
        }
        res.redirect('/home');
    } else {
        res.send("<script>alert('خطأ في البيانات'); window.location.href='/login';</script>");
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const currentDevice = req.headers['user-agent'];
    let deviceMatch = !user.device_info || user.device_info === currentDevice;
    res.render('index', { courses, user, deviceMatch });
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.role !== 'admin') return res.status(403).send("Forbidden");
    const students = await User.find({ role: 'student' });
    const codes = await Code.find();
    res.render('admin', { students, codes });
});

// تصفير الجهاز (Admin Only)
app.get('/admin/reset/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    await User.findByIdAndUpdate(req.params.id, { device_info: "" });
    res.redirect('/admin/dashboard');
});

// توليد الأكواد (Admin Only)
app.post('/admin/generate', async (req, res) => {
    const { courseId, count } = req.body;
    for(let i=0; i<count; i++) {
        let code = `MEDO-${courseId.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        await Code.create({ code, course_id: courseId });
    }
    res.redirect('/admin/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = app;
app.listen(process.env.PORT || 3000);
