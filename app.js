const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بـ MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ Database Connected & Integrated"));

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
    thumb: String,
    lectures: [{ title: String, vid: String }] 
}));

app.use(session({ secret: 'medo-platform-2026', resave: false, saveUninitialized: false }));

// ================= المسارات الأساسية (User Routes) =================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@medo.com' && password === 'admin123') {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        res.redirect('/home');
    } else {
        res.render('login', { error: 'بيانات الدخول خاطئة', success: '' });
    }
});

app.get('/signup', (req, res) => res.render('signup', { error: '', success: '' }));

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.render('signup', { error: 'الإيميل مسجل مسبقاً', success: '' });
        await User.create({ username, email, password });
        res.render('login', { error: '', success: 'تم إنشاء الحساب بنجاح، سجل دخولك الآن' });
    } catch (e) { res.render('signup', { error: 'حدث خطأ في التسجيل', success: '' }); }
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const dbCourses = await Course.find({});
    res.render('index', { 
        courses: dbCourses, 
        enrolledList: JSON.parse(user.courses || '{}'), 
        username: user.username, error: '', success: '' 
    });
});

app.post('/activate/:courseId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { activationCode } = req.body;
    const courseId = req.params.courseId;
    const codeDoc = await Code.findOne({ code: activationCode.trim(), used: false });
    if (codeDoc) {
        const user = await User.findById(req.session.userId);
        let enrolled = JSON.parse(user.courses || '{}');
        enrolled[courseId] = { activated: true };
        await User.findByIdAndUpdate(user._id, { courses: JSON.stringify(enrolled) });
        codeDoc.used = true;
        await codeDoc.save();
        res.redirect('/home');
    } else {
        res.redirect('/home?error=invalid_code');
    }
});

app.get('/video/:id', async (req, res) => {
    if (!req.session.userId && !req.session.isAdmin) return res.redirect('/login');
    const course = await Course.findById(req.params.id);
    const lecIndex = parseInt(req.query.lec) || 0; 
    res.render('video', { course, lecIndex });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ================= لوحة التحكم (Admin Routes) =================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const students = await User.find({});
    const codes = await Code.find({});
    const dbCourses = await Course.find({});
    res.render('admin', { students, codes, courses: dbCourses });
});

app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, thumb } = req.body;
    await Course.create({ title, thumb: thumb || 'https://via.placeholder.com/300x180', lectures: [] });
    res.redirect('/admin');
});

app.post('/admin/add-lecture', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { courseId, title, vid } = req.body;
    await Course.findByIdAndUpdate(courseId, { $push: { lectures: { title, vid } } });
    res.redirect('/admin');
});

app.get('/admin/course-data/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
    const course = await Course.findById(req.params.id);
    res.json(course);
});

app.post('/admin/edit-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, thumb } = req.body;
    await Course.findByIdAndUpdate(req.params.id, { title, thumb });
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

app.get('/admin/delete-all-codes', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Code.deleteMany({});
    res.redirect('/admin');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
