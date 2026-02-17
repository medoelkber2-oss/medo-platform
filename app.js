const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// 1. إعدادات المحرك
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. الاتصال بقاعدة البيانات
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Connected with Device Protection"))
    .catch(err => console.error("❌ DB Error", err));

// 3. تعريف الجداول (محدثة ببصمة الجهاز)
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    enrolled_courses: { type: [String], default: [] },
    device_info: { type: String, default: "" } // هنا بنخزن بصمة الجهاز
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true }, 
    course_id: String, 
    is_used: { type: Boolean, default: false }
}));

// 4. إعداد الجلسة
app.use(session({ 
    secret: 'medo-top-secret', 
    resave: false, 
    saveUninitialized: true 
}));

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق الرقمي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", vid: "ieaQmXn-uA4", thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

// --- 5. المسارات (Routes) ---

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/home');
    res.redirect('/login');
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId);
        const currentDevice = req.headers['user-agent']; // بصمة الجهاز اللي داخل دلوقتي

        // فحص حماية الجهاز: لو الطالب فعل كورس قبل كدة وجهازه اتغير
        let deviceMatch = true;
        if (user.device_info && user.device_info !== currentDevice) {
            deviceMatch = false;
        }

        res.render('index', { 
            courses: courses, 
            enrolledList: user.enrolled_courses || [], 
            username: user.username,
            deviceMatch: deviceMatch // هنبعت دي للصفحة عشان نقفل الفيديوهات لو مش متطابق
        });
    } catch (e) { res.redirect('/login'); }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));

app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); } 
    catch (e) { res.send("الإيميل مسجل مسبقاً"); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) { 
        req.session.userId = user._id; 
        res.redirect('/home'); 
    } else { res.send("بيانات غلط"); }
});

// تفعيل الكورس مع قفل الجهاز
app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const currentDevice = req.headers['user-agent']; // بصمة جهاز الطالب حالياً

    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    
    if (codeDoc) {
        // تحديث المستخدم: إضافة الكورس وقفل الحساب على الجهاز ده
        await User.findByIdAndUpdate(req.session.userId, { 
            $addToSet: { enrolled_courses: req.params.courseId },
            $set: { device_info: currentDevice } 
        });
        
        codeDoc.is_used = true;
        await codeDoc.save();
        res.send("<script>alert('تم التفعيل وقفل الكورس على هذا الجهاز!'); window.location.href='/home';</script>");
    } else {
        res.send("<script>alert('الكود غلط أو مستخدم'); window.location.href='/home';</script>");
    }
});

app.get('/admin/generate', async (req, res) => {
    try {
        const ids = ["c1", "c2", "c3"];
        for (let id of ids) {
            for (let i = 0; i < 5; i++) {
                let code = `MEDO-${id.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
                await Code.create({ code: code, course_id: id, is_used: false });
            }
        }
        res.send("✅ تم توليد أكواد الحماية");
    } catch (e) { res.send("خطأ"); }
});

app.get('/admin/data', async (req, res) => {
    const students = await User.find();
    const codes = await Code.find();
    res.json({ students, codes });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Security active on ${PORT}`));
module.exports = app;
