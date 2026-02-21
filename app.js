const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// Models
const UserSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    courses: { type: String, default: '{}' }
});

const CodeSchema = new mongoose.Schema({
    code: String,
    used: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Code = mongoose.model('Code', CodeSchema);

// Session
app.use(session({
    secret: 'medo-platform-2026',
    resave: false,
    saveUninitialized: false
}));

// Courses
let courses = [];

function parseCourses(str) {
    try { return JSON.parse(str || '{}'); }
    catch { return {}; }
}

// ==================== ROUTES ====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login', { error: '', success: '' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    
    if (user) {
        req.session.userId = user._id.toString();
        
        if (email === 'admin@medo.com') {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        res.redirect('/home');
    } else {
        res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
    }
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: '', success: '' });
});

app.post('/signup', async (req, res) => {
    try {
        await User.create(req.body);
        res.render('login', { error: '', success: '✅ تم إنشاء الحساب بنجاح!' });
    } catch (e) {
        res.render('signup', { error: 'الإيميل مسجل مسبقاً!', success: '' });
    }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');
    
    res.render('index', {
        courses: courses,
        enrolledList: parseCourses(user.courses),
        username: user.username,
        sessionId: req.sessionID,
        error: '',
        success: ''
    });
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode.trim(), used: false });
    const user = await User.findById(req.session.userId);
    
    let enrolled = parseCourses(user.courses);
    
    if (codeDoc) {
        enrolled[req.params.courseId] = { views: 0, max: 3, device: req.sessionID };
        await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
        codeDoc.used = true;
        await codeDoc.save();
        
        res.render('index', {
            courses: courses,
            enrolledList: enrolled,
            username: user.username,
            sessionId: req.sessionID,
            error: '',
            success: '✅ تم التفعيل! لديك 3 مشاهدات'
        });
    } else {
        res.render('index', {
            courses: courses,
            enrolledList: enrolled,
            username: user.username,
            sessionId: req.sessionID,
            error: '❌ الكود خاطئ أو مستخدم',
            success: ''
        });
    }
});

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: courses,
        error: '',
        success: ''
    });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    courses.push({
        id: "c" + (courses.length + 1),
        title: req.body.title,
        vid: req.body.vid,
        thumb: req.body.thumb
    });
    
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: courses,
        error: '',
        success: '✅ تم إضافة الكورس!'
    });
});

// ✅ حذف كورس
app.get('/admin/delete-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    courses = courses.filter(c => c.id !== req.params.id);
    
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: courses,
        error: '',
        success: '✅ تم حذف الكورس!'
    });
});

app.post('/admin/add-code', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    await Code.create({ code: req.body.newCode.trim() });
    
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: courses,
        error: '',
        success: '✅ تم إضافة الكود!'
    });
});

app.get('/admin/delete-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/admin/delete-all-codes', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Code.deleteMany({});
    res.redirect('/admin');
});

app.get('/admin/generate-keys', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    
    for (let i = 0; i < 20; i++) {
        await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
    }
    res.redirect('/admin');
});

app.get('/admin/delete-code/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Code.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log("🚀 Server running on " + PORT));
