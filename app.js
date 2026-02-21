const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الربط بالداتا بيز - استخدمنا .trim() عشان لو فيه مسافات في الرابط ما يعملش Error
const mongoURI = (process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority").trim();

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

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
    secret: 'medo-platform-2026',
    resave: false,
    saveUninitialized: true
}));

const courses = [
    { id: "c1", title: "مراجعة ليلة الامتحان - فيزياء", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1636466484362-d26e79aa59d6?q=80&w=500" },
    { id: "c2", title: "كورس التأسيس الشامل - كيمياء", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1532187875605-2fe358711e24?q=80&w=500" }
];

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));

app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); }
    catch (e) { res.render('signup', { error: "الإيميل مستخدم بالفعل" }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) { req.session.userId = user._id; res.redirect('/home'); }
    else { res.render('login', { error: "البيانات غير صحيحة" }); }
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
        res.send("<script>alert('✅ تم تفعيل الكورس بنجاح!'); window.location.href='/home';</script>");
    } else {
        res.send("<script>alert('❌ الكود غير صحيح أو مستخدم'); window.location.href='/home';</script>");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on port ${PORT}`));
