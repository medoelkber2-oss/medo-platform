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

const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Connected Successfully"))
    .catch(err => console.error("❌ DB Error", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String,
    device_info: String, // لحفظ بصمة الجهاز
    enrolled_courses: { type: [String], default: [] }
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

const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق الرقمي", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", vid: "ieaQmXn-uA4", thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/home');
    res.redirect('/login');
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId);
        const device = req.headers['user-agent'];
        // التحقق من الجهاز
        const deviceMatch = (!user.device_info || user.device_info === device);
        
        res.render('index', { 
            courses, 
            enrolledList: user.enrolled_courses || [], 
            username: user.username,
            deviceMatch
        });
    } catch (e) { res.redirect('/login'); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        const device = req.headers['user-agent'];
        // حماية: إذا لم يكن هناك بصمة جهاز، احفظها الآن
        if (!user.device_info) {
            await User.findByIdAndUpdate(user._id, { device_info: device });
        }
        req.session.userId = user._id;
        // إذا كان الإيميل هو إيميلك، يحولك للأدمن
        if (email === "medo_elkber@gmail.com") return res.redirect('/admin/dashboard');
        res.redirect('/home');
    } else {
        res.render('login', { error: "بيانات غلط" });
    }
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode, course_id: req.params.courseId, is_used: false });
    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        codeDoc.is_used = true;
        await codeDoc.save();
        res.redirect('/home?success=activated');
    } else {
        res.redirect('/home?error=wrongcode');
    }
});

// لوحة التحكم (عرض الطلاب والأكواد)
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.email !== "medo_elkber@gmail.com") return res.redirect('/home');
    
    const students = await User.find();
    const codes = await Code.find();
    res.render('admin', { students, codes, courses });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));
app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); } 
    catch (e) { res.render('signup', { error: "الإيميل مسجل مسبقاً" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
