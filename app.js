const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// إعدادات Vercel الأساسية
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// رابط الداتا بيز (تأكد إنه شغال)
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Connected"))
    .catch(err => console.log("❌ DB Error"));

// تعريف الجداول
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

// إعداد الجلسة
app.use(session({ 
    secret: 'medo-top-secret', 
    resave: false, 
    saveUninitialized: true 
}));

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق الرقمي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" }
];

// --- المسارات (Routes) ---

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/home');
    res.redirect('/login');
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId);
        res.render('index', { 
            courses: courses, 
            enrolledList: user ? user.enrolled_courses : [], 
            username: user ? user.username : "طالب" 
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
    try {
        await User.create(req.body);
        res.redirect('/login');
    } catch (e) { res.send("الإيميل موجود فعلاً"); }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email, password: req.body.password });
        if (user) { req.session.userId = user._id; res.redirect('/home'); }
        else { res.send("بيانات غلط"); }
    } catch (e) { res.send("مشكلة في السيرفر"); }
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        codeDoc.is_used = true;
        await codeDoc.save();
        res.send("<script>alert('تم!'); window.location.href='/home';</script>");
    } else { res.send("<script>alert('غلط'); window.location.href='/home';</script>"); }
});

// دي أهم حتة لـ Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Ready` ));

module.exports = app;
