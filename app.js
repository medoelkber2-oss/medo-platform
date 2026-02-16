const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// --- الرابط اللي كان عامل مشكلة (تم إصلاحه 100%) ---
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI.trim()) // استخدمت trim() عشان لو فيه أي مسافة زيادة تتمسح أوتوماتيك
    .then(() => console.log("✅ مبروك يا ميدو.. الموقع متصل بالسحاب بنجاح!"))
    .catch(err => {
        console.log("❌ لسه فيه مشكلة.. تأكد إنك فاتح الـ Network Access في MongoDB");
        console.error(err);
    });

// تعريف الجداول
const userSchema = new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    enrolled_courses: [String]
});
const codeSchema = new mongoose.Schema({
    code: { type: String, unique: true }, 
    course_id: String, 
    is_used: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Code = mongoose.model('Code', codeSchema);

app.use(session({ secret: 'medo-top-secret', resave: false, saveUninitialized: true }));

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق الرقمي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" }
];

// --- المسارات الرئيسية ---
app.get('/', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    res.render('index', { courses, enrolledList: user.enrolled_courses || [], username: user.username });
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });

    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        codeDoc.is_used = true;
        await codeDoc.save();
        res.send("<script>alert('تم تفعيل الكورس!'); window.location.href='/';</script>");
    } else {
        res.send("<script>alert('الكود خطأ!'); window.location.href='/';</script>");
    }
});

// لوحة التحكم السريعة
app.get('/admin/data', async (req, res) => {
    const codes = await Code.find();
    const users = await User.find();
    res.json({ total_codes: codes.length, codes, students: users });
});

app.get('/admin/generate', async (req, res) => {
    const count = await Code.countDocuments();
    if (count === 0) {
        for (let i = 0; i < 100; i++) {
            let randomCode = "MEDO-" + Math.random().toString(36).substring(2, 7).toUpperCase();
            await Code.create({ code: randomCode, course_id: i < 50 ? "c1" : "c2" });
        }
        res.send("✅ تم توليد 100 كود في السحابة!");
    } else {
        res.send("الأكواد موجودة فعلاً.");
    }
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) { req.session.userId = user.id; res.redirect('/'); }
    else res.send("بيانات غلط");
});

app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
    try {
        await User.create(req.body);
        res.redirect('/login');
    } catch (e) { res.send("الإيميل مسجل مسبقاً"); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر شغال على بورت ${PORT}`));