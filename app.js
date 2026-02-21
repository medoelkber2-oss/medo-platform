const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بقاعدة البيانات MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ Database Connected & Synced"));

// --- الموديلات (Models) ---
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    courses: { type: String, default: '{}' }
}));

const Code = mongoose.model('Code', new mongoose.Schema({ 
    code: String, 
    used: { type: Boolean, default: false } 
}));

const Course = mongoose.model('Course', new mongoose.Schema({
    title: String,
    vid: String,
    thumb: String
}));

app.use(session({ 
    secret: 'medo-platform-2026', 
    resave: false, 
    saveUninitialized: false 
}));

function parseCourses(str) { try { return JSON.parse(str || '{}'); } catch { return {}; } }

// ==================== الرواتات (Routes) ====================

// حل مشكلة Cannot GET / (تحويل المستخدم للوج إن أوتوماتيكياً)
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { error: '', success: '' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    // التحقق من الأدمن
    if (email === 'admin@medo.com' && password === 'admin123') { // غير الباسورد هنا لو حابب
        req.session.isAdmin = true;
        req.session.userId = 'admin_id';
        return res.redirect('/admin');
    }
    // التحقق من الطالب
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id.toString();
        res.redirect('/home');
    } else {
        res.render('login', { error: 'بيانات الدخول خاطئة!', success: '' });
    }
});

app.get('/signup', (req, res) => res.render('signup', { error: '', success: '' }));

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
    const dbCourses = await Course.find({});
    res.render('index', {
        courses: dbCourses,
        enrolledList: parseCourses(user.courses),
        username: user.username,
        error: '', success: ''
    });
});

// تفعيل كورس بكود
app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ code: activationCode.trim(), used: false });
    const user = await User.findById(req.session.userId);
    let enrolled = parseCourses(user.courses);

    if (codeDoc) {
        enrolled[req.params.courseId] = { activated: true };
        await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
        codeDoc.used = true;
        await codeDoc.save();
        res.redirect('/home');
    } else {
        const dbCourses = await Course.find({});
        res.render('index', { courses: dbCourses, enrolledList: enrolled, username: user.username, error: '❌ الكود غير صحيح أو مستخدم', success: '' });
    }
});

// مشاهدة الفيديو
app.get('/video/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const course = await Course.findById(req.params.id);
    if (!course) return res.send("الكورس غير موجود");
    res.render('video', { course });
});

// ==================== لوحة التحكم (Admin) ====================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    res.render('admin', {
        students: await User.find({}),
        codes: await Code.find({}),
        courses: await Course.find({}),
        error: '', success: ''
    });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    await Course.create({ title, vid, thumb: thumb || 'https://via.placeholder.com/300x160' });
    res.redirect('/admin');
});

app.get('/admin/delete-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Course.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/admin/generate-keys', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    for (let i = 0; i < 20; i++) {
        await Code.create({ code: "MEDO-" + Math.random().toString(36).substring(2, 8).toUpperCase() });
    }
    res.redirect('/admin');
});

app.get('/admin/delete-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
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
app.listen(PORT, () => console.log("🚀 Server is running on port " + PORT));
