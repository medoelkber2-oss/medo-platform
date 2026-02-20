const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// الاتصال بـ MongoDB
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error", err));

// --- الجداول (Models) ---
const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    device_info: String,
    enrolled_courses: { type: [String], default: [] } // مصفوفة فيها IDs الكورسات المفعلة
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true },
    course_id: String,
    is_used: { type: Boolean, default: false }
}));

app.use(session({ 
    secret: 'medo-top-secret', 
    resave: false, 
    saveUninitialized: true 
}));

// --- الكورسات بتاعتك (اللي طلبت ترجعها) ---
const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق الرقمي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", vid: "ieaQmXn-uA4", thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

// --- المسارات (Routes) ---

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/home');
    res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));

app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); } 
    catch (e) { res.render('signup', { error: "الإيميل مسجل مسبقاً" }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        const device = req.headers['user-agent'];
        // حماية الجهاز (لو مش أدمن)
        if (user.device_info && user.device_info !== device && email !== "medo_elkber@gmail.com") {
            return res.render('login', { error: "هذا الحساب مفتوح من جهاز آخر" });
        }
        if (!user.device_info) await User.findByIdAndUpdate(user._id, { device_info: device });
        
        req.session.userId = user._id;
        return (email === "medo_elkber@gmail.com") ? res.redirect('/admin/dashboard') : res.redirect('/home');
    }
    res.render('login', { error: "بيانات الدخول غير صحيحة" });
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    res.render('index', { 
        courses: courses, 
        enrolledList: user.enrolled_courses || [], 
        username: user.username 
    });
});

// تفعيل الكورس بكود
app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    
    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        codeDoc.is_used = true;
        await codeDoc.save();
        res.redirect('/home?success=true');
    } else {
        res.redirect('/home?error=invalid');
    }
});

// --- لوحة التحكم (Admin) ---
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.email !== "medo_elkber@gmail.com") return res.redirect('/home');
    
    const students = await User.find();
    const codes = await Code.find();
    res.render('admin', { students, codes, courses });
});

// توليد أكواد تلقائية من الأدمن
app.post('/admin/generate', async (req, res) => {
    const { course_id, count } = req.body;
    for (let i = 0; i < parseInt(count); i++) {
        let codeText = `MEDO-${course_id.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        await Code.create({ code: codeText, course_id, is_used: false });
    }
    res.redirect('/admin/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
