const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الربط بقاعدة بيانات مانجو
const mongoURI = process.env.MONGO_URI || "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ MongoDB Connected & Ready"));

// الموديلات (Models)
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String, courses: { type: String, default: '{}' }
}));
const Code = mongoose.model('Code', new mongoose.Schema({ code: String, used: { type: Boolean, default: false } }));
const Course = mongoose.model('Course', new mongoose.Schema({ title: String, vid: String, thumb: String }));

app.use(session({ secret: 'medo-platform-2026', resave: false, saveUninitialized: false }));

// --- المسارات (Routes) ---

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login', { error: '', success: '' }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@medo.com' && password === '0987654321') {
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

// ================= لوحة التحكم الشاملة (Admin Dashboard) =================

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const studentsRaw = await User.find({});
    const codes = await Code.find({});
    const dbCourses = await Course.find({});

    const students = studentsRaw.map(s => {
        const enrolled = JSON.parse(s.courses || '{}');
        return { ...s._doc, activeCount: Object.keys(enrolled).length };
    });

    res.render('admin', { students, codes, courses: dbCourses });
});

// إدارة الكورسات (إضافة وحذف)
app.post('/admin/add-course', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    const { title, vid, thumb } = req.body;
    await Course.create({ title, vid, thumb: thumb || 'https://via.placeholder.com/300x180' });
    res.redirect('/admin');
});

app.get('/admin/delete-course/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Course.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

// إدارة الطلاب (تصفير وحذف)
app.get('/admin/reset-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndUpdate(req.params.id, { courses: '{}' });
    res.redirect('/admin');
});

app.get('/admin/delete-student/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

// إدارة الأكواد (توليد، حذف فردي، مسح الكل)
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

app.get('/admin/delete-code/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    await Code.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(8080, () => console.log("🚀 Power Platform is Running on 8080"));
